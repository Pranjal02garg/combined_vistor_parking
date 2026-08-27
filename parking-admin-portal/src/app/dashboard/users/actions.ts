"use server";

import { getCurrentAuth } from "@/lib/auth/service";
import { getDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth/crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";

export async function updateUserDetailsAction(
  prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") redirect("/login");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "").trim() as "admin" | "user";
  const password = String(formData.get("password") || "").trim();
  const eligibleTillRaw = String(formData.get("eligibleTill") || "").trim();
  
  if (!email || !name) return { error: "Name and email are required." };

  const db = await getDb();
  const existingUser = await db.collection("users").findOne({ email });

  if (!existingUser) return { error: "User not found." };

  const updates: any = {
    name,
    role,
    eligibleTill: eligibleTillRaw ? new Date(eligibleTillRaw) : null,
    updatedAt: new Date(),
  };

  if (password) {
    updates.passwordHash = await hashPassword(password);
  }

  await db.collection("users").updateOne({ email }, { $set: updates });
  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function removeSingleVehicleAction(formData: FormData) {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") return;

  const email = String(formData.get("email") || "");
  const plateNumber = String(formData.get("plateNumber") || "").toUpperCase().replace(/[\s-]+/g, "").trim();

  if (!email || !plateNumber) return;

  const db = await getDb();
  const existingUser = await db.collection("users").findOne({ email });
  if (!existingUser) return;

  const existingCars = existingUser.allowedCars ?? [];
  const matchedCar = existingCars.find((car: any) => 
    String(car.plateNumber || "").toUpperCase().replace(/[\s-]+/g, "").trim() === plateNumber
  );

  if (!matchedCar) return;

  const updatedCars = existingCars.filter((car: any) => 
    String(car.plateNumber || "").toUpperCase().replace(/[\s-]+/g, "").trim() !== plateNumber
  );

  await db.collection("users").updateOne(
    { _id: existingUser._id },
    { $set: { allowedCars: updatedCars, updatedAt: new Date() } }
  );

  const changeDoc = {
    "car number": matchedCar.plateNumber,
    action: "delete",
    userId: existingUser._id,
    userEmail: existingUser.email,
    timestamp: new Date(),
  };

  await db.collection("car_changes").insertOne({ ...changeDoc });
  await db.collection("system_logs").insertOne({ ...changeDoc });

  revalidatePath("/dashboard/users");
}

export async function addSingleVehicleAction(formData: FormData) {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") return;

  const email = String(formData.get("email") || "");
  const plateNumber = String(formData.get("plateNumber") || "").toUpperCase().replace(/\s+/g, "").trim();
  const stickerColor = String(formData.get("stickerColor") || "green").trim();

  if (!email || !plateNumber) return;

  const db = await getDb();
  const existingUser = await db.collection("users").findOne({ email });
  if (!existingUser) return;

  const alreadyExists = (existingUser.allowedCars ?? []).some(
    (car: any) => car.plateNumber === plateNumber
  );

  if (alreadyExists) return;

  await db.collection("users").updateOne(
    { _id: existingUser._id },
    {
      $set: {
        allowedCars: [...(existingUser.allowedCars ?? []), { plateNumber, stickerColor, isActive: true }],
        updatedAt: new Date(),
      },
    }
  );

  const changeDoc = {
    "car number": plateNumber,
    action: "add",
    userId: existingUser._id,
    userEmail: existingUser.email,
    timestamp: new Date(),
  };

  await db.collection("car_changes").insertOne({ ...changeDoc });
  await db.collection("system_logs").insertOne({ ...changeDoc });

  revalidatePath("/dashboard/users");
}

export async function toggleVehicleStatus(formData: FormData) {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") return;

  const email = String(formData.get("email") || "");
  const plateNumber = String(formData.get("plateNumber") || "").toUpperCase().replace(/[\s-]+/g, "").trim();
  const nextStatus = String(formData.get("nextStatus") || "") === "true";

  if (!email || !plateNumber) return;

  const db = await getDb();
  const user = await db.collection("users").findOne({ email });
  if (!user) return;

  const existingCars = user.allowedCars ?? [];
  const matchedCarIndex = existingCars.findIndex((car: any) => 
    String(car.plateNumber || "").toUpperCase().replace(/[\s-]+/g, "").trim() === plateNumber
  );

  if (matchedCarIndex === -1) return;

  existingCars[matchedCarIndex].isActive = nextStatus;

  await db.collection("users").updateOne(
    { _id: user._id },
    { $set: { allowedCars: existingCars, updatedAt: new Date() } }
  );

  if (user.isActive && user.parkingEligible) {
    const changeDoc = {
      "car number": existingCars[matchedCarIndex].plateNumber,
      action: nextStatus ? "add" : "delete",
      userId: user._id,
      userEmail: user.email,
      timestamp: new Date(),
    };
    await db.collection("car_changes").insertOne({ ...changeDoc });
    await db.collection("system_logs").insertOne({ ...changeDoc });
  }

  revalidatePath("/dashboard/users");
}

export async function createManagedUser(
  prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData,
) {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") redirect("/login");

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const parkingEligible = formData.get("parkingEligible") === "on";

  if (!name || !email || !password) return { error: "Name, email, and password are required." };

  const db = await getDb();
  const existingUser = await db.collection("users").findOne({ email });
  if (existingUser) return { error: "A user with this email already exists." };

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const insertedId = new ObjectId();
  
  const userDoc = {
    _id: insertedId,
    name,
    department: null,
    faculty_id: null,
    phone: null,
    alternateContact: null,
    email,
    passwordHash,
    role: "user",
    isActive: true,
    parkingEligible,
    eligibleFrom: null,
    eligibleTill: null,
    allowedCars: [],
    failedLoginAttempts: 0,
    lockUntil: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("users").insertOne(userDoc);
  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function toggleUserStatus(formData: FormData) {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") redirect("/login");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const nextStatus = String(formData.get("nextStatus") || "") === "true";
  if (!email || email === auth.user.email) return;

  const db = await getDb();
  const user = await db.collection("users").findOne({ email });
  if (!user) return;

  await db.collection("users").updateOne({ email }, { $set: { isActive: nextStatus, updatedAt: new Date() } });

  const cars = user.allowedCars ?? [];
  const activeCars = cars.filter((c: any) => c.isActive !== false);

  if (activeCars.length > 0) {
    const changes = activeCars.map((car: any) => ({
      "car number": car.plateNumber,
      action: nextStatus && user.parkingEligible ? "add" : "delete",
      userId: user._id,
      userEmail: user.email,
      timestamp: new Date(),
    }));

    if (!nextStatus || (nextStatus && user.parkingEligible)) {
      // Need to stringify/parse to clone or map over them to avoid modifying original reference if driver does it
      const systemLogs = changes.map((c: any) => ({ ...c }));
      const carChanges = changes.map((c: any) => ({ ...c }));
      
      await db.collection("car_changes").insertMany(carChanges);
      await db.collection("system_logs").insertMany(systemLogs);
    }
  }

  revalidatePath("/dashboard/users");
}

export async function toggleParkingAccess(formData: FormData) {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") redirect("/login");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const nextAccess = String(formData.get("nextAccess") || "") === "true";
  if (!email) return;

  const db = await getDb();
  const user = await db.collection("users").findOne({ email });
  if (!user) return;

  await db.collection("users").updateOne({ email }, { $set: { parkingEligible: nextAccess, updatedAt: new Date() } });

  const cars = user.allowedCars ?? [];
  const activeCars = cars.filter((c: any) => c.isActive !== false);

  if (activeCars.length > 0) {
    const changes = activeCars.map((car: any) => ({
      "car number": car.plateNumber,
      action: nextAccess && user.isActive ? "add" : "delete",
      userId: user._id,
      userEmail: user.email,
      timestamp: new Date(),
    }));

    if (!nextAccess || (nextAccess && user.isActive)) {
      const systemLogs = changes.map((c: any) => ({ ...c }));
      const carChanges = changes.map((c: any) => ({ ...c }));
      
      await db.collection("car_changes").insertMany(carChanges);
      await db.collection("system_logs").insertMany(systemLogs);
    }
  }

  revalidatePath("/dashboard/users");
}

export async function getSystemLogsAction() {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") redirect("/login");

  const db = await getDb();
  // Fetch from the permanent audit log, not the ephemeral queue!
  const logs = await db.collection("system_logs")
    .find({})
    .sort({ timestamp: -1 })
    .limit(100)
    .toArray();
    
  return logs.map(log => ({
    _id: log._id.toString(),
    action: log.action,
    carNumber: log["car number"],
    userEmail: log.userEmail,
    timestamp: log.timestamp ? new Date(log.timestamp).toISOString() : null
  }));
}
