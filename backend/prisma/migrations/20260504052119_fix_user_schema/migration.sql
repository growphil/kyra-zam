/*
  Warnings:

  - The values [REPAIRED] on the enum `PaxStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [TECHNICIAN] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `AuditLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `changedAt` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `logId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `previousStatus` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `cycleCount` on the `Cell` table. All the data in the column will be lost.
  - You are about to alter the column `voltage` on the `Cell` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `ahValue` on the `Cell` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to alter the column `irValue` on the `Cell` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the column `paxType` on the `PaxPack` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Sale` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `DoublePrecision`.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - Added the required column `action` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `AuditLog` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `cycles` to the `Cell` table without a default value. This is not possible if the table is not empty.
  - Made the column `voltage` on table `Cell` required. This step will fail if there are existing NULL values in that column.
  - Made the column `category` on table `Cell` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `paxTypeId` to the `PaxPack` table without a default value. This is not possible if the table is not empty.
  - Made the column `diagnosisNotes` on table `Repair` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `createdBy` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paxTypeName` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaxStatus_new" AS ENUM ('PAX_ASSEMBLED', 'PAX_TESTED', 'READY_FOR_SALE', 'UNDER_REPAIR', 'SOLD_TO_VENDOR', 'SOLD_TO_CUSTOMER', 'SCRAPPED');
ALTER TABLE "PaxPack" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PaxPack" ALTER COLUMN "status" TYPE "PaxStatus_new" USING ("status"::text::"PaxStatus_new");
ALTER TYPE "PaxStatus" RENAME TO "PaxStatus_old";
ALTER TYPE "PaxStatus_new" RENAME TO "PaxStatus";
DROP TYPE "PaxStatus_old";
ALTER TABLE "PaxPack" ALTER COLUMN "status" SET DEFAULT 'PAX_ASSEMBLED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPERADMIN', 'ADMIN', 'INVENTORY_MANAGER', 'TEST_ENGINEER', 'ASSEMBLY_TECHNICIAN', 'PAX_TEST_ENGINEER', 'SUPERVISOR', 'SALES_EXECUTIVE', 'ACCOUNTANT');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";

-- DropForeignKey
ALTER TABLE "PaxPack" DROP CONSTRAINT "PaxPack_approvedBy_fkey";

-- DropForeignKey
ALTER TABLE "Repair" DROP CONSTRAINT "Repair_repairedBy_fkey";

-- AlterTable
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_pkey",
DROP COLUMN "changedAt",
DROP COLUMN "logId",
DROP COLUMN "previousStatus",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "prevStatus" TEXT,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "newStatus" DROP NOT NULL,
ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Cell" DROP COLUMN "cycleCount",
ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "cycles" INTEGER NOT NULL,
ADD COLUMN     "reservedForPaxTypeId" TEXT,
ALTER COLUMN "voltage" SET NOT NULL,
ALTER COLUMN "voltage" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "category" SET NOT NULL,
ALTER COLUMN "ahValue" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "irValue" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PaxPack" DROP COLUMN "paxType",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "paxTypeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Repair" ALTER COLUMN "diagnosisNotes" SET NOT NULL;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "paxTypeName" TEXT NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "password",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordHash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "PaxType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cellCount" INTEGER NOT NULL,
    "ahMin" DOUBLE PRECISION NOT NULL,
    "ahMax" DOUBLE PRECISION NOT NULL,
    "irMin" DOUBLE PRECISION NOT NULL,
    "irMax" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaxType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QcThreshold" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "ahMin" DOUBLE PRECISION NOT NULL,
    "ahMax" DOUBLE PRECISION NOT NULL,
    "irMin" DOUBLE PRECISION NOT NULL,
    "irMax" DOUBLE PRECISION NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QcThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "minStock" INTEGER NOT NULL DEFAULT 5,
    "lastRestock" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaxType_name_key" ON "PaxType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Material_sku_key" ON "Material"("sku");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_reservedForPaxTypeId_fkey" FOREIGN KEY ("reservedForPaxTypeId") REFERENCES "PaxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaxPack" ADD CONSTRAINT "PaxPack_paxTypeId_fkey" FOREIGN KEY ("paxTypeId") REFERENCES "PaxType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
