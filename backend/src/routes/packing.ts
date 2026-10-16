import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";
import QRCode from "qrcode";

// Sequential numbering helpers
async function generatePackingNumber(tx?: any): Promise<string> {
  const client = tx || prisma;
  const currentYear = new Date().getFullYear();
  const last = await client.packingRecord.findFirst({
    where: { packingNumber: { startsWith: `PK-${currentYear}-` } },
    orderBy: { packingNumber: "desc" }
  });

  let next = 1;
  if (last) {
    const parts = last.packingNumber.split("-");
    if (parts.length >= 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) next = parsed + 1;
    }
  }
  return `PK-${currentYear}-${String(next).padStart(6, "0")}`;
}

async function generateStickerNumber(tx?: any): Promise<string> {
  const client = tx || prisma;
  const currentYear = new Date().getFullYear();
  const last = await client.packingRecord.findFirst({
    where: { stickerNumber: { startsWith: `STK-${currentYear}-` } },
    orderBy: { stickerNumber: "desc" }
  });

  let next = 1;
  if (last && last.stickerNumber) {
    const parts = last.stickerNumber.split("-");
    if (parts.length >= 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) next = parsed + 1;
    }
  }
  return `STK-${currentYear}-${String(next).padStart(6, "0")}`;
}

// Standard fallback packing materials if not customized per PaxType
const DEFAULT_PACKING_MATERIALS = [
  { name: "Fast Battery Charger", quantity: 1, isRequired: true, notes: "Verify voltage & connector" },
  { name: "AC Power Charging Cable", quantity: 1, isRequired: true, notes: "Standard 3-pin plug" },
  { name: "User Instruction & Safety Manual", quantity: 1, isRequired: true, notes: "KYRA ZAM Official Manual" },
  { name: "Warranty Certificate Card", quantity: 1, isRequired: true, notes: "With printed serial & date" },
  { name: "Mounting Bracket & Screw Kit", quantity: 1, isRequired: true, notes: "Complete hardware set" },
  { name: "Auxiliary Wiring Harness", quantity: 1, isRequired: false, notes: "Vehicle interface connector" },
  { name: "High-Density Protective EPE Foam Set", quantity: 2, isRequired: true, notes: "Top & bottom cushions" },
  { name: "Heavy-Duty Corrugated Outer Box", quantity: 1, isRequired: true, notes: "With UN/battery hazard mark" }
];

// Standard box inspection checklist
const DEFAULT_BOX_CHECKLIST = [
  { name: "Correct outer carton matching Pax Type model", isRequired: true },
  { name: "Carton is clean, rigid, dry and free of damage", isRequired: true },
  { name: "Battery pack placed in correct orientation", isRequired: true },
  { name: "All shock-absorbing protective foam pads installed", isRequired: true },
  { name: "Charger, cables and hardware accessories safely nested", isRequired: true },
  { name: "User manual and warranty documentation enclosed", isRequired: true },
  { name: "Battery specification & hazard warning label applied", isRequired: true },
  { name: "Packing sticker printed and affixed to designated spot", isRequired: true },
  { name: "Box securely taped and tamper-evident seal applied", isRequired: true }
];

