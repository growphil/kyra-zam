-- CreateEnum MediaCategory
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaCategory') THEN
        CREATE TYPE "MediaCategory" AS ENUM (
            'PRODUCT_IMAGE',
            'PRODUCT_GALLERY',
            'MATERIAL_IMAGE',
            'EMPLOYEE_PROFILE',
            'EMPLOYEE_DOCUMENT',
            'FINANCE_PAYMENT_PROOF',
            'FINANCE_INVOICE',
            'FINANCE_RECEIPT',
            'PROCUREMENT_PO',
            'PROCUREMENT_GRN',
            'PROCUREMENT_SUPPLIER_INVOICE',
            'PROCUREMENT_INVOICE_ORDER',
            'PRODUCTION_JOB_CARD',
            'PRODUCTION_REPORT',
            'QUALITY_PAX_REPORT',
            'QUALITY_INSPECTION',
            'SERVICE_RMA',
            'SERVICE_BATTERY_PHOTO',
            'SERVICE_REPORT',
            'INVENTORY_SCRAP',
            'DISPATCH_POD',
            'DISPATCH_SIGNATURE',
            'GENERAL_ATTACHMENT'
        );
    END IF;
END $$;

-- CreateEnum MediaVisibility
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaVisibility') THEN
        CREATE TYPE "MediaVisibility" AS ENUM ('PRIVATE', 'PUBLIC_CATALOG', 'RESTRICTED');
    END IF;
END $$;

-- CreateEnum MediaUploadStatus
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaUploadStatus') THEN
        CREATE TYPE "MediaUploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'DELETED');
    END IF;
END $$;

-- CreateTable MediaAsset
CREATE TABLE IF NOT EXISTS "MediaAsset" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileExtension" TEXT,
    "fileSize" INTEGER,
    "storageProvider" TEXT NOT NULL DEFAULT 'S3',
    "category" "MediaCategory" NOT NULL,
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "MediaUploadStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");
CREATE INDEX IF NOT EXISTS "MediaAsset_category_idx" ON "MediaAsset"("category");
CREATE INDEX IF NOT EXISTS "MediaAsset_entityType_entityId_idx" ON "MediaAsset"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "MediaAsset_uploadedById_idx" ON "MediaAsset"("uploadedById");
CREATE INDEX IF NOT EXISTS "MediaAsset_status_idx" ON "MediaAsset"("status");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'MediaAsset_uploadedById_fkey'
    ) THEN
        ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

