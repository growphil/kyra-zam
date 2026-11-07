-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ULTRA_ADMIN';

-- CreateTable ComponentMaster
CREATE TABLE IF NOT EXISTS "ComponentMaster" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturerPartNumber" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "technicalSpecs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable CategorySequence
CREATE TABLE IF NOT EXISTS "CategorySequence" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "nextSequence" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategorySequence_pkey" PRIMARY KEY ("id")
);

-- Create Indexes for ComponentMaster
CREATE UNIQUE INDEX IF NOT EXISTS "ComponentMaster_partNumber_key" ON "ComponentMaster"("partNumber");
CREATE INDEX IF NOT EXISTS "ComponentMaster_category_idx" ON "ComponentMaster"("category");
CREATE INDEX IF NOT EXISTS "ComponentMaster_partNumber_idx" ON "ComponentMaster"("partNumber");
CREATE INDEX IF NOT EXISTS "ComponentMaster_name_idx" ON "ComponentMaster"("name");
CREATE INDEX IF NOT EXISTS "ComponentMaster_manufacturerPartNumber_idx" ON "ComponentMaster"("manufacturerPartNumber");

-- Create Indexes for CategorySequence
CREATE UNIQUE INDEX IF NOT EXISTS "CategorySequence_category_key" ON "CategorySequence"("category");
CREATE INDEX IF NOT EXISTS "CategorySequence_category_idx" ON "CategorySequence"("category");

-- AlterTable Material
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "partNumber" TEXT;
CREATE INDEX IF NOT EXISTS "Material_partNumber_idx" ON "Material"("partNumber");
CREATE INDEX IF NOT EXISTS "Material_materialCode_idx" ON "Material"("materialCode");

-- AlterTable Product: add nullable componentId
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "componentId" TEXT;
CREATE INDEX IF NOT EXISTS "Product_componentId_idx" ON "Product"("componentId");

-- Add ForeignKey Product -> ComponentMaster (Strictly validated)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Product_componentId_fkey' AND confdeltype != 'n'
    ) THEN
        ALTER TABLE "Product" DROP CONSTRAINT "Product_componentId_fkey";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_componentId_fkey') THEN
        ALTER TABLE "Product" ADD CONSTRAINT "Product_componentId_fkey" 
            FOREIGN KEY ("componentId") REFERENCES "ComponentMaster"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable InvoiceOrder: add isDirect and make purchaseOrderId nullable
ALTER TABLE "InvoiceOrder" ADD COLUMN IF NOT EXISTS "isDirect" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InvoiceOrder" ALTER COLUMN "purchaseOrderId" DROP NOT NULL;

-- Ensure foreign key on InvoiceOrder(purchaseOrderId) preserves deliberate ON DELETE RESTRICT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'InvoiceOrder_purchaseOrderId_fkey' AND confdeltype != 'r'
    ) THEN
        ALTER TABLE "InvoiceOrder" DROP CONSTRAINT "InvoiceOrder_purchaseOrderId_fkey";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceOrder_purchaseOrderId_fkey') THEN
        ALTER TABLE "InvoiceOrder" ADD CONSTRAINT "InvoiceOrder_purchaseOrderId_fkey" 
            FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") 
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AlterTable GoodsReceipt: make purchaseOrderId nullable
ALTER TABLE "GoodsReceipt" ALTER COLUMN "purchaseOrderId" DROP NOT NULL;

-- Ensure foreign key on GoodsReceipt(purchaseOrderId) preserves deliberate ON DELETE RESTRICT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'GoodsReceipt_purchaseOrderId_fkey' AND confdeltype != 'r'
    ) THEN
        ALTER TABLE "GoodsReceipt" DROP CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GoodsReceipt_purchaseOrderId_fkey') THEN
        ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_purchaseOrderId_fkey" 
            FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") 
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

