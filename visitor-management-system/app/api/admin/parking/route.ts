import { prisma } from "@/lib/server/prisma";
import { getGuard, isHead } from "@/lib/server/session";
import { ok, fail, sameOrigin } from "@/lib/server/http";
import { hash } from "@node-rs/argon2";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getGuard();
  if (!session || !isHead(session.role)) {
    return fail(403, "HEAD authority required");
  }

  try {
    const [lots, vehicles, barrierLogs, cameraEvents, users, settings, auditLogs] = await Promise.all([
      prisma.parkingLot.findMany({ orderBy: { name: "asc" } }),
      prisma.facultyVehicle.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
              facultyId: true,
              phone: true,
              parkingEligible: true,
              eligibleFrom: true,
              eligibleTill: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.barrierAccessLog.findMany({
        take: 40,
        orderBy: { createdAt: "desc" },
        include: {
          gate: { select: { name: true, code: true } },
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.cameraEventLog.findMany({
        take: 25,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        where: { role: { in: ["STAFF", "HEAD"] } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          department: true,
          facultyId: true,
          phone: true,
          parkingEligible: true,
          eligibleFrom: true,
          eligibleTill: true,
          createdAt: true,
          vehicles: {
            select: {
              id: true,
              plateNumber: true,
              stickerColor: true,
              vehicleType: true,
              modelName: true,
              isActive: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.systemSettings.findUnique({ where: { id: "global" } }),
      prisma.auditLog.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { name: true, email: true } },
        },
      }),
    ]);

    const featureFlags = (settings?.featureFlags as any) || {};
    const cameraAlarmOn = !!featureFlags.cameraAlarmOn;

    const totalCapacity = lots.reduce((acc, l) => acc + l.totalCapacity, 0);
    const totalOccupied = lots.reduce((acc, l) => acc + l.occupied, 0);
    const totalFree = Math.max(0, totalCapacity - totalOccupied);
    const occupancyPercentage = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    return ok({
      stats: {
        totalCapacity,
        totalOccupied,
        totalFree,
        occupancyPercentage,
        totalRegisteredVehicles: vehicles.length,
        activeVehicles: vehicles.filter((v) => v.isActive).length,
        eligibleFacultyCount: users.filter((u) => u.parkingEligible).length,
        cameraAlarmOn,
      },
      lots,
      vehicles,
      users,
      barrierLogs,
      cameraEvents,
      auditLogs,
    });
  } catch (err: any) {
    return fail(500, err?.message || "Failed to fetch parking admin data");
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "Bad origin");

  const session = await getGuard();
  if (!session || !isHead(session.role)) {
    return fail(403, "HEAD authority required");
  }

  try {
    const body = await req.json();
    const { action } = body;

    // 1. Toggle Camera Alarm
    if (action === "TOGGLE_MANUAL_ALARM") {
      const nextState = !!body.nextState;
      const existing = await prisma.systemSettings.findUnique({ where: { id: "global" } });
      const currentFlags = (existing?.featureFlags as any) || {};
      
      await prisma.systemSettings.upsert({
        where: { id: "global" },
        create: {
          id: "global",
          featureFlags: { ...currentFlags, cameraAlarmOn: nextState },
          updatedById: session.userId,
        },
        update: {
          featureFlags: { ...currentFlags, cameraAlarmOn: nextState },
          updatedById: session.userId,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: nextState ? "PARKING_ALARM_ACTIVATED" : "PARKING_ALARM_DEACTIVATED",
          entityType: "CameraSystem",
          entityId: "manual_alarm",
          actorId: session.userId,
          details: { state: nextState ? "ON" : "OFF" },
        },
      });

      return ok({ message: `Camera alarm turned ${nextState ? "ON" : "OFF"}`, isAlarmOn: nextState });
    }

    // 2. Toggle User Permit Eligibility
    if (action === "TOGGLE_USER_PERMIT" && body.userId) {
      const user = await prisma.user.update({
        where: { id: body.userId },
        data: {
          parkingEligible: !!body.parkingEligible,
          ...(body.eligibleFrom !== undefined ? { eligibleFrom: body.eligibleFrom ? new Date(body.eligibleFrom) : null } : {}),
          ...(body.eligibleTill !== undefined ? { eligibleTill: body.eligibleTill ? new Date(body.eligibleTill) : null } : {}),
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "PARKING_PERMIT_UPDATED",
          entityType: "User",
          entityId: user.id,
          actorId: session.userId,
          details: { parkingEligible: user.parkingEligible, userEmail: user.email },
        },
      });

      return ok({ message: `Parking permit updated for ${user.name}`, user });
    }

    // 3. Create Managed User with Vehicle
    if (action === "CREATE_MANAGED_USER") {
      const { email, name, password, department, facultyId, plateNumber, stickerColor, vehicleType } = body;
      if (!email || !name) return fail(400, "Email and name are required");

      const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (existingUser) return fail(400, "A user with this email already exists");

      const passwordHash = await hash(password || "campus123");
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name: name.trim(),
          passwordHash,
          role: "STAFF",
          department: department?.trim() || null,
          facultyId: facultyId?.trim() || null,
          parkingEligible: true,
        },
      });

      if (plateNumber && plateNumber.trim()) {
        await prisma.facultyVehicle.create({
          data: {
            userId: newUser.id,
            plateNumber: plateNumber.toUpperCase().replace(/\s+/g, "").trim(),
            stickerColor: stickerColor || "green",
            vehicleType: vehicleType || "CAR",
            isActive: true,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          action: "STAFF_USER_CREATED",
          entityType: "User",
          entityId: newUser.id,
          actorId: session.userId,
          details: { email: newUser.email, name: newUser.name, plateNumber },
        },
      });

      return ok({ message: `User ${newUser.name} created successfully`, user: newUser });
    }

    // 4. Update User Details
    if (action === "UPDATE_USER_DETAILS" && body.userId) {
      const { name, department, facultyId, parkingEligible, eligibleTill } = body;
      const updatedUser = await prisma.user.update({
        where: { id: body.userId },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(department !== undefined ? { department: department?.trim() || null } : {}),
          ...(facultyId !== undefined ? { facultyId: facultyId?.trim() || null } : {}),
          ...(typeof parkingEligible === "boolean" ? { parkingEligible } : {}),
          ...(eligibleTill !== undefined ? { eligibleTill: eligibleTill ? new Date(eligibleTill) : null } : {}),
        },
      });

      return ok({ message: `User ${updatedUser.name} updated`, user: updatedUser });
    }

    // 5. Add Vehicle to User
    if (action === "ADD_USER_VEHICLE") {
      const { userId, userEmail, plateNumber, stickerColor, vehicleType, modelName } = body;
      let targetUserId = userId;

      if (!targetUserId && userEmail) {
        const u = await prisma.user.findUnique({ where: { email: userEmail.toLowerCase().trim() } });
        if (u) targetUserId = u.id;
      }

      if (!targetUserId || !plateNumber) return fail(400, "User and license plate number are required");

      const cleanPlate = plateNumber.toUpperCase().replace(/\s+/g, "").trim();
      const existingVehicle = await prisma.facultyVehicle.findUnique({ where: { plateNumber: cleanPlate } });
      if (existingVehicle) return fail(400, `Vehicle ${cleanPlate} is already registered on campus`);

      const vehicle = await prisma.facultyVehicle.create({
        data: {
          userId: targetUserId,
          plateNumber: cleanPlate,
          stickerColor: stickerColor || "green",
          vehicleType: vehicleType || "CAR",
          modelName: modelName?.trim() || null,
          isActive: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "VEHICLE_REGISTERED",
          entityType: "FacultyVehicle",
          entityId: vehicle.id,
          actorId: session.userId,
          details: { plateNumber: cleanPlate, userId: targetUserId },
        },
      });

      return ok({ message: `Vehicle ${cleanPlate} registered successfully`, vehicle });
    }

    // 6. Delete Vehicle
    if (action === "DELETE_USER_VEHICLE" && body.vehicleId) {
      const vehicle = await prisma.facultyVehicle.delete({
        where: { id: body.vehicleId },
      });

      await prisma.auditLog.create({
        data: {
          action: "VEHICLE_DELETED",
          entityType: "FacultyVehicle",
          entityId: body.vehicleId,
          actorId: session.userId,
          details: { plateNumber: vehicle.plateNumber },
        },
      });

      return ok({ message: `Vehicle ${vehicle.plateNumber} removed successfully` });
    }

    // 7. Update Vehicle
    if (action === "UPDATE_VEHICLE" && body.vehicleId) {
      const vehicle = await prisma.facultyVehicle.update({
        where: { id: body.vehicleId },
        data: {
          ...(body.stickerColor ? { stickerColor: body.stickerColor } : {}),
          ...(body.vehicleType ? { vehicleType: body.vehicleType } : {}),
          ...(body.modelName !== undefined ? { modelName: body.modelName?.trim() || null } : {}),
          ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "VEHICLE_STATUS_UPDATED",
          entityType: "FacultyVehicle",
          entityId: vehicle.id,
          actorId: session.userId,
          details: { plateNumber: vehicle.plateNumber, isActive: vehicle.isActive, stickerColor: vehicle.stickerColor },
        },
      });

      return ok({ message: `Vehicle ${vehicle.plateNumber} updated`, vehicle });
    }

    // 8. Batch Import from Excel / JSON
    if (action === "BATCH_IMPORT_EXCEL" && Array.isArray(body.items)) {
      let createdCount = 0;
      for (const item of body.items) {
        if (!item.plateNumber) continue;
        const cleanPlate = item.plateNumber.toUpperCase().replace(/\s+/g, "").trim();
        const userEmail = (item.email || "staff1@campus.edu").toLowerCase().trim();

        let user = await prisma.user.findUnique({ where: { email: userEmail } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: userEmail,
              name: item.name || "Faculty Member",
              passwordHash: await hash("campus123"),
              role: "STAFF",
              department: item.department || "Academic Faculty",
              parkingEligible: true,
            },
          });
        }

        const existing = await prisma.facultyVehicle.findUnique({ where: { plateNumber: cleanPlate } });
        if (!existing) {
          await prisma.facultyVehicle.create({
            data: {
              userId: user.id,
              plateNumber: cleanPlate,
              stickerColor: item.stickerColor || "green",
              vehicleType: item.vehicleType || "CAR",
              modelName: item.modelName || null,
              isActive: true,
            },
          });
          createdCount++;
        }
      }

      await prisma.auditLog.create({
        data: {
          action: "EXCEL_BATCH_VEHICLE_IMPORT",
          entityType: "FacultyVehicle",
          actorId: session.userId,
          details: { totalImported: createdCount },
        },
      });

      return ok({ message: `Successfully imported ${createdCount} vehicles into campus allowlist`, count: createdCount });
    }

    return fail(400, "Invalid action or parameters");
  } catch (err: any) {
    return fail(500, err?.message || "Failed to process parking admin action");
  }
}
