-- CreateEnum ExpenseStatus
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseStatus') THEN
        CREATE TYPE "ExpenseStatus" AS ENUM (
            'DRAFT',
            'PENDING_VERIFICATION',
            'AUTO_APPROVED',
            'APPROVED',
            'REJECTED',
            'CANCELLED'
        );
    END IF;
END $$;

-- CreateEnum ExpenseApprovalMethod
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseApprovalMethod') THEN
        CREATE TYPE "ExpenseApprovalMethod" AS ENUM ('AUTO', 'ACCOUNTANT', 'SUPERADMIN');
    END IF;
END $$;

-- CreateEnum ExpensePaymentStatus
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpensePaymentStatus') THEN
        CREATE TYPE "ExpensePaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIALLY_PAID');
    END IF;
END $$;

-- CreateTable ExpenseCategory
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExpenseThreshold
CREATE TABLE IF NOT EXISTS "ExpenseThreshold" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable Expense
CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "department" TEXT,
    "costCentre" TEXT,
    "vendorName" TEXT,
    "vendorContact" TEXT,
    "invoiceNumber" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "paymentReference" TEXT,
    "paymentStatus" "ExpensePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "approvalMethod" "ExpenseApprovalMethod",
    "submittedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "thresholdSnapshot" DECIMAL(12,2),
    "thresholdCurrency" TEXT DEFAULT 'ZMW',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExpenseAttachment
CREATE TABLE IF NOT EXISTS "ExpenseAttachment" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'RECEIPT',
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExpenseApproval
CREATE TABLE IF NOT EXISTS "ExpenseApproval" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "approverId" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "approvalLevel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExpenseLedger
CREATE TABLE IF NOT EXISTS "ExpenseLedger" (
    "id" TEXT NOT NULL,
    "ledgerNumber" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "categoryName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "vendorName" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "department" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "approvedByName" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvalMethod" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable ExpenseAuditLog
CREATE TABLE IF NOT EXISTS "ExpenseAuditLog" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseAuditLog_pkey" PRIMARY KEY ("id")
);

-- Unique & Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE INDEX IF NOT EXISTS "ExpenseCategory_name_idx" ON "ExpenseCategory"("name");
CREATE INDEX IF NOT EXISTS "ExpenseCategory_isActive_idx" ON "ExpenseCategory"("isActive");

CREATE INDEX IF NOT EXISTS "ExpenseThreshold_isActive_idx" ON "ExpenseThreshold"("isActive");
CREATE INDEX IF NOT EXISTS "ExpenseThreshold_effectiveFrom_idx" ON "ExpenseThreshold"("effectiveFrom");

CREATE UNIQUE INDEX IF NOT EXISTS "Expense_expenseNumber_key" ON "Expense"("expenseNumber");
CREATE INDEX IF NOT EXISTS "Expense_expenseNumber_idx" ON "Expense"("expenseNumber");
CREATE INDEX IF NOT EXISTS "Expense_status_idx" ON "Expense"("status");
CREATE INDEX IF NOT EXISTS "Expense_categoryId_idx" ON "Expense"("categoryId");
CREATE INDEX IF NOT EXISTS "Expense_submittedById_idx" ON "Expense"("submittedById");
CREATE INDEX IF NOT EXISTS "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE INDEX IF NOT EXISTS "Expense_createdAt_idx" ON "Expense"("createdAt");

CREATE INDEX IF NOT EXISTS "ExpenseAttachment_expenseId_idx" ON "ExpenseAttachment"("expenseId");

CREATE INDEX IF NOT EXISTS "ExpenseApproval_expenseId_idx" ON "ExpenseApproval"("expenseId");
CREATE INDEX IF NOT EXISTS "ExpenseApproval_approverId_idx" ON "ExpenseApproval"("approverId");

CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseLedger_ledgerNumber_key" ON "ExpenseLedger"("ledgerNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseLedger_expenseId_key" ON "ExpenseLedger"("expenseId");
CREATE INDEX IF NOT EXISTS "ExpenseLedger_ledgerNumber_idx" ON "ExpenseLedger"("ledgerNumber");
CREATE INDEX IF NOT EXISTS "ExpenseLedger_expenseNumber_idx" ON "ExpenseLedger"("expenseNumber");
CREATE INDEX IF NOT EXISTS "ExpenseLedger_expenseDate_idx" ON "ExpenseLedger"("expenseDate");
CREATE INDEX IF NOT EXISTS "ExpenseLedger_categoryName_idx" ON "ExpenseLedger"("categoryName");
CREATE INDEX IF NOT EXISTS "ExpenseLedger_createdAt_idx" ON "ExpenseLedger"("createdAt");

CREATE INDEX IF NOT EXISTS "ExpenseAuditLog_expenseId_idx" ON "ExpenseAuditLog"("expenseId");
CREATE INDEX IF NOT EXISTS "ExpenseAuditLog_actorId_idx" ON "ExpenseAuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "ExpenseAuditLog_action_idx" ON "ExpenseAuditLog"("action");
CREATE INDEX IF NOT EXISTS "ExpenseAuditLog_createdAt_idx" ON "ExpenseAuditLog"("createdAt");

-- Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ExpenseThreshold_createdById_fkey') THEN
        ALTER TABLE "ExpenseThreshold" ADD CONSTRAINT "ExpenseThreshold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Expense_categoryId_fkey') THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Expense_submittedById_fkey') THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Expense_approvedById_fkey') THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Expense_rejectedById_fkey') THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ExpenseAttachment_expenseId_fkey') THEN
        ALTER TABLE "ExpenseAttachment" ADD CONSTRAINT "ExpenseAttachment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ExpenseAttachment_uploadedById_fkey') THEN
        ALTER TABLE "ExpenseAttachment" ADD CONSTRAINT "ExpenseAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ExpenseApproval_expenseId_fkey') THEN
        ALTER TABLE "ExpenseApproval" ADD CONSTRAINT "ExpenseApproval_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ExpenseApproval_approverId_fkey') THEN
        ALTER TABLE "ExpenseApproval" ADD CONSTRAINT "ExpenseApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ExpenseLedger_expenseId_fkey') THEN
        ALTER TABLE "ExpenseLedger" ADD CONSTRAINT "ExpenseLedger_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ExpenseAuditLog_expenseId_fkey') THEN
        ALTER TABLE "ExpenseAuditLog" ADD CONSTRAINT "ExpenseAuditLog_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ExpenseAuditLog_actorId_fkey') THEN
        ALTER TABLE "ExpenseAuditLog" ADD CONSTRAINT "ExpenseAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
