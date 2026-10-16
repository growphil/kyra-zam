-- CreateTable
CREATE TABLE "WorkOrderExecution" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "actualHours" DOUBLE PRECISION DEFAULT 0,
    "pauseReason" TEXT,
    "completionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderExecution_workOrderId_key" ON "WorkOrderExecution"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderExecution_workOrderId_idx" ON "WorkOrderExecution"("workOrderId");

-- AddForeignKey
ALTER TABLE "WorkOrderExecution" ADD CONSTRAINT "WorkOrderExecution_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
