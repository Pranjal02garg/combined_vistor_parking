import { redirect } from "next/navigation";
import { getCurrentAuth } from "@/lib/auth/service";
import { getDb } from "@/lib/mongodb";
import UsersView from "./users-view";
import {
  toggleUserStatus,
  toggleParkingAccess,
  removeSingleVehicleAction,
  addSingleVehicleAction,
  updateUserDetailsAction,
  createManagedUser,
  toggleVehicleStatus,
} from "./actions";

export default async function UsersPage() {
  const auth = await getCurrentAuth();
  if (!auth || auth.user.role !== "admin") {
    redirect("/login");
  }

  const db = await getDb();
  const users = await db
    .collection("users")
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  const serializedUsers = users.map((user) => ({
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    parkingEligible: user.parkingEligible,
    eligibleFrom: user.eligibleFrom ? new Date(user.eligibleFrom).toISOString() : null,
    eligibleTill: user.eligibleTill ? new Date(user.eligibleTill).toISOString() : null,
    allowedCars: user.allowedCars ?? [],
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
    updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
  }));

  const actions = {
    toggleUserStatus,
    toggleParkingAccess,
    removeSingleVehicle: removeSingleVehicleAction,
    addSingleVehicle: addSingleVehicleAction,
    updateUserDetails: updateUserDetailsAction,
    createManagedUser,
    toggleVehicleStatus,
  };

  return (
    <UsersView
      users={serializedUsers as any}
      authEmail={auth.user.email}
      actions={actions}
    />
  );
}