export async function packingRoutes(fastify: FastifyInstance) {
  const packingAuth = {
    preHandler: [
      requireRoles(
        "PACKING_OPERATOR",
        "PACKING",
        "INVENTORY_MANAGER",
        "SUPERVISOR",
        "ADMIN",
        "SUPERADMIN",
        "QC"
      )
    ]
  };

  const packingActionAuth = {
    preHandler: [
      requireRoles(
        "PACKING_OPERATOR",
        "PACKING",
        "INVENTORY_MANAGER",
        "SUPERVISOR",
        "ADMIN",
        "SUPERADMIN"
      )
    ]
  };

  // ── 1. GET /packing/stats — Overview KPIs ──────────────────────────────────
  fastify.get("/stats", packingAuth, async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      readyForPacking,
      packingInProgress,
      packedToday,
      transferredToFGToday,
      totalTransferred
    ] = await Promise.all([
      // Packs passed QC/testing awaiting packing
      prisma.paxPack.count({
        where: {
          status: { in: ["READY_FOR_PACKING", "READY_FOR_SALE", "PAX_TESTED"] },
          packingRecord: null
        }
      }),
      // Active packing records in progress
      prisma.packingRecord.count({
        where: {
          status: { in: ["PACKING_IN_PROGRESS", "CHECKLIST_PENDING", "PACKING_CONFIRMED", "STICKER_GENERATED"] }
        }
      }),
      // Packed today
      prisma.packingRecord.count({
        where: {
          completedAt: { gte: todayStart },
          status: { in: ["PACKED", "TRANSFER_PENDING", "TRANSFERRED_TO_FINISHED_GOODS"] }
        }
      }),
      // Transferred to FG today
      prisma.packingRecord.count({
        where: {
          transferredAt: { gte: todayStart },
          status: "TRANSFERRED_TO_FINISHED_GOODS"
        }
      }),
      // Total ever transferred
      prisma.packingRecord.count({
        where: {
          status: "TRANSFERRED_TO_FINISHED_GOODS"
        }
      })
    ]);

    return {
      readyForPacking,
      packingInProgress,
      packedToday,
      transferredToFGToday,
      totalTransferred
    };
  });

  // ── 2. GET /packing/queue — Packing Queue ───────────────────────────────────
  fastify.get("/queue", packingAuth, async (request) => {
    const { search, paxTypeId, status, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    // Eligible condition:
    // Pax EOL test PASSED/PAX_TESTED and QC APPROVED (or status READY_FOR_PACKING/READY_FOR_SALE)
    // and not already packed & transferred
    const where: any = {
      status: {
        in: ["READY_FOR_PACKING", "READY_FOR_SALE", "PAX_TESTED"]
      },
      OR: [
        { packingRecord: null },
        {
          packingRecord: {
            status: { in: ["READY_FOR_PACKING", "PACKING_IN_PROGRESS", "CHECKLIST_PENDING"] }
          }
        }
      ]
    };

    if (paxTypeId) {
      where.paxTypeId = paxTypeId;
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { paxSerial: { contains: search, mode: "insensitive" } },
            { paxType: { name: { contains: search, mode: "insensitive" } } },
            { workOrder: { workOrderNumber: { contains: search, mode: "insensitive" } } }
          ]
        }
      ];
    }

    const [packs, total] = await Promise.all([
      prisma.paxPack.findMany({
        where,
        skip,
        take,
        orderBy: { assembledAt: "desc" },
        include: {
          paxType: true,
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
              productRef: true,
              supervisor: { select: { id: true, name: true } }
            }
          },
          assembledAtStation: true,
          inspections: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { inspector: { select: { id: true, name: true } } }
          },
          defects: {
            where: { status: { in: ["OPEN", "UNDER_REVIEW"] } }
          },
          packingRecord: {
            include: {
              operator: { select: { id: true, name: true } },
              checklistItems: true
            }
          }
        }
      }),
      prisma.paxPack.count({ where })
    ]);

    // Format queue items with full traceability info and eligibility indicator
    const queueItems = packs.map(pack => {
      const latestInspection = pack.inspections[0];
      const hasPassedQC = latestInspection?.result === "PASS" || pack.approvedBy !== null || pack.status === "READY_FOR_SALE";
      const hasPassedEOL = pack.testReportUrl !== null || pack.status === "PAX_TESTED" || pack.status === "READY_FOR_SALE";
      const hasOpenDefects = pack.defects.length > 0;

      let isEligible = true;
      const reasons: string[] = [];

      if (!hasPassedEOL) {
        isEligible = false;
        reasons.push("EOL Testing not completed or pending");
      }
      if (!hasPassedQC) {
        isEligible = false;
        reasons.push("QC inspection sign-off pending");
      }
      if (hasOpenDefects) {
        isEligible = false;
        reasons.push(`Has ${pack.defects.length} blocking open defect(s)`);
      }

      return {
        paxSerial: pack.paxSerial,
        paxTypeId: pack.paxTypeId,
        paxTypeName: pack.paxType?.name || "Lithium Battery Pack",
        nominalVoltage: pack.paxType?.nominalVoltage || 48.0,
        nominalCapacity: pack.paxType?.nominalCapacity || 32.0,
        configuration: pack.paxType?.configuration || "16S1P",
        cellCount: pack.paxType?.cellCount || 16,
        assembledAt: pack.assembledAt,
        assembledStation: pack.assembledAtStation?.name || "Main Assembly Line",
        workOrderNumber: pack.workOrder?.workOrderNumber || "WO-DIRECT",
        testReportUrl: pack.testReportUrl,
        eolTestStatus: hasPassedEOL ? "PASSED" : "PENDING",
        qcStatus: hasPassedQC ? "APPROVED" : "PENDING",
        qcInspector: latestInspection?.inspector?.name || "QC Inspector",
        qcApprovedAt: pack.approvedAt || latestInspection?.createdAt,
        isEligible,
        ineligibilityReasons: reasons,
        packingRecord: pack.packingRecord
      };
    });

    return {
      queue: queueItems,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take)
    };
  });

  // ── 3. GET /packing/verify/:serial — Verify PaxPack Details ───────────────────
  fastify.get("/verify/:serial", packingAuth, async (request, reply) => {
    const { serial } = request.params as { serial: string };

    const pack = await prisma.paxPack.findUnique({
      where: { paxSerial: serial },
      include: {
        paxType: {
          include: {
            packingConfigs: {
              include: { material: true }
            }
          }
        },
        workOrder: {
          include: {
            supervisor: { select: { id: true, name: true } },
            operators: { include: { user: { select: { id: true, name: true } } } }
          }
        },
        cells: {
          include: {
            cell: {
              select: {
                serialNumber: true,
                partNumber: true,
                batchNumber: true,
                voltage: true,
                ahValue: true,
                irValue: true,
                grade: true
              }
            }
          },
          orderBy: { position: "asc" }
        },
        assembledAtStation: true,
        inspections: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: {
            inspector: { select: { id: true, name: true } },
            checkpoints: true
          }
        },
        defects: {
          where: { status: { in: ["OPEN", "UNDER_REVIEW"] } }
        },
        packingRecord: {
          include: {
            operator: { select: { id: true, name: true } },
            station: true,
            destinationWarehouse: true,
            destinationLocation: true,
            checklistItems: {
              include: { material: true },
              orderBy: { createdAt: "asc" }
            }
          }
        }
      }
    });

    if (!pack) {
      return reply.status(404).send({
        eligible: false,
        reason: "PAX_NOT_FOUND",
        message: `Pax Pack serial "${serial}" was not found in the system.`
      });
    }

    // Check strict eligibility
    const hasPassedEOL = pack.testReportUrl !== null || pack.status === "PAX_TESTED" || pack.status === "READY_FOR_SALE" || pack.status === "READY_FOR_PACKING";
    const latestInspection = pack.inspections[0];
    const hasPassedQC = latestInspection?.result === "PASS" || pack.approvedBy !== null || pack.status === "READY_FOR_SALE";
    const isAlreadyTransferred = pack.packingRecord?.status === "TRANSFERRED_TO_FINISHED_GOODS";
    const isAlreadySold = pack.status === "SOLD_TO_CUSTOMER" || pack.status === "SOLD_TO_VENDOR";
    const isScrapped = pack.status === "SCRAPPED";
    const isUnderRepair = pack.status === "UNDER_REPAIR";
    const hasOpenDefects = pack.defects.length > 0;

    const reasons: string[] = [];
    if (!hasPassedEOL) reasons.push("EOL test has not been completed.");
    if (!hasPassedQC) reasons.push("QC inspection approval is pending.");
    if (hasOpenDefects) reasons.push(`Pax Pack has ${pack.defects.length} blocking open defect(s).`);
    if (isAlreadyTransferred) reasons.push("Pax Pack has already been packed and transferred to Finished Goods.");
    if (isAlreadySold) reasons.push("Pax Pack is already sold/dispatched.");
    if (isScrapped) reasons.push("Pax Pack is marked as SCRAPPED.");
    if (isUnderRepair) reasons.push("Pax Pack is currently under repair.");

    // Check product packing material configuration
    const rawConfigs = pack.paxType?.packingConfigs || [];
    const activeConfigs = rawConfigs
      .map((c: any) => {
        let parsed: any = {};
        try {
          if (c.notes && c.notes.startsWith("{")) parsed = JSON.parse(c.notes);
        } catch {}
        return {
          id: c.id,
          name: c.name,
          materialId: c.materialId,
          materialCode: parsed.materialCode || c.material?.sku || null,
          quantity: c.quantity || 1,
          unit: parsed.unit || c.material?.unit || "PCS",
          isRequired: c.isRequired ?? true,
          conditionOptions: parsed.conditionOptions || "GOOD,DAMAGED,NA",
          notes: parsed.instructions || (typeof c.notes === "string" && !c.notes.startsWith("{") ? c.notes : ""),
          isActive: parsed.isActive !== undefined ? parsed.isActive : true,
          displayOrder: parsed.displayOrder !== undefined ? parsed.displayOrder : 0
        };
      })
      .filter((c: any) => c.isActive !== false)
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder);

    const hasConfiguredMaterials = activeConfigs.length > 0;
    if (!hasConfiguredMaterials) {
      reasons.push(`Packing materials are not configured for this product (${pack.paxType?.name || "Unknown Model"}). Contact the administrator.`);
    }

    const eligible = reasons.length === 0;

    return {
      eligible,
      reasons,
      hasConfiguredMaterials,
      pax: {
        paxSerial: pack.paxSerial,
        status: pack.status,
        assembledAt: pack.assembledAt,
        assembledStation: pack.assembledAtStation?.name || "Main Assembly Line",
        workOrder: pack.workOrder ? {
          id: pack.workOrder.id,
          workOrderNumber: pack.workOrder.workOrderNumber,
          productRef: pack.workOrder.productRef,
          supervisor: pack.workOrder.supervisor?.name || "Supervisor"
        } : null,
        paxType: {
          id: pack.paxType.id,
          name: pack.paxType.name,
          configuration: pack.paxType.configuration,
          nominalVoltage: pack.paxType.nominalVoltage,
          nominalCapacity: pack.paxType.nominalCapacity,
          cellCount: pack.paxType.cellCount,
          cellChemistry: pack.paxType.cellChemistry
        },
        cells: pack.cells.map(c => ({
          position: c.position,
          cellSerial: c.cellSerial,
          voltage: c.cell?.voltage,
          ahValue: c.cell?.ahValue,
          irValue: c.cell?.irValue,
          grade: c.cell?.grade
        })),
        eolTesting: {
          status: hasPassedEOL ? "PASSED" : "PENDING",
          reportUrl: pack.testReportUrl,
          testedAt: pack.assembledAt
        },
        qualityControl: {
          status: hasPassedQC ? "APPROVED" : "PENDING",
          inspector: latestInspection?.inspector?.name || (pack.approvedBy ? "QC Supervisor" : "Pending"),
          approvedAt: pack.approvedAt || latestInspection?.createdAt,
          inspectionNumber: latestInspection?.inspectionNumber || "QC-VERIFIED"
        },
        packingRecord: pack.packingRecord,
        availablePackingMaterials: activeConfigs,
        hasConfiguredMaterials,
        standardBoxChecklist: DEFAULT_BOX_CHECKLIST
      }
    };
  });

  // ── 4. POST /packing/start — Start Packing Session ───────────────────────────
  fastify.post("/start", packingActionAuth, async (request, reply) => {
    const { paxSerial, stationId } = request.body as {
      paxSerial: string;
      stationId?: string;
    };
    const actor = request.user as { id: string; name?: string };

    if (!paxSerial) {
      return reply.status(400).send({ error: "paxSerial is required" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock the PaxPack row
        await tx.$executeRawUnsafe(
          `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
          paxSerial
        );

        const pack = await tx.paxPack.findUnique({
          where: { paxSerial },
          include: {
            paxType: {
              include: { packingConfigs: true }
            },
            packingRecord: {
              include: { checklistItems: true }
            },
            inspections: {
              orderBy: { createdAt: "desc" },
              take: 1
            },
            defects: {
              where: { status: { in: ["OPEN", "UNDER_REVIEW"] } }
            }
          }
        });

        if (!pack) {
          throw new Error(`Pax Pack "${paxSerial}" does not exist.`);
        }

        // Validate eligibility
        const hasPassedEOL = pack.testReportUrl !== null || pack.status === "PAX_TESTED" || pack.status === "READY_FOR_SALE" || pack.status === "READY_FOR_PACKING";
        const latestInspection = pack.inspections[0];
        const hasPassedQC = latestInspection?.result === "PASS" || pack.approvedBy !== null || pack.status === "READY_FOR_SALE";

        if (!hasPassedEOL) {
          throw new Error("Cannot pack this Pax: EOL testing has not been completed.");
        }
        if (!hasPassedQC) {
          throw new Error("Cannot pack this Pax: QC approval is pending.");
        }
        if (pack.defects.length > 0) {
          throw new Error(`Cannot pack this Pax: Has ${pack.defects.length} blocking open defect(s).`);
        }
        if (pack.packingRecord?.status === "TRANSFERRED_TO_FINISHED_GOODS") {
          throw new Error("This Pax Pack has already been packed and transferred to Finished Goods.");
        }

        // If an existing active packing record exists, return it
        if (pack.packingRecord) {
          return pack.packingRecord;
        }

        // Generate sequential packing number
        const packingNumber = await generatePackingNumber(tx);

        // Prepare checklist items from active product packing configs
        const rawConfigs = pack.paxType?.packingConfigs || [];
        const activeConfigs = rawConfigs
          .map((c: any) => {
            let parsed: any = {};
            try {
              if (c.notes && c.notes.startsWith("{")) parsed = JSON.parse(c.notes);
            } catch {}
            return {
              name: c.name,
              materialId: c.materialId,
              materialCode: parsed.materialCode || null,
              quantity: c.quantity || 1,
              unit: parsed.unit || "PCS",
              required: c.isRequired,
              notes: parsed.instructions || (typeof c.notes === "string" && !c.notes.startsWith("{") ? c.notes : null),
              isActive: parsed.isActive !== undefined ? parsed.isActive : true,
              displayOrder: parsed.displayOrder !== undefined ? parsed.displayOrder : 0
            };
          })
          .filter((c: any) => c.isActive !== false)
          .sort((a: any, b: any) => a.displayOrder - b.displayOrder);

        if (activeConfigs.length === 0) {
          throw new Error(
            `Packing materials are not configured for this product (${pack.paxType?.name || "Unknown Model"}). Contact the administrator.`
          );
        }

        const configuredMaterials = activeConfigs.map((c: any) => ({
          itemType: "MATERIAL",
          itemName: c.name,
          materialId: c.materialId || null,
          required: c.required,
          quantity: c.quantity,
          condition: "GOOD",
          notes: JSON.stringify({
            materialCode: c.materialCode || null,
            unit: c.unit || "PCS",
            conditionOptions: c.conditionOptions || "GOOD,DAMAGED,NA",
            instructions: c.notes || null
          })
        }));

        const boxItems = DEFAULT_BOX_CHECKLIST.map(b => ({
          itemType: "BOX",
          itemName: b.name,
          materialId: null,
          required: b.isRequired,
          quantity: 1,
          condition: "GOOD",
          notes: null
        }));

        // Create Packing Record
        const newRecord = await tx.packingRecord.create({
          data: {
            packingNumber,
            paxSerial,
            paxTypeId: pack.paxTypeId,
            operatorId: actor.id,
            stationId: stationId || null,
            status: "PACKING_IN_PROGRESS",
            checklistItems: {
              create: [...configuredMaterials, ...boxItems]
            }
          },
          include: {
            checklistItems: true,
            paxType: true,
            operator: { select: { id: true, name: true } }
          }
        });

        // Update PaxPack status if not already PACKED
        if (pack.status !== "READY_FOR_PACKING" && pack.status !== "PACKED") {
          await tx.paxPack.update({
            where: { paxSerial },
            data: { status: "READY_FOR_PACKING" }
          });
        }

        // Audit Log
        await tx.auditLog.create({
          data: {
            entityType: "packing",
            entityId: newRecord.id,
            actorId: actor.id,
            action: "PACKING_STARTED",
            prevStatus: pack.status,
            newStatus: "PACKING_IN_PROGRESS",
            metadata: {
              packingNumber,
              paxSerial,
              paxType: pack.paxType.name,
              itemCount: newRecord.checklistItems.length
            }
          }
        });

        return newRecord;
      });

      await wsManager.broadcast("packing:started", {
        paxSerial,
        packingNumber: result.packingNumber,
        operator: actor.name || actor.id,
        status: "PACKING_IN_PROGRESS"
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to start packing session" });
    }
  });

  // ── 5. PUT /packing/:packingId/checklist — Save Checklist State ───────────────
  fastify.put("/:packingId/checklist", packingActionAuth, async (request, reply) => {
    const { packingId } = request.params as { packingId: string };
    const { items, boxCondition, boxSealed, notes } = request.body as {
      items: Array<{
        id: string;
        verified: boolean;
        condition?: string;
        notes?: string;
        quantity?: number;
      }>;
      boxCondition?: string;
      boxSealed?: boolean;
      notes?: string;
    };
    const actor = request.user as { id: string; name?: string };

    try {
      const updatedRecord = await prisma.$transaction(async (tx) => {
        const record = await tx.packingRecord.findUnique({
          where: { id: packingId },
          include: { checklistItems: true }
        });

        if (!record) throw new Error("Packing record not found");
        if (record.status === "TRANSFERRED_TO_FINISHED_GOODS") {
          throw new Error("Cannot edit checklist for pack already transferred to Finished Goods.");
        }

        // Update each checklist item
        if (items && Array.isArray(items)) {
          for (const it of items) {
            await tx.packingChecklistItem.update({
              where: { id: it.id },
              data: {
                verified: it.verified,
                condition: it.condition || "GOOD",
                notes: it.notes || null,
                quantity: it.quantity ?? 1,
                verifiedAt: it.verified ? new Date() : null
              }
            });
          }
        }

        // Check if all items are verified
        const allItems = await tx.packingChecklistItem.findMany({
          where: { packingRecordId: packingId }
        });
        const allVerified = allItems.every(i => !i.required || i.verified);

        const newStatus = allVerified ? "CHECKLIST_PENDING" : "PACKING_IN_PROGRESS";

        const updated = await tx.packingRecord.update({
          where: { id: packingId },
          data: {
            boxCondition: boxCondition || record.boxCondition,
            boxSealed: boxSealed ?? record.boxSealed,
            notes: notes ?? record.notes,
            status: record.status === "PACKED" ? "PACKED" : newStatus
          },
          include: {
            checklistItems: true,
            pax: { include: { paxType: true } },
            operator: { select: { id: true, name: true } }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "packing",
            entityId: packingId,
            actorId: actor.id,
            action: "PACKING_CHECKLIST_UPDATED",
            prevStatus: record.status,
            newStatus: updated.status,
            metadata: {
              packingNumber: record.packingNumber,
              allVerified,
              boxSealed
            }
          }
        });

        return updated;
      });

      return updatedRecord;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to update checklist" });
    }
  });

  // ── 6. POST /packing/:packingId/confirm — Final Packing Confirmation ─────────
  fastify.post("/:packingId/confirm", packingActionAuth, async (request, reply) => {
    const { packingId } = request.params as { packingId: string };
    const { boxCondition, boxSealed, notes } = request.body as {
      boxCondition?: string;
      boxSealed?: boolean;
      notes?: string;
    };
    const actor = request.user as { id: string; name?: string };

    try {
      const confirmedRecord = await prisma.$transaction(async (tx) => {
        // Lock packing record
        const record = await tx.packingRecord.findUnique({
          where: { id: packingId },
          include: {
            checklistItems: true,
            pax: {
              include: {
                paxType: true,
                defects: { where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } },
                inspections: { orderBy: { createdAt: "desc" }, take: 1 }
              }
            }
          }
        });

        if (!record) throw new Error("Packing record not found");
        if (record.status === "TRANSFERRED_TO_FINISHED_GOODS") {
          throw new Error("Pack already transferred to Finished Goods.");
        }

        // Server-side verification of all mandatory requirements
        const unverifiedItems = record.checklistItems.filter(i => i.required && !i.verified);
        if (unverifiedItems.length > 0) {
          throw new Error(
            `Cannot confirm packing: ${unverifiedItems.length} mandatory item(s) are not verified (${unverifiedItems.map(u => u.itemName).join(", ")}).`
          );
        }

        if (record.pax.defects.length > 0) {
          throw new Error("Cannot confirm packing: Pax Pack has open quality defects.");
        }

        // Generate Sticker number & deterministic QR string
        const stickerNumber = record.stickerNumber || (await generateStickerNumber(tx));
        const qrDataPayload = JSON.stringify({
          brand: "KYRA ZAM",
          type: "BATTERY_PACK",
          serial: record.paxSerial,
          model: record.pax.paxType.name,
          packingId: record.packingNumber,
          sticker: stickerNumber,
          date: new Date().toISOString().split("T")[0]
        });

        // Update Packing Record
        const updated = await tx.packingRecord.update({
          where: { id: packingId },
          data: {
            status: "PACKED",
            completedAt: new Date(),
            stickerNumber,
            stickerGeneratedAt: record.stickerGeneratedAt || new Date(),
            qrData: qrDataPayload,
            boxCondition: boxCondition || "GOOD",
            boxSealed: boxSealed ?? true,
            notes: notes ?? record.notes
          },
          include: {
            checklistItems: true,
            pax: { include: { paxType: true } },
            operator: { select: { id: true, name: true } }
          }
        });

        // Update PaxPack status to PACKED
        await tx.paxPack.update({
          where: { paxSerial: record.paxSerial },
          data: { status: "PACKED" }
        });

        // Audit Logs
        await tx.auditLog.create({
          data: {
            entityType: "packing",
            entityId: packingId,
            actorId: actor.id,
            action: "PACKING_CONFIRMED",
            prevStatus: record.status,
            newStatus: "PACKED",
            metadata: {
              packingNumber: record.packingNumber,
              paxSerial: record.paxSerial,
              stickerNumber
            }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "pax",
            entityId: record.paxSerial,
            actorId: actor.id,
            action: "PACKING_COMPLETED",
            prevStatus: record.pax.status,
            newStatus: "PACKED",
            metadata: {
              packingNumber: record.packingNumber,
              stickerNumber
            }
          }
        });

        return updated;
      });

      await wsManager.broadcast("packing:confirmed", {
        packingId,
        packingNumber: confirmedRecord.packingNumber,
        paxSerial: confirmedRecord.paxSerial,
        status: "PACKED"
      });

      await wsManager.broadcast("packing:completed", {
        paxSerial: confirmedRecord.paxSerial,
        packingNumber: confirmedRecord.packingNumber
      });

      return confirmedRecord;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to confirm packing" });
    }
  });

  // ── 7. GET /packing/:packingId/sticker — Get Printable Sticker Data ──────────
  fastify.get("/:packingId/sticker", packingAuth, async (request, reply) => {
    const { packingId } = request.params as { packingId: string };
    const actor = request.user as { id: string; name?: string };

    const record = await prisma.packingRecord.findUnique({
      where: { id: packingId },
      include: {
        pax: { include: { paxType: true, workOrder: true } },
        operator: { select: { id: true, name: true, email: true } },
        destinationWarehouse: true,
        destinationLocation: true
      }
    });

    if (!record) {
      return reply.status(404).send({ error: "Packing record not found" });
    }

    // Generate QR Code as Base64 Data URL
    const qrPayload = record.qrData || JSON.stringify({
      brand: "KYRA ZAM",
      serial: record.paxSerial,
      model: record.pax.paxType.name,
      packingId: record.packingNumber,
      date: new Date(record.completedAt || record.createdAt).toISOString().split("T")[0]
    });

    let qrCodeBase64 = "";
    try {
      qrCodeBase64 = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 280,
        color: {
          dark: "#000000",
          light: "#ffffff"
        }
      });
    } catch (e) {
      console.error("QR Code generation error:", e);
    }

    // Log Sticker Print/Access Event
    await prisma.auditLog.create({
      data: {
        entityType: "packing",
        entityId: packingId,
        actorId: actor.id,
        action: "PACKING_STICKER_PRINTED",
        newStatus: record.status,
        metadata: {
          packingNumber: record.packingNumber,
          stickerNumber: record.stickerNumber,
          printedAt: new Date().toISOString()
        }
      }
    });

    return {
      sticker: {
        brand: "KYRA ZAM",
        title: "LITHIUM BATTERY PACK",
        modelName: record.pax.paxType.name,
        nominalVoltage: `${record.pax.paxType.nominalVoltage || 48}V`,
        nominalCapacity: `${record.pax.paxType.nominalCapacity || 32}Ah`,
        configuration: record.pax.paxType.configuration || "16S1P",
        paxSerial: record.paxSerial,
        packingNumber: record.packingNumber,
        stickerNumber: record.stickerNumber || "STK-OFFICIAL",
        packingDate: record.completedAt || record.createdAt,
        operatorName: record.operator?.name || "Packing Specialist",
        workOrderNumber: record.pax.workOrder?.workOrderNumber || "WO-N/A",
        status: record.status,
        boxCondition: record.boxCondition || "GOOD",
        boxSealed: record.boxSealed,
        qrCodeBase64,
        qrPayload
      }
    };
  });

  // ── 8. POST /packing/:packingId/transfer-to-fg — Finished Goods Warehouse Transfer
  fastify.post("/:packingId/transfer-to-fg", packingActionAuth, async (request, reply) => {
    const { packingId } = request.params as { packingId: string };
    const { warehouseId, locationId, notes } = request.body as {
      warehouseId: string;
      locationId: string;
      notes?: string;
    };
    const actor = request.user as { id: string; name?: string };

    if (!warehouseId || !locationId) {
      return reply.status(400).send({ error: "warehouseId and locationId are required" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lock packing record
        const record = await tx.packingRecord.findUnique({
          where: { id: packingId },
          include: {
            pax: { include: { paxType: true } }
          }
        });

        if (!record) throw new Error("Packing record not found");
        if (record.status !== "PACKED" && record.status !== "TRANSFER_PENDING") {
          throw new Error(`Cannot transfer pack in status ${record.status}. Must be PACKED first.`);
        }

        // Validate warehouse & location
        const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
        if (!warehouse) throw new Error("Destination warehouse not found");

        const location = await tx.warehouseLocation.findUnique({ where: { id: locationId } });
        if (!location) throw new Error("Destination warehouse location not found");

        // Find or create a matching Material record for Finished Goods battery pack
        const fgSku = `FG-${record.pax.paxType.name.replace(/\s+/g, "-").toUpperCase()}`;
        let fgMaterial = await tx.material.findUnique({ where: { sku: fgSku } });

        if (!fgMaterial) {
          fgMaterial = await tx.material.create({
            data: {
              sku: fgSku,
              name: `Finished Goods - ${record.pax.paxType.name}`,
              category: "Finished Goods",
              unit: "pack",
              quantity: 0,
              minStock: 5,
              unitPrice: record.pax.paxType.unitPrice || 25000,
              materialType: "FG"
            }
          });
        }

        // Update Material total inventory quantity
        await tx.material.update({
          where: { id: fgMaterial.id },
          data: {
            quantity: { increment: 1 },
            lastRestock: new Date()
          }
        });

        // Upsert Material Location Balance
        await tx.materialLocationBalance.upsert({
          where: {
            materialId_warehouseId_locationId: {
              materialId: fgMaterial.id,
              warehouseId,
              locationId
            }
          },
          update: {
            quantity: { increment: 1 }
          },
          create: {
            materialId: fgMaterial.id,
            warehouseId,
            locationId,
            quantity: 1
          }
        });

        // Create Stock Movement transaction
        await tx.stockMovement.create({
          data: {
            materialId: fgMaterial.id,
            quantity: 1,
            movementType: "RECEIPT",
            source: "PACKING_TRANSFER_FINISHED_GOODS",
            referenceId: record.packingNumber,
            warehouseId,
            locationId,
            userId: actor.id,
            reason: notes || `Pax ${record.paxSerial} packed and moved to Finished Goods warehouse.`
          }
        });

        // Update Packing Record status
        const updatedRecord = await tx.packingRecord.update({
          where: { id: packingId },
          data: {
            status: "TRANSFERRED_TO_FINISHED_GOODS",
            destinationWarehouseId: warehouseId,
            destinationLocationId: locationId,
            transferredAt: new Date(),
            notes: notes ? `${record.notes ? record.notes + " | " : ""}${notes}` : record.notes
          },
          include: {
            destinationWarehouse: true,
            destinationLocation: true,
            pax: { include: { paxType: true } },
            operator: { select: { id: true, name: true } }
          }
        });

        // Update PaxPack status to READY_FOR_SALE (Finished Goods in warehouse ready for dispatch)
        await tx.paxPack.update({
          where: { paxSerial: record.paxSerial },
          data: { status: "READY_FOR_SALE" }
        });

        // Audit Logs
        await tx.auditLog.create({
          data: {
            entityType: "packing",
            entityId: packingId,
            actorId: actor.id,
            action: "PACKING_TRANSFER_COMPLETED",
            prevStatus: "PACKED",
            newStatus: "TRANSFERRED_TO_FINISHED_GOODS",
            metadata: {
              packingNumber: record.packingNumber,
              paxSerial: record.paxSerial,
              warehouse: warehouse.name,
              location: location.name || location.code
            }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "inventory",
            entityId: fgMaterial.id,
            actorId: actor.id,
            action: "FG_STOCK_RECEIVED",
            newStatus: "READY_FOR_SALE",
            metadata: {
              paxSerial: record.paxSerial,
              packingNumber: record.packingNumber,
              warehouseId,
              locationId
            }
          }
        });

        return updatedRecord;
      });

      await wsManager.broadcast("packing:transferred", {
        packingId,
        packingNumber: result.packingNumber,
        paxSerial: result.paxSerial,
        warehouseName: result.destinationWarehouse?.name,
        locationCode: result.destinationLocation?.code,
        status: "TRANSFERRED_TO_FINISHED_GOODS"
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to transfer to Finished Goods" });
    }
  });

  // ── 9. GET /packing/history — Packing History ────────────────────────────────
  fastify.get("/history", packingAuth, async (request) => {
    const {
      search,
      paxTypeId,
      status,
      operatorId,
      page = "1",
      limit = "20"
    } = request.query as any;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (paxTypeId) {
      where.paxTypeId = paxTypeId;
    }

    if (operatorId) {
      where.operatorId = operatorId;
    }

    if (search) {
      where.OR = [
        { packingNumber: { contains: search, mode: "insensitive" } },
        { paxSerial: { contains: search, mode: "insensitive" } },
        { stickerNumber: { contains: search, mode: "insensitive" } },
        { paxType: { name: { contains: search, mode: "insensitive" } } },
        { operator: { name: { contains: search, mode: "insensitive" } } }
      ];
    }

    const [records, total] = await Promise.all([
      prisma.packingRecord.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          pax: {
            include: {
              workOrder: { select: { workOrderNumber: true } },
              inspections: { orderBy: { createdAt: "desc" }, take: 1 }
            }
          },
          paxType: true,
          operator: { select: { id: true, name: true, email: true } },
          destinationWarehouse: true,
          destinationLocation: true,
          checklistItems: true
        }
      }),
      prisma.packingRecord.count({ where })
    ]);

    return {
      history: records,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take)
    };
  });

  // ── 10. GET /packing/warehouses — Warehouse Locations for Transfer ───────────
  fastify.get("/warehouses", packingAuth, async () => {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        locations: {
          orderBy: { code: "asc" }
        }
      },
      orderBy: { name: "asc" }
    });
    return warehouses;
  });

  // ── 11. GET /packing/materials/config — Get Material Configs per PaxType ──────
  fastify.get("/materials/config", packingAuth, async (request) => {
    const { paxTypeId } = request.query as any;
    const where = paxTypeId ? { paxTypeId } : {};

    const configs = await prisma.packingMaterialConfig.findMany({
      where,
      include: {
        paxType: true,
        material: true
      },
      orderBy: { createdAt: "asc" }
    });

    return configs
      .map((c: any) => {
        let parsed: any = {};
        try {
          if (c.notes && c.notes.startsWith("{")) {
            parsed = JSON.parse(c.notes);
          }
        } catch {}

        return {
          id: c.id,
          paxTypeId: c.paxTypeId,
          paxType: c.paxType,
          materialId: c.materialId,
          material: c.material,
          name: c.name,
          materialCode: parsed.materialCode || c.material?.sku || c.material?.materialCode || "",
          quantity: c.quantity || 1,
          unit: parsed.unit || c.material?.unit || "PCS",
          isRequired: c.isRequired ?? true,
          conditionOptions: parsed.conditionOptions || "GOOD,DAMAGED,NA",
          notes: parsed.instructions || (typeof c.notes === "string" && !c.notes.startsWith("{") ? c.notes : "") || "",
          instructions: parsed.instructions || (typeof c.notes === "string" && !c.notes.startsWith("{") ? c.notes : "") || "",
          isActive: parsed.isActive !== undefined ? parsed.isActive : true,
          displayOrder: parsed.displayOrder !== undefined ? parsed.displayOrder : 0,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        };
      })
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder);
  });

  // ── 12. POST /packing/materials/config — Save/Update Material Config ─────────
  fastify.post(
    "/materials/config",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN", "SUPERVISOR", "INVENTORY_MANAGER")] },
    async (request, reply) => {
      const { paxTypeId, materials } = request.body as {
        paxTypeId: string;
        materials: Array<{
          name: string;
          materialId?: string;
          materialCode?: string;
          quantity: number;
          unit?: string;
          isRequired?: boolean;
          conditionOptions?: string;
          notes?: string;
          instructions?: string;
          isActive?: boolean;
          displayOrder?: number;
        }>;
      };
      const actor = request.user as { id: string; name?: string };

      if (!paxTypeId) {
        return reply.status(400).send({ error: "paxTypeId is required." });
      }

      if (!materials || !Array.isArray(materials)) {
        return reply.status(400).send({ error: "materials array is required." });
      }

      // Verify PaxType exists
      const paxType = await prisma.paxType.findUnique({
        where: { id: paxTypeId }
      });
      if (!paxType) {
        return reply.status(404).send({ error: `Product/Model (PaxType) with ID "${paxTypeId}" does not exist.` });
      }

      // Validate each material
      const seenNames = new Set<string>();
      for (let i = 0; i < materials.length; i++) {
        const m = materials[i];
        const trimmedName = (m.name || "").trim();
        if (!trimmedName) {
          return reply.status(400).send({ error: `Material at position ${i + 1} must have a valid non-empty name.` });
        }

        const lowerName = trimmedName.toLowerCase();
        if (seenNames.has(lowerName)) {
          return reply.status(400).send({
            error: `Duplicate material detected: "${trimmedName}". Each material in a model's checklist must have a unique name.`
          });
        }
        seenNames.add(lowerName);

        const qty = typeof m.quantity === "number" ? m.quantity : parseInt(m.quantity as any, 10);
        if (isNaN(qty) || qty <= 0) {
          return reply.status(400).send({ error: `Material "${trimmedName}" must have a valid quantity greater than zero.` });
        }
      }

      try {
        await prisma.$transaction(async (tx) => {
          // Delete existing configs for this paxType (idempotent replacement)
          await tx.packingMaterialConfig.deleteMany({ where: { paxTypeId } });

          // Insert new validated configs
          for (let i = 0; i < materials.length; i++) {
            const m = materials[i];
            const structuredNotes = JSON.stringify({
              instructions: (m.instructions || m.notes || "").trim(),
              materialCode: (m.materialCode || "").trim() || null,
              unit: (m.unit || "PCS").trim().toUpperCase(),
              conditionOptions: m.conditionOptions || "GOOD,DAMAGED,NA",
              isActive: m.isActive !== undefined ? Boolean(m.isActive) : true,
              displayOrder: typeof m.displayOrder === "number" ? m.displayOrder : i
            });

            await tx.packingMaterialConfig.create({
              data: {
                paxTypeId,
                name: m.name.trim(),
                materialId: m.materialId || null,
                quantity: typeof m.quantity === "number" ? m.quantity : parseInt(m.quantity as any, 10) || 1,
                isRequired: m.isRequired !== undefined ? Boolean(m.isRequired) : true,
                notes: structuredNotes
              }
            });
          }

          // Record audit log
          if (actor?.id) {
            await tx.auditLog.create({
              data: {
                entityType: "PACKING_MATERIAL_CONFIG",
                entityId: paxTypeId,
                actorId: actor.id,
                action: "UPDATE_PACKING_MATERIALS",
                prevStatus: null,
                newStatus: "CONFIGURED",
                metadata: {
                  paxTypeId,
                  paxTypeName: paxType.name,
                  materialCount: materials.length,
                  materials: materials.map((m, idx) => ({
                    name: m.name.trim(),
                    quantity: m.quantity,
                    unit: m.unit || "PCS",
                    isRequired: m.isRequired ?? true,
                    isActive: m.isActive ?? true,
                    displayOrder: typeof m.displayOrder === "number" ? m.displayOrder : idx
                  }))
                }
              }
            });
          }
        });

        const updated = await prisma.packingMaterialConfig.findMany({
          where: { paxTypeId },
          include: { material: true }
        });

        const formatted = updated
          .map((c: any) => {
            let parsed: any = {};
            try {
              if (c.notes && c.notes.startsWith("{")) parsed = JSON.parse(c.notes);
            } catch {}
            return {
              id: c.id,
              paxTypeId: c.paxTypeId,
              name: c.name,
              materialId: c.materialId,
              materialCode: parsed.materialCode || c.material?.sku || null,
              quantity: c.quantity,
              unit: parsed.unit || c.material?.unit || "PCS",
              isRequired: c.isRequired,
              conditionOptions: parsed.conditionOptions || "GOOD,DAMAGED,NA",
              notes: parsed.instructions || "",
              instructions: parsed.instructions || "",
              isActive: parsed.isActive !== undefined ? parsed.isActive : true,
              displayOrder: parsed.displayOrder !== undefined ? parsed.displayOrder : 0
            };
          })
          .sort((a: any, b: any) => a.displayOrder - b.displayOrder);

        return { success: true, count: formatted.length, configs: formatted };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to update packing configs" });
      }
    }
  );
}
