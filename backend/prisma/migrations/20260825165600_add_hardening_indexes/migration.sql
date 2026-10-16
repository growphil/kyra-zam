-- CreateIndex
CREATE INDEX "InventoryReservation_materialId_status_idx" ON "InventoryReservation"("materialId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_paxSerial_status_idx" ON "InventoryReservation"("paxSerial", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Warranty_paxSerial_active" ON "Warranty"("paxSerial") WHERE "status" = 'ACTIVE';
