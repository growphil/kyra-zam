-- CreateEnum
CREATE TYPE "InvoiceOrderType" AS ENUM ('PROFORMA', 'FINAL_TAX_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "InvoiceOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_INVENTORY', 'INVENTORY_VERIFIED', 'PENDING_ADMIN_APPROVAL', 'CORRECTION_REQUIRED', 'REJECTED', 'APPROVED', 'QC_PENDING', 'PARTIALLY_ACCEPTED', 'READY_TO_STOCK', 'STOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InvoicePaymentMode" AS ENUM ('CREDIT', 'PAID', 'PARTIALLY_PAID');

-- CreateTable
CREATE TABLE "InvoiceOrder" (
    "id" TEXT NOT NULL,
    "ioNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "supplierInvoiceNumber" TEXT NOT NULL,
    "invoiceType" "InvoiceOrderType" NOT NULL DEFAULT 'FINAL_TAX_INVOICE',
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "additionalCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "paymentMode" "InvoicePaymentMode" NOT NULL DEFAULT 'CREDIT',
    "paymentMethod" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "InvoiceOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "inventoryVerifiedById" TEXT,
    "inventoryVerifiedAt" TIMESTAMP(3),
    "adminApprovedById" TEXT,
    "adminApprovedAt" TIMESTAMP(3),
    "goodsReceiptId" TEXT,
    "rejectionReason" TEXT,
    "correctionRemarks" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceOrderItem" (
    "id" TEXT NOT NULL,
    "invoiceOrderId" TEXT NOT NULL,
    "poItemId" TEXT,
    "materialId" TEXT,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "invoiceQuantity" INTEGER NOT NULL,
    "actualReceivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "acceptedQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "shortageQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "batchNumber" TEXT,
    "serialNumber" TEXT,
    "warehouseId" TEXT,
    "warehouseLocationId" TEXT,
    "inspectionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceOrderVerification" (
    "id" TEXT NOT NULL,
    "invoiceOrderId" TEXT NOT NULL,
    "verifiedById" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "remarks" TEXT,
    "discrepancySummary" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceOrderVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceOrderApproval" (
    "id" TEXT NOT NULL,
    "invoiceOrderId" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL,
    "remarks" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceOrderApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceOrderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentReference" TEXT,
    "paymentDocument" TEXT,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceDocument" (
    "id" TEXT NOT NULL,
    "invoiceOrderId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileReference" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceOrder_ioNumber_key" ON "InvoiceOrder"("ioNumber");

-- CreateIndex
CREATE INDEX "InvoiceOrder_ioNumber_idx" ON "InvoiceOrder"("ioNumber");
CREATE INDEX "InvoiceOrder_purchaseOrderId_idx" ON "InvoiceOrder"("purchaseOrderId");
CREATE INDEX "InvoiceOrder_vendorId_idx" ON "InvoiceOrder"("vendorId");
CREATE INDEX "InvoiceOrder_status_idx" ON "InvoiceOrder"("status");
CREATE INDEX "InvoiceOrder_createdById_idx" ON "InvoiceOrder"("createdById");

-- CreateIndex
CREATE INDEX "InvoiceOrderItem_invoiceOrderId_idx" ON "InvoiceOrderItem"("invoiceOrderId");
CREATE INDEX "InvoiceOrderItem_poItemId_idx" ON "InvoiceOrderItem"("poItemId");
CREATE INDEX "InvoiceOrderItem_materialId_idx" ON "InvoiceOrderItem"("materialId");
CREATE INDEX "InvoiceOrderItem_productId_idx" ON "InvoiceOrderItem"("productId");

-- CreateIndex
CREATE INDEX "InvoiceOrderVerification_invoiceOrderId_idx" ON "InvoiceOrderVerification"("invoiceOrderId");
CREATE INDEX "InvoiceOrderVerification_verifiedById_idx" ON "InvoiceOrderVerification"("verifiedById");

-- CreateIndex
CREATE INDEX "InvoiceOrderApproval_invoiceOrderId_idx" ON "InvoiceOrderApproval"("invoiceOrderId");
CREATE INDEX "InvoiceOrderApproval_approvedById_idx" ON "InvoiceOrderApproval"("approvedById");

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceOrderId_idx" ON "InvoicePayment"("invoiceOrderId");
CREATE INDEX "InvoicePayment_recordedById_idx" ON "InvoicePayment"("recordedById");

-- CreateIndex
CREATE INDEX "InvoiceDocument_invoiceOrderId_idx" ON "InvoiceDocument"("invoiceOrderId");
CREATE INDEX "InvoiceDocument_uploadedById_idx" ON "InvoiceDocument"("uploadedById");

-- AddForeignKey
ALTER TABLE "InvoiceOrder" ADD CONSTRAINT "InvoiceOrder_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrder" ADD CONSTRAINT "InvoiceOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrder" ADD CONSTRAINT "InvoiceOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrder" ADD CONSTRAINT "InvoiceOrder_inventoryVerifiedById_fkey" FOREIGN KEY ("inventoryVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrder" ADD CONSTRAINT "InvoiceOrder_adminApprovedById_fkey" FOREIGN KEY ("adminApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrder" ADD CONSTRAINT "InvoiceOrder_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceOrderItem" ADD CONSTRAINT "InvoiceOrderItem_invoiceOrderId_fkey" FOREIGN KEY ("invoiceOrderId") REFERENCES "InvoiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrderItem" ADD CONSTRAINT "InvoiceOrderItem_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrderItem" ADD CONSTRAINT "InvoiceOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrderItem" ADD CONSTRAINT "InvoiceOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrderItem" ADD CONSTRAINT "InvoiceOrderItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrderItem" ADD CONSTRAINT "InvoiceOrderItem_warehouseLocationId_fkey" FOREIGN KEY ("warehouseLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceOrderVerification" ADD CONSTRAINT "InvoiceOrderVerification_invoiceOrderId_fkey" FOREIGN KEY ("invoiceOrderId") REFERENCES "InvoiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrderVerification" ADD CONSTRAINT "InvoiceOrderVerification_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceOrderApproval" ADD CONSTRAINT "InvoiceOrderApproval_invoiceOrderId_fkey" FOREIGN KEY ("invoiceOrderId") REFERENCES "InvoiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceOrderApproval" ADD CONSTRAINT "InvoiceOrderApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceOrderId_fkey" FOREIGN KEY ("invoiceOrderId") REFERENCES "InvoiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_invoiceOrderId_fkey" FOREIGN KEY ("invoiceOrderId") REFERENCES "InvoiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

