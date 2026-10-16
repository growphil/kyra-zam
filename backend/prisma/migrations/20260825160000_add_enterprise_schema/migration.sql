-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('RECEIVED', 'DIAGNOSIS_PENDING', 'DIAGNOSIS_COMPLETED', 'ESTIMATE_GENERATED', 'WAITING_FOR_CUSTOMER_APPROVAL', 'MATERIAL_REQUESTED', 'MATERIAL_APPROVED', 'MATERIAL_ISSUED', 'REPAIR_IN_PROGRESS', 'REPAIR_COMPLETED', 'QC_PENDING', 'QC_IN_PROGRESS', 'TEST_FAILED', 'READY_FOR_DELIVERY', 'PAYMENT_PENDING', 'DELIVERED', 'SCRAP_RECOMMENDED', 'SCRAP', 'CANCELLED', 'ON_HOLD', 'REOPENED');

-- CreateEnum
CREATE TYPE "MaterialRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ISSUED');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScrapType" AS ENUM ('PROFITABLE', 'LOSS');

-- CreateEnum
CREATE TYPE "ScrapSource" AS ENUM ('SERVICE', 'TESTING', 'ASSEMBLY', 'PRODUCTION', 'INVENTORY_DAMAGE', 'RETURNED_PRODUCT');

-- CreateEnum
CREATE TYPE "ScrapStatus" AS ENUM ('REPORTED', 'SCRAP_PENDING_REVIEW', 'UNDER_REVIEW', 'STORED', 'SOLD', 'RECYCLED', 'SCRAPPED', 'DISPOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ApprovalMethod" AS ENUM ('PHONE_CALL', 'WHATSAPP', 'EMAIL', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'ISSUED', 'RELEASED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'MEETING', 'FOLLOW_UP', 'EMAIL', 'NOTE', 'TASK');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CUSTOMER_VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAYMENT_PENDING', 'READY_FOR_FULFILLMENT', 'IN_FULFILLMENT', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "SalesOrderPaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('FROM_STOCK', 'PRODUCTION_REQUIRED');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PurchaseRequestSource" AS ENUM ('MANUAL', 'SALES_ORDER', 'PRODUCTION_REQUIREMENT', 'LOW_STOCK', 'SERVICE');

-- CreateEnum
CREATE TYPE "PurchaseRequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GoodsReceiptStatus" AS ENUM ('EXPECTED', 'RECEIVING', 'QC_PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'STOCKED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'RESERVATION', 'RESERVATION_RELEASE', 'ADJUSTMENT', 'RETURN', 'TRANSFER');

-- CreateEnum
CREATE TYPE "ProductionRequirementStatus" AS ENUM ('PENDING', 'MATERIAL_CHECK', 'READY', 'PLANNED', 'IN_PRODUCTION', 'COMPLETED', 'CLOSED', 'CANCELLED', 'MATERIAL_SHORTAGE');

