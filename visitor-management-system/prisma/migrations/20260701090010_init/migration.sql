-- CreateEnum
CREATE TYPE "Role" AS ENUM ('GUARD', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'EXITED');

-- CreateEnum
CREATE TYPE "VisitorCategory" AS ENUM ('PARENT', 'DELIVERY_VENDOR', 'TAXI', 'CONTRACTOR', 'OFFICIAL', 'STAFF', 'RESIDENT', 'OTHERS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'GUARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitLog" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "category" "VisitorCategory" NOT NULL,
    "details" JSONB NOT NULL,
    "selfieUrl" TEXT NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'PENDING',
    "vehicleNumber" TEXT,
    "visitorId" TEXT NOT NULL,
    "entryGateId" TEXT NOT NULL,
    "exitGateId" TEXT,
    "decidedById" TEXT,
    "exitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),

    CONSTRAINT "VisitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GateStaff" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_GateStaff_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_code_key" ON "Gate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_name_key" ON "Gate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Visitor_phone_key" ON "Visitor"("phone");

-- CreateIndex
CREATE INDEX "Visitor_name_idx" ON "Visitor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VisitLog_referenceCode_key" ON "VisitLog"("referenceCode");

-- CreateIndex
CREATE INDEX "VisitLog_status_entryGateId_idx" ON "VisitLog"("status", "entryGateId");

-- CreateIndex
CREATE INDEX "VisitLog_status_idx" ON "VisitLog"("status");

-- CreateIndex
CREATE INDEX "VisitLog_vehicleNumber_idx" ON "VisitLog"("vehicleNumber");

-- CreateIndex
CREATE INDEX "VisitLog_visitorId_idx" ON "VisitLog"("visitorId");

-- CreateIndex
CREATE INDEX "_GateStaff_B_index" ON "_GateStaff"("B");

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_entryGateId_fkey" FOREIGN KEY ("entryGateId") REFERENCES "Gate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_exitGateId_fkey" FOREIGN KEY ("exitGateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_exitedById_fkey" FOREIGN KEY ("exitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GateStaff" ADD CONSTRAINT "_GateStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "Gate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GateStaff" ADD CONSTRAINT "_GateStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
