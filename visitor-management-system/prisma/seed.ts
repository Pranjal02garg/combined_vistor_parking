import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { CATEGORIES } from "../lib/categories";

// Seeds the 4 gates plus demo staff. Passwords here are for local demo ONLY —
// rotate/replace before any real deployment.
const prisma = new PrismaClient();

// Self-contained demo avatar. Previously these were images.unsplash.com URLs,
// which broke the console with 404/DNS errors whenever the machine was offline
// or on a restricted network. A data URI always renders.
const DEMO_AVATAR =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
      "<rect width='100' height='100' fill='#f2ead9'/>" +
      "<circle cx='50' cy='38' r='17' fill='#7a1f2b'/>" +
      "<path d='M18 92c0-17.5 14-29 32-29s32 11.5 32 29z' fill='#7a1f2b'/>" +
      "</svg>"
  );

// Seed the dynamic form config from the original hardcoded categories, so the
// DB-driven intake form starts with the existing 8 categories. Idempotent.
async function seedForms() {
  for (let ci = 0; ci < CATEGORIES.length; ci++) {
    const c = CATEGORIES[ci];
    const key = c.id.toUpperCase(); // matches VisitLog.category snapshots
    const isDeliveryOrVendor = key === "DELIVERY" || key === "VENDOR" || key === "DELIVERY_VENDOR";
    const overstayMinutes = isDeliveryOrVendor ? 120 : null;

    const category = await prisma.formCategory.upsert({
      where: { key },
      update: { label: c.label, description: c.description, icon: c.icon, sortOrder: ci, overstayMinutes },
      create: { key, label: c.label, description: c.description, icon: c.icon, sortOrder: ci, overstayMinutes },
    });

    for (let fi = 0; fi < c.fields.length; fi++) {
      const f = c.fields[fi];
      const field = await prisma.formField.upsert({
        where: { categoryId_name: { categoryId: category.id, name: f.name } },
        update: {
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder ?? null,
          pattern: f.pattern ?? null,
          maxLength: f.maxLength ?? null,
          sortOrder: fi,
          requiredWhenField: f.requiredWhen?.field ?? null,
          requiredWhenValue: f.requiredWhen?.value ?? null,
        },
        create: {
          categoryId: category.id,
          name: f.name,
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder ?? null,
          pattern: f.pattern ?? null,
          maxLength: f.maxLength ?? null,
          sortOrder: fi,
          requiredWhenField: f.requiredWhen?.field ?? null,
          requiredWhenValue: f.requiredWhen?.value ?? null,
        },
      });

      // Reset options to match the config (idempotent).
      await prisma.fieldOption.deleteMany({ where: { fieldId: field.id } });
      if (f.options?.length) {
        await prisma.fieldOption.createMany({
          data: f.options.map((opt, oi) => ({
            fieldId: field.id,
            value: opt,
            label: opt,
            sortOrder: oi,
          })),
        });
      }
    }
  }
}

