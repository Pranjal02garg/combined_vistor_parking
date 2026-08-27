import { NextRequest } from "next/server";

import { hashPassword } from "@/lib/auth/crypto";
import {
  createUser,
  findUserByEmail,
  getCurrentAuth,
} from "@/lib/auth/service";
import { getDb } from "@/lib/mongodb";
import { jsonNoStore } from "@/lib/http/response";

export async function GET(): Promise<Response> {
  const auth = await getCurrentAuth();

  if (!auth || auth.user.role !== "admin") {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const users = await db
      .collection("users")
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    return jsonNoStore({ users }, { status: 200 });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return jsonNoStore({ error: "Failed to fetch users." }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const auth = await getCurrentAuth();

    if (!auth || auth.user.role !== "admin") {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "").trim();
    const role = body.role === "admin" ? "admin" : "user";
    const parkingEligible = Boolean(body.parkingEligible);
    const eligibleFrom = body.eligibleFrom ? new Date(body.eligibleFrom) : null;
    const eligibleTill = body.eligibleTill ? new Date(body.eligibleTill) : null;

    if (!name || !email || !password) {
      return jsonNoStore(
        { error: "Name, email, and password are required." },
        { status: 400 },
      );
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return jsonNoStore(
        { error: "A user with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(name, email, passwordHash, role);

    const db = await getDb();
    await db.collection("users").updateOne(
      { email },
      {
        $set: {
          parkingEligible,
          eligibleFrom,
          eligibleTill,
          updatedAt: new Date(),
        },
      },
    );

    const updatedUser = await db
      .collection("users")
      .findOne({ email }, { projection: { passwordHash: 0 } });

    return jsonNoStore(
      {
        message: "User created successfully.",
        user: updatedUser ?? user,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/users error:", error);
    return jsonNoStore({ error: "Failed to create user." }, { status: 500 });
  }
}
