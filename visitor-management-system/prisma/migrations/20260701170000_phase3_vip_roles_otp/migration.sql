-- CreateEnum
CREATE TYPE "VIPPassStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_IN', 'EXITED', 'EXPIRED');

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('HEAD', 'GUARD', 'STAFF');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'GUARD';
COMMIT;

-- AlterTable
ALTER TABLE "VisitLog" ADD COLUMN     "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VIPPass" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "vehicleNumber" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "status" "VIPPassStatus" NOT NULL DEFAULT 'PENDING',
    "hostStaffId" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "scannedById" TEXT,
    "entryGateId" TEXT,
    "exitGateId" TEXT,
    "enteredAt" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VIPPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VIPPass_token_key" ON "VIPPass"("token");

-- CreateIndex
CREATE INDEX "VIPPass_status_idx" ON "VIPPass"("status");

-- CreateIndex
CREATE INDEX "VIPPass_hostStaffId_idx" ON "VIPPass"("hostStaffId");

-- CreateIndex
CREATE INDEX "VIPPass_enteredAt_status_idx" ON "VIPPass"("enteredAt", "status");

-- CreateIndex
CREATE INDEX "VIPPass_validFrom_validUntil_status_idx" ON "VIPPass"("validFrom", "validUntil", "status");

-- CreateIndex
CREATE INDEX "VisitLog_createdAt_status_category_idx" ON "VisitLog"("createdAt", "status", "category");

-- CreateIndex
CREATE INDEX "VisitLog_status_exitedAt_idx" ON "VisitLog"("status", "exitedAt");

-- CreateIndex
CREATE INDEX "VisitLog_entryGateId_createdAt_idx" ON "VisitLog"("entryGateId", "createdAt");

-- AddForeignKey
ALTER TABLE "VIPPass" ADD CONSTRAINT "VIPPass_hostStaffId_fkey" FOREIGN KEY ("hostStaffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VIPPass" ADD CONSTRAINT "VIPPass_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VIPPass" ADD CONSTRAINT "VIPPass_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VIPPass" ADD CONSTRAINT "VIPPass_entryGateId_fkey" FOREIGN KEY ("entryGateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VIPPass" ADD CONSTRAINT "VIPPass_exitGateId_fkey" FOREIGN KEY ("exitGateId") REFERENCES "Gate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