async function main() {
  console.log("🧹 Clearing old test database cache and records...");

  // Clear existing operational records for a fresh demo
  await prisma.auditLog.deleteMany({});
  await prisma.incidentLog.deleteMany({});
  await prisma.broadcastLog.deleteMany({});
  await prisma.staffHouseHelp.deleteMany({});
  await prisma.houseHelp.deleteMany({});
  await prisma.vIPPass.deleteMany({});
  await prisma.visitLog.deleteMany({});
  await prisma.blacklist.deleteMany({});
  await prisma.visitor.deleteMany({});

  console.log("🏛️ Seeding Campus Gates...");
  const gates = [];
  for (const code of ["1", "2", "3", "4"]) {
    const gate = await prisma.gate.upsert({
      where: { code },
      update: { name: `Main Gate ${code}`, location: `Thapar Campus - Gate ${code}` },
      create: { code, name: `Main Gate ${code}`, location: `Thapar Campus - Gate ${code}` },
    });
    gates.push(gate);
  }

  console.log("👤 Seeding Official Roles (Head, Staff, Guards)...");
  const defaultPassHash = await hash("123456");
  const adminPassHash = await hash("admin123");
  const staffPassHash = await hash("staff123");

  const headUser = await prisma.user.upsert({
    where: { email: "admin@campus.edu" },
    update: { name: "Col. Sanjeev Bakshi (Chief Security Officer)", passwordHash: adminPassHash, role: "HEAD" },
    create: {
      email: "admin@campus.edu",
      name: "Col. Sanjeev Bakshi (Chief Security Officer)",
      passwordHash: adminPassHash,
      role: "HEAD",
      gates: { connect: gates.map((g) => ({ id: g.id })) },
    },
  });

  const staffUser1 = await prisma.user.upsert({
    where: { email: "staff1@campus.edu" },
    update: { name: "Prof. Rajesh Sharma (HOD, Computer Science)", passwordHash: staffPassHash, role: "STAFF" },
    create: {
      email: "staff1@campus.edu",
      name: "Prof. Rajesh Sharma (HOD, Computer Science)",
      passwordHash: staffPassHash,
      role: "STAFF",
    },
  });

  const staffUser2 = await prisma.user.upsert({
    where: { email: "prof.kaur@thapar.edu" },
    update: { name: "Dr. Simran Kaur (Dean, Student Affairs)", passwordHash: staffPassHash, role: "STAFF" },
    create: {
      email: "prof.kaur@thapar.edu",
      name: "Dr. Simran Kaur (Dean, Student Affairs)",
      passwordHash: staffPassHash,
      role: "STAFF",
    },
  });

  const guard1 = await prisma.user.upsert({
    where: { email: "gate1@campus.edu" },
    update: { name: "Officer Jaswinder Singh (Gate 1)", passwordHash: defaultPassHash, role: "GUARD" },
    create: {
      email: "gate1@campus.edu",
      name: "Officer Jaswinder Singh (Gate 1)",
      passwordHash: defaultPassHash,
      role: "GUARD",
      gates: { connect: [{ id: gates[0].id }] },
    },
  });

  const guard2 = await prisma.user.upsert({
    where: { email: "gate2@campus.edu" },
    update: { name: "Officer Harpreet Singh (Gate 2)", passwordHash: defaultPassHash, role: "GUARD" },
    create: {
      email: "gate2@campus.edu",
      name: "Officer Harpreet Singh (Gate 2)",
      passwordHash: defaultPassHash,
      role: "GUARD",
      gates: { connect: [{ id: gates[1].id }] },
    },
  });

  await seedForms();
  await prisma.systemSettings.upsert({
    where: { id: "global" },
    update: { overstayMinutes: 120, defaulterThreshold: 3 },
    create: { id: "global", overstayMinutes: 120, defaulterThreshold: 3 },
  });

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const twentyMinsAgo = new Date(now.getTime() - 20 * 60 * 1000);
  const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  console.log("🎫 Seeding Official VIP Passes...");
  // 1. VIP Pass - Approved & Scannable Live
  await prisma.vIPPass.create({
    data: {
      token: "GST-VIP-CHANCELLOR",
      guestName: "Sh. Ratan Tata Memorial Conclave Chief Guest",
      guestPhone: "9876543210",
      purpose: "Convocation Ceremony 2026 - Chief Guest of Honour",
      vehicleNumber: "PB11-VIP-0001",
      status: "APPROVED",
      hostStaffId: staffUser1.id,
      approvedById: headUser.id,
      approvedAt: oneHourAgo,
      validFrom: twoHoursAgo,
      validUntil: thirtyDaysLater,
    },
  });

  // 2. VIP Pass - Checked in & Active on Campus
  await prisma.vIPPass.create({
    data: {
      token: "GST-VIP-TECH-DIR",
      guestName: "Ms. Sunita Reddy (Managing Director, Google Cloud India)",
      guestPhone: "9812345678",
      purpose: "Campus Placement Drive & AI Innovation Lab Inauguration",
      vehicleNumber: "CH01-GA-7700",
      status: "CHECKED_IN",
      hostStaffId: staffUser1.id,
      approvedById: headUser.id,
      approvedAt: twoHoursAgo,
      scannedById: guard1.id,
      entryGateId: gates[0].id,
      enteredAt: oneHourAgo,
      validFrom: twoHoursAgo,
      validUntil: thirtyDaysLater,
      onDutyGuard: "Officer Jaswinder Singh",
    },
  });

  // 3. VIP Pass - Pending Head Approval (To show 1-tap Approve in /head)
  await prisma.vIPPass.create({
    data: {
      token: "GST-VIP-BOG-MEMBER",
      guestName: "Dr. Arvind Subramanian (External Examiner, IIT Delhi)",
      guestPhone: "9823456789",
      purpose: "PhD Defense Review & Academic Council Meeting",
      vehicleNumber: "HR26-DX-9900",
      status: "PENDING",
      hostStaffId: staffUser1.id,
      validFrom: now,
      validUntil: tomorrow,
    },
  });

  console.log("🧹 Seeding House Help & Daily Staff Passes...");
  // 1. House Maid (Approved & Linked to Prof. Sharma)
  const maid1 = await prisma.houseHelp.create({
    data: {
      token: "HLP-MAID-SUNITA",
      name: "Sunita Devi",
      phone: "9876500111",
      serviceType: "MAID",
      status: "APPROVED",
      registeredById: staffUser1.id,
      approvedById: headUser.id,
      approvedAt: twoHoursAgo,
      idProofType: "AADHAAR",
      idProofNumber: "9102-8812-4410",
      photoUrl: DEMO_AVATAR,
    },
  });

  await prisma.staffHouseHelp.create({
    data: {
      staffId: staffUser1.id,
      houseHelpId: maid1.id,
      quarterNumber: "Faculty Residence B-104",
      validUntil: thirtyDaysLater,
      isActive: true,
    },
  });

  // 2. Cook (Approved & Linked to Prof. Sharma)
  const cook1 = await prisma.houseHelp.create({
    data: {
      token: "HLP-COOK-RAMESH",
      name: "Ramesh Kumar",
      phone: "9876500222",
      serviceType: "COOK",
      status: "APPROVED",
      registeredById: staffUser1.id,
      approvedById: headUser.id,
      approvedAt: twoHoursAgo,
      idProofType: "AADHAAR",
      idProofNumber: "4521-8890-1123",
      photoUrl: DEMO_AVATAR,
    },
  });

  await prisma.staffHouseHelp.create({
    data: {
      staffId: staffUser1.id,
      houseHelpId: cook1.id,
      quarterNumber: "Faculty Residence B-104",
      validUntil: thirtyDaysLater,
      isActive: true,
    },
  });

  // 3. Driver (Pending Head Verification)
  const driver1 = await prisma.houseHelp.create({
    data: {
      token: "HLP-DRIVER-JASBIR",
      name: "Jasbir Singh",
      phone: "9876500333",
      serviceType: "DRIVER",
      status: "PENDING_APPROVAL",
      registeredById: staffUser1.id,
      idProofType: "DRIVING_LICENSE",
      idProofNumber: "PB11-2018-0091823",
      photoUrl: DEMO_AVATAR,
    },
  });

  await prisma.staffHouseHelp.create({
    data: {
      staffId: staffUser1.id,
      houseHelpId: driver1.id,
      quarterNumber: "Faculty Residence B-104",
      validUntil: thirtyDaysLater,
      isActive: true,
    },
  });

  console.log("🚗 Seeding Active Live Gate Feed Visits...");
  const visitor1 = await prisma.visitor.create({
    data: {
      name: "Vikram Malhotra",
      phone: "9876543210",
      visitCount: 3,
      overstayCount: 0,
      lastVisitAt: new Date(),
    },
  });

  const visitor2 = await prisma.visitor.create({
    data: {
      name: "Rohit Verma (Zomato Delivery)",
      phone: "9823456789",
      visitCount: 14,
      overstayCount: 0,
      lastVisitAt: new Date(),
    },
  });

  const visitor3 = await prisma.visitor.create({
    data: {
      name: "Simran Kaur (Uber Commercial)",
      phone: "9834567890",
      visitCount: 6,
      overstayCount: 0,
      lastVisitAt: new Date(),
    },
  });

  const visitor4 = await prisma.visitor.create({
    data: {
      name: "Civil Works Contractor (M/S BuildTech)",
      phone: "9845678901",
      visitCount: 9,
      overstayCount: 2,
      lastVisitAt: new Date(),
    },
  });

  // Visit 1: PENDING at Gate 1 (Parent visit)
  await prisma.visitLog.create({
    data: {
      referenceCode: "VMS-992140",
      category: "PARENT",
      categoryLabel: "Parent / Guardian",
      visitorId: visitor1.id,
      entryGateId: gates[0].id,
      vehicleNumber: "PB11-CB-4521",
      phoneVerified: true,
      selfieUrl: DEMO_AVATAR,
      status: "PENDING",
      createdAt: fiveMinsAgo,
      details: { studentName: "Aarav Malhotra", rollNumber: "102103456", hostel: "Hostel J", purpose: "Visiting Student" },
      fieldsSnapshot: [
        { label: "Student Name", value: "Aarav Malhotra" },
        { label: "Roll Number", value: "102103456" },
        { label: "Hostel", value: "Hostel J" },
      ],
    },
  });

  // Visit 2: APPROVED & Inside (Delivery)
  await prisma.visitLog.create({
    data: {
      referenceCode: "VMS-881230",
      category: "DELIVERY",
      categoryLabel: "Delivery & Courier",
      visitorId: visitor2.id,
      entryGateId: gates[0].id,
      vehicleNumber: "PB10-EZ-3312",
      phoneVerified: true,
      selfieUrl: DEMO_AVATAR,
      status: "APPROVED",
      createdAt: twentyMinsAgo,
      approvedAt: twentyMinsAgo,
      decidedById: guard1.id,
      onDutyGuard: "Officer Jaswinder Singh",
      details: { company: "Zomato Food Delivery", orderNumber: "ZOM-88219", hostelBlock: "Hostel K" },
      fieldsSnapshot: [
        { label: "Company", value: "Zomato" },
        { label: "Drop Location", value: "Hostel K" },
      ],
    },
  });

  // Visit 3: APPROVED & Inside (Commercial Cab)
  await prisma.visitLog.create({
    data: {
      referenceCode: "VMS-771450",
      category: "CAB",
      categoryLabel: "Commercial Taxi / Auto",
      visitorId: visitor3.id,
      entryGateId: gates[1].id,
      vehicleNumber: "PB65-AT-7822",
      phoneVerified: true,
      selfieUrl: DEMO_AVATAR,
      status: "APPROVED",
      createdAt: oneHourAgo,
      approvedAt: oneHourAgo,
      decidedById: guard2.id,
      onDutyGuard: "Officer Harpreet Singh",
      details: { cabAggregator: "Uber Commercial", destination: "Main Administrative Building" },
      fieldsSnapshot: [
        { label: "Aggregator", value: "Uber" },
        { label: "Destination", value: "Admin Block" },
      ],
    },
  });

  // Visit 4: Overstay Alert (Civil Contractor)
  await prisma.visitLog.create({
    data: {
      referenceCode: "VMS-661920",
      category: "VENDOR",
      categoryLabel: "Contractor & Maintenance",
      visitorId: visitor4.id,
      entryGateId: gates[0].id,
      vehicleNumber: "PB11-CN-8800",
      phoneVerified: true,
      selfieUrl: DEMO_AVATAR,
      status: "APPROVED",
      createdAt: threeHoursAgo,
      approvedAt: threeHoursAgo,
      decidedById: guard1.id,
      onDutyGuard: "Officer Jaswinder Singh",
      details: { contractorCompany: "M/S BuildTech Patiala", workLocation: "Auditorium Renovation Site" },
      fieldsSnapshot: [
        { label: "Company", value: "M/S BuildTech" },
        { label: "Work Zone", value: "Auditorium" },
      ],
    },
  });

  console.log("📢 Seeding Campus Broadcast & Security Watchlist...");
  await prisma.broadcastLog.create({
    data: {
      message: "📢 Convocation 2026: VIP convoy movement active at Main Gate 1. All security units maintain clear fast-track lane.",
      priority: "high",
      sentById: headUser.id,
    },
  });

  console.log("🅿️ Seeding Smart Parking Lots & Faculty Vehicles...");
  await prisma.barrierAccessLog.deleteMany({});
  await prisma.cameraEventLog.deleteMany({});
  await prisma.facultyVehicle.deleteMany({});
  await prisma.parkingLot.deleteMany({});

  const lotS4 = await prisma.parkingLot.create({
    data: {
      name: "Faculty Lot S4 (South Zone)",
      code: "LOT_S4",
      zone: "S4",
      totalCapacity: 50,
      occupied: 24,
      reservedFaculty: 30,
    },
  });

  const lotAdmin = await prisma.parkingLot.create({
    data: {
      name: "Main Administrative Lot",
      code: "LOT_ADMIN",
      zone: "ADMIN",
      totalCapacity: 35,
      occupied: 18,
      reservedFaculty: 20,
    },
  });

  const lotE4 = await prisma.parkingLot.create({
    data: {
      name: "Engineering & Computing Lot E4",
      code: "LOT_E4",
      zone: "E4",
      totalCapacity: 60,
      occupied: 38,
      reservedFaculty: 35,
    },
  });

  // Seed Faculty Vehicles
  const vehicle1 = await prisma.facultyVehicle.create({
    data: {
      userId: staffUser1.id,
      plateNumber: "PB11BH8820",
      stickerColor: "green",
      vehicleType: "CAR",
      modelName: "Honda City (Pearl White)",
      isActive: true,
    },
  });

  const vehicle2 = await prisma.facultyVehicle.create({
    data: {
      userId: staffUser1.id,
      plateNumber: "PB10AB1234",
      stickerColor: "blue",
      vehicleType: "CAR",
      modelName: "Tata Nexon EV (Blue)",
      isActive: true,
    },
  });

  const vehicle3 = await prisma.facultyVehicle.create({
    data: {
      userId: staffUser2.id,
      plateNumber: "CH01AR9999",
      stickerColor: "green",
      vehicleType: "CAR",
      modelName: "Toyota Fortuner (Black)",
      isActive: true,
    },
  });

  // Seed Barrier Access Logs
  await prisma.barrierAccessLog.create({
    data: {
      userId: staffUser1.id,
      vehicleId: vehicle1.id,
      gateId: gates[0].id,
      plateNumber: "PB11BH8820",
      action: "BARRIER_OPEN",
      method: "ANPR",
      status: "SUCCESS",
      createdAt: twentyMinsAgo,
    },
  });

  await prisma.barrierAccessLog.create({
    data: {
      userId: staffUser2.id,
      vehicleId: vehicle3.id,
      gateId: gates[1].id,
      plateNumber: "CH01AR9999",
      action: "BARRIER_OPEN",
      method: "GATE_QR_SCAN",
      status: "SUCCESS",
      createdAt: fiveMinsAgo,
    },
  });

  // Seed ANPR Live Camera Events
  await prisma.cameraEventLog.create({
    data: {
      gateId: gates[0].id,
      plateNumber: "PB11BH8820",
      cameraType: "ENTRY",
      confidence: 0.98,
      matched: true,
      createdAt: twentyMinsAgo,
    },
  });

  await prisma.cameraEventLog.create({
    data: {
      gateId: gates[1].id,
      plateNumber: "PB10AB1234",
      cameraType: "ENTRY",
      confidence: 0.96,
      matched: true,
      createdAt: fiveMinsAgo,
    },
  });

  console.log("✨ Demo Database Seeding Completed Successfully!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
