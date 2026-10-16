-- CreateTable
CREATE TABLE "WorkOrderScheduling" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "assignedDate" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "estimatedHrs" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderScheduling_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderScheduling_workOrderId_key" ON "WorkOrderScheduling"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderScheduling_assignedDate_idx" ON "WorkOrderScheduling"("assignedDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderScheduling_assignedDate_sequence_key" ON "WorkOrderScheduling"("assignedDate", "sequence");

-- AddForeignKey
ALTER TABLE "WorkOrderScheduling" ADD CONSTRAINT "WorkOrderScheduling_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
