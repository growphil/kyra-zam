import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { 
  QualityInspectionCreateSchema,
  DefectCreateSchema
} from "../schemas/zod.schemas";
import { disassemblePaxPack } from "../services/disassembly.service";

// Sequential numbering helpers
async function generateInspectionNumber() {
  const last = await prisma.qualityInspection.findFirst({ orderBy: { inspectionNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.inspectionNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `QC-${String(next).padStart(6, '0')}`;
}

async function generateDefectNumber(tx?: any) {
  const client = tx || prisma;
  const last = await client.defect.findFirst({ orderBy: { defectNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.defectNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `DEF-${String(next).padStart(6, '0')}`;
}

export async function qualityRoutes(fastify: FastifyInstance) {
  const qualityPreHandler = { preHandler: [requireRoles("SUPERVISOR", "ADMIN", "SUPERADMIN", "QC")] };
  const readPreHandler = { preHandler: [requireRoles("SUPERVISOR", "PAX_TEST_ENGINEER", "ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN", "QC")] };

  // GET /crm/quality/dashboard
  fastify.get("/dashboard", readPreHandler, async (request, reply) => {
    const [
      cellQcPending,
      cellQcApproved,
      paxQcPending,
      paxQcApproved,
      openDefects,
      criticalDefects,
      totalInspections,
      passedInspections,
      failedInspections,
      recentPaxInspections,
      recentCellLogs,
      activeDefectsList
    ] = await Promise.all([
      // 1. Gate 1: Cell QC Pending (Cells tested by Test Engineer awaiting QC review)
      prisma.cell.count({
        where: {
          status: "CELL_TESTED",
          NOT: {
            qcDecisionHistory: {
              has: "QC_APPROVED"
            }
          }
        }
      }),
      // Gate 1: Cell QC Approved
      prisma.cell.count({
        where: {
          status: "CELL_TESTED",
          qcDecisionHistory: {
            has: "QC_APPROVED"
          }
        }
      }),
      // 2. Gate 2: PAX QC Pending (Packs with completed PAX testing awaiting final QC)
      prisma.paxPack.count({
        where: { status: "PAX_TESTED" }
      }),
      // Gate 2: PAX QC Approved
      prisma.paxPack.count({
        where: { status: "READY_FOR_SALE" }
      }),
      // Defect metrics
      prisma.defect.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      prisma.defect.count({ where: { severity: "CRITICAL", status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      // Inspection metrics
      prisma.qualityInspection.count(),
      prisma.qualityInspection.count({ where: { result: "PASS" } }),
      prisma.qualityInspection.count({ where: { result: "FAIL" } }),
      // Recent PAX QC Inspections
      prisma.qualityInspection.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          inspector: { select: { name: true } },
          workOrder: { select: { workOrderNumber: true } }
        }
      }),
      // Recent Cell QC Audit Logs
      prisma.auditLog.findMany({
        where: {
          entityType: "cell",
          action: { in: ["qc_cell_approved", "qc_cell_rejected", "qc_cell_send_retest", "qc_result_pass"] }
        },
        take: 10,
        orderBy: { timestamp: "desc" },
        include: {
          actor: { select: { name: true } }
        }
      }),
      // Active defects list
      prisma.defect.findMany({
        where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          workOrder: { select: { workOrderNumber: true } },
          reportedBy: { select: { name: true } }
        }
      })
    ]);

    // Build unified recent inspections stream (both CELL & PAX)
    const combinedInspections: any[] = [];

    for (const insp of recentPaxInspections) {
      combinedInspections.push({
        id: insp.id,
        inspectionNumber: insp.inspectionNumber,
        type: "PAX",
        serial: insp.paxSerial || "---",
        workOrder: insp.workOrder?.workOrderNumber || "---",
        result: insp.result,
        inspector: insp.inspector?.name || "QC Inspector",
        timestamp: insp.createdAt,
        notes: insp.notes
      });
    }

    for (const log of recentCellLogs) {
      const isApproved = log.action === "qc_cell_approved";
      const isRejected = log.action === "qc_cell_rejected";
      const isRetest = log.action === "qc_cell_send_retest";
      const result = isApproved ? "PASS" : isRejected ? "FAIL" : isRetest ? "RETEST" : "TESTED";

      combinedInspections.push({
        id: log.id,
        inspectionNumber: `QC-C-${log.id.slice(0, 6).toUpperCase()}`,
        type: "CELL",
        serial: log.entityId,
        workOrder: (log.metadata as any)?.workOrderId || "---",
        result,
        inspector: log.actor?.name || "Sunita Patel (Tester)",
        timestamp: log.timestamp,
        notes: (log.metadata as any)?.notes || (log.metadata as any)?.reason
      });
    }

    combinedInspections.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      stats: {
        cellQcPending,
        cellQcApproved,
        paxQcPending,
        paxQcApproved,
        activeDefects: openDefects,
        criticalDefects,
        totalInspections,
        passedInspections,
        failedInspections
      },
      recentInspections: combinedInspections.slice(0, 10),
      activeDefects: activeDefectsList
    };
  });

  // ── 1. CELL QC APPROVAL GATE (GATE 1) ─────────────────────────────────────

  // GET /crm/quality/cells/pending-qc - Queue of tested cells awaiting QC approval
  fastify.get("/cells/pending-qc", readPreHandler, async (request) => {
    const { search, grade, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {
      status: "CELL_TESTED",
      NOT: {
        qcDecisionHistory: {
          has: "QC_APPROVED"
        }
      }
    };

    if (grade) where.grade = grade;
    if (search) {
      where.OR = [
        { serialNumber: { contains: search, mode: "insensitive" } },
        { partNumber: { contains: search, mode: "insensitive" } },
        { batchNumber: { contains: search, mode: "insensitive" } }
      ];
    }

    const [cells, total] = await Promise.all([
      prisma.cell.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        include: {
          inwardBatch: {
            select: {
              id: true,
              inwardNumber: true,
              batchNumber: true,
              partNumber: true
            }
          },
          testingRequirement: {
            include: {
              workOrder: {
                select: {
                  id: true,
                  workOrderNumber: true,
                  productRef: true,
                  bom: { select: { name: true } }
                }
              }
            }
          }
        }
      }),
      prisma.cell.count({ where })
    ]);

    // Fetch tester information from audit logs for these cells
    const cellSerials = cells.map(c => c.serialNumber);
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "cell",
        entityId: { in: cellSerials },
        action: { startsWith: "qc_result_" }
      },
      orderBy: { timestamp: "desc" },
      include: {
        actor: { select: { id: true, name: true, email: true } }
      }
    });

    const enrichedCells = cells.map(cell => {
      const log = auditLogs.find(l => l.entityId === cell.serialNumber);
      return {
        ...cell,
        testedBy: log?.actor?.name || cell.machineOperator || "Sunita Patel",
        testedAt: log?.timestamp || cell.updatedAt,
        testMethod: cell.machineId ? `Machine (${cell.machineId})` : "Manual Station"
      };
    });

    return {
      cells: enrichedCells,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take)
    };
  });

  // GET /crm/quality/cells/history - QC-reviewed Cell History
  fastify.get("/cells/history", readPreHandler, async (request) => {
    const { search, decision, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {
      OR: [
        { qcDecisionHistory: { has: "QC_APPROVED" } },
        { qcDecisionHistory: { has: "QC_REJECTED" } },
        { qcDecisionHistory: { has: "QC_RETEST" } }
      ]
    };

    if (decision === "APPROVED") {
      where.qcDecisionHistory = { has: "QC_APPROVED" };
      where.status = "CELL_TESTED";
    } else if (decision === "REJECTED") {
      where.status = "REJECTED";
    } else if (decision === "RETEST") {
      where.status = "RETEST_REQUIRED";
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { serialNumber: { contains: search, mode: "insensitive" } },
            { partNumber: { contains: search, mode: "insensitive" } },
            { batchNumber: { contains: search, mode: "insensitive" } }
          ]
        }
      ];
    }

    const [cells, total] = await Promise.all([
      prisma.cell.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: "desc" },
        include: {
          inwardBatch: {
            select: {
              id: true,
              inwardNumber: true,
              batchNumber: true,
              partNumber: true
            }
          },
          testingRequirement: {
            include: {
              workOrder: {
                select: {
                  id: true,
                  workOrderNumber: true,
                  productRef: true
                }
              }
            }
          }
        }
      }),
      prisma.cell.count({ where })
    ]);

    // Fetch QC audit logs for decision details
    const cellSerials = cells.map(c => c.serialNumber);
    const qcLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "cell",
        entityId: { in: cellSerials },
        action: { in: ["qc_cell_approved", "qc_cell_rejected", "qc_cell_send_retest"] }
      },
      orderBy: { timestamp: "desc" },
      include: {
        actor: { select: { id: true, name: true } }
      }
    });

    const enrichedCells = cells.map(cell => {
      const log = qcLogs.find(l => l.entityId === cell.serialNumber);
      const isApproved = cell.qcDecisionHistory.includes("QC_APPROVED") && cell.status === "CELL_TESTED";
      const isRejected = cell.status === "REJECTED" || cell.qcDecisionHistory.includes("QC_REJECTED");
      const isRetest = cell.status === "RETEST_REQUIRED" || cell.qcDecisionHistory.includes("QC_RETEST");

      return {
        ...cell,
        qcDecision: isApproved ? "QC_APPROVED" : isRejected ? "QC_REJECTED" : isRetest ? "QC_RETEST" : "QC_REVIEWED",
        qcInspector: log?.actor?.name || "QC Inspector",
        qcDecisionAt: log?.timestamp || cell.updatedAt,
        qcNotes: (log?.metadata as any)?.notes || (log?.metadata as any)?.reason || null
      };
    });

    return {
      cells: enrichedCells,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take)
    };
  });

  // POST /crm/quality/cells/:serial/decision - Record QC Gate 1 decision
  fastify.post(
    "/cells/:serial/decision",
    qualityPreHandler,
    async (request, reply) => {
      const { serial } = request.params as { serial: string };
      const { decision, reason, notes } = request.body as {
        decision: "APPROVE" | "RETEST" | "REJECT";
        reason?: string;
        notes?: string;
      };
      const actor = request.user as { id: string; name?: string };

      const cell = await prisma.cell.findUnique({
        where: { serialNumber: serial },
        include: { inwardBatch: true, testingRequirement: true }
      });

      if (!cell) {
        return reply.status(404).send({ error: "Cell not found" });
      }

      if (cell.status !== "CELL_TESTED" && cell.status !== "HOLD") {
        return reply.status(400).send({
          error: `Cannot make QC decision on cell in status ${cell.status}. Only tested cells awaiting QC can be reviewed.`
        });
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          if (decision === "APPROVE") {
            const updated = await tx.cell.update({
              where: { serialNumber: serial },
              data: {
                status: "CELL_TESTED",
                qcDecisionHistory: {
                  push: "QC_APPROVED"
                },
                updatedAt: new Date()
              }
            });

            await tx.auditLog.create({
              data: {
                entityType: "cell",
                entityId: serial,
                actorId: actor.id,
                action: "qc_cell_approved",
                prevStatus: cell.status,
                newStatus: "CELL_TESTED",
                metadata: {
                  decision: "APPROVE",
                  inspector: actor.name || actor.id,
                  notes: notes || "Cell QC inspection passed and approved for production.",
                  timestamp: new Date().toISOString()
                }
              }
            });

            return updated;
          } else if (decision === "RETEST") {
            const nextRetest = cell.retestCount + 1;
            const updated = await tx.cell.update({
              where: { serialNumber: serial },
              data: {
                status: "RETEST_REQUIRED",
                retestCount: nextRetest,
                lastRetestAt: new Date(),
                qcDecisionHistory: {
                  push: "QC_RETEST"
                },
                updatedAt: new Date()
              }
            });

            await tx.auditLog.create({
              data: {
                entityType: "cell",
                entityId: serial,
                actorId: actor.id,
                action: "qc_cell_send_retest",
                prevStatus: cell.status,
                newStatus: "RETEST_REQUIRED",
                metadata: {
                  decision: "RETEST",
                  reason: reason || "Sent for retest by QC Inspector",
                  notes,
                  retestCount: nextRetest,
                  inspector: actor.name || actor.id,
                  timestamp: new Date().toISOString()
                }
              }
            });

            return updated;
          } else if (decision === "REJECT") {
            const updated = await tx.cell.update({
              where: { serialNumber: serial },
              data: {
                status: "REJECTED",
                qcDecisionHistory: {
                  push: "QC_REJECTED"
                },
                updatedAt: new Date()
              }
            });

            // If scrap material exists, log to Scrap
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
                scrapId: `SCRAP-${serial}-${Date.now().toString().slice(-4)}`,
                scrapType: "LOSS",
                sourceType: "TESTING",
                status: "SCRAP_PENDING_REVIEW",
                materialId: cellMaterial.id,
                materialName: cellMaterial.name,
                sku: cellMaterial.sku,
                quantity: 1,
                unitCost: cellMaterial.unitPrice,
                totalCost: cellMaterial.unitPrice,
                defectType: `QC_REJECT: ${reason || "Cell rejected during QC review"}`,
                severity: "HIGH",
                description: notes || `QC Inspector rejected cell. Reason: ${reason || "Specification mismatch"}`,
                cellSerial: serial,
                createdBy: actor.id
              }
            });

            await tx.auditLog.create({
              data: {
                entityType: "cell",
                entityId: serial,
                actorId: actor.id,
                action: "qc_cell_rejected",
                prevStatus: cell.status,
                newStatus: "REJECTED",
                metadata: {
                  decision: "REJECT",
                  reason: reason || "Rejected by QC Inspector",
                  notes,
                  inspector: actor.name || actor.id,
                  timestamp: new Date().toISOString()
                }
              }
            });

            return updated;
          } else {
            throw new Error(`Invalid QC decision ${decision}`);
          }
        });

        return { success: true, cell: result, decision };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "QC cell decision failed" });
      }
    }
  );

  // ── 2. PAX QC APPROVAL GATE (GATE 2) ──────────────────────────────────────

  // GET /crm/quality/pax/pending-qc - Queue of tested PAX packs awaiting QC approval
  fastify.get("/pax/pending-qc", readPreHandler, async (request) => {
    const { search, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {
      status: "PAX_TESTED"
    };

    if (search) {
      where.OR = [
        { paxSerial: { contains: search, mode: "insensitive" } },
        { workOrder: { workOrderNumber: { contains: search, mode: "insensitive" } } },
        { paxType: { name: { contains: search, mode: "insensitive" } } }
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
            include: {
              bom: true,
              supervisor: { select: { name: true } }
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
                  grade: true,
                  status: true
                }
              }
            },
            orderBy: { position: "asc" }
          },
          assembledAtStation: true
        }
      }),
      prisma.paxPack.count({ where })
    ]);

    // Fetch tester and test report details from audit logs
    const paxSerials = packs.map(p => p.paxSerial);
    const testLogs = await prisma.auditLog.findMany({
      where: {
        entityType: "pax",
        entityId: { in: paxSerials },
        action: { in: ["pax_tested", "pax_test_uploaded", "test_report_uploaded", "STATUS_CHANGE"] }
      },
      orderBy: { timestamp: "desc" },
      include: {
        actor: { select: { id: true, name: true, email: true } }
      }
    });

    const enrichedPacks = packs.map(pack => {
      const log = testLogs.find(l => l.entityId === pack.paxSerial);
      return {
        ...pack,
        paxTestedBy: log?.actor?.name || "PAX Test Engineer",
        paxTestedAt: log?.timestamp || pack.assembledAt,
        paxTestResult: "PASS",
        cellCount: pack.cells.length
      };
    });

    return {
      packs: enrichedPacks,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take)
    };
  });

  // GET /crm/quality/pax/history - QC-reviewed PAX History
  fastify.get("/pax/history", readPreHandler, async (request) => {
    const { search, status, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {
      inspections: {
        some: {}
      }
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { paxSerial: { contains: search, mode: "insensitive" } },
        { workOrder: { workOrderNumber: { contains: search, mode: "insensitive" } } }
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
              workOrderNumber: true,
              productRef: true
            }
          },
          inspections: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              inspector: { select: { name: true } }
            }
          }
        }
      }),
      prisma.paxPack.count({ where })
    ]);

    const enrichedPacks = packs.map(pack => {
      const latestInsp = pack.inspections[0];
      return {
        ...pack,
        latestInspection: latestInsp || null,
        qcDecision: latestInsp?.result === "PASS" ? "QC_APPROVED" : latestInsp?.result === "FAIL" ? "QC_REJECTED" : latestInsp?.result || "COMPLETED",
        qcInspector: latestInsp?.inspector?.name || "QC Inspector",
        qcDecisionAt: latestInsp?.createdAt || pack.approvedAt
      };
    });

    return {
      packs: enrichedPacks,
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take)
    };
  });

  // POST /crm/quality/pax/:serial/decision - Record QC Gate 2 decision
  fastify.post(
    "/pax/:serial/decision",
    qualityPreHandler,
    async (request, reply) => {
      const { serial } = request.params as { serial: string };
      const { decision, notes, defectType, severity, checkpoints } = request.body as {
        decision: "APPROVE" | "RETEST_REWORK" | "REJECT";
        notes?: string;
        defectType?: string;
        severity?: string;
        checkpoints?: any[];
      };
      const actor = request.user as { id: string; name?: string };

      const pax = await prisma.paxPack.findUnique({
        where: { paxSerial: serial },
        include: { workOrder: { include: { operators: true } } }
      });

      if (!pax) {
        return reply.status(404).send({ error: "Pax Pack not found" });
      }

      if (decision === "APPROVE" && pax.status !== "PAX_TESTED") {
        return reply.status(400).send({
          error: `Cannot submit QC APPROVE. Pax Pack status must be PAX_TESTED (Current: ${pax.status})`
        });
      }

      // Quality Separation of Duties: Operators are not authorized to inspect own assembly
      if (pax.workOrder?.operators?.some((op: any) => op.userId === actor.id)) {
        return reply.status(403).send({
          error: "Quality Separation of Duties: Operators cannot inspect or sign-off their own Work Order assemblies."
        });
      }

      const inspectionNumber = await generateInspectionNumber();
      const resultValue = decision === "APPROVE" ? "PASS" : decision === "RETEST_REWORK" ? "RETEST" : "FAIL";

      try {
        const result = await prisma.$transaction(async (tx) => {
          // 1. Create QualityInspection
          const inspection = await tx.qualityInspection.create({
            data: {
              inspectionNumber,
              workOrderId: pax.workOrderId,
              paxSerial: serial,
              inspectionType: "FINAL",
              inspectorId: actor.id,
              status: "COMPLETED",
              result: resultValue,
              notes: notes || (decision === "APPROVE" ? "Approved by QC Inspector" : "QC rejected/sent for rework")
            }
          });

          // 2. Add checkpoints if provided
          const cps = checkpoints || [
            { name: "PAX Test Verification", description: "Verify PAX automated test results and parameters", result: resultValue === "PASS" ? "PASS" : "FAIL" },
            { name: "Cell Genealogy Check", description: "Verify all series cells are matched and QC approved", result: "PASS" },
            { name: "Enclosure & Safety Seal", description: "Verify physical build, torque markers, safety labels", result: resultValue === "PASS" ? "PASS" : "FAIL" }
          ];

          for (const cp of cps) {
            await tx.qualityCheckpoint.create({
              data: {
                inspectionId: inspection.id,
                name: cp.name,
                description: cp.description,
                expectedValue: cp.expectedValue || "Within Standard Tolerance",
                actualValue: cp.actualValue || (resultValue === "PASS" ? "Verified Compliant" : "Defect Detected"),
                result: cp.result || (resultValue === "PASS" ? "PASS" : "FAIL"),
                notes: cp.notes || null
              }
            });
          }

          // 3. Handle Status Transitions
          if (decision === "APPROVE") {
            await tx.paxPack.update({
              where: { paxSerial: serial },
              data: {
                status: "READY_FOR_SALE",
                approvedBy: actor.id,
                approvedAt: new Date()
              }
            });

            await tx.auditLog.create({
              data: {
                entityType: "pax",
                entityId: serial,
                actorId: actor.id,
                action: "final_qc_pass",
                prevStatus: pax.status,
                newStatus: "READY_FOR_SALE",
                metadata: { inspectionNumber, decision: "APPROVE", notes }
              }
            });

            // Check auto-completion of Work Order
            if (pax.workOrderId) {
              const wo = await tx.workOrder.findUnique({ where: { id: pax.workOrderId } });
              if (wo && wo.status !== "COMPLETED" && wo.status !== "CANCELLED" && wo.status !== "CLOSED") {
                const totalReadyPacks = await tx.paxPack.count({
                  where: {
                    workOrderId: pax.workOrderId,
                    status: "READY_FOR_SALE"
                  }
                });

                const pendingPacks = await tx.paxPack.count({
                  where: {
                    workOrderId: pax.workOrderId,
                    status: { not: "READY_FOR_SALE" }
                  }
                });

                if (pendingPacks === 0 && totalReadyPacks >= (wo.plannedQuantity || 1)) {
                  await tx.workOrder.update({
                    where: { id: pax.workOrderId },
                    data: {
                      status: "COMPLETED",
                      completedQuantity: totalReadyPacks
                    }
                  });

                  await tx.auditLog.create({
                    data: {
                      entityType: "work-order",
                      entityId: pax.workOrderId,
                      actorId: actor.id,
                      action: "PRODUCTION_COMPLETED_AUTOMATIC",
                      prevStatus: wo.status,
                      newStatus: "COMPLETED",
                      metadata: { inspectionNumber, paxSerial: serial, totalPacks: totalReadyPacks }
                    }
                  });
                }
              }
            }
          } else {
            // RETEST_REWORK or REJECT -> move to UNDER_REPAIR & log Defect
            await tx.paxPack.update({
              where: { paxSerial: serial },
              data: { status: "UNDER_REPAIR" }
            });

            await tx.auditLog.create({
              data: {
                entityType: "pax",
                entityId: serial,
                actorId: actor.id,
                action: "final_qc_fail",
                prevStatus: pax.status,
                newStatus: "UNDER_REPAIR",
                metadata: { inspectionNumber, decision, notes }
              }
            });

            const defectNum = await generateDefectNumber(tx);
            await tx.defect.create({
              data: {
                defectNumber: defectNum,
                workOrderId: pax.workOrderId,
                paxSerial: serial,
                inspectionId: inspection.id,
                defectType: defectType || (decision === "RETEST_REWORK" ? "REWORK_REQUIRED" : "QC_FAIL"),
                severity: severity || "CRITICAL",
                description: notes || `Failed QC Gate 2 Inspection (${inspectionNumber}). Sent to ${decision}.`,
                disposition: decision === "RETEST_REWORK" ? "REWORK" : "REPAIR",
                status: "OPEN",
                reportedById: actor.id
              }
            });
          }

          return inspection;
        });

        return { success: true, inspection: result, decision };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "QC PAX decision failed" });
      }
    }
  );

  // GET /crm/quality/inspections
  fastify.get("/inspections", readPreHandler, async (request, reply) => {
    const { status, result, type } = request.query as any;
    const where: any = {};
    if (status) where.status = status;
    if (result) where.result = result;
    if (type) where.inspectionType = type;

    return prisma.qualityInspection.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        workOrder: { select: { workOrderNumber: true } },
        pax: { select: { paxSerial: true } },
        inspector: { select: { name: true } }
      }
    });
  });

  // GET /crm/quality/inspections/:id
  fastify.get("/inspections/:id", readPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const insp = await prisma.qualityInspection.findUnique({
      where: { id },
      include: {
        workOrder: true,
        pax: { include: { paxType: true } },
        inspector: { select: { name: true, email: true } },
        checkpoints: true,
        defects: true
      }
    });
    if (!insp) return reply.status(404).send({ error: "Inspection not found" });
    return insp;
  });

  // POST /crm/quality/inspections
  fastify.post("/inspections", qualityPreHandler, async (request, reply) => {
    const data = QualityInspectionCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const inspectionNumber = await generateInspectionNumber();

    try {
      const inspection = await prisma.$transaction(async (tx) => {
        let prevPaxStatus: string | null = null;
        let pax: any = null;

        if (data.paxSerial && data.inspectionType === "FINAL") {
          // Lock PaxPack row first (deterministic order!)
          await tx.$executeRawUnsafe(
            `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
            data.paxSerial
          );

          pax = await tx.paxPack.findUnique({
            where: { paxSerial: data.paxSerial },
            include: { workOrder: { include: { operators: true } } }
          });
          
          if (!pax) {
            throw new Error("Pax Pack not found");
          }

          if (!pax.workOrderId) {
            throw new Error("Cannot perform final QC inspection: Pax Pack is not linked to a Work Order.");
          }

          prevPaxStatus = pax.status;

          if (data.result === "PASS") {
            if (pax.status !== "PAX_TESTED") {
              throw new Error(`Cannot submit final QC PASS. Pax Pack status must be PAX_TESTED (Current: ${pax.status})`);
            }
          }
          
          if (pax.workOrder) {
            const isOperator = (pax.workOrder.operators || []).some((op: any) => op.userId === actor.id);
            if (isOperator) {
              throw new Error("Quality Separation of Duties: Operators are not authorized to inspect or sign-off their own Work Order assemblies.");
            }
          }
        }

        const doc = await tx.qualityInspection.create({
          data: {
            inspectionNumber,
            workOrderId: data.workOrderId,
            paxSerial: data.paxSerial,
            inspectionType: data.inspectionType,
            inspectorId: actor.id,
            status: "COMPLETED",
            result: data.result,
            notes: data.notes
          }
        });

        for (const cp of data.checkpoints) {
          await tx.qualityCheckpoint.create({
            data: {
              inspectionId: doc.id,
              name: cp.name,
              description: cp.description,
              expectedValue: cp.expectedValue,
              actualValue: cp.actualValue,
              result: cp.result,
              notes: cp.notes
            }
          });
        }

        if (data.paxSerial && data.inspectionType === "FINAL" && data.result === "PASS") {
          await tx.paxPack.update({
            where: { paxSerial: data.paxSerial },
            data: { status: "READY_FOR_SALE" }
          });

          await tx.auditLog.create({
            data: {
              entityType: "pax",
              entityId: data.paxSerial,
              actorId: actor.id,
              action: "final_qc_pass",
              prevStatus: prevPaxStatus || "PAX_TESTED",
              newStatus: "READY_FOR_SALE",
              metadata: { inspectionNumber }
            }
          });

          const targetWoId = data.workOrderId || (pax ? pax.workOrderId : null);
          if (targetWoId) {
            const wo = await tx.workOrder.findUnique({ where: { id: targetWoId } });
            if (wo && wo.status !== "COMPLETED" && wo.status !== "CANCELLED" && wo.status !== "CLOSED") {
              // 1. Check if all required cell testing requirements are completed
              const pendingPctrs = await tx.productionCellTestingRequirement.count({
                where: {
                  workOrderId: targetWoId,
                  status: { not: "COMPLETED" }
                }
              });

              // 2. Check if all other packs for this work order are already READY_FOR_SALE
              const activeUnpassedPacks = await tx.paxPack.count({
                where: {
                  workOrderId: targetWoId,
                  paxSerial: { not: data.paxSerial },
                  status: { not: "READY_FOR_SALE" }
                }
              });

              // 3. Check total ready packs count
              const totalReadyPacks = await tx.paxPack.count({
                where: {
                  workOrderId: targetWoId,
                  status: "READY_FOR_SALE"
                }
              });

              if (pendingPctrs === 0 && activeUnpassedPacks === 0 && totalReadyPacks >= (wo.plannedQuantity || 1)) {
                const now = new Date();
                const exec = await tx.workOrderExecution.findUnique({ where: { workOrderId: targetWoId } });
                let updatedHours = exec?.actualHours || 0;
                if (exec && !exec.completedAt) {
                  const lastActiveTime = exec.resumedAt || exec.startedAt || wo.startDate || now;
                  const elapsedMs = Math.max(0, now.getTime() - lastActiveTime.getTime());
                  updatedHours += elapsedMs / (1000 * 60 * 60);

                  await tx.workOrderExecution.update({
                    where: { workOrderId: targetWoId },
                    data: {
                      completedAt: now,
                      completionNotes: `Automatically completed via Final QC Pass (${inspectionNumber})`,
                      actualHours: updatedHours
                    }
                  });
                }

                await tx.workOrder.update({
                  where: { id: targetWoId },
                  data: {
                    status: "COMPLETED",
                    completedQuantity: totalReadyPacks
                  }
                });

                await tx.auditLog.create({
                  data: {
                    entityType: "work-order",
                    entityId: targetWoId,
                    actorId: actor.id,
                    action: "PRODUCTION_COMPLETED_AUTOMATIC",
                    prevStatus: wo.status,
                    newStatus: "COMPLETED",
                    metadata: { inspectionNumber, paxSerial: data.paxSerial, totalPacks: totalReadyPacks }
                  }
                });
              }
            }
          }
        }

        if (data.paxSerial && data.inspectionType === "FINAL" && data.result === "FAIL") {
          await tx.paxPack.update({
            where: { paxSerial: data.paxSerial },
            data: { status: "UNDER_REPAIR" }
          });

          await tx.auditLog.create({
            data: {
              entityType: "pax",
              entityId: data.paxSerial,
              actorId: actor.id,
              action: "final_qc_fail",
              prevStatus: prevPaxStatus || "PAX_TESTED",
              newStatus: "UNDER_REPAIR",
              metadata: { inspectionNumber }
            }
          });

          const defectNum = await generateDefectNumber(tx);
          const defect = await tx.defect.create({
            data: {
              defectNumber: defectNum,
              workOrderId: data.workOrderId || null,
              paxSerial: data.paxSerial,
              inspectionId: doc.id,
              defectType: "QC_FAIL",
              severity: "CRITICAL",
              description: data.notes || `Failed final QC inspection ${inspectionNumber}.`,
              status: "OPEN",
              reportedById: actor.id
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "defect",
              entityId: defect.id,
              actorId: actor.id,
              action: "DEFECT_REPORTED",
              newStatus: "OPEN",
              metadata: { inspectionNumber }
            }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "quality-inspection",
            entityId: doc.id,
            actorId: actor.id,
            action: "INSPECTION_COMPLETED",
            newStatus: data.result,
            metadata: { inspectionNumber, result: data.result, paxSerial: data.paxSerial }
          }
        });

        return doc;
      });

      return inspection;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "QC inspection submission failed" });
    }
  });

  // GET /crm/quality/defects
  fastify.get("/defects", readPreHandler, async (request, reply) => {
    const { status, severity } = request.query as any;
    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;

    return prisma.defect.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        workOrder: { select: { workOrderNumber: true } },
        pax: { select: { paxSerial: true } },
        reportedBy: { select: { name: true } },
        resolvedBy: { select: { name: true } }
      }
    });
  });

  // GET /crm/quality/defects/:id
  fastify.get("/defects/:id", readPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const def = await prisma.defect.findUnique({
      where: { id },
      include: {
        workOrder: true,
        pax: true,
        reportedBy: { select: { name: true, email: true } },
        resolvedBy: { select: { name: true, email: true } }
      }
    });
    if (!def) return reply.status(404).send({ error: "Defect report not found" });
    return def;
  });

  // POST /crm/quality/defects
  fastify.post("/defects", readPreHandler, async (request, reply) => {
    const data = DefectCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const defectNumber = await generateDefectNumber();

    try {
      const def = await prisma.$transaction(async (tx) => {
        if (data.paxSerial) {
          // Lock PaxPack row first
          await tx.$executeRawUnsafe(
            `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
            data.paxSerial
          );

          const pax = await tx.paxPack.findUnique({ where: { paxSerial: data.paxSerial } });
          if (!pax) {
            throw new Error("Pax Pack not found");
          }

          if (pax.status === "SOLD_TO_CUSTOMER" || pax.status === "SOLD_TO_VENDOR") {
            const err = new Error("Cannot report defect for a customer-owned battery pack.");
            (err as any).statusCode = 400;
            throw err;
          }
        }

        const doc = await tx.defect.create({
          data: {
            defectNumber,
            workOrderId: data.workOrderId,
            paxSerial: data.paxSerial,
            inspectionId: data.inspectionId,
            defectType: data.defectType,
            severity: data.severity,
            description: data.description,
            rootCause: data.rootCause,
            disposition: data.disposition,
            status: "OPEN",
            reportedById: actor.id
          }
        });

        if (data.paxSerial) {
          if (data.disposition === "SCRAP") {
            await disassemblePaxPack(
              tx,
              data.paxSerial,
              data.reclaimedMaterials || [],
              actor.id,
              data.description || "Scrapped via Defect ticket creation"
            );
          } else {
            await tx.paxPack.update({
              where: { paxSerial: data.paxSerial },
              data: { status: "UNDER_REPAIR" }
            });
          }
        }

        await tx.auditLog.create({
          data: {
            entityType: "defect",
            entityId: doc.id,
            actorId: actor.id,
            action: "DEFECT_REPORTED",
            newStatus: "OPEN",
            metadata: { defectNumber, severity: data.severity }
          }
        });

        return doc;
      });

      return def;
    } catch (err: any) {
      const code = err.statusCode || 400;
      return reply.status(code).send({ error: err.message || "Defect reporting failed" });
    }
  });

  // PUT /crm/quality/defects/:id/resolve
  fastify.put("/defects/:id/resolve", qualityPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { disposition, rootCause } = request.body as { disposition: string; rootCause?: string };
    const actor = request.user as { id: string };

    const baseDef = await prisma.defect.findUnique({ where: { id } });
    if (!baseDef) return reply.status(404).send({ error: "Defect not found" });

    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Lock order: PaxPack first, then Defect
        if (baseDef.paxSerial) {
          await tx.$executeRawUnsafe(
            `SELECT * FROM "PaxPack" WHERE "paxSerial" = $1 FOR UPDATE`,
            baseDef.paxSerial
          );
        }
        await tx.$executeRawUnsafe(
          `SELECT * FROM "Defect" WHERE id = $1 FOR UPDATE`,
          id
        );

        const currentDef = await tx.defect.findUnique({ where: { id } });
        if (!currentDef) throw new Error("Defect not found");

        if (currentDef.status === "RESOLVED" || currentDef.status === "CLOSED") {
          const err = new Error("Defect has already been resolved.");
          (err as any).statusCode = 400;
          throw err;
        }

        const previousStatus = currentDef.status;

        const doc = await tx.defect.update({
          where: { id },
          data: {
            status: "RESOLVED",
            disposition: disposition || currentDef.disposition,
            rootCause: rootCause || currentDef.rootCause,
            resolvedById: actor.id
          }
        });

        if (currentDef.paxSerial) {
          const pax = await tx.paxPack.findUnique({ where: { paxSerial: currentDef.paxSerial } });
          if (pax) {
            if (pax.status === "SOLD_TO_CUSTOMER" || pax.status === "SOLD_TO_VENDOR") {
              const err = new Error("Cannot alter status of a customer-owned battery pack.");
              (err as any).statusCode = 400;
              throw err;
            }

            await tx.paxPack.update({
              where: { paxSerial: currentDef.paxSerial },
              data: { status: "PAX_ASSEMBLED" }
            });
          }
        }

        await tx.auditLog.create({
          data: {
            entityType: "defect",
            entityId: id,
            actorId: actor.id,
            action: "DEFECT_RESOLVED",
            prevStatus: previousStatus,
            newStatus: "RESOLVED"
          }
        });

        return doc;
      });

      return updated;
    } catch (err: any) {
      const code = err.statusCode || 400;
      return reply.status(code).send({ error: err.message || "Defect resolution failed" });
    }
  });

  // GET /crm/quality/finished-goods
  fastify.get("/finished-goods", readPreHandler, async (request, reply) => {
    const { search, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {
      status: "READY_FOR_SALE"
    };

    if (search) {
      where.paxSerial = { contains: search, mode: "insensitive" };
    }

    const [packs, total] = await Promise.all([
      prisma.paxPack.findMany({
        where,
        orderBy: { assembledAt: "desc" },
        skip,
        take,
        include: {
          paxType: true,
          workOrder: { select: { workOrderNumber: true } }
        }
      }),
      prisma.paxPack.count({ where })
    ]);

    return { packs, total, page: parseInt(page, 10), limit: take };
  });
}
