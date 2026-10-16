-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TECHNICIAN', 'SUPERVISOR', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "CellStatus" AS ENUM ('RAW', 'CELL_TESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaxStatus" AS ENUM ('PAX_ASSEMBLED', 'PAX_TESTED', 'READY_FOR_SALE', 'SOLD_TO_VENDOR', 'SOLD_TO_CUSTOMER', 'UNDER_REPAIR', 'REPAIRED');

-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('VENDOR', 'CUSTOMER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cell" (
    "serialNumber" TEXT NOT NULL,
    "voltage" DECIMAL(65,30),
    "category" TEXT,
    "cycleCount" INTEGER,
    "ahValue" DECIMAL(65,30),
    "irValue" DECIMAL(65,30),
    "status" "CellStatus" NOT NULL DEFAULT 'RAW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cell_pkey" PRIMARY KEY ("serialNumber")
);

-- CreateTable
CREATE TABLE "PaxPack" (
    "paxSerial" TEXT NOT NULL,
    "paxType" TEXT NOT NULL,
    "status" "PaxStatus" NOT NULL DEFAULT 'PAX_ASSEMBLED',
    "assembledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "testReportUrl" TEXT,
    "qrUrl" TEXT,

    CONSTRAINT "PaxPack_pkey" PRIMARY KEY ("paxSerial")
);

-- CreateTable
CREATE TABLE "PaxCell" (
    "paxSerial" TEXT NOT NULL,
    "cellSerial" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PaxCell_pkey" PRIMARY KEY ("paxSerial","cellSerial")
);

-- CreateTable
CREATE TABLE "Sale" (
    "saleId" TEXT NOT NULL,
    "paxSerial" TEXT NOT NULL,
    "saleType" "SaleType" NOT NULL,
    "customerName" TEXT,
    "vendorId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "invoiceUrl" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("saleId")
);

-- CreateTable
CREATE TABLE "Repair" (
    "repairId" TEXT NOT NULL,
    "paxSerial" TEXT NOT NULL,
    "fixType" TEXT NOT NULL,
    "diagnosisNotes" TEXT,
    "repairedBy" TEXT NOT NULL,
    "reTestResult" TEXT,
    "repairedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("repairId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "logId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("logId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PaxCell_cellSerial_key" ON "PaxCell"("cellSerial");

-- AddForeignKey
ALTER TABLE "PaxPack" ADD CONSTRAINT "PaxPack_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaxCell" ADD CONSTRAINT "PaxCell_paxSerial_fkey" FOREIGN KEY ("paxSerial") REFERENCES "PaxPack"("paxSerial") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaxCell" ADD CONSTRAINT "PaxCell_cellSerial_fkey" FOREIGN KEY ("cellSerial") REFERENCES "Cell"("serialNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_paxSerial_fkey" FOREIGN KEY ("paxSerial") REFERENCES "PaxPack"("paxSerial") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_paxSerial_fkey" FOREIGN KEY ("paxSerial") REFERENCES "PaxPack"("paxSerial") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_repairedBy_fkey" FOREIGN KEY ("repairedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
