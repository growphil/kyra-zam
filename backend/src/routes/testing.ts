import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { CellStatus } from "../generated/client";
import { requireRoles } from "../middleware/rbac";
import { processReportWithSidecar } from "../services/sidecar.service";
import { writeAudit } from "../services/audit.service";
import { ManualLinkSchema, ApplyCellSchema } from "../schemas/zod.schemas";
import { wsManager } from "../websocket/manager";
import { z } from "zod";

import { normalizeSerial } from "../utils/serial";

import { evaluateQcCell, calculateGrade } from "../domain/qc/qcRules";

export async function testingRoutes(fastify: FastifyInstance) {
  // GET /testing/qc-thresholds - Public for operational reliability
  // GET /testing/qc-thresholds - Prioritizes Active Production Model
  fastify.get("/qc-thresholds", async (request) => {
    const activeProduction = await prisma.paxType.findFirst({
      where: { isProductionActive: true }
    });

    if (activeProduction) {
      return {
        id: activeProduction.id,
        name: activeProduction.name,
        source: "PAX_TYPE",
        activeModelId: activeProduction.id,
        activeModelName: activeProduction.name,
        ahMin: activeProduction.ahMin,
        ahMax: activeProduction.ahMax,
        irMin: activeProduction.irMin,
        irMax: activeProduction.irMax,
        retestIrMargin: activeProduction.retestIrMargin,
        retestAhMargin: activeProduction.retestAhMargin,
        hardFailIr: activeProduction.hardFailIr,
        hardFailAh: activeProduction.hardFailAh,
        isModelBased: true
      };
    }

    const thresholds = await prisma.qcThreshold.findUnique({ where: { id: "global" } });
    return { 
      id: "global",
      name: "Global Fallback",
      source: "GLOBAL",
      activeModelId: null,
      activeModelName: null,
      ahMin: thresholds?.ahMin ?? 3.0,
      ahMax: thresholds?.ahMax ?? 3.6,
      irMin: thresholds?.irMin ?? 5.0,
      irMax: thresholds?.irMax ?? 60.0,
      serialDisplayLength: thresholds?.serialDisplayLength ?? null,
      retestIrMargin: 2.0,
      retestAhMargin: 0.1,
      hardFailIr: 70.0,
      hardFailAh: 3.0,
      isModelBased: false 
    };
  });

  // GET /testing/station-summary - Live Operational Station KPIs & Active Bulk Batches
  fastify.get(
    "/station-summary",
    { preHandler: [requireRoles("TEST_ENGINEER", "ADMIN", "SUPERADMIN")] },
    async () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [activeBatches, testedTodayCount, retestCount, rejectedCount] = await Promise.all([
        prisma.cellInwardBatch.findMany({
          where: { availableQty: { gt: 0 } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            inwardNumber: true,
            partNumber: true,
            batchNumber: true,
            quantity: true,
            availableQty: true,
            testedQty: true,
            rejectedQty: true,
            voltage: true,
            category: true,
            cycles: true,
            createdAt: true,
          }
        }),
        prisma.cell.count({
          where: {
            updatedAt: { gte: startOfDay },
            status: { in: [CellStatus.CELL_TESTED, CellStatus.REJECTED, CellStatus.HOLD, CellStatus.RETEST_REQUIRED] }
          }
        }),
        prisma.cell.count({
          where: { status: CellStatus.RETEST_REQUIRED }
        }),
        prisma.cell.count({
          where: { status: CellStatus.REJECTED }
        })
      ]);

      const pendingBulkCount = activeBatches.reduce((acc, b) => acc + b.availableQty, 0);

      return {
        pendingBulkCount,
        testedTodayCount,
        retestCount,
        rejectedCount,
        activeBatches,
      };
    }
  );

  // GET /testing/recent-tests - Live Station Audit Activity (Last 15 Tests)
  fastify.get(
    "/recent-tests",
    { preHandler: [requireRoles("TEST_ENGINEER", "ADMIN", "SUPERADMIN")] },
    async () => {
      const recentCells = await prisma.cell.findMany({
        where: {
          status: { in: [CellStatus.CELL_TESTED, CellStatus.REJECTED, CellStatus.HOLD, CellStatus.RETEST_REQUIRED] }
        },
        orderBy: { updatedAt: "desc" },
        take: 15,
        select: {
          serialNumber: true,
          partNumber: true,
          batchNumber: true,
          voltage: true,
          ahValue: true,
          irValue: true,
          grade: true,
          status: true,
          updatedAt: true,
          machineId: true,
          machineOperator: true,
          retestCount: true,
          qcDecisionHistory: true,
        }
      });

      return { tests: recentCells };
    }
  );

  // GET /testing/validated-cells - Comprehensive Validated Cell Reports (Single View & Production Order View)
  fastify.get(
    "/validated-cells",
    { preHandler: [requireRoles("TEST_ENGINEER", "ADMIN", "SUPERADMIN")] },
    async (request) => {
      const { search, status, workOrderId, limit = 100, page = 1 } = request.query as any;

      const where: any = {
        status: { in: [CellStatus.CELL_TESTED, CellStatus.REJECTED, CellStatus.HOLD, CellStatus.RETEST_REQUIRED] }
      };

      if (status && status !== "ALL") {
        where.status = status;
      }

      if (workOrderId) {
        where.testingRequirement = {
          workOrderId: workOrderId
        };
      }

      if (search && search.trim()) {
        const s = search.trim();
        where.OR = [
          { serialNumber: { contains: s, mode: "insensitive" } },
          { partNumber: { contains: s, mode: "insensitive" } },
          { batchNumber: { contains: s, mode: "insensitive" } },
          { testingRequirement: { workOrder: { workOrderNumber: { contains: s, mode: "insensitive" } } } },
          { testingRequirement: { workOrder: { productRef: { contains: s, mode: "insensitive" } } } },
        ];
      }

      const [cells, total, readyCount, prodRequirements] = await Promise.all([
        prisma.cell.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: Number(limit),
          skip: (Number(page) - 1) * Number(limit),
          include: {
            testingRequirement: {
              include: {
                workOrder: {
                  select: {
                    id: true,
                    workOrderNumber: true,
                    productRef: true,
                    status: true,
                    supervisor: { select: { name: true } }
                  }
                }
              }
            },
            inwardBatch: {
              select: {
                inwardNumber: true,
                batchNumber: true
              }
            }
          }
        }),
        prisma.cell.count({ where }),
        prisma.cell.count({ where: { status: CellStatus.RAW } }),
        prisma.productionCellTestingRequirement.findMany({
          include: {
            workOrder: {
              select: {
                id: true,
                workOrderNumber: true,
                productRef: true,
                status: true
              }
            },
            testedCells: {
              select: {
                serialNumber: true,
                status: true,
                ahValue: true,
                irValue: true,
                grade: true,
                updatedAt: true,
                machineOperator: true,
                machineId: true,
                partNumber: true
              }
            }
          },
          orderBy: { activatedAt: "desc" }
        })
      ]);

      // Calculate production order grouping summary
      const productionOrderSummaries = prodRequirements.map(req => {
        const testedCells = req.testedCells || [];
        const passCount = testedCells.filter(c => c.status === CellStatus.CELL_TESTED).length;
        const retestCount = testedCells.filter(c => c.status === CellStatus.RETEST_REQUIRED).length;
        const holdCount = testedCells.filter(c => c.status === CellStatus.HOLD).length;
        const failCount = testedCells.filter(c => c.status === CellStatus.REJECTED).length;
        const validatedCount = testedCells.filter(c => c.status !== CellStatus.RAW).length;
        const totalSerialized = testedCells.length;
        const pendingValidation = Math.max(0, req.requiredQuantity - passCount);

        return {
          requirementId: req.id,
          requirementNumber: req.requirementNumber,
          workOrderId: req.workOrder?.id,
          workOrderNumber: req.workOrder?.workOrderNumber || "WO-N/A",
          productRef: req.workOrder?.productRef || "Standard Pack",
          cellSku: req.cellSku,
          requiredQuantity: req.requiredQuantity,
          serializedQuantity: totalSerialized,
          validatedQuantity: validatedCount,
          passCount,
          retestCount,
          holdCount,
          failCount,
          pendingValidation,
          status: req.status
        };
      });

      return {
        cells,
        total,
        page: Number(page),
        limit: Number(limit),
        metrics: {
          serializedReadyCount: readyCount,
          totalValidated: total
        },
        productionOrderSummaries
      };
    }
  );

  // POST /testing/validate-serial - Real-Time Scanner Pre-Validation (Strictly Serialized Cells)
  fastify.post(
    "/validate-serial",
    { preHandler: [requireRoles("TEST_ENGINEER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { serial } = request.body as { serial: string };
      if (!serial || !serial.trim()) {
        return reply.status(400).send({ error: "Serial number is required" });
      }

      const normalized = normalizeSerial(serial.trim());
      const existing = await prisma.cell.findUnique({
        where: { serialNumber: normalized },
        include: {
          paxCell: true,
          inwardBatch: true,
          testingRequirement: {
            include: {
              workOrder: {
                select: {
                  id: true,
                  workOrderNumber: true,
                  productRef: true,
                  status: true
                }
              }
            }
          }
        }
      });

      if (!existing) {
        return {
          isValid: false,
          normalizedSerial: normalized,
          status: "NOT_FOUND",
          isAlreadyTested: false,
          message: `Cell '${normalized}' is NOT serialized in the system. Serialize this physical cell first at /test-engineer/cells.`,
        };
      }

      if (existing.status === CellStatus.CELL_TESTED) {
        return {
          isValid: false,
          normalizedSerial: normalized,
          status: existing.status,
          isAlreadyTested: true,
          message: `Cell '${normalized}' is already tested and qualified (Grade ${existing.grade || "A"}, ${existing.ahValue} AH, ${existing.irValue} mΩ).`,
          existingCell: existing,
        };
      }

      if (existing.status === CellStatus.REJECTED) {
        return {
          isValid: false,
          normalizedSerial: normalized,
          status: existing.status,
          isAlreadyTested: true,
          message: `Cell '${normalized}' was previously REJECTED and auto-scrapped.`,
          existingCell: existing,
        };
      }

      // Valid serialized cell ready for testing
      return {
        isValid: true,
        normalizedSerial: normalized,
        status: existing.status === CellStatus.RAW ? "READY FOR TEST" : existing.status,
        rawStatus: existing.status,
        isAlreadyTested: false,
        message: `Serialized cell '${normalized}' identified and ready for validation.`,
        cellSku: existing.partNumber || existing.testingRequirement?.cellSku || "CELL-LFP-3200",
        workOrderNumber: existing.testingRequirement?.workOrder?.workOrderNumber || "WO-GENERAL",
        productRef: existing.testingRequirement?.workOrder?.productRef || "Battery Pack",
        productionRequirementId: existing.testingRequirementId,
        existingCell: existing,
      };
    }
  );

  // POST /testing/upload
  fastify.post("/upload", { preHandler: [requireRoles("TEST_ENGINEER", "ADMIN", "SUPERADMIN")] }, async (request, reply) => {
    const data = await (request as any).file();
    if (!data) return reply.status(400).send({ error: "No file provided" });

    const buffer = await data.toBuffer();
    const fileName = data.filename;

    // 1. Fetch only RAW cells for the matching search pool (as per spec)
    const rawCells = await prisma.cell.findMany({
      where: { status: CellStatus.RAW },
      select: { serialNumber: true },
    });
    // Normalize DB serials before sending to sidecar
    const knownSerials = rawCells.map(c => normalizeSerial(c.serialNumber));

    // 2. Fetch all cells to detect "Already Tested" scenarios (pre-matching)
    const allCells = await prisma.cell.findMany({
      where: { status: { in: [CellStatus.CELL_TESTED, CellStatus.REJECTED] } },
      select: { serialNumber: true, status: true },
    });
    // Normalize these too for the check
    const testedSerialsMap = new Map(allCells.map(c => [normalizeSerial(c.serialNumber), c.status]));

    // Call Python sidecar with normalized RAW serials
    const results = await processReportWithSidecar(buffer, fileName, knownSerials);
    
    // Normalize sidecar buckets
    const allRows = [
      ...(results.matched || []),
      ...(results.review || []),
      ...(results.unmatched || [])
    ];

    const normalizedRows = allRows.map((r: any) => {
      const machineSerial = normalizeSerial(r.serial_from_file || "");
      const cellSerial = r.matched_db_serial || "UNMATCHED";
      
      // Check if this machine serial (or matched serial) is already tested in DB
      const isAlreadyTested = testedSerialsMap.has(machineSerial) || testedSerialsMap.has(cellSerial);
      
      return {
        machineSerial,
        normalizedSerial: r.normalized_serial,
        cellSerial,
        confidence: r.confidence ?? 0,
        ahValue: r.ah_value,
        irValue: r.ir_value,
        grade: r.grade,
        isAlreadyTested
      };
    });

    return normalizedRows;
  });

  // POST /testing/manual-link
  fastify.post("/manual-link", { preHandler: [requireRoles("TEST_ENGINEER", "ADMIN", "SUPERADMIN")] }, async (request, reply) => {
    const data = ManualLinkSchema.parse(request.body);

    const cell = await prisma.cell.findUnique({ where: { serialNumber: data.dbSerial } });
    if (!cell) return reply.status(404).send({ error: "Cell not found in DB" });
    
    // Allow re-linking if status is RAW or CELL_TESTED
    if (cell.status !== CellStatus.RAW && cell.status !== CellStatus.CELL_TESTED) {
      return reply.status(409).send({ error: `Cell is ${cell.status} — cannot re-link` });
    }

    return { success: true, linkedSerial: data.dbSerial };
  });

  // GET /testing/production-requirements - Live Production Cell Testing Requirements
  fastify.get(
    "/production-requirements",
    { preHandler: [requireRoles("TEST_ENGINEER", "SUPERVISOR", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async () => {
      const requirements = await prisma.productionCellTestingRequirement.findMany({
        include: {
          material: true,
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
              productRef: true,
              plannedQuantity: true,
              status: true,
              dueDate: true,
              supervisor: { select: { name: true, email: true } },
              scheduling: { select: { sequence: true, assignedDate: true } },
              execution: { select: { startedAt: true, actualHours: true } }
            }
          }
        },
        orderBy: [
          { status: "asc" },
          { activatedAt: "desc" }
        ]
      });

      const sorted = [...requirements].sort((a, b) => {
        if (a.status === "IN_PROGRESS" && b.status !== "IN_PROGRESS") return -1;
        if (a.status !== "IN_PROGRESS" && b.status === "IN_PROGRESS") return 1;
        const seqA = a.workOrder?.scheduling?.sequence ?? 999;
        const seqB = b.workOrder?.scheduling?.sequence ?? 999;
        return seqA - seqB;
      });

      const reqIds = requirements.map(r => r.id);

      const [serializedCounts, inwardBatches] = await Promise.all([
        prisma.cell.groupBy({
          by: ["testingRequirementId"],
          _count: { _all: true },
          where: { testingRequirementId: { in: reqIds } }
        }),
        prisma.cellInwardBatch.findMany({
          where: { availableQty: { gt: 0 } },
          select: {
            id: true,
            partNumber: true,
            batchNumber: true,
            quantity: true,
            availableQty: true,
            voltage: true,
            category: true,
            materialId: true
          }
        })
      ]);

      const serializedCountMap = new Map<string, number>();
      for (const item of serializedCounts) {
        if (item.testingRequirementId) {
          serializedCountMap.set(item.testingRequirementId, item._count._all);
        }
      }

      const enrichedRequirements = sorted.map(r => {
        const serialized = serializedCountMap.get(r.id) || 0;
        const matchingBatches = inwardBatches.filter(b => 
          (b.partNumber || "").toUpperCase() === (r.cellSku || "").toUpperCase() ||
          (b.partNumber || "").toUpperCase().includes((r.cellSku || "").toUpperCase()) ||
          (r.cellSku || "").toUpperCase().includes((b.partNumber || "").toUpperCase())
        );
        const availableBulkStock = matchingBatches.reduce((acc, b) => acc + b.availableQty, 0);
        const firstBatch = matchingBatches[0];

        return {
          ...r,
          serializedQuantity: serialized,
          qualifiedQuantity: r.testedQuantity,
          remainingQuantity: Math.max(0, r.requiredQuantity - r.testedQuantity),
          availableBulkStock,
          defaultValues: {
            chemistry: firstBatch?.category || r.material?.category || "LFP",
            ratedVoltage: firstBatch?.voltage || 3.2,
            category: firstBatch?.category || "LFP 3.2V"
          }
        };
      });

      const totalRequired = requirements.filter(r => r.status === "IN_PROGRESS").reduce((acc, r) => acc + r.requiredQuantity, 0);
      const totalTested = requirements.filter(r => r.status === "IN_PROGRESS").reduce((acc, r) => acc + r.testedQuantity, 0);
      const totalRemaining = requirements.filter(r => r.status === "IN_PROGRESS").reduce((acc, r) => acc + r.remainingQuantity, 0);

      return {
        requirements: enrichedRequirements,
        metrics: {
          activeRequirementsCount: requirements.filter(r => r.status === "IN_PROGRESS").length,
          totalRequired,
          totalTested,
          totalRemaining
        }
      };
    }
  );

  // GET /testing/production-requirements/:id - Detail view
  fastify.get(
    "/production-requirements/:id",
    { preHandler: [requireRoles("TEST_ENGINEER", "SUPERVISOR", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [req, serializedCount, inwardBatches] = await Promise.all([
        prisma.productionCellTestingRequirement.findUnique({
          where: { id },
          include: {
            material: true,
            workOrder: {
              include: {
                supervisor: { select: { name: true, email: true } },
                scheduling: true,
                execution: true,
                productionPlan: { select: { planNumber: true } },
                productionRequirement: { select: { requirementNumber: true } }
              }
            },
            testedCells: {
              take: 50,
              orderBy: { createdAt: "desc" },
              include: {
                inwardBatch: {
                  select: { id: true, inwardNumber: true, batchNumber: true }
                }
              }
            }
          }
        }),
        prisma.cell.count({
          where: { testingRequirementId: id }
        }),
        prisma.cellInwardBatch.findMany({
          where: { availableQty: { gt: 0 } },
          select: {
            id: true,
            partNumber: true,
            batchNumber: true,
            quantity: true,
            availableQty: true,
            voltage: true,
            category: true
          }
        })
      ]);

      if (!req) return reply.status(404).send({ error: "Production testing requirement not found" });

      const matchingBatches = inwardBatches.filter(b => 
        (b.partNumber || "").toUpperCase() === (req.cellSku || "").toUpperCase() ||
        (b.partNumber || "").toUpperCase().includes((req.cellSku || "").toUpperCase()) ||
        (req.cellSku || "").toUpperCase().includes((b.partNumber || "").toUpperCase())
      );
      const availableBulkStock = matchingBatches.reduce((acc, b) => acc + b.availableQty, 0);
      const firstBatch = matchingBatches[0];

      return {
        ...req,
        serializedQuantity: serializedCount,
        qualifiedQuantity: req.testedQuantity,
        remainingQuantity: Math.max(0, req.requiredQuantity - req.testedQuantity),
        availableBulkStock,
        defaultValues: {
          chemistry: firstBatch?.category || req.material?.category || "LFP",
          ratedVoltage: firstBatch?.voltage || 3.2,
          category: firstBatch?.category || "LFP 3.2V"
        }
      };
    }
  );

  // POST /testing/apply
  fastify.post("/apply", { preHandler: [requireRoles("TEST_ENGINEER", "ADMIN", "SUPERADMIN")] }, async (request, reply) => {
    const actor = (request.user as any).id;
    const cells = z.array(ApplyCellSchema).parse(request.body);
    
    // Fetch thresholds with same priority as GET /qc-thresholds
    const activeProduction = await prisma.paxType.findFirst({ where: { isProductionActive: true } });
    const thresholds = activeProduction || await prisma.qcThreshold.findUnique({ where: { id: "global" } });
    
    if (!thresholds) return reply.status(500).send({ error: "QC thresholds not configured" });

    // Map configuration to expected evaluateQcCell input format
    const config = {
      ahMin: thresholds.ahMin,
      ahMax: thresholds.ahMax,
      irMin: thresholds.irMin ?? 5.0,
      irMax: thresholds.irMax,
      retestAhMargin: (thresholds as any).retestAhMargin ?? 0.1,
      retestIrMargin: (thresholds as any).retestIrMargin ?? 2.0,
      hardFailAh: (thresholds as any).hardFailAh ?? 3.0,
      hardFailIr: (thresholds as any).hardFailIr ?? 70.0,
    };

    const results = { passed: 0, rejected: 0, retest: 0, hold: 0, errors: 0 };
    const perCell: { cellSerial: string; result: string; failureReason?: string; testingRequirementId?: string; remainingRequirement?: number }[] = [];

    for (const cell of cells) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const normalizedSerial = normalizeSerial(cell.cellSerial);

          // Lock Cell row for update if it already exists
          let existing = await tx.cell.findUnique({ where: { serialNumber: normalizedSerial } });

          // STAGE 3: INDEPENDENT BACKEND VALIDATION USING THE UNIFIED QC RULES ENGINE
          const backendQcResult = evaluateQcCell(cell.ahValue, cell.irValue, config);
          
          let failureReason: string | undefined = undefined;
          if (backendQcResult !== "PASS") {
            const failReasons: string[] = [];
            if (cell.ahValue === null || cell.ahValue === undefined || isNaN(cell.ahValue)) failReasons.push("AH_MISSING");
            else if (cell.ahValue <= 0 || cell.ahValue > 1000) failReasons.push("AH_IMPOSSIBLE");
            else if (cell.ahValue < config.ahMin) failReasons.push("AH_LOW");
            else if (cell.ahValue > config.ahMax) failReasons.push("AH_HIGH");

            if (cell.irValue === null || cell.irValue === undefined || isNaN(cell.irValue)) failReasons.push("IR_MISSING");
            else if (cell.irValue <= 0 || cell.irValue > 500) failReasons.push("IR_IMPOSSIBLE");
            else if (cell.irValue < config.irMin) failReasons.push("IR_LOW");
            else if (cell.irValue > config.irMax) failReasons.push("IR_HIGH");

            failureReason = failReasons.length > 0 ? failReasons.join(", ") : backendQcResult;
          }

          // STAGE 3: MISMATCH DETECTION
          const frontendQcResult = cell.qcPrediction;
          if (frontendQcResult && frontendQcResult !== "incomplete" && frontendQcResult !== backendQcResult) {
            console.error("QC_MISMATCH", { 
              serial: normalizedSerial, 
              frontend: frontendQcResult, 
              backend: backendQcResult,
              reason: failureReason,
              ah: cell.ahValue,
              ir: cell.irValue,
              thresholds 
            });
          }

          // Validate Production Cell Testing Requirement if provided
          let prodReq: any = null;
          const targetRequirementId = cell.productionRequirementId || existing?.testingRequirementId;
          if (targetRequirementId) {
            prodReq = await tx.productionCellTestingRequirement.findUnique({
              where: { id: targetRequirementId },
              include: { workOrder: true }
            });
            if (prodReq) {
              if (prodReq.status !== "IN_PROGRESS" && backendQcResult === "PASS") {
                // If it was completed, check if remaining > 0
                if (prodReq.remainingQuantity <= 0 && (!existing || existing.status !== CellStatus.RETEST_REQUIRED)) {
                  throw new Error(`Production testing requirement ${prodReq.requirementNumber} is already fulfilled (${prodReq.testedQuantity}/${prodReq.requiredQuantity})`);
                }
              }
            }
          }

          // Retest Attempt Tracking & Escalations
          let nextRetestCount = existing ? existing.retestCount : 0;
          let newStatus: CellStatus = CellStatus.HOLD;

          if (backendQcResult === "PASS") {
            newStatus = CellStatus.CELL_TESTED;
          } else if (backendQcResult === "FAIL") {
            newStatus = CellStatus.REJECTED;
          } else if (backendQcResult === "RETEST") {
            nextRetestCount = (existing ? existing.retestCount : 0) + 1;
            if (nextRetestCount === 1) {
              newStatus = CellStatus.RETEST_REQUIRED;
            } else if (nextRetestCount === 2) {
              newStatus = CellStatus.HOLD;
            } else {
              newStatus = CellStatus.REJECTED;
            }
          } else if (backendQcResult === "HOLD") {
            newStatus = CellStatus.HOLD;
          }

          // If cell does not exist yet (captured at testing stage from bulk inward batch):
          let linkedBatchNumber = existing?.batchNumber || null;
          let inwardBatchId = existing?.inwardBatchId || null;

          if (!existing) {
            // Find active inward batch with availableQty > 0
            const activeBatch = await tx.cellInwardBatch.findFirst({
              where: {
                availableQty: { gt: 0 },
                ...(cell.batchNumber ? { batchNumber: cell.batchNumber } : {})
              },
              orderBy: { createdAt: "asc" }
            });

            if (activeBatch) {
              inwardBatchId = activeBatch.id;
              linkedBatchNumber = activeBatch.batchNumber;

              const newAvail = Math.max(0, activeBatch.availableQty - 1);
              const isRejected = newStatus === CellStatus.REJECTED;

              await tx.cellInwardBatch.update({
                where: { id: activeBatch.id },
                data: {
                  availableQty: newAvail,
                  testedQty: activeBatch.testedQty + (isRejected ? 0 : 1),
                  rejectedQty: activeBatch.rejectedQty + (isRejected ? 1 : 0),
                  status: newAvail === 0 ? "COMPLETED" : "IN_TESTING"
                }
              });
            }

            // If production requirement is specified, validate batch SKU against requirement SKU
            if (prodReq && activeBatch) {
              const batchSku = (activeBatch.partNumber || "").toUpperCase();
              const reqSku = (prodReq.cellSku || "").toUpperCase();
              if (batchSku !== reqSku && !batchSku.includes(reqSku) && !reqSku.includes(batchSku)) {
                throw new Error(`Cell SKU mismatch: Requirement requires ${prodReq.cellSku} but batch is ${activeBatch.partNumber}`);
              }
            }

            existing = await tx.cell.create({
              data: {
                serialNumber: normalizedSerial,
                inwardBatchId: inwardBatchId,
                partNumber: activeBatch?.partNumber || prodReq?.cellSku || "CELL-LFP-3200",
                batchNumber: linkedBatchNumber || "BATCH-2026-001",
                voltage: cell.voltage || activeBatch?.voltage || 3.2,
                category: activeBatch?.category || "LFP 3.2V",
                cycles: activeBatch?.cycles || 0,
                status: CellStatus.RAW,
                testingRequirementId: prodReq ? prodReq.id : null
              }
            });
          }

          const updatedCell = await tx.cell.update({
            where: { serialNumber: normalizedSerial },
            data: {
              ahValue: cell.ahValue,
              irValue: cell.irValue,
              grade: cell.grade,
              status: newStatus,
              retestCount: nextRetestCount,
              lastRetestAt: backendQcResult === "RETEST" ? new Date() : undefined,
              testingRequirementId: prodReq ? prodReq.id : existing.testingRequirementId,
              qcDecisionHistory: {
                push: backendQcResult
              },
              machineId: cell.machineId,
              machineCalibrationDate: cell.machineCalibrationDate ? new Date(cell.machineCalibrationDate) : undefined,
              machineOperator: cell.machineOperator,
              ambientTemperature: cell.ambientTemperature,
              cellTemperature: cell.cellTemperature,
              updatedAt: new Date(),
            },
          });

          // UPDATE PRODUCTION REQUIREMENT IF PASS
          let remainingRequirementAfter = prodReq ? prodReq.remainingQuantity : undefined;
          if (prodReq && backendQcResult === "PASS") {
            const wasAlreadyCredited = existing.status === CellStatus.CELL_TESTED && existing.testingRequirementId === prodReq.id;
            if (!wasAlreadyCredited) {
              const newTested = prodReq.testedQuantity + 1;
              const newRemaining = Math.max(0, prodReq.requiredQuantity - newTested);
              const isCompleted = newRemaining === 0;
              remainingRequirementAfter = newRemaining;

              await tx.productionCellTestingRequirement.update({
                where: { id: prodReq.id },
                data: {
                  testedQuantity: newTested,
                  remainingQuantity: newRemaining,
                  status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
                  completedAt: isCompleted ? new Date() : null
                }
              });

              if (isCompleted) {
                wsManager.broadcastToRoles(["SUPERVISOR", "TEST_ENGINEER", "ADMIN", "SUPERADMIN"], "production_cell_requirement_completed", {
                  requirementId: prodReq.id,
                  requirementNumber: prodReq.requirementNumber,
                  workOrderId: prodReq.workOrderId,
                  cellSku: prodReq.cellSku,
                  requiredQuantity: prodReq.requiredQuantity
                });
              }
            }
          }

          await tx.auditLog.create({
            data: {
              entityType: "cell",
              entityId: normalizedSerial,
              actorId: actor,
              action: `qc_result_${backendQcResult.toLowerCase()}`,
              prevStatus: existing ? existing.status : "RAW",
              newStatus,
              metadata: {
                ah: cell.ahValue,
                ir: cell.irValue,
                qcResult: backendQcResult,
                failureReason,
                retestCount: nextRetestCount,
                inwardBatchId,
                batchNumber: linkedBatchNumber,
                productionRequirementId: prodReq?.id,
                workOrderId: prodReq?.workOrderId,
                thresholdSnapshot: {
                  ahMin: config.ahMin,
                  ahMax: config.ahMax,
                  irMin: config.irMin,
                  irMax: config.irMax,
                  retestAhMargin: config.retestAhMargin,
                  retestIrMargin: config.retestIrMargin,
                  hardFailAh: config.hardFailAh,
                  hardFailIr: config.hardFailIr,
                },
                sourceFile: cell.sourceFile,
                machineSerial: cell.machineSerial,
                machineId: cell.machineId,
                machineOperator: cell.machineOperator,
                ambientTemperature: cell.ambientTemperature,
                cellTemperature: cell.cellTemperature,
                timestamp: new Date().toISOString()
              },
            },
          });

          // AUTO-MOVE REJECTED CELLS TO SCRAP PENDING REVIEW IN SCRAP MANAGEMENT
          if (newStatus === CellStatus.REJECTED) {
            let cellMaterial = await tx.material.findUnique({ where: { sku: "SKU-REJ-CELL" } });
            if (!cellMaterial) {
              cellMaterial = await tx.material.create({
                data: {
                  name: "Rejected Lithium-Ion Cells",
                  category: "CELLS",
                  sku: "SKU-REJ-CELL",
                  quantity: 0,
                  unit: "pcs",
                  minStock: 0,
                  unitPrice: 15.0,
                  totalValue: 0.0,
                  isPriceVerified: true,
                  materialType: "CELL_REJECT"
                }
              });
            }

            await tx.scrapEntry.create({
              data: {
                scrapId: `SCRAP-${cell.cellSerial}-${Date.now().toString().slice(-4)}`,
                scrapType: "LOSS",
                sourceType: "TESTING",
                status: "SCRAP_PENDING_REVIEW",
                materialId: cellMaterial.id,
                materialName: cellMaterial.name,
                sku: cellMaterial.sku,
                quantity: 1,
                unitCost: cellMaterial.unitPrice,
                totalCost: cellMaterial.unitPrice,
                defectType: failureReason || "QC_FAIL",
                severity: "HIGH",
                description: `Auto-scrapped from test engine due to QC failure. Tested values: AH=${cell.ahValue}, IR=${cell.irValue}.`,
                cellSerial: cell.cellSerial,
                createdBy: actor,
              }
            });
          }

          return { 
            newStatus, 
            nextRetestCount, 
            failureReason, 
            batchNumber: existing.batchNumber,
            productionRequirementId: prodReq?.id,
            remainingRequirement: remainingRequirementAfter
          };
        });

        // Batch Analytics updates and Live Alerts
        if (result.batchNumber) {
          await updateBatchAnalytics(result.batchNumber);
        }

        if (result.newStatus === CellStatus.CELL_TESTED) results.passed++;
        else if (result.newStatus === CellStatus.REJECTED) results.rejected++;
        else if (result.newStatus === CellStatus.RETEST_REQUIRED) results.retest++;
        else if (result.newStatus === CellStatus.HOLD) results.hold++;

        if (result.newStatus === CellStatus.REJECTED || result.newStatus === CellStatus.HOLD) {
          wsManager.broadcastToRoles(["ADMIN", "SUPERADMIN", "SUPERVISOR"], "cell_qc_alert", {
            cellSerial: cell.cellSerial,
            status: result.newStatus,
            failureReason: result.failureReason,
            retestCount: result.nextRetestCount,
            ahValue: cell.ahValue,
            irValue: cell.irValue,
          });
        }
        
        perCell.push({ 
          cellSerial: cell.cellSerial, 
          result: result.newStatus, 
          failureReason: result.failureReason,
          testingRequirementId: result.productionRequirementId,
          remainingRequirement: result.remainingRequirement
        });
      } catch (err: any) {
        console.error("Apply error for cell", cell.cellSerial, err);
        results.errors++;
        perCell.push({ cellSerial: cell.cellSerial, result: "error", failureReason: err.message || "Transaction failed" });
      }
    }

    return { ...results, perCell };
  });
}



