import { prisma } from "../prisma";
import { CellInwardSchema, PartNumberInwardSchema } from "../schemas/zod.schemas";
import { CellStatus } from "../generated/client";
import { parse } from "csv-parse/sync";
import * as ExcelJS from "exceljs";
import { normalizeSerial } from "../utils/serial";

export class CellService {
  /**
   * Generates a unique sequential Inward reference number: INW-YYYY-XXXXXX
   */
  static async generateInwardNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.cellInwardBatch.count();
    const sequence = (count + 1).toString().padStart(6, "0");
    return `INW-${year}-${sequence}`;
  }

  /**
   * Creates a quantity-based cell inward batch transaction.
   * Updates/Increments Material stock, records StockMovement, creates CellInwardBatch and AuditLog.
   */
  static async createInwardBatch(data: {
    partNumber: string;
    quantity: number;
    batchNumber: string;
    category: string;
    voltage: number;
    cycles: number;
    notes?: string | null;
  }, userId: string) {
    const validated = PartNumberInwardSchema.parse(data);

    return await prisma.$transaction(async (tx) => {
      // 1. Locate or verify Material SKU in Master table
      let material = await tx.material.findUnique({
        where: { sku: validated.partNumber }
      });

      if (!material) {
        // Automatically create Material item if it doesn't exist yet under CELLS category
        material = await tx.material.create({
          data: {
            name: `${validated.partNumber} Cell (${validated.category})`,
            category: "CELLS",
            sku: validated.partNumber,
            quantity: validated.quantity,
            unit: "pcs",
            minStock: 50,
            unitPrice: 0,
            totalValue: 0,
            isPriceVerified: false,
            materialType: "CELL_RAW"
          }
        });
      } else {
        // Increment material stock
        material = await tx.material.update({
          where: { id: material.id },
          data: {
            quantity: material.quantity + validated.quantity,
            lastRestock: new Date()
          }
        });
      }

      // 2. Generate unique Inward Number
      const inwardNumber = await CellService.generateInwardNumber();

      // 3. Create the Cell Inward Batch
      const inwardBatch = await tx.cellInwardBatch.create({
        data: {
          inwardNumber,
          partNumber: validated.partNumber,
          materialId: material.id,
          batchNumber: validated.batchNumber,
          quantity: validated.quantity,
          availableQty: validated.quantity,
          testedQty: 0,
          rejectedQty: 0,
          consumedQty: 0,
          category: validated.category,
          voltage: validated.voltage,
          cycles: validated.cycles,
          receivedById: userId,
          status: "RECEIVED",
          notes: validated.notes || null,
        },
        include: {
          receivedBy: { select: { id: true, name: true, email: true } },
          material: true
        }
      });

      // 4. Create StockMovement entry for ERP traceability
      await tx.stockMovement.create({
        data: {
          materialId: material.id,
          quantity: validated.quantity,
          movementType: "RECEIPT",
          source: "CELL_INWARD",
          userId: userId,
          reason: `Cell Inward ${inwardNumber}: Received ${validated.quantity} units (Batch: ${validated.batchNumber})`
        }
      });

      // 5. Create AuditLog
      await tx.auditLog.create({
        data: {
          entityType: "cell_inward_batch",
          entityId: inwardBatch.id,
          actorId: userId,
          action: "CELL_INWARD_BATCH_CREATED",
          newStatus: "RECEIVED",
          metadata: {
            inwardNumber,
            partNumber: validated.partNumber,
            quantity: validated.quantity,
            batchNumber: validated.batchNumber,
            category: validated.category,
            voltage: validated.voltage,
            cycles: validated.cycles
          }
        }
      });

      return inwardBatch;
    });
  }

  /**
   * Parses CSV/Excel file for bulk quantity-based inward manifest
   */
  static async previewBulkInwardBatches(buffer: Buffer, extension: string) {
    let records: any[] = [];

    if (extension === "csv") {
      records = parse(buffer as any, { columns: true, skip_empty_lines: true, trim: true });
    } else if (extension === "xlsx" || extension === "xls") {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.worksheets[0];
      const headers: string[] = [];

      worksheet.getRow(1).eachCell((cell: any) => {
        headers.push(cell.value?.toString() || "");
      });

      worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return;
        const record: any = {};
        row.eachCell((cell: any, colNumber: number) => {
          record[headers[colNumber - 1]] = cell.value;
        });
        records.push(record);
      });
    } else {
      throw new Error("Unsupported file format. Please upload CSV or Excel files.");
    }

    const rows: any[] = [];
    const errors: string[] = [];
    let totalQuantity = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        const normalized: any = { voltage: 3.2, cycles: 0 };
        for (const key of Object.keys(record)) {
          const cleanKey = key.trim().toLowerCase().replace(/[\s_.-]/g, "");
          const val = record[key]?.toString()?.trim();
          if (!val) continue;

          if (cleanKey.includes("partnumber") || cleanKey === "partno" || cleanKey === "part" || cleanKey === "sku" || cleanKey === "item") {
            normalized.partNumber = val.toUpperCase();
          } else if (cleanKey.includes("qty") || cleanKey.includes("quantity") || cleanKey === "count") {
            normalized.quantity = parseInt(val, 10);
          } else if (cleanKey.includes("batch")) {
            normalized.batchNumber = val.toUpperCase();
          } else if (cleanKey.includes("voltage") || cleanKey === "v" || cleanKey === "volts") {
            normalized.voltage = parseFloat(val);
          } else if (cleanKey.includes("category") || cleanKey === "cat" || cleanKey === "type" || cleanKey === "chemistry") {
            normalized.category = val;
          } else if (cleanKey.includes("cycle")) {
            normalized.cycles = parseInt(val, 10);
          } else if (cleanKey.includes("note") || cleanKey.includes("remark")) {
            normalized.notes = val;
          }
        }

        if (!normalized.partNumber) {
          throw new Error("Missing Part Number / SKU");
        }
        if (!normalized.quantity || normalized.quantity <= 0) {
          throw new Error("Invalid or missing Quantity (must be > 0)");
        }
        if (!normalized.batchNumber) {
          normalized.batchNumber = `BATCH-${new Date().toISOString().slice(0, 10)}`;
        }
        if (!normalized.category) {
          normalized.category = "LFP 3.2V";
        }

        const validated = PartNumberInwardSchema.parse(normalized);
        totalQuantity += validated.quantity;
        rows.push(validated);
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    return {
      rows,
      summary: {
        totalBatches: rows.length,
        totalQuantity,
        errorCount: errors.length,
        totalRows: records.length
      },
      errors
    };
  }

  /**
   * Commits bulk quantity-based inward batches atomically.
   */
  static async commitBulkInwardBatches(batches: any[], userId: string) {
    let createdCount = 0;
    let totalQtyInwarded = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of batches) {
        const validated = PartNumberInwardSchema.parse(item);

        // 1. Locate or create Material
        let material = await tx.material.findUnique({
          where: { sku: validated.partNumber }
        });

        if (!material) {
          material = await tx.material.create({
            data: {
              name: `${validated.partNumber} Cell (${validated.category})`,
              category: "CELLS",
              sku: validated.partNumber,
              quantity: validated.quantity,
              unit: "pcs",
              minStock: 50,
              unitPrice: 0,
              totalValue: 0,
              isPriceVerified: false,
              materialType: "CELL_RAW"
            }
          });
        } else {
          material = await tx.material.update({
            where: { id: material.id },
            data: {
              quantity: material.quantity + validated.quantity,
              lastRestock: new Date()
            }
          });
        }

        const count = await tx.cellInwardBatch.count();
        const inwardNumber = `INW-${new Date().getFullYear()}-${(count + 1).toString().padStart(6, "0")}`;

        // 2. Create Inward Batch
        const inwardBatch = await tx.cellInwardBatch.create({
          data: {
            inwardNumber,
            partNumber: validated.partNumber,
            materialId: material.id,
            batchNumber: validated.batchNumber,
            quantity: validated.quantity,
            availableQty: validated.quantity,
            category: validated.category,
            voltage: validated.voltage,
            cycles: validated.cycles,
            receivedById: userId,
            status: "RECEIVED",
            notes: validated.notes || null
          }
        });

        // 3. Stock movement
        await tx.stockMovement.create({
          data: {
            materialId: material.id,
            quantity: validated.quantity,
            movementType: "RECEIPT",
            source: "CELL_INWARD_BULK",
            userId: userId,
            reason: `Bulk Inward ${inwardNumber}: Received ${validated.quantity} units (Batch: ${validated.batchNumber})`
          }
        });

        // 4. Audit log
        await tx.auditLog.create({
          data: {
            entityType: "cell_inward_batch",
            entityId: inwardBatch.id,
            actorId: userId,
            action: "CELL_INWARD_BULK_COMMIT",
            newStatus: "RECEIVED",
            metadata: {
              inwardNumber,
              partNumber: validated.partNumber,
              quantity: validated.quantity,
              batchNumber: validated.batchNumber
            }
          }
        });

        createdCount++;
        totalQtyInwarded += validated.quantity;
      }
    });

    return {
      success: true,
      created: createdCount,
      totalQuantity: totalQtyInwarded
    };
  }

  /**
   * Deprecated backward compatibility methods for legacy serial-based inward
   */
  static async previewBulkInward(buffer: Buffer, extension: string) {
    let records: any[] = [];
    if (extension === "csv") {
      records = parse(buffer as any, { columns: true, skip_empty_lines: true, trim: true });
    } else if (extension === "xlsx" || extension === "xls") {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const worksheet = workbook.worksheets[0];
      const headers: string[] = [];
      worksheet.getRow(1).eachCell((cell: any) => headers.push(cell.value?.toString() || ""));
      worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return;
        const record: any = {};
        row.eachCell((cell: any, colNumber: number) => {
          record[headers[colNumber - 1]] = cell.value;
        });
        records.push(record);
      });
    } else {
      throw new Error("Unsupported file format");
    }

    const rows: any[] = [];
    const errors: string[] = [];
    let newCount = 0;
    let duplicateCount = 0;

    for (const record of records) {
      try {
        const normalized: any = { cycles: 0 };
        for (const key of Object.keys(record)) {
          const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "");
          const val = record[key]?.toString()?.trim();
          if (!val) continue;
          if (cleanKey.includes("serial") || cleanKey.includes("sn") || cleanKey === "id") normalized.serialNumber = normalizeSerial(val);
          else if (cleanKey.includes("batch")) normalized.batchNumber = val;
          else if (cleanKey.includes("voltage") || cleanKey === "v") normalized.voltage = parseFloat(val);
          else if (cleanKey.includes("category") || cleanKey === "cat" || cleanKey === "type") normalized.category = val;
          else if (cleanKey.includes("cycle")) normalized.cycles = parseInt(val, 10);
        }

        const validated = CellInwardSchema.parse(normalized);
        const existing = await prisma.cell.findUnique({ where: { serialNumber: validated.serialNumber } });
        if (existing) {
          duplicateCount++;
          rows.push({ ...validated, isUpdate: true });
        } else {
          newCount++;
          rows.push({ ...validated, isUpdate: false });
        }
      } catch (err: any) {
        errors.push(`Row ${records.indexOf(record) + 2}: ${err.message}`);
      }
    }

    return { rows, summary: { newCount, duplicateCount, total: records.length }, errors };
  }

  static async commitBulkInward(rows: any[], userId: string) {
    const results = { created: 0, updated: 0, errors: 0 };
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const { isUpdate, ...data } = row;
        await tx.cell.upsert({
          where: { serialNumber: data.serialNumber },
          update: { ...data, updatedAt: new Date() },
          create: { ...data, status: CellStatus.RAW }
        });
        if (isUpdate) results.updated++;
        else results.created++;

        await tx.auditLog.create({
          data: {
            entityType: "cell",
            entityId: data.serialNumber,
            actorId: userId,
            action: isUpdate ? "BULK_UPDATE" : "BULK_INWARD",
            newStatus: CellStatus.RAW,
            metadata: { bulk: true, batchNumber: data.batchNumber }
          }
        });
      }
    });
    return results;
  }
}
