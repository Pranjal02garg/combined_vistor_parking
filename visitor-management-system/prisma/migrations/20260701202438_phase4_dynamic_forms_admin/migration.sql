/*
  Warnings:

  - Changed the type of `category` on the `VisitLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "VIPPass" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" TEXT;

-- AlterTable
ALTER TABLE "VisitLog" ADD COLUMN     "categoryLabel" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" TEXT,
ADD COLUMN     "fieldsSnapshot" JSONB;

-- Convert `category` from the VisitorCategory enum to TEXT, preserving existing values.
ALTER TABLE "VisitLog" ALTER COLUMN "category" TYPE TEXT USING "category"::text;

-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN     "overstayCount" INTEGER NOT NULL DEFAULT 0;

-- DropEnum
DROP TYPE "VisitorCategory";

-- CreateTable
CREATE TABLE "FormCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormField" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "placeholder" TEXT,
    "pattern" TEXT,
    "maxLength" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiredWhenField" TEXT,
    "requiredWhenValue" TEXT,

    CONSTRAINT "FormField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldOption" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "overstayMinutes" INTEGER NOT NULL DEFAULT 120,
    "defaulterThreshold" INTEGER NOT NULL DEFAULT 3,
    "featureFlags" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blacklist" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "reason" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormCategory_key_key" ON "FormCategory"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FormField_categoryId_name_key" ON "FormField"("categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Blacklist_phone_key" ON "Blacklist"("phone");

-- CreateIndex
CREATE INDEX "Blacklist_phone_active_idx" ON "Blacklist"("phone", "active");

-- NOTE: index "VisitLog_createdAt_status_category_idx" already exists and is preserved by the
-- in-place `category` type cast above, so it is intentionally NOT recreated here.

-- AddForeignKey
ALTER TABLE "FormField" ADD CONSTRAINT "FormField_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FormCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldOption" ADD CONSTRAINT "FieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "FormField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