/**
 * Recalculates statistics for a batch and triggers real-time quality control alerts.
 */
async function updateBatchAnalytics(batchNumber: string) {
  const batchCells = await prisma.cell.findMany({
    where: { batchNumber }
  });

  const totalCount = batchCells.length;
  if (totalCount === 0) return;

  const passedCount = batchCells.filter(c => c.status === CellStatus.CELL_TESTED).length;
  const failedCount = batchCells.filter(c => c.status === CellStatus.REJECTED).length;
  const retestCount = batchCells.filter(c => c.status === CellStatus.RETEST_REQUIRED || c.retestCount > 0).length;

  const failRate = (failedCount / totalCount) * 100;
  const retestRate = (retestCount / totalCount) * 100;
  
  // Enterprise Stability Index formulation: 100 - (1.0 * Failure Rate + 0.5 * Retest Rate)
  const stabilityScore = Math.max(0, Math.min(100, 100 - (failRate + (retestRate * 0.5))));

  await prisma.batchAnalytics.upsert({
    where: { batchNumber },
    update: {
      totalCells: totalCount,
      passedCount,
      failedCount,
      retestCount,
      stabilityScore
    },
    create: {
      batchNumber,
      totalCells: totalCount,
      passedCount,
      failedCount,
      retestCount,
      stabilityScore
    }
  });

  // Real-Time Socket Alerts for manufacturing safety
  if (failRate > 15) {
    wsManager.broadcastToRoles(["ADMIN", "SUPERADMIN", "SUPERVISOR"], "batch_alert", {
      type: "HIGH_FAILURE_RATE",
      batchNumber,
      message: `High QC failure rate (${failRate.toFixed(1)}%) detected in Batch ${batchNumber}`
    });
  }

  if (stabilityScore < 80) {
    wsManager.broadcastToRoles(["ADMIN", "SUPERADMIN", "SUPERVISOR"], "batch_alert", {
      type: "SUPERVISOR_INSPECTION_REQUIRED",
      batchNumber,
      message: `Batch ${batchNumber} requires supervisor inspection due to low stability score (${stabilityScore.toFixed(1)}/100)`
    });
  }
}