-- CreateEnum
CREATE TYPE "ProductionPlanStatus" AS ENUM ('DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('CREATED', 'ASSIGNED', 'READY', 'IN_PROGRESS', 'QC_PENDING', 'COMPLETED', 'CLOSED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackingStatus" AS ENUM ('READY_FOR_PACKING', 'PACKING_IN_PROGRESS', 'CHECKLIST_PENDING', 'PACKING_CONFIRMED', 'STICKER_GENERATED', 'PACKED', 'TRANSFER_PENDING', 'TRANSFERRED_TO_FINISHED_GOODS');

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('MACHINERY', 'TESTING_EQUIPMENT', 'TOOLING', 'IT_HARDWARE', 'VEHICLE', 'FURNITURE', 'SAFETY_EQUIPMENT', 'FACILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('OPERATIONAL', 'IN_USE', 'UNDER_MAINTENANCE', 'CALIBRATION_DUE', 'STANDBY', 'RETIRED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'PROBATION', 'SUSPENDED', 'TERMINATED', 'RESIGNED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'CASUAL', 'INTERN');

-- CreateEnum
CREATE TYPE "SalaryBasis" AS ENUM ('MONTHLY', 'DAILY', 'HOURLY');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'REST_DAY', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'CALCULATED', 'REVIEW_REQUIRED', 'APPROVED', 'PAYMENT_PROCESSING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'MOBILE_MONEY', 'CASH', 'CHEQUE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CellStatus" ADD VALUE 'HOLD';
ALTER TYPE "CellStatus" ADD VALUE 'UNMATCHED';
ALTER TYPE "CellStatus" ADD VALUE 'RETEST_REQUIRED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaxStatus" ADD VALUE 'READY_FOR_PAX_TEST';
ALTER TYPE "PaxStatus" ADD VALUE 'READY_FOR_PACKING';
ALTER TYPE "PaxStatus" ADD VALUE 'PACKED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'PURCHASE_MANAGER';
ALTER TYPE "Role" ADD VALUE 'MARKETING_MANAGER';
ALTER TYPE "Role" ADD VALUE 'QC';
ALTER TYPE "Role" ADD VALUE 'PACKING_OPERATOR';
ALTER TYPE "Role" ADD VALUE 'SELLER';
ALTER TYPE "Role" ADD VALUE 'HR_PAYROLL';

-- AlterTable
ALTER TABLE "Cell" ADD COLUMN     "ambientTemperature" DOUBLE PRECISION,
ADD COLUMN     "cellTemperature" DOUBLE PRECISION,
ADD COLUMN     "grade" TEXT,
ADD COLUMN     "inwardBatchId" TEXT,
ADD COLUMN     "lastRetestAt" TIMESTAMP(3),
ADD COLUMN     "machineCalibrationDate" TIMESTAMP(3),
ADD COLUMN     "machineId" TEXT,
ADD COLUMN     "machineOperator" TEXT,
ADD COLUMN     "partNumber" TEXT,
ADD COLUMN     "qcDecisionHistory" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "retestCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "testingRequirementId" TEXT;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isPriceVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "materialCode" TEXT,
ADD COLUMN     "materialType" TEXT NOT NULL DEFAULT 'QTZ',
ADD COLUMN     "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PaxPack" ADD COLUMN     "assembledAtStationId" TEXT,
ADD COLUMN     "bomId" TEXT,
ADD COLUMN     "workOrderId" TEXT;

-- AlterTable
ALTER TABLE "PaxType" ADD COLUMN     "allowedGrades" TEXT[] DEFAULT ARRAY['A+', 'A']::TEXT[],
ADD COLUMN     "autoPackEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bomId" TEXT,
ADD COLUMN     "bomNumber" TEXT,
ADD COLUMN     "cellChemistry" TEXT DEFAULT 'LFP',
ADD COLUMN     "cellPartNumber" TEXT,
ADD COLUMN     "configuration" TEXT DEFAULT '16S1P',
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "hardFailAh" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
ADD COLUMN     "hardFailIr" DOUBLE PRECISION NOT NULL DEFAULT 70.0,
ADD COLUMN     "isProductionActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxAhDifference" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
ADD COLUMN     "maxIrDifference" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
ADD COLUMN     "nominalCapacity" DOUBLE PRECISION,
ADD COLUMN     "nominalVoltage" DOUBLE PRECISION DEFAULT 48.0,
ADD COLUMN     "retestAhMargin" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
ADD COLUMN     "retestIrMargin" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "QcThreshold" ADD COLUMN     "serialDisplayLength" INTEGER;

-- AlterTable
ALTER TABLE "Repair" ADD COLUMN     "defectId" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "roles" "Role"[];

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "category" TEXT;

-- CreateTable
CREATE TABLE "MaterialCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CellCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CellInwardBatch" (
    "id" TEXT NOT NULL,
    "inwardNumber" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "materialId" TEXT,
    "batchNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "availableQty" INTEGER NOT NULL,
    "testedQty" INTEGER NOT NULL DEFAULT 0,
    "rejectedQty" INTEGER NOT NULL DEFAULT 0,
    "consumedQty" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL,
    "voltage" DOUBLE PRECISION NOT NULL DEFAULT 3.2,
    "cycles" INTEGER NOT NULL DEFAULT 0,
    "receivedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CellInwardBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CellMaster" (
    "id" TEXT NOT NULL,
    "cellSku" TEXT NOT NULL,
    "cellName" TEXT NOT NULL,
    "chemistry" TEXT NOT NULL DEFAULT 'LFP',
    "nominalVoltage" DOUBLE PRECISION NOT NULL DEFAULT 3.2,
    "nominalCapacity" DOUBLE PRECISION NOT NULL DEFAULT 3.2,
    "supplier" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactorySetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "defaultPaymentTerms" TEXT NOT NULL DEFAULT '100% Advance',
    "defaultAdvancePercentage" DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    "defaultFreightAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "defaultHandlingCharge" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "defaultQuotationValidityDays" INTEGER NOT NULL DEFAULT 30,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'INR',
    "minimumOrderValue" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "shippingCalculationMethod" TEXT NOT NULL DEFAULT 'FLAT_RATE',
    "freeShippingThreshold" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "defaultShippingCarrier" TEXT NOT NULL DEFAULT 'Standard Road Logistics',
    "shippingTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "estimatedDeliveryLeadDays" INTEGER NOT NULL DEFAULT 3,
    "defaultUnitSystem" TEXT NOT NULL DEFAULT 'METRIC',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "workingHoursPerDay" DECIMAL(4,2) NOT NULL DEFAULT 8.00,
    "productionDaysPerWeek" INTEGER NOT NULL DEFAULT 6,
    "defaultDeliveryTerms" TEXT NOT NULL DEFAULT 'EXW - Ex Works',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactorySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOM" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOMItem" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BOMItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceBattery" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "qrCode" TEXT,
    "customerName" TEXT NOT NULL,
    "customerMobile" TEXT NOT NULL,
    "batteryModel" TEXT NOT NULL,
    "originalBatterySerial" TEXT,
    "issueDescription" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'RECEIVED',
    "warrantyStatus" TEXT,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "images" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "holdReason" TEXT,
    "holdBy" TEXT,
    "holdDate" TIMESTAMP(3),
    "resumeDate" TIMESTAMP(3),
    "previousStatus" TEXT,
    "serviceType" TEXT,
    "warrantyId" TEXT,

    CONSTRAINT "ServiceBattery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRepairLog" (
    "id" TEXT NOT NULL,
    "serviceBatteryId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "technicianId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRepairLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceMaterialRequest" (
    "id" TEXT NOT NULL,
    "serviceBatteryId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceMaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceMaterialItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "issuedUnitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceMaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTestReport" (
    "id" TEXT NOT NULL,
    "serviceBatteryId" TEXT NOT NULL,
    "voltageTest" TEXT,
    "loadTest" TEXT,
    "thermalTest" TEXT,
    "chargingTest" TEXT,
    "dischargeTest" TEXT,
    "finalObservation" TEXT,
    "reportUrl" TEXT,
    "images" TEXT[],
    "status" "TestStatus" NOT NULL,
    "testedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceTestReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceDelivery" (
    "id" TEXT NOT NULL,
    "serviceBatteryId" TEXT NOT NULL,
    "customerSignature" TEXT,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentStatus" TEXT,
    "warrantyUpdate" TEXT,
    "deliveredBy" TEXT NOT NULL,
    "overrideBy" TEXT,
    "overrideReason" TEXT,
    "overrideDate" TIMESTAMP(3),

    CONSTRAINT "ServiceDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapEntry" (
    "id" TEXT NOT NULL,
    "scrapId" TEXT NOT NULL,
    "scrapType" "ScrapType" NOT NULL,
    "sourceType" "ScrapSource" NOT NULL,
    "status" "ScrapStatus" NOT NULL DEFAULT 'REPORTED',
    "materialId" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedRecoveryValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualSaleValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defectType" TEXT NOT NULL,
    "severity" "SeverityLevel" NOT NULL,
    "description" TEXT,
    "images" TEXT[],
    "reports" TEXT[],
    "cellSerial" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapInventory" (
    "id" TEXT NOT NULL,
    "scrapEntryId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "estimatedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStatus" "ScrapStatus" NOT NULL DEFAULT 'STORED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapSale" (
    "id" TEXT NOT NULL,
    "scrapEntryId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "quantitySold" INTEGER NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchAnalytics" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "totalCells" INTEGER NOT NULL DEFAULT 0,
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "retestCount" INTEGER NOT NULL DEFAULT 0,
    "stabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCost" (
    "id" TEXT NOT NULL,
    "serviceBatteryId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "materialCost" DECIMAL(12,2) NOT NULL,
    "labourCost" DECIMAL(12,2) NOT NULL,
    "marginPercentage" DECIMAL(5,2) NOT NULL,
    "marginAmount" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "generatedBySystem" BOOLEAN NOT NULL DEFAULT true,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "overrideReason" TEXT,
    "overrideById" TEXT,
    "overrideAt" TIMESTAMP(3),
    "materialCostSnapshot" DECIMAL(12,2),
    "labourCostSnapshot" DECIMAL(12,2),
    "marginPercentSnapshot" DECIMAL(5,2),
    "marginAmountSnapshot" DECIMAL(12,2),
    "invoiceAmountSnapshot" DECIMAL(12,2),
    "overrideBy" TEXT,
    "overrideDate" TIMESTAMP(3),
    "oldMaterialCost" DECIMAL(12,2),
    "oldLabourCost" DECIMAL(12,2),
    "oldMargin" DECIMAL(5,2),
    "oldInvoiceAmount" DECIMAL(12,2),
    "newInvoiceAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePricingMaster" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "labourCost" DECIMAL(12,2) NOT NULL,
    "marginPercentage" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePricingMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEstimate" (
    "id" TEXT NOT NULL,
    "serviceBatteryId" TEXT NOT NULL,
    "materialCost" DECIMAL(12,2) NOT NULL,
    "labourCost" DECIMAL(12,2) NOT NULL,
    "marginAmount" DECIMAL(12,2) NOT NULL,
    "totalEstimate" DECIMAL(12,2) NOT NULL,
    "remarks" TEXT,
    "approvedByCustomer" BOOLEAN NOT NULL DEFAULT false,
    "approvedDate" TIMESTAMP(3),
    "approvalMethod" "ApprovalMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "materialId" TEXT,
    "quantity" INTEGER NOT NULL,
    "serviceBatteryId" TEXT,
    "salesOrderId" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "paxSerial" TEXT,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapApproval" (
    "id" TEXT NOT NULL,
    "serviceBatteryId" TEXT NOT NULL,
    "recommendedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "reason" TEXT NOT NULL,
    "approvedDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceReopenHistory" (
    "id" TEXT NOT NULL,
    "serviceBatteryId" TEXT NOT NULL,
    "originalServiceId" TEXT NOT NULL,
    "reopenedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "warrantyCovered" BOOLEAN NOT NULL,
    "reopenDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceReopenHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" "Role",
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "billingAddress" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "taxGst" TEXT,
    "notes" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "leadNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "source" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedUserId" TEXT,
    "requirementSummary" TEXT,
    "notes" TEXT,
    "expectedFollowUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),
    "convertedByUserId" TEXT,
    "convertedCustomerId" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "leadId" TEXT,
    "customerId" TEXT,
    "assignedUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "leadId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedSalesUserId" TEXT,
    "quotationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL,
    "additionalCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "deliveryTerms" TEXT NOT NULL,
    "notes" TEXT,
    "internalNotes" TEXT,
    "customerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "customerNameSnapshot" TEXT NOT NULL,
    "customerEmailSnapshot" TEXT NOT NULL,
    "customerPhoneSnapshot" TEXT NOT NULL,
    "billingAddressSnapshot" TEXT NOT NULL,
    "shippingAddressSnapshot" TEXT NOT NULL,
    "citySnapshot" TEXT NOT NULL,
    "stateSnapshot" TEXT NOT NULL,
    "countrySnapshot" TEXT NOT NULL,
    "postalCodeSnapshot" TEXT NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productRef" TEXT,
    "materialId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "lineSubtotal" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "specification" TEXT,
    "notes" TEXT,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationRevision" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "QuotationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationApproval" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "status" TEXT NOT NULL,
    "comments" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "salesOrderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quotationId" TEXT,
    "leadId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedSalesUserId" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredDeliveryDate" TIMESTAMP(3) NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "SalesOrderPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL,
    "additionalCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "deliveryTerms" TEXT NOT NULL,
    "billingAddressSnapshot" TEXT NOT NULL,
    "shippingAddressSnapshot" TEXT NOT NULL,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isFinancialCleared" BOOLEAN NOT NULL DEFAULT false,
    "financialClearedAt" TIMESTAMP(3),
    "financialClearedById" TEXT,
    "financialOriginalAmount" DECIMAL(12,2),

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productRef" TEXT,
    "materialId" TEXT,
    "description" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityFulfilled" INTEGER NOT NULL DEFAULT 0,
    "quantityPending" INTEGER NOT NULL,
    "quantityCancelled" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "lineSubtotal" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "specification" TEXT,
    "sourceQuotationItemId" TEXT,
    "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'FROM_STOCK',

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "prNumber" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "source" "PurchaseRequestSource" NOT NULL DEFAULT 'MANUAL',
    "sourceReferenceId" TEXT,
    "priority" "PurchaseRequestPriority" NOT NULL DEFAULT 'NORMAL',
    "requiredDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "requiredDate" TIMESTAMP(3) NOT NULL,
    "specification" TEXT,
    "notes" TEXT,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestApproval" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "status" TEXT NOT NULL,
    "comments" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequestApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "purchaseRequestId" TEXT,
    "createdById" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" TIMESTAMP(3) NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "additionalCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "deliveryTerms" TEXT NOT NULL,
    "billingAddress" TEXT NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "quantityPending" INTEGER NOT NULL,
    "quantityCancelled" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "lineSubtotal" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "specification" TEXT,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT NOT NULL,
    "warehouseId" TEXT,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'EXPECTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptItem" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "quantityAccepted" INTEGER NOT NULL DEFAULT 0,
    "quantityRejected" INTEGER NOT NULL DEFAULT 0,
    "quantityDamaged" INTEGER NOT NULL DEFAULT 0,
    "batchNumber" TEXT,
    "serialNumber" TEXT,
    "inspectionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,

    CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialLocationBalance" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialLocationBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "source" TEXT NOT NULL,
    "referenceId" TEXT,
    "warehouseId" TEXT,
    "locationId" TEXT,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionRequirement" (
    "id" TEXT NOT NULL,
    "requirementNumber" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productRef" TEXT,
    "requiredQuantity" INTEGER NOT NULL,
    "requiredDeliveryDate" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'PRODUCTION_REQUIRED',
    "status" "ProductionRequirementStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" TEXT NOT NULL,
    "planNumber" TEXT NOT NULL,
    "productionRequirementId" TEXT NOT NULL,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedCompletionDate" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "plannedQuantity" INTEGER NOT NULL,
    "supervisorId" TEXT,
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "workOrderNumber" TEXT NOT NULL,
    "productionPlanId" TEXT,
    "productionRequirementId" TEXT,
    "salesOrderId" TEXT,
    "productRef" TEXT,
    "bomId" TEXT,
    "plannedQuantity" INTEGER NOT NULL,
    "startedQuantity" INTEGER NOT NULL DEFAULT 0,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "remainingQuantity" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "supervisorId" TEXT,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'CREATED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderOperator" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "WorkOrderOperator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityInspection" (
    "id" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "workOrderId" TEXT,
    "paxSerial" TEXT,
    "inspectionType" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QualityInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityCheckpoint" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "result" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "QualityCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Defect" (
    "id" TEXT NOT NULL,
    "defectNumber" TEXT NOT NULL,
    "workOrderId" TEXT,
    "paxSerial" TEXT,
    "inspectionId" TEXT,
    "defectType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "disposition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Defect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchOrder" (
    "id" TEXT NOT NULL,
    "dispatchNumber" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "dispatchDate" TIMESTAMP(3),
    "plannedDispatchDate" TIMESTAMP(3) NOT NULL,
    "deliveryAddressSnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "shippingMethod" TEXT,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchItem" (
    "id" TEXT NOT NULL,
    "dispatchOrderId" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "productRef" TEXT,
    "quantityOrdered" INTEGER NOT NULL,
    "quantityDispatched" INTEGER NOT NULL,
    "quantityPicked" INTEGER NOT NULL DEFAULT 0,
    "quantityPacked" INTEGER NOT NULL DEFAULT 0,
    "quantityDelivered" INTEGER NOT NULL DEFAULT 0,
    "paxSerial" TEXT,
    "notes" TEXT,

    CONSTRAINT "DispatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryPackage" (
    "id" TEXT NOT NULL,
    "packageNumber" TEXT NOT NULL,
    "dispatchOrderId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "dimensions" TEXT,
    "packageType" TEXT,
    "trackingReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PACKED',

    CONSTRAINT "DeliveryPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "dispatchOrderId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "shippingMethod" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "pickupDate" TIMESTAMP(3),
    "expectedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveryNotes" TEXT,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofOfDelivery" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredBy" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientContact" TEXT,
    "signatureReference" TEXT,
    "deliveryNotes" TEXT,
    "attachmentUrl" TEXT,

    CONSTRAINT "ProofOfDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "dispatchOrderId" TEXT,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL,
    "additionalCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(12,2) NOT NULL,
    "paymentTerms" TEXT NOT NULL,
    "billingAddressSnapshot" TEXT NOT NULL,
    "shippingAddressSnapshot" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "salesOrderItemId" TEXT,
    "productRef" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "lineSubtotal" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "salesOrderId" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "bankDetails" TEXT,
    "notes" TEXT,
    "paymentProofUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "rejectionReason" TEXT,
    "recordedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warranty" (
    "id" TEXT NOT NULL,
    "warrantyNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "paxSerial" TEXT,
    "salesOrderId" TEXT,
    "invoiceId" TEXT,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "warrantyStartDate" TIMESTAMP(3) NOT NULL,
    "warrantyEndDate" TIMESTAMP(3) NOT NULL,
    "warrantyDurationMonths" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "coverageType" TEXT NOT NULL DEFAULT 'FULL',
    "terms" TEXT,
    "exclusions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StationOperatorAssignment" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "StationOperatorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "originWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantityRequested" INTEGER NOT NULL,
    "quantityShipped" INTEGER NOT NULL DEFAULT 0,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "originLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCellTestingRequirement" (
    "id" TEXT NOT NULL,
    "requirementNumber" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "materialId" TEXT,
    "cellSku" TEXT NOT NULL,
    "cellName" TEXT NOT NULL,
    "requiredQuantity" INTEGER NOT NULL,
    "testedQuantity" INTEGER NOT NULL DEFAULT 0,
    "remainingQuantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionCellTestingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingRecord" (
    "id" TEXT NOT NULL,
    "packingNumber" TEXT NOT NULL,
    "paxSerial" TEXT NOT NULL,
    "paxTypeId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "stationId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "PackingStatus" NOT NULL DEFAULT 'READY_FOR_PACKING',
    "stickerNumber" TEXT,
    "stickerGeneratedAt" TIMESTAMP(3),
    "stickerPrintedAt" TIMESTAMP(3),
    "qrData" TEXT,
    "boxCondition" TEXT DEFAULT 'GOOD',
    "boxSealed" BOOLEAN NOT NULL DEFAULT false,
    "destinationWarehouseId" TEXT,
    "destinationLocationId" TEXT,
    "transferredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingChecklistItem" (
    "id" TEXT NOT NULL,
    "packingRecordId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "materialId" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingMaterialConfig" (
    "id" TEXT NOT NULL,
    "paxTypeId" TEXT NOT NULL,
    "materialId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingMaterialConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAsset" (
    "id" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "AssetCategory" NOT NULL DEFAULT 'OTHER',
    "manufacturer" TEXT,
    "modelNumber" TEXT,
    "serialNumber" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DOUBLE PRECISION DEFAULT 0,
    "vendorId" TEXT,
    "invoiceNumber" TEXT,
    "warrantyExpiry" TIMESTAMP(3),
    "warrantyDetails" TEXT,
    "location" TEXT,
    "warehouseId" TEXT,
    "department" TEXT,
    "assignedToUserId" TEXT,
    "assignedDate" TIMESTAMP(3),
    "status" "AssetStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "retiredDate" TIMESTAMP(3),
    "retirementReason" TEXT,
    "lastMaintenanceDate" TIMESTAMP(3),
    "nextMaintenanceDate" TIMESTAMP(3),
    "maintenanceIntervalDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMaintenanceRecord" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "serviceProvider" TEXT,
    "cost" DOUBLE PRECISION DEFAULT 0,
    "performedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextDueDate" TIMESTAMP(3),
    "performedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAssignmentHistory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "assignedByName" TEXT,
    "department" TEXT,
    "location" TEXT,
    "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkShift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 30,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "workDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "isFactoryShift" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCalendarHoliday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "isStatutory" BOOLEAN NOT NULL DEFAULT true,
    "isMovable" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "isCompanyShutdown" BOOLEAN NOT NULL DEFAULT false,
    "applicableDepartment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCalendarHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "nrcNumber" TEXT,
    "tpinNumber" TEXT,
    "napsaNumber" TEXT,
    "nhimaNumber" TEXT,
    "department" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "hireDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminationDate" TIMESTAMP(3),
    "managerId" TEXT,
    "workLocation" TEXT NOT NULL DEFAULT 'Lusaka Plant',
    "shiftId" TEXT,
    "salaryBasis" "SalaryBasis" NOT NULL DEFAULT 'MONTHLY',
    "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "bankName" TEXT,
    "bankBranch" TEXT,
    "bankAccountNumber" TEXT,
    "mobileMoneyProvider" TEXT,
    "mobileMoneyNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "shiftId" TEXT,
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "workedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "regularHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyExitMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "isMissingPunch" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'PORTAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCorrection" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requestedClockIn" TIMESTAMP(3),
    "requestedClockOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "daysPerYear" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "carryOverMax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requiresDoc" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitledDays" DOUBLE PRECISION NOT NULL,
    "usedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingDays" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "workingDaysCount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "attachmentName" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutoryRuleSet" (
    "id" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Zambia',
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "payeBands" JSONB NOT NULL,
    "napsaEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "napsaEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "napsaCeiling" DOUBLE PRECISION NOT NULL DEFAULT 30368,
    "nhimaEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "nhimaEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatutoryRuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "payoutDate" TIMESTAMP(3),
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTaxable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaye" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNapsa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNhima" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEmployerCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preparedById" TEXT,
    "preparedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNote" TEXT,
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePayrollRecord" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "statutoryRuleSetId" TEXT,
    "salaryBasis" "SalaryBasis" NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "workingDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workedDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimePay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowancesBreakdown" JSONB,
    "bonuses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "absenceDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "taxablePay" DOUBLE PRECISION NOT NULL,
    "payeTax" DOUBLE PRECISION NOT NULL,
    "napsaEmployee" DOUBLE PRECISION NOT NULL,
    "napsaEmployer" DOUBLE PRECISION NOT NULL,
    "nhimaEmployee" DOUBLE PRECISION NOT NULL,
    "nhimaEmployer" DOUBLE PRECISION NOT NULL,
    "totalDeductions" DOUBLE PRECISION NOT NULL,
    "netPay" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "bankDetailsSnapshot" JSONB,
    "calculationDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePayrollRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCategory_name_key" ON "MaterialCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CellCategory_name_key" ON "CellCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VendorCategory_name_key" ON "VendorCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CellInwardBatch_inwardNumber_key" ON "CellInwardBatch"("inwardNumber");

-- CreateIndex
CREATE INDEX "CellInwardBatch_partNumber_idx" ON "CellInwardBatch"("partNumber");

-- CreateIndex
CREATE INDEX "CellInwardBatch_batchNumber_idx" ON "CellInwardBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "CellInwardBatch_status_idx" ON "CellInwardBatch"("status");

-- CreateIndex
CREATE INDEX "CellInwardBatch_createdAt_idx" ON "CellInwardBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CellMaster_cellSku_key" ON "CellMaster"("cellSku");

-- CreateIndex
CREATE UNIQUE INDEX "BOM_name_key" ON "BOM"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceBattery_serviceId_key" ON "ServiceBattery"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceBattery_serialNumber_key" ON "ServiceBattery"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceDelivery_serviceBatteryId_key" ON "ServiceDelivery"("serviceBatteryId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapEntry_scrapId_key" ON "ScrapEntry"("scrapId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapInventory_scrapEntryId_key" ON "ScrapInventory"("scrapEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchAnalytics_batchNumber_key" ON "BatchAnalytics"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCost_serviceBatteryId_key" ON "ServiceCost"("serviceBatteryId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePricingMaster_serviceType_key" ON "ServicePricingMaster"("serviceType");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEstimate_serviceBatteryId_key" ON "ServiceEstimate"("serviceBatteryId");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapApproval_serviceBatteryId_key" ON "ScrapApproval"("serviceBatteryId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");

-- CreateIndex
CREATE INDEX "Customer_customerCode_idx" ON "Customer"("customerCode");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE INDEX "Customer_assignedUserId_idx" ON "Customer"("assignedUserId");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_leadNumber_key" ON "Lead"("leadNumber");

-- CreateIndex
CREATE INDEX "Lead_leadNumber_idx" ON "Lead"("leadNumber");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_priority_idx" ON "Lead"("priority");

-- CreateIndex
CREATE INDEX "Lead_assignedUserId_idx" ON "Lead"("assignedUserId");

-- CreateIndex
CREATE INDEX "Lead_expectedFollowUpDate_idx" ON "Lead"("expectedFollowUpDate");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_leadId_idx" ON "Activity"("leadId");

-- CreateIndex
CREATE INDEX "Activity_customerId_idx" ON "Activity"("customerId");

-- CreateIndex
CREATE INDEX "Activity_assignedUserId_idx" ON "Activity"("assignedUserId");

-- CreateIndex
CREATE INDEX "Activity_dueDate_idx" ON "Activity"("dueDate");

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quotationNumber_key" ON "Quotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "Quotation_quotationNumber_idx" ON "Quotation"("quotationNumber");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "Quotation_leadId_idx" ON "Quotation"("leadId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_createdById_idx" ON "Quotation"("createdById");

-- CreateIndex
CREATE INDEX "Quotation_assignedSalesUserId_idx" ON "Quotation"("assignedSalesUserId");

-- CreateIndex
CREATE INDEX "Quotation_quotationDate_idx" ON "Quotation"("quotationDate");

-- CreateIndex
CREATE INDEX "Quotation_validUntil_idx" ON "Quotation"("validUntil");

-- CreateIndex
CREATE INDEX "Quotation_createdAt_idx" ON "Quotation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_salesOrderNumber_key" ON "SalesOrder"("salesOrderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_quotationId_key" ON "SalesOrder"("quotationId");

-- CreateIndex
CREATE INDEX "SalesOrder_salesOrderNumber_idx" ON "SalesOrder"("salesOrderNumber");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrder_quotationId_idx" ON "SalesOrder"("quotationId");

-- CreateIndex
CREATE INDEX "SalesOrder_leadId_idx" ON "SalesOrder"("leadId");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrder_createdById_idx" ON "SalesOrder"("createdById");

-- CreateIndex
CREATE INDEX "SalesOrder_assignedSalesUserId_idx" ON "SalesOrder"("assignedSalesUserId");

-- CreateIndex
CREATE INDEX "SalesOrder_requiredDeliveryDate_idx" ON "SalesOrder"("requiredDeliveryDate");

-- CreateIndex
CREATE INDEX "SalesOrder_createdAt_idx" ON "SalesOrder"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequest_prNumber_key" ON "PurchaseRequest"("prNumber");

-- CreateIndex
CREATE INDEX "PurchaseRequest_prNumber_idx" ON "PurchaseRequest"("prNumber");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_priority_idx" ON "PurchaseRequest"("priority");

-- CreateIndex
CREATE INDEX "PurchaseRequest_requiredDate_idx" ON "PurchaseRequest"("requiredDate");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_poNumber_idx" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendorId_idx" ON "PurchaseOrder"("vendorId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_grnNumber_key" ON "GoodsReceipt"("grnNumber");

-- CreateIndex
CREATE INDEX "GoodsReceipt_grnNumber_idx" ON "GoodsReceipt"("grnNumber");

-- CreateIndex
CREATE INDEX "GoodsReceipt_purchaseOrderId_idx" ON "GoodsReceipt"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "GoodsReceipt_vendorId_idx" ON "GoodsReceipt"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_warehouseId_code_key" ON "WarehouseLocation"("warehouseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLocationBalance_materialId_warehouseId_locationId_key" ON "MaterialLocationBalance"("materialId", "warehouseId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionRequirement_requirementNumber_key" ON "ProductionRequirement"("requirementNumber");

-- CreateIndex
CREATE INDEX "ProductionRequirement_requirementNumber_idx" ON "ProductionRequirement"("requirementNumber");

-- CreateIndex
CREATE INDEX "ProductionRequirement_salesOrderId_idx" ON "ProductionRequirement"("salesOrderId");

-- CreateIndex
CREATE INDEX "ProductionRequirement_customerId_idx" ON "ProductionRequirement"("customerId");

-- CreateIndex
CREATE INDEX "ProductionRequirement_status_idx" ON "ProductionRequirement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionPlan_planNumber_key" ON "ProductionPlan"("planNumber");

-- CreateIndex
CREATE INDEX "ProductionPlan_planNumber_idx" ON "ProductionPlan"("planNumber");

-- CreateIndex
CREATE INDEX "ProductionPlan_status_idx" ON "ProductionPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_workOrderNumber_key" ON "WorkOrder"("workOrderNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_workOrderNumber_idx" ON "WorkOrder"("workOrderNumber");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QualityInspection_inspectionNumber_key" ON "QualityInspection"("inspectionNumber");

-- CreateIndex
CREATE INDEX "QualityInspection_inspectionNumber_idx" ON "QualityInspection"("inspectionNumber");

-- CreateIndex
CREATE INDEX "QualityInspection_status_idx" ON "QualityInspection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Defect_defectNumber_key" ON "Defect"("defectNumber");

-- CreateIndex
CREATE INDEX "Defect_defectNumber_idx" ON "Defect"("defectNumber");

-- CreateIndex
CREATE INDEX "Defect_status_idx" ON "Defect"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchOrder_dispatchNumber_key" ON "DispatchOrder"("dispatchNumber");

-- CreateIndex
CREATE INDEX "DispatchOrder_dispatchNumber_idx" ON "DispatchOrder"("dispatchNumber");

-- CreateIndex
CREATE INDEX "DispatchOrder_status_idx" ON "DispatchOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPackage_packageNumber_key" ON "DeliveryPackage"("packageNumber");

-- CreateIndex
CREATE INDEX "DeliveryPackage_packageNumber_idx" ON "DeliveryPackage"("packageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNumber_key" ON "Shipment"("shipmentNumber");

-- CreateIndex
CREATE INDEX "Shipment_shipmentNumber_idx" ON "Shipment"("shipmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentReference_key" ON "Payment"("paymentReference");

-- CreateIndex
CREATE INDEX "Payment_paymentReference_idx" ON "Payment"("paymentReference");

-- CreateIndex
CREATE INDEX "Payment_salesOrderId_idx" ON "Payment"("salesOrderId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_warrantyNumber_key" ON "Warranty"("warrantyNumber");

-- CreateIndex
CREATE INDEX "Warranty_warrantyNumber_idx" ON "Warranty"("warrantyNumber");

-- CreateIndex
CREATE INDEX "Warranty_status_idx" ON "Warranty"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStation_name_key" ON "ProductionStation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStation_code_key" ON "ProductionStation"("code");

-- CreateIndex
CREATE INDEX "StationOperatorAssignment_stationId_idx" ON "StationOperatorAssignment"("stationId");

-- CreateIndex
CREATE INDEX "StationOperatorAssignment_operatorId_idx" ON "StationOperatorAssignment"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_transferNumber_key" ON "StockTransfer"("transferNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionCellTestingRequirement_requirementNumber_key" ON "ProductionCellTestingRequirement"("requirementNumber");

-- CreateIndex
CREATE INDEX "ProductionCellTestingRequirement_workOrderId_idx" ON "ProductionCellTestingRequirement"("workOrderId");

-- CreateIndex
CREATE INDEX "ProductionCellTestingRequirement_cellSku_idx" ON "ProductionCellTestingRequirement"("cellSku");

-- CreateIndex
CREATE INDEX "ProductionCellTestingRequirement_status_idx" ON "ProductionCellTestingRequirement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionCellTestingRequirement_workOrderId_cellSku_key" ON "ProductionCellTestingRequirement"("workOrderId", "cellSku");

-- CreateIndex
CREATE UNIQUE INDEX "PackingRecord_packingNumber_key" ON "PackingRecord"("packingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PackingRecord_paxSerial_key" ON "PackingRecord"("paxSerial");

-- CreateIndex
CREATE UNIQUE INDEX "PackingRecord_stickerNumber_key" ON "PackingRecord"("stickerNumber");

-- CreateIndex
CREATE INDEX "PackingRecord_packingNumber_idx" ON "PackingRecord"("packingNumber");

-- CreateIndex
CREATE INDEX "PackingRecord_paxSerial_idx" ON "PackingRecord"("paxSerial");

-- CreateIndex
CREATE INDEX "PackingRecord_status_idx" ON "PackingRecord"("status");

-- CreateIndex
CREATE INDEX "PackingRecord_operatorId_idx" ON "PackingRecord"("operatorId");

-- CreateIndex
CREATE INDEX "PackingChecklistItem_packingRecordId_idx" ON "PackingChecklistItem"("packingRecordId");

-- CreateIndex
CREATE INDEX "PackingMaterialConfig_paxTypeId_idx" ON "PackingMaterialConfig"("paxTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAsset_assetTag_key" ON "CompanyAsset"("assetTag");

-- CreateIndex
CREATE INDEX "CompanyAsset_assetTag_idx" ON "CompanyAsset"("assetTag");

-- CreateIndex
CREATE INDEX "CompanyAsset_category_idx" ON "CompanyAsset"("category");

-- CreateIndex
CREATE INDEX "CompanyAsset_status_idx" ON "CompanyAsset"("status");

-- CreateIndex
CREATE INDEX "CompanyAsset_assignedToUserId_idx" ON "CompanyAsset"("assignedToUserId");

-- CreateIndex
CREATE INDEX "CompanyAsset_warehouseId_idx" ON "CompanyAsset"("warehouseId");

-- CreateIndex
CREATE INDEX "AssetMaintenanceRecord_assetId_idx" ON "AssetMaintenanceRecord"("assetId");

-- CreateIndex
CREATE INDEX "AssetMaintenanceRecord_performedDate_idx" ON "AssetMaintenanceRecord"("performedDate");

-- CreateIndex
CREATE INDEX "AssetAssignmentHistory_assetId_idx" ON "AssetAssignmentHistory"("assetId");

-- CreateIndex
CREATE INDEX "AssetAssignmentHistory_assignedToId_idx" ON "AssetAssignmentHistory"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkShift_code_key" ON "WorkShift"("code");

-- CreateIndex
CREATE INDEX "WorkCalendarHoliday_year_idx" ON "WorkCalendarHoliday"("year");

-- CreateIndex
CREATE INDEX "WorkCalendarHoliday_date_idx" ON "WorkCalendarHoliday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCalendarHoliday_name_date_key" ON "WorkCalendarHoliday"("name", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_employeeNumber_idx" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE INDEX "Employee_department_idx" ON "Employee"("department");

-- CreateIndex
CREATE INDEX "Employee_employmentStatus_idx" ON "Employee"("employmentStatus");

-- CreateIndex
CREATE INDEX "Attendance_workDate_idx" ON "Attendance"("workDate");

-- CreateIndex
CREATE INDEX "Attendance_status_idx" ON "Attendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_employeeId_workDate_key" ON "Attendance"("employeeId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_attendanceId_idx" ON "AttendanceCorrection"("attendanceId");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_employeeId_idx" ON "AttendanceCorrection"("employeeId");

-- CreateIndex
CREATE INDEX "AttendanceCorrection_status_idx" ON "AttendanceCorrection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_code_key" ON "LeavePolicy"("code");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_policyId_year_key" ON "LeaveBalance"("employeeId", "policyId", "year");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_endDate_idx" ON "LeaveRequest"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "StatutoryRuleSet_versionName_key" ON "StatutoryRuleSet"("versionName");

-- CreateIndex
CREATE INDEX "StatutoryRuleSet_isActive_idx" ON "StatutoryRuleSet"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_periodCode_key" ON "PayrollPeriod"("periodCode");

-- CreateIndex
CREATE INDEX "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_startDate_endDate_idx" ON "PayrollPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "EmployeePayrollRecord_employeeId_idx" ON "EmployeePayrollRecord"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeePayrollRecord_periodId_idx" ON "EmployeePayrollRecord"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayrollRecord_periodId_employeeId_key" ON "EmployeePayrollRecord"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "Cell_inwardBatchId_idx" ON "Cell"("inwardBatchId");

-- CreateIndex
CREATE INDEX "Cell_partNumber_idx" ON "Cell"("partNumber");

-- CreateIndex
CREATE INDEX "Cell_batchNumber_idx" ON "Cell"("batchNumber");

-- CreateIndex
CREATE INDEX "Cell_testingRequirementId_idx" ON "Cell"("testingRequirementId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_idempotencyKey_key" ON "Sale"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_inwardBatchId_fkey" FOREIGN KEY ("inwardBatchId") REFERENCES "CellInwardBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_testingRequirementId_fkey" FOREIGN KEY ("testingRequirementId") REFERENCES "ProductionCellTestingRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CellInwardBatch" ADD CONSTRAINT "CellInwardBatch_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CellInwardBatch" ADD CONSTRAINT "CellInwardBatch_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaxType" ADD CONSTRAINT "PaxType_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BOM"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaxPack" ADD CONSTRAINT "PaxPack_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BOM"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaxPack" ADD CONSTRAINT "PaxPack_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaxPack" ADD CONSTRAINT "PaxPack_assembledAtStationId_fkey" FOREIGN KEY ("assembledAtStationId") REFERENCES "ProductionStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_defectId_fkey" FOREIGN KEY ("defectId") REFERENCES "Defect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOMItem" ADD CONSTRAINT "BOMItem_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BOM"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOMItem" ADD CONSTRAINT "BOMItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBattery" ADD CONSTRAINT "ServiceBattery_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "Warranty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRepairLog" ADD CONSTRAINT "ServiceRepairLog_serviceBatteryId_fkey" FOREIGN KEY ("serviceBatteryId") REFERENCES "ServiceBattery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMaterialRequest" ADD CONSTRAINT "ServiceMaterialRequest_serviceBatteryId_fkey" FOREIGN KEY ("serviceBatteryId") REFERENCES "ServiceBattery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMaterialItem" ADD CONSTRAINT "ServiceMaterialItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceMaterialRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceMaterialItem" ADD CONSTRAINT "ServiceMaterialItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTestReport" ADD CONSTRAINT "ServiceTestReport_serviceBatteryId_fkey" FOREIGN KEY ("serviceBatteryId") REFERENCES "ServiceBattery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceDelivery" ADD CONSTRAINT "ServiceDelivery_serviceBatteryId_fkey" FOREIGN KEY ("serviceBatteryId") REFERENCES "ServiceBattery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapEntry" ADD CONSTRAINT "ScrapEntry_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapEntry" ADD CONSTRAINT "ScrapEntry_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapEntry" ADD CONSTRAINT "ScrapEntry_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapInventory" ADD CONSTRAINT "ScrapInventory_scrapEntryId_fkey" FOREIGN KEY ("scrapEntryId") REFERENCES "ScrapEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapSale" ADD CONSTRAINT "ScrapSale_scrapEntryId_fkey" FOREIGN KEY ("scrapEntryId") REFERENCES "ScrapEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCost" ADD CONSTRAINT "ServiceCost_serviceBatteryId_fkey" FOREIGN KEY ("serviceBatteryId") REFERENCES "ServiceBattery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEstimate" ADD CONSTRAINT "ServiceEstimate_serviceBatteryId_fkey" FOREIGN KEY ("serviceBatteryId") REFERENCES "ServiceBattery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_serviceBatteryId_fkey" FOREIGN KEY ("serviceBatteryId") REFERENCES "ServiceBattery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_paxSerial_fkey" FOREIGN KEY ("paxSerial") REFERENCES "PaxPack"("paxSerial") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapApproval" ADD CONSTRAINT "ScrapApproval_serviceBatteryId_fkey" FOREIGN KEY ("serviceBatteryId") REFERENCES "ServiceBattery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceReopenHistory" ADD CONSTRAINT "ServiceReopenHistory_serviceBatteryId_fkey" FOREIGN KEY ("serviceBatteryId") REFERENCES "ServiceBattery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedByUserId_fkey" FOREIGN KEY ("convertedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_assignedSalesUserId_fkey" FOREIGN KEY ("assignedSalesUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationRevision" ADD CONSTRAINT "QuotationRevision_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationRevision" ADD CONSTRAINT "QuotationRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationApproval" ADD CONSTRAINT "QuotationApproval_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationApproval" ADD CONSTRAINT "QuotationApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationApproval" ADD CONSTRAINT "QuotationApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_assignedSalesUserId_fkey" FOREIGN KEY ("assignedSalesUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_financialClearedById_fkey" FOREIGN KEY ("financialClearedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApproval" ADD CONSTRAINT "PurchaseRequestApproval_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApproval" ADD CONSTRAINT "PurchaseRequestApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApproval" ADD CONSTRAINT "PurchaseRequestApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLocationBalance" ADD CONSTRAINT "MaterialLocationBalance_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLocationBalance" ADD CONSTRAINT "MaterialLocationBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLocationBalance" ADD CONSTRAINT "MaterialLocationBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRequirement" ADD CONSTRAINT "ProductionRequirement_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRequirement" ADD CONSTRAINT "ProductionRequirement_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRequirement" ADD CONSTRAINT "ProductionRequirement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionRequirement" ADD CONSTRAINT "ProductionRequirement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_productionRequirementId_fkey" FOREIGN KEY ("productionRequirementId") REFERENCES "ProductionRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "ProductionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_productionRequirementId_fkey" FOREIGN KEY ("productionRequirementId") REFERENCES "ProductionRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BOM"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderOperator" ADD CONSTRAINT "WorkOrderOperator_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderOperator" ADD CONSTRAINT "WorkOrderOperator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_paxSerial_fkey" FOREIGN KEY ("paxSerial") REFERENCES "PaxPack"("paxSerial") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityInspection" ADD CONSTRAINT "QualityInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityCheckpoint" ADD CONSTRAINT "QualityCheckpoint_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "QualityInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_paxSerial_fkey" FOREIGN KEY ("paxSerial") REFERENCES "PaxPack"("paxSerial") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "QualityInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchOrder" ADD CONSTRAINT "DispatchOrder_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchItem" ADD CONSTRAINT "DispatchItem_dispatchOrderId_fkey" FOREIGN KEY ("dispatchOrderId") REFERENCES "DispatchOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchItem" ADD CONSTRAINT "DispatchItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchItem" ADD CONSTRAINT "DispatchItem_paxSerial_fkey" FOREIGN KEY ("paxSerial") REFERENCES "PaxPack"("paxSerial") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryPackage" ADD CONSTRAINT "DeliveryPackage_dispatchOrderId_fkey" FOREIGN KEY ("dispatchOrderId") REFERENCES "DispatchOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_dispatchOrderId_fkey" FOREIGN KEY ("dispatchOrderId") REFERENCES "DispatchOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfDelivery" ADD CONSTRAINT "ProofOfDelivery_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dispatchOrderId_fkey" FOREIGN KEY ("dispatchOrderId") REFERENCES "DispatchOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_paxSerial_fkey" FOREIGN KEY ("paxSerial") REFERENCES "PaxPack"("paxSerial") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warranty" ADD CONSTRAINT "Warranty_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationOperatorAssignment" ADD CONSTRAINT "StationOperatorAssignment_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ProductionStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StationOperatorAssignment" ADD CONSTRAINT "StationOperatorAssignment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_originWarehouseId_fkey" FOREIGN KEY ("originWarehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_originLocationId_fkey" FOREIGN KEY ("originLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCellTestingRequirement" ADD CONSTRAINT "ProductionCellTestingRequirement_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCellTestingRequirement" ADD CONSTRAINT "ProductionCellTestingRequirement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingRecord" ADD CONSTRAINT "PackingRecord_paxSerial_fkey" FOREIGN KEY ("paxSerial") REFERENCES "PaxPack"("paxSerial") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingRecord" ADD CONSTRAINT "PackingRecord_paxTypeId_fkey" FOREIGN KEY ("paxTypeId") REFERENCES "PaxType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingRecord" ADD CONSTRAINT "PackingRecord_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingRecord" ADD CONSTRAINT "PackingRecord_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ProductionStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingRecord" ADD CONSTRAINT "PackingRecord_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingRecord" ADD CONSTRAINT "PackingRecord_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingChecklistItem" ADD CONSTRAINT "PackingChecklistItem_packingRecordId_fkey" FOREIGN KEY ("packingRecordId") REFERENCES "PackingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingChecklistItem" ADD CONSTRAINT "PackingChecklistItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingMaterialConfig" ADD CONSTRAINT "PackingMaterialConfig_paxTypeId_fkey" FOREIGN KEY ("paxTypeId") REFERENCES "PaxType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingMaterialConfig" ADD CONSTRAINT "PackingMaterialConfig_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAsset" ADD CONSTRAINT "CompanyAsset_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAsset" ADD CONSTRAINT "CompanyAsset_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAsset" ADD CONSTRAINT "CompanyAsset_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMaintenanceRecord" ADD CONSTRAINT "AssetMaintenanceRecord_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CompanyAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMaintenanceRecord" ADD CONSTRAINT "AssetMaintenanceRecord_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignmentHistory" ADD CONSTRAINT "AssetAssignmentHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "CompanyAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignmentHistory" ADD CONSTRAINT "AssetAssignmentHistory_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryRuleSet" ADD CONSTRAINT "StatutoryRuleSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayrollRecord" ADD CONSTRAINT "EmployeePayrollRecord_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayrollRecord" ADD CONSTRAINT "EmployeePayrollRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayrollRecord" ADD CONSTRAINT "EmployeePayrollRecord_statutoryRuleSetId_fkey" FOREIGN KEY ("statutoryRuleSetId") REFERENCES "StatutoryRuleSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

