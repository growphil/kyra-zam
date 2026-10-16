import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";
import { 
  ProductionRequirementCreateSchema,
  ProductionPlanCreateSchema,
  WorkOrderCreateSchema,
  WorkOrderScheduleSchema
} from "../schemas/zod.schemas";

// Notification helper
async function triggerProductionNotification(targetUserId: string | null, targetRole: string | null, message: string) {
  const channels = ["IN_APP", "EMAIL"];
  for (const channel of channels) {
    try {
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          role: targetRole as any,
          message,
          channel,
          status: "SENT"
        }
      });
    } catch (err) {
      console.error("Failed to save notification:", err);
    }
  }
  try {
    if (targetRole) {
      await wsManager.broadcastToRoles([targetRole as any], "notification", { message });
    } else if (targetUserId) {
      await wsManager.sendToUser(targetUserId, "notification", { message });
    }
    // Also trigger production real-time refresh
    wsManager.broadcastProduction("production:update", { message, targetRole, targetUserId });
  } catch (e) {
    console.warn("WebSocket notification broadcast failed:", e);
  }
}

// Sequence generators
async function generateRequirementNumber() {
  const last = await prisma.productionRequirement.findFirst({ orderBy: { requirementNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.requirementNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `PRD-${String(next).padStart(6, '0')}`;
}

async function generatePlanNumber() {
  const last = await prisma.productionPlan.findFirst({ orderBy: { planNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.planNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `PLAN-${String(next).padStart(6, '0')}`;
}

async function generateWorkOrderNumber() {
  const last = await prisma.workOrder.findFirst({ orderBy: { workOrderNumber: 'desc' } });
  let next = 1;
  if (last) {
    const match = last.workOrderNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `WO-${String(next).padStart(6, '0')}`;
}

export async function productionRoutes(fastify: FastifyInstance) {
  const productionPreHandler = { preHandler: [requireRoles("SUPERVISOR", "INVENTORY_MANAGER", "PURCHASE_MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "ADMIN", "SUPERADMIN")] };

  // GET /crm/production/dashboard (Live Material Monitoring & Support Hub)
  fastify.get("/dashboard", productionPreHandler, async (request, reply) => {
    const [
      pendingReqs,
      shortageReqs,
      readyReqs,
      activeWorkOrdersCount,
      completedWorkOrders,
      activeWorkOrders,
      unallocatedWorkOrders,
      readyWorkOrders
    ] = await Promise.all([
      prisma.productionRequirement.count({ where: { status: "PENDING" } }),
      prisma.productionRequirement.count({ where: { status: "MATERIAL_SHORTAGE" } }),
      prisma.productionRequirement.count({ where: { status: "READY" } }),
      prisma.workOrder.count({ where: { status: "IN_PROGRESS" } }),
      prisma.workOrder.count({ where: { status: "COMPLETED" } }),
      // Active Live Runs (IN_PROGRESS or ON_HOLD)
      prisma.workOrder.findMany({
        where: { status: { in: ["IN_PROGRESS", "ON_HOLD"] } },
        include: {
          execution: true,
          productionPlan: { select: { planNumber: true, priority: true } },
          productionRequirement: { select: { requirementNumber: true, priority: true } },
          salesOrder: { select: { salesOrderNumber: true, priority: true, customer: { select: { name: true } } } },
          bom: {
            include: {
              items: {
                include: { material: true }
              }
            }
          },
          operators: {
            include: {
              user: { select: { id: true, name: true, email: true } }
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      }),
      // Unallocated Work Orders awaiting material reservation
      prisma.workOrder.findMany({
        where: { status: { in: ["CREATED", "ASSIGNED"] } },
        include: {
          bom: { include: { items: { include: { material: true } } } },
          salesOrder: { select: { salesOrderNumber: true, customer: { select: { name: true } } } },
          productionPlan: { select: { planNumber: true, priority: true } },
          scheduling: true
        },
        orderBy: { createdAt: "desc" },
        take: 20
      }),
      // Ready Work Orders awaiting start
      prisma.workOrder.findMany({
        where: { status: "READY" },
        include: {
          bom: { include: { items: { include: { material: true } } } },
          salesOrder: { select: { salesOrderNumber: true, customer: { select: { name: true } } } },
          scheduling: true
        },
        orderBy: { updatedAt: "desc" },
        take: 10
      })
    ]);

    // Process BOM material availability & reservation status for active live runs
    const liveRuns = await Promise.all(
      activeWorkOrders.map(async (wo) => {
        const bomItems = wo.bom?.items || [];
        const materialBreakdown = await Promise.all(
          bomItems.map(async (item) => {
            const neededQty = item.quantity * wo.plannedQuantity;
            const physicalStock = item.material.quantity;

            // Fetch active reservations
            const activeRes = await prisma.inventoryReservation.findMany({
              where: { materialId: item.materialId, status: "RESERVED" }
            });
            const totalReserved = activeRes.reduce((acc, r) => acc + r.quantity, 0);
            const availableStock = Math.max(0, physicalStock - totalReserved);
            const shortage = Math.max(0, neededQty - availableStock);

            // Check if this work order has an active reservation
            const woReservation = activeRes.filter(r => r.salesOrderId === wo.salesOrderId);
            const allocatedToOrder = woReservation.reduce((acc, r) => acc + r.quantity, 0);

            return {
              materialId: item.materialId,
              sku: item.material.sku,
              name: item.material.name,
              unit: item.material.unit,
              neededQty,
              allocatedToOrder,
              physicalStock,
              totalReserved,
              availableStock,
              shortage,
              isAllocated: allocatedToOrder >= neededQty || wo.status === "IN_PROGRESS" || wo.status === "ON_HOLD",
              isShortage: shortage > 0 && allocatedToOrder < neededQty
            };
          })
        );

        const hasActiveShortage = materialBreakdown.some(m => m.isShortage);

        return {
          id: wo.id,
          workOrderNumber: wo.workOrderNumber,
          status: wo.status,
          productRef: wo.productRef,
          plannedQuantity: wo.plannedQuantity,
          completedQuantity: wo.completedQuantity,
          remainingQuantity: wo.remainingQuantity,
          dueDate: wo.dueDate,
          salesOrder: wo.salesOrder,
          productionPlan: wo.productionPlan,
          execution: wo.execution,
          operators: wo.operators,
          bomName: wo.bom?.name || "Standard BOM",
          materials: materialBreakdown,
          hasActiveShortage,
          isPausedForMaterial: wo.status === "ON_HOLD" && (wo.execution?.pauseReason?.toLowerCase().includes("material") || wo.execution?.pauseReason?.toLowerCase().includes("shortage") || hasActiveShortage)
        };
      })
    );

    // Aggregate material shortage alerts
    const shortageAlerts: any[] = [];
    for (const run of liveRuns) {
      if (run.isPausedForMaterial || run.hasActiveShortage) {
        shortageAlerts.push({
          type: "LIVE_RUN_SHORTAGE",
          workOrderId: run.id,
          workOrderNumber: run.workOrderNumber,
          status: run.status,
          pauseReason: run.execution?.pauseReason,
          affectedMaterials: run.materials.filter(m => m.isShortage)
        });
      }
    }

    return {
      stats: {
        pendingReqs,
        shortageReqs,
        readyReqs,
        activeWorkOrders: activeWorkOrdersCount,
        completedWorkOrders,
        unallocatedCount: unallocatedWorkOrders.length,
        liveRunsCount: liveRuns.length,
        readyCount: readyWorkOrders.length,
        activeShortageAlertsCount: shortageAlerts.length
      },
      liveRuns,
      unallocatedWorkOrders: unallocatedWorkOrders.map(wo => ({
        id: wo.id,
        workOrderNumber: wo.workOrderNumber,
        status: wo.status,
        productRef: wo.productRef,
        plannedQuantity: wo.plannedQuantity,
        dueDate: wo.dueDate,
        salesOrder: wo.salesOrder,
        productionPlan: wo.productionPlan,
        scheduling: wo.scheduling,
        bom: wo.bom ? { id: wo.bom.id, name: wo.bom.name, itemCount: wo.bom.items.length } : null
      })),
      readyWorkOrders: readyWorkOrders.map(wo => ({
        id: wo.id,
        workOrderNumber: wo.workOrderNumber,
        status: wo.status,
        productRef: wo.productRef,
        plannedQuantity: wo.plannedQuantity,
        dueDate: wo.dueDate,
        salesOrder: wo.salesOrder,
        scheduling: wo.scheduling
      })),
      shortageAlerts
    };
  });

  // GET /crm/production/operations/dashboard
  fastify.get("/operations/dashboard", {
    preHandler: [requireRoles("SUPERVISOR", "PAX_TEST_ENGINEER", "ADMIN", "SUPERADMIN")]
  }, async (request, reply) => {
    const { date } = request.query as { date?: string };
    const queryDate = date ? date : new Date().toISOString().split("T")[0];
    const targetDate = new Date(queryDate + "T00:00:00.000Z");
    const user = request.user as { id: string; roles?: string[] };
    const isAssemblyTech = user.roles?.includes("ASSEMBLY_TECHNICIAN") && !user.roles?.includes("SUPERVISOR") && !user.roles?.includes("ADMIN") && !user.roles?.includes("SUPERADMIN");

    // Fetch schedules on targetDate
    const schedules = await prisma.workOrderScheduling.findMany({
      where: { assignedDate: targetDate },
      include: {
        workOrder: {
          include: {
            execution: true,
            productionPlan: { select: { planNumber: true, priority: true } },
            productionRequirement: { select: { requirementNumber: true, priority: true } },
            salesOrder: { select: { salesOrderNumber: true, priority: true, customer: { select: { name: true } } } },
            cellTestingRequirements: true,
            bom: {
              include: {
                items: {
                  include: { material: true }
                }
              }
            },
            operators: {
              include: {
                user: { select: { id: true, name: true, email: true } }
              }
            },
            inspections: {
              orderBy: { createdAt: "desc" }
            }
          }
        }
      },
      orderBy: { sequence: "asc" }
    });

    // Calculate metrics
    let scheduled = schedules.length;
    let ready = 0;
    let inProgress = 0;
    let paused = 0;
    let qcPending = 0;
    let completed = 0;

    let myScheduled = 0;
    let myReady = 0;
    let myInProgress = 0;
    let myPaused = 0;
    let myQcPending = 0;
    let myCompleted = 0;

    for (const s of schedules) {
      if (!s.workOrder) continue;
      const wo = s.workOrder;
      const status = wo.status;
      const isAssignedToUser = wo.operators?.some(op => op.userId === user.id && op.status === "ACTIVE");

      if (status === "READY") {
        ready++;
        if (isAssignedToUser) myReady++;
      } else if (status === "IN_PROGRESS" && wo.execution?.startedAt && !wo.execution?.completedAt) {
        inProgress++;
        if (isAssignedToUser) myInProgress++;
      } else if (status === "ON_HOLD") {
        paused++;
        if (isAssignedToUser) myPaused++;
      } else if (status === "QC_PENDING") {
        qcPending++;
        if (isAssignedToUser) myQcPending++;
      } else if (status === "COMPLETED" || status === "CLOSED") {
        completed++;
        if (isAssignedToUser) myCompleted++;
      }

      if (isAssignedToUser) {
        myScheduled++;
      }
    }

    // Overdue count: Work orders not completed/closed/cancelled and dueDate < now
    const overdueCount = await prisma.workOrder.count({
      where: {
        status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
        dueDate: { lt: new Date() }
      }
    });

    const myOverdueCount = await prisma.workOrder.count({
      where: {
        status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
        dueDate: { lt: new Date() },
        operators: {
          some: { userId: user.id, status: "ACTIVE" }
        }
      }
    });

    // Stale/Integrity anomaly checks
    const dataIntegrityWarnings: any[] = [];
    for (const s of schedules) {
      if (s.workOrder?.status === "IN_PROGRESS" && (!s.workOrder.execution || !s.workOrder.execution.startedAt)) {
        dataIntegrityWarnings.push({
          workOrderId: s.workOrder.id,
          workOrderNumber: s.workOrder.workOrderNumber,
          message: "Work Order is marked IN_PROGRESS but no valid execution start record exists."
        });
      }
    }

    // Authoritative Current Production Run detection:
    // MUST have status = IN_PROGRESS AND a valid execution record with startedAt != null and completedAt == null
    let currentRunWo: any = null;
    let currentRunSched: any = null;

    // 1. Try to find active run on targetDate
    const candidateSched = schedules.find(s => 
      s.workOrder?.status === "IN_PROGRESS" && 
      s.workOrder.execution?.startedAt && 
      !s.workOrder.execution?.completedAt
    );

    if (candidateSched) {
      currentRunWo = candidateSched.workOrder;
      currentRunSched = candidateSched;
    } else {
      // 2. Try to find globally active run
      const globalActive = await prisma.workOrder.findFirst({
        where: { 
          status: "IN_PROGRESS",
          execution: {
            startedAt: { not: null },
            completedAt: null
          }
        },
        include: {
          execution: true,
          scheduling: true,
          productionPlan: { select: { priority: true } },
          productionRequirement: { select: { priority: true } },
          salesOrder: { select: { priority: true } },
          operators: {
            include: {
              user: { select: { id: true, name: true } }
            }
          },
          inspections: {
            orderBy: { createdAt: "desc" }
          }
        }
      });
      if (globalActive) {
        currentRunWo = globalActive;
        currentRunSched = globalActive.scheduling as any;
      }
    }

    // Fetch active station for the current user
    const userActiveStationAssignment = await prisma.stationOperatorAssignment.findFirst({
      where: { operatorId: user.id, releasedAt: null },
      include: { station: true }
    });

    let currentRun = null;
    if (currentRunWo && currentRunWo.execution?.startedAt && !currentRunWo.execution?.completedAt) {
      const estHrs = currentRunSched?.estimatedHrs || 0;
      const now = new Date();
      const exec = currentRunWo.execution;
      const lastActive = exec.resumedAt || exec.startedAt || now;
      const currentSessionMs = currentRunWo.status === "IN_PROGRESS" ? Math.max(0, now.getTime() - new Date(lastActive).getTime()) : 0;
      const actHrs = (exec.actualHours || 0) + (currentSessionMs / (1000 * 60 * 60));
      const variance = actHrs - estHrs;

      let progressState = "ON TRACK";
      if (variance > 1.0) {
        progressState = "OVERDUE";
      } else if (variance > 0) {
        progressState = "AT RISK";
      }

      currentRun = {
        id: currentRunWo.id,
        workOrderId: currentRunWo.id,
        workOrderNumber: currentRunWo.workOrderNumber,
        productRef: currentRunWo.productRef,
        sequence: currentRunSched?.sequence || 0,
        plannedQuantity: currentRunWo.plannedQuantity,
        startedAt: currentRunWo.execution.startedAt,
        resumedAt: currentRunWo.execution.resumedAt || null,
        pausedAt: currentRunWo.execution.pausedAt || null,
        pauseReason: currentRunWo.execution.pauseReason || null,
        actualHours: actHrs,
        estimatedHours: estHrs,
        progressState,
        varianceHours: variance,
        stationName: userActiveStationAssignment?.station?.name || null,
        stationCode: userActiveStationAssignment?.station?.code || null,
        technicians: currentRunWo.operators?.map((o: any) => o.user?.name || "Technician") || [],
        cellTestingRequirements: currentRunWo.cellTestingRequirements || []
      };
    }

    // Build today's queue
    const queue = schedules.map(s => {
      const wo = s.workOrder;
      if (!wo) return null;

      const actHrs = wo.execution?.actualHours || 0;
      const estHrs = s.estimatedHrs;
      const isOverdue = wo.status !== "COMPLETED" && wo.status !== "CLOSED" && wo.status !== "CANCELLED" && wo.dueDate < new Date();
      const latestInspection = wo.inspections[0];
      const qcStatus = latestInspection ? latestInspection.result : (wo.status === "QC_PENDING" ? "PENDING" : "NONE");
      const priority = wo.productionPlan?.priority || wo.productionRequirement?.priority || wo.salesOrder?.priority || "NORMAL";
      const isAssignedToUser = wo.operators?.some(op => op.userId === user.id && op.status === "ACTIVE");

      return {
        id: wo.id,
        sequence: s.sequence,
        workOrderNumber: wo.workOrderNumber,
        productRef: wo.productRef,
        plannedQuantity: wo.plannedQuantity,
        priority,
        status: wo.status,
        estimatedHours: estHrs,
        actualHours: actHrs,
        assignedDate: s.assignedDate,
        startedAt: wo.execution?.startedAt || null,
        pausedAt: wo.execution?.pausedAt || null,
        completedAt: wo.execution?.completedAt || null,
        pauseReason: wo.execution?.pauseReason || null,
        isOverdue,
        qcStatus,
        isAssignedToUser,
        operators: wo.operators?.map(o => ({ id: o.user.id, name: o.user.name })),
        bom: wo.bom,
        cellTestingRequirements: wo.cellTestingRequirements || []
      };
    }).filter(Boolean);

    // Bottlenecks detection
    const bottlenecks: any[] = [];

    // 1. WorkOrder waiting for material allocation
    const unallocatedToday = schedules.filter(s => s.workOrder && ["CREATED", "ASSIGNED"].includes(s.workOrder.status));
    for (const s of unallocatedToday) {
      bottlenecks.push({
        workOrderId: s.workOrder!.id,
        workOrderNumber: s.workOrder!.workOrderNumber,
        type: "MATERIAL_ALLOCATION_PENDING",
        description: `Work order ${s.workOrder!.workOrderNumber} is scheduled but waiting for material allocation.`,
        severity: "HIGH"
      });
    }

    // 2. WorkOrder READY but not started after its planned sequence
    const maxActiveSeq = schedules
      .filter(s => s.workOrder && ["IN_PROGRESS", "QC_PENDING", "COMPLETED", "CLOSED"].includes(s.workOrder.status))
      .reduce((max, s) => Math.max(max, s.sequence), 0);

    const delayedReady = schedules.filter(s => s.workOrder?.status === "READY" && s.sequence < maxActiveSeq);
    for (const s of delayedReady) {
      bottlenecks.push({
        workOrderId: s.workOrder!.id,
        workOrderNumber: s.workOrder!.workOrderNumber,
        type: "SEQUENCE_DELAY",
        description: `Work order ${s.workOrder!.workOrderNumber} is READY but was bypassed by a later sequence.`,
        severity: "MEDIUM"
      });
    }

    // 3. WorkOrder ON_HOLD
    const pausedOrders = schedules.filter(s => s.workOrder?.status === "ON_HOLD");
    for (const s of pausedOrders) {
      bottlenecks.push({
        workOrderId: s.workOrder!.id,
        workOrderNumber: s.workOrder!.workOrderNumber,
        type: "PRODUCTION_PAUSED",
        description: `Work order ${s.workOrder!.workOrderNumber} is paused: ${s.workOrder!.execution?.pauseReason || "No reason given"}.`,
        severity: "CRITICAL"
      });
    }

    // 4. WorkOrder QC_PENDING
    const pendingQc = schedules.filter(s => s.workOrder?.status === "QC_PENDING");
    for (const s of pendingQc) {
      bottlenecks.push({
        workOrderId: s.workOrder!.id,
        workOrderNumber: s.workOrder!.workOrderNumber,
        type: "QC_PENDING",
        description: `Work order ${s.workOrder!.workOrderNumber} is waiting for QC inspection.`,
        severity: "MEDIUM"
      });
    }

    // 5. WorkOrder exceeding estimated hours
    for (const s of schedules) {
      if (!s.workOrder?.execution) continue;
      const act = s.workOrder.execution.actualHours || 0;
      const est = s.estimatedHrs;
      if (act > est) {
        bottlenecks.push({
          workOrderId: s.workOrder.id,
          workOrderNumber: s.workOrder.workOrderNumber,
          type: "ESTIMATE_EXCEEDED",
          description: `Work order ${s.workOrder.workOrderNumber} has exceeded estimated hours by ${(act - est).toFixed(1)} hrs.`,
          severity: "HIGH"
        });
      }
    }

    // 6. Past schedules that remain incomplete
    const pastSchedules = await prisma.workOrderScheduling.findMany({
      where: {
        assignedDate: { lt: targetDate },
        workOrder: {
          status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] }
        }
      },
      include: { workOrder: true }
    });
    for (const ps of pastSchedules) {
      if (!ps.workOrder) continue;
      bottlenecks.push({
        workOrderId: ps.workOrder.id,
        workOrderNumber: ps.workOrder.workOrderNumber,
        type: "OVERDUE_SCHEDULE",
        description: `Work order ${ps.workOrder.workOrderNumber} was scheduled on ${ps.assignedDate.toISOString().split("T")[0]} but remains unfinished.`,
        severity: "CRITICAL"
      });
    }

    // Performance Calculations:
    const perfOrders = schedules.filter(s => s.workOrder && ["QC_PENDING", "COMPLETED", "CLOSED"].includes(s.workOrder.status));
    let plannedHours = 0;
    let actualHours = 0;
    let completedCount = 0;

    for (const s of perfOrders) {
      plannedHours += s.estimatedHrs;
      actualHours += s.workOrder!.execution?.actualHours || 0;
      if (["COMPLETED", "CLOSED"].includes(s.workOrder!.status)) {
        completedCount++;
      }
    }

    const varianceHours = actualHours - plannedHours;
    const averageActualHours = perfOrders.length > 0 ? (actualHours / perfOrders.length) : 0;
    const averageVarianceHours = perfOrders.length > 0 ? (varianceHours / perfOrders.length) : 0;

    const performance = {
      plannedHours,
      actualHours,
      varianceHours,
      completedCount,
      averageActualHours,
      averageVarianceHours
    };

    // Fetch active station assignments and stations for live shopfloor tracking
    const activeAssignments = await prisma.stationOperatorAssignment.findMany({
      where: { releasedAt: null },
      include: {
        station: true,
        operator: { select: { id: true, name: true, email: true } }
      }
    });

    const stations = await prisma.productionStation.findMany({
      include: {
        assignments: {
          where: { releasedAt: null },
          include: { operator: { select: { id: true, name: true } } }
        }
      }
    });

    return {
      date: queryDate,
      summary: {
        scheduled,
        ready,
        inProgress,
        paused,
        qcPending,
        completed,
        overdue: overdueCount,
        myScheduled: myScheduled || scheduled,
        myReady: myReady || ready,
        myInProgress: myInProgress || inProgress,
        myPaused: myPaused || paused,
        myQcPending: myQcPending || qcPending,
        myCompleted: myCompleted || completed,
        myOverdue: myOverdueCount
      },
      currentRun,
      dataIntegrityWarnings,
      queue,
      bottlenecks,
      performance,
      activeAssignments,
      stations,
      currentStation: userActiveStationAssignment?.station || null
    };
  });

  // --- PRODUCTION REQUIREMENT ENDPOINTS ---

  // GET /crm/production/requirements
  fastify.get("/requirements", productionPreHandler, async (request, reply) => {
    const { search, status, priority, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (search) {
      where.OR = [
        { requirementNumber: { contains: search, mode: "insensitive" } },
        { productRef: { contains: search, mode: "insensitive" } }
      ];
    }
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [requirements, total] = await Promise.all([
      prisma.productionRequirement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          salesOrder: { select: { id: true, salesOrderNumber: true } },
          salesOrderItem: { select: { id: true, description: true, productRef: true } },
          createdBy: { select: { id: true, name: true } },
          plans: { select: { id: true, planNumber: true, status: true } }
        }
      }),
      prisma.productionRequirement.count({ where })
    ]);

    return { requirements, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/production/requirements/:id
  fastify.get("/requirements/:id", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const req = await prisma.productionRequirement.findUnique({
      where: { id },
      include: {
        customer: true,
        salesOrder: { include: { items: true } },
        salesOrderItem: true,
        createdBy: { select: { name: true, email: true } },
        plans: true,
        workOrders: {
          include: {
            cellTestingRequirements: true
          }
        }
      }
    });
    if (!req) return reply.status(404).send({ error: "Production Requirement not found" });

    // Derive BOM and material availability (separated: normal materials vs cell testing requirements)
    const bom: any = await prisma.bOM.findFirst({
      where: req.productRef ? {
        name: { contains: req.productRef, mode: "insensitive" }
      } : undefined,
      include: { items: { include: { material: true } } }
    }) || await prisma.bOM.findFirst({
      include: { items: { include: { material: true } } }
    });

    // Fetch active Purchase Requests for this requirement to identify requested materials
    const existingPRs = await prisma.purchaseRequest.findMany({
      where: {
        sourceReferenceId: id,
        status: { notIn: ["CANCELLED", "REJECTED"] }
      },
      include: {
        items: true
      }
    });

    let normalMaterials: any[] = [];
    let cellRequirements: any[] = [];
    let hasNormalShortage = false;

    if (bom?.items) {
      for (const item of bom.items) {
        const mat = item.material;
        const isCell = 
          mat?.category?.toUpperCase() === "CELL" || 
          mat?.sku?.toUpperCase().startsWith("CELL") ||
          mat?.name?.toLowerCase().includes("cell");

        const neededQty = item.quantity * req.requiredQuantity;

        if (isCell) {
          const cellSku = mat?.sku || "CELL-RAW";
          
          // Check linked testing requirement progress if WorkOrders exist
          const linkedReqs = req.workOrders.flatMap(wo => wo.cellTestingRequirements || [])
            .filter(r => r.cellSku?.toLowerCase() === cellSku.toLowerCase());
          
          const testedQty = linkedReqs.reduce((acc, r) => acc + (r.testedQuantity || 0), 0);
          const remainingQty = Math.max(0, neededQty - testedQty);

          // Get bulk un-serialized stock from CellInwardBatch
          const inwardBatches = await prisma.cellInwardBatch.findMany({
            where: {
              OR: [
                { partNumber: { equals: cellSku, mode: "insensitive" } },
                { category: { equals: "CELL", mode: "insensitive" } }
              ],
              availableQty: { gt: 0 }
            }
          });
          const bulkInwardAvailable = inwardBatches.reduce((acc, b) => acc + b.availableQty, 0);

          // Get count of free serialized & qualified cells
          const qualifiedInInventory = await prisma.cell.count({
            where: {
              status: "CELL_TESTED",
              paxCell: null,
              OR: [
                { partNumber: { equals: cellSku, mode: "insensitive" } },
                { category: { equals: "CELL", mode: "insensitive" } }
              ]
            }
          });

          cellRequirements.push({
            materialId: item.materialId,
            sku: cellSku,
            name: mat?.name || "Lithium Cell",
            bomQtyPerUnit: item.quantity,
            requiredQuantity: neededQty,
            testedQuantity: testedQty,
            remainingQuantity: remainingQty,
            bulkInwardAvailable,
            qualifiedInInventory,
            status: remainingQty === 0 ? "COMPLETED" : testedQty > 0 ? "IN_PROGRESS" : "TESTING REQUIRED"
          });
        } else {
          const physicalStock = mat?.quantity ?? 0;
          const activeReservations = await prisma.inventoryReservation.findMany({
            where: {
              materialId: item.materialId,
              status: "RESERVED"
            }
          });
          const reservedQty = activeReservations.reduce((acc, x) => acc + x.quantity, 0);
          const availableQty = Math.max(0, physicalStock - reservedQty);
          const shortage = Math.max(0, neededQty - availableQty);

          if (shortage > 0) hasNormalShortage = true;

          const matchingPR = existingPRs.find(pr => pr.items.some(it => it.materialId === item.materialId));

          normalMaterials.push({
            materialId: item.materialId,
            sku: mat?.sku,
            name: mat?.name,
            bomQtyPerUnit: item.quantity,
            required: neededQty,
            physical: physicalStock,
            reserved: reservedQty,
            available: availableQty,
            shortage,
            prRequested: Boolean(matchingPR),
            prNumber: matchingPR?.prNumber || null,
            prStatus: matchingPR?.status || null,
            prId: matchingPR?.id || null,
            status: shortage === 0 ? "AVAILABLE" : availableQty > 0 ? "PARTIALLY_AVAILABLE" : "SHORTAGE"
          });
        }
      }
    }

    return {
      ...req,
      materialsAnalysis: {
        normalMaterials,
        cellRequirements,
        normalMaterialStatus: hasNormalShortage ? "MATERIAL_SHORTAGE" : "READY",
        cellTestingStatus: cellRequirements.length === 0 ? "N/A" : 
          cellRequirements.every(c => c.status === "COMPLETED") ? "COMPLETED" :
          cellRequirements.some(c => c.status === "IN_PROGRESS") ? "IN_PROGRESS" : "TESTING REQUIRED"
      }
    };
  });

  const spawnRequirementPreHandler = { preHandler: [requireRoles("ACCOUNTANT", "ADMIN", "SUPERADMIN", "SALES_EXECUTIVE")] };

  // POST /crm/production/requirements (Create from Sales Order Item - strictly Accountant, Admin, Super Admin, Sales Executive)
  fastify.post("/requirements", spawnRequirementPreHandler, async (request, reply) => {
    const data = ProductionRequirementCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const existing = await prisma.productionRequirement.findFirst({
      where: {
        salesOrderItemId: data.salesOrderItemId,
        status: { not: "CANCELLED" }
      }
    });

    if (existing) {
      return reply.status(400).send({ error: "A Production Requirement already exists for this Sales Order item." });
    }

    // Ensure Sales Order is financially cleared before production can be spawned
    if (data.salesOrderId) {
      const order = await prisma.salesOrder.findUnique({
        where: { id: data.salesOrderId }
      });
      if (!order) {
        return reply.status(404).send({ error: "Linked Sales Order not found." });
      }
      if (!order.isFinancialCleared) {
        return reply.status(400).send({ error: "Cannot spawn production requirement. This Sales Order has not been financially cleared." });
      }
    }

    const requirementNumber = await generateRequirementNumber();

    const prd = await prisma.$transaction(async (tx) => {
      const doc = await tx.productionRequirement.create({
        data: {
          requirementNumber,
          salesOrderId: data.salesOrderId,
          salesOrderItemId: data.salesOrderItemId,
          customerId: data.customerId,
          productRef: data.productRef,
          requiredQuantity: data.requiredQuantity,
          requiredDeliveryDate: new Date(data.requiredDeliveryDate),
          priority: data.priority,
          fulfillmentType: "PRODUCTION_REQUIRED",
          status: "PENDING",
          createdById: actor.id,
          notes: data.notes
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "production-requirement",
          entityId: doc.id,
          actorId: actor.id,
          action: "REQUIREMENT_CREATED",
          newStatus: "PENDING",
          metadata: { requirementNumber }
        }
      });

      return doc;
    });

    return prd;
  });

  // POST /crm/production/requirements/:id/check-materials (BOM Match & Shortage Check - Normal Materials Separated from Cells)
  fastify.post("/requirements/:id/check-materials", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const req = await prisma.productionRequirement.findUnique({
      where: { id },
      include: {
        salesOrderItem: true,
        workOrders: {
          include: {
            cellTestingRequirements: true
          }
        }
      }
    });

    if (!req) return reply.status(404).send({ error: "Requirement not found" });

    // Try finding BOM for this item
    const bom: any = await prisma.bOM.findFirst({
      where: req.productRef ? {
        name: { contains: req.productRef, mode: "insensitive" }
      } : undefined,
      include: { items: { include: { material: true } } }
    }) || await prisma.bOM.findFirst({
      include: { items: { include: { material: true } } }
    });

    if (!bom) {
      return reply.status(400).send({ error: "No BOM specifications configured in the system" });
    }

    // Fetch active Purchase Requests for this requirement to identify requested materials
    const existingPRs = await prisma.purchaseRequest.findMany({
      where: {
        sourceReferenceId: id,
        status: { notIn: ["CANCELLED", "REJECTED"] }
      },
      include: {
        items: true
      }
    });

    const normalMaterials = [];
    const cellRequirements = [];
    let hasNormalShortage = false;

    for (const item of bom.items) {
      const mat = item.material;
      const isCell = 
        mat?.category?.toUpperCase() === "CELL" || 
        mat?.sku?.toUpperCase().startsWith("CELL") ||
        mat?.name?.toLowerCase().includes("cell");

      const neededQty = item.quantity * req.requiredQuantity;

      if (isCell) {
        const cellSku = mat?.sku || "CELL-RAW";
        
        // Count tested cells linked to this requirement's WorkOrders
        const linkedReqs = req.workOrders.flatMap(wo => wo.cellTestingRequirements || [])
          .filter(r => r.cellSku?.toLowerCase() === cellSku.toLowerCase());
        
        const testedQty = linkedReqs.reduce((acc, r) => acc + (r.testedQuantity || 0), 0);
        const remainingQty = Math.max(0, neededQty - testedQty);

        // Bulk un-serialized stock from CellInwardBatch
        const inwardBatches = await prisma.cellInwardBatch.findMany({
          where: {
            OR: [
              { partNumber: { equals: cellSku, mode: "insensitive" } },
              { category: { equals: "CELL", mode: "insensitive" } }
            ],
            availableQty: { gt: 0 }
          }
        });
        const bulkInwardAvailable = inwardBatches.reduce((acc, b) => acc + b.availableQty, 0);

        // Count of free serialized & qualified cells
        const qualifiedInInventory = await prisma.cell.count({
          where: {
            status: "CELL_TESTED",
            paxCell: null,
            OR: [
              { partNumber: { equals: cellSku, mode: "insensitive" } },
              { category: { equals: "CELL", mode: "insensitive" } }
            ]
          }
        });

        cellRequirements.push({
          materialId: item.materialId,
          sku: cellSku,
          name: mat?.name || "Lithium Cell",
          bomQtyPerUnit: item.quantity,
          requiredQuantity: neededQty,
          testedQuantity: testedQty,
          remainingQuantity: remainingQty,
          bulkInwardAvailable,
          qualifiedInInventory,
          status: remainingQty === 0 ? "COMPLETED" : testedQty > 0 ? "IN_PROGRESS" : "TESTING REQUIRED"
        });
      } else {
        const physicalStock = mat?.quantity ?? 0;

        // Calculate reserved stock
        const activeReservations = await prisma.inventoryReservation.findMany({
          where: {
            materialId: item.materialId,
            status: "RESERVED"
          }
        });
        const reservedQty = activeReservations.reduce((acc, x) => acc + x.quantity, 0);
        const availableQty = Math.max(0, physicalStock - reservedQty);
        const shortage = Math.max(0, neededQty - availableQty);

        if (shortage > 0) hasNormalShortage = true;

        const matchingPR = existingPRs.find(pr => pr.items.some(it => it.materialId === item.materialId));

        normalMaterials.push({
          materialId: item.materialId,
          sku: mat?.sku,
          name: mat?.name,
          bomQtyPerUnit: item.quantity,
          required: neededQty,
          physical: physicalStock,
          reserved: reservedQty,
          available: availableQty,
          shortage,
          prRequested: Boolean(matchingPR),
          prNumber: matchingPR?.prNumber || null,
          prStatus: matchingPR?.status || null,
          prId: matchingPR?.id || null,
          status: shortage === 0 ? "AVAILABLE" : availableQty > 0 ? "PARTIALLY_AVAILABLE" : "SHORTAGE"
        });
      }
    }

    const nextStatus = hasNormalShortage ? "MATERIAL_SHORTAGE" : "READY";

    await prisma.productionRequirement.update({
      where: { id },
      data: { status: nextStatus }
    });

    return {
      status: nextStatus,
      normalMaterialStatus: nextStatus,
      materials: normalMaterials,
      cellRequirements,
      cellTestingStatus: cellRequirements.length === 0 ? "N/A" : 
        cellRequirements.every(c => c.status === "COMPLETED") ? "COMPLETED" :
        cellRequirements.some(c => c.status === "IN_PROGRESS") ? "IN_PROGRESS" : "TESTING REQUIRED"
    };
  });

  // POST /crm/production/requirements/:id/spawn-purchase-request
  fastify.post("/requirements/:id/spawn-purchase-request", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { materialId, shortageQty } = request.body as { materialId: string; shortageQty: number };
    const actor = request.user as { id: string };

    const req = await prisma.productionRequirement.findUnique({ where: { id } });
    if (!req) return reply.status(404).send({ error: "Requirement not found" });

    // Ensure we do not create duplicate Purchase Requests for this same requirement
    const duplicate = await prisma.purchaseRequest.findFirst({
      where: {
        sourceReferenceId: id,
        items: { some: { materialId } },
        status: { notIn: ["CANCELLED", "REJECTED"] }
      }
    });

    if (duplicate) {
      return reply.status(400).send({ error: `A Purchase Request already exists for this requirement/material. See ${duplicate.prNumber}` });
    }

    // Sequence PR
    const prNumber = await prisma.$queryRawUnsafe<any[]>(`SELECT count(*) FROM "PurchaseRequest"`);
    const count = parseInt(prNumber[0].count, 10) + 1;
    const prCode = `PR-PROD-${String(count).padStart(6, '0')}`;

    const pr = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.create({
        data: {
          prNumber: prCode,
          requestedById: actor.id,
          source: "PRODUCTION_REQUIREMENT",
          sourceReferenceId: id,
          priority: req.priority as any,
          requiredDate: req.requiredDeliveryDate,
          reason: `Production shortfall backup for ${req.requirementNumber}`,
          status: "DRAFT"
        }
      });

      await tx.purchaseRequestItem.create({
        data: {
          purchaseRequestId: doc.id,
          materialId,
          requestedQuantity: shortageQty,
          requiredDate: req.requiredDeliveryDate
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "production-requirement",
          entityId: id,
          actorId: actor.id,
          action: "SHORTAGE_PR_SPAWNED",
          metadata: { prNumber: prCode, materialId }
        }
      });

      return doc;
    });

    return pr;
  });


  // --- PRODUCTION PLANS ---

  // GET /crm/production/plans
  fastify.get("/plans", productionPreHandler, async (request, reply) => {
    const { status, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (status) where.status = status;

    const [plans, total] = await Promise.all([
      prisma.productionPlan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          productionRequirement: true,
          supervisor: { select: { name: true } },
          createdBy: { select: { name: true } }
        }
      }),
      prisma.productionPlan.count({ where })
    ]);

    return { plans, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/production/plans/:id
  fastify.get("/plans/:id", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await prisma.productionPlan.findUnique({
      where: { id },
      include: {
        productionRequirement: { include: { customer: true } },
        supervisor: { select: { name: true, email: true } },
        createdBy: { select: { name: true } },
        workOrders: {
          include: {
            operators: true,
            bom: { select: { id: true, name: true } },
            supervisor: { select: { id: true, name: true } }
          }
        }
      }
    });
    if (!plan) return reply.status(404).send({ error: "Plan not found" });
    return plan;
  });

  // POST /crm/production/plans (Schedule Once - Idempotent / In-place edit if already exists)
  fastify.post("/plans", productionPreHandler, async (request, reply) => {
    const data = ProductionPlanCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    // Verify that the related Sales Order is financially cleared before planning
    const req = await prisma.productionRequirement.findUnique({
      where: { id: data.productionRequirementId },
      include: { salesOrder: true, plans: true }
    });
    if (!req) {
      return reply.status(404).send({ error: "Production requirement not found" });
    }
    if (req.salesOrder && !req.salesOrder.isFinancialCleared) {
      return reply.status(400).send({ error: "Cannot create production plan. The related Sales Order is not financially cleared." });
    }

    // Check if a plan already exists for this requirement -> UPDATE schedule dates rather than creating duplicate
    const existingPlan = req.plans && req.plans.length > 0 ? req.plans[0] : null;
    if (existingPlan) {
      const updatedPlan = await prisma.$transaction(async (tx) => {
        const doc = await tx.productionPlan.update({
          where: { id: existingPlan.id },
          data: {
            plannedStartDate: new Date(data.plannedStartDate),
            plannedCompletionDate: new Date(data.plannedCompletionDate),
            priority: data.priority,
            plannedQuantity: data.plannedQuantity,
            supervisorId: data.supervisorId,
            notes: data.notes
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "production-plan",
            entityId: doc.id,
            actorId: actor.id,
            action: "PLAN_RESCHEDULED",
            prevStatus: existingPlan.status,
            newStatus: existingPlan.status,
            metadata: { 
              planNumber: existingPlan.planNumber,
              plannedStartDate: data.plannedStartDate,
              plannedCompletionDate: data.plannedCompletionDate,
              plannedQuantity: data.plannedQuantity
            }
          }
        });

        return doc;
      });

      wsManager.broadcastProduction("plan:update", { id: updatedPlan.id, planNumber: updatedPlan.planNumber, action: "rescheduled" });
      wsManager.broadcastProduction("production:update", { requirementId: data.productionRequirementId });
      return updatedPlan;
    }

    const planNumber = await generatePlanNumber();

    const plan = await prisma.$transaction(async (tx) => {
      const doc = await tx.productionPlan.create({
        data: {
          planNumber,
          productionRequirementId: data.productionRequirementId,
          plannedStartDate: new Date(data.plannedStartDate),
          plannedCompletionDate: new Date(data.plannedCompletionDate),
          priority: data.priority,
          plannedQuantity: data.plannedQuantity,
          supervisorId: data.supervisorId,
          notes: data.notes,
          status: "DRAFT",
          createdById: actor.id
        }
      });

      await tx.productionRequirement.update({
        where: { id: data.productionRequirementId },
        data: { status: "PLANNED" }
      });

      await tx.auditLog.create({
        data: {
          entityType: "production-plan",
          entityId: doc.id,
          actorId: actor.id,
          action: "PLAN_CREATED",
          newStatus: "DRAFT",
          metadata: { planNumber }
        }
      });

      return doc;
    });

    wsManager.broadcastProduction("plan:update", { id: plan.id, planNumber: plan.planNumber, action: "created" });
    wsManager.broadcastProduction("production:update", { requirementId: data.productionRequirementId });

    return plan;
  });

  // PATCH /crm/production/plans/:id (Update Schedule Dates / Parameters)
  fastify.patch("/plans/:id", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const actor = request.user as { id: string };

    const plan = await prisma.productionPlan.findUnique({ where: { id } });
    if (!plan) return reply.status(404).send({ error: "Plan not found" });

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.productionPlan.update({
        where: { id },
        data: {
          plannedStartDate: data.plannedStartDate ? new Date(data.plannedStartDate) : undefined,
          plannedCompletionDate: data.plannedCompletionDate ? new Date(data.plannedCompletionDate) : undefined,
          priority: data.priority || undefined,
          plannedQuantity: data.plannedQuantity ? Number(data.plannedQuantity) : undefined,
          supervisorId: data.supervisorId !== undefined ? data.supervisorId : undefined,
          notes: data.notes !== undefined ? data.notes : undefined
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "production-plan",
          entityId: doc.id,
          actorId: actor.id,
          action: "PLAN_SCHEDULE_UPDATED",
          prevStatus: plan.status,
          newStatus: doc.status,
          metadata: {
            planNumber: plan.planNumber,
            changes: data
          }
        }
      });

      return doc;
    });

    wsManager.broadcastProduction("plan:update", { id: updated.id, planNumber: updated.planNumber, action: "updated" });
    wsManager.broadcastProduction("production:update", { requirementId: plan.productionRequirementId });

    return updated;
  });

  // PUT /crm/production/plans/:id/status
  fastify.put("/plans/:id/status", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: any };
    const actor = request.user as { id: string };

    const plan = await prisma.productionPlan.findUnique({ where: { id } });
    if (!plan) return reply.status(404).send({ error: "Plan not found" });

    // Idempotency: if status is same, return immediately without duplicate audit logs or db operations
    if (plan.status === status) {
      return plan;
    }

    // Transition checks
    const from = plan.status;
    const to = status;
    let valid = false;
    if (from === "DRAFT" && ["PLANNED", "CANCELLED"].includes(to)) valid = true;
    if (from === "PLANNED" && ["RELEASED", "ON_HOLD", "CANCELLED"].includes(to)) valid = true;
    if (from === "RELEASED" && ["IN_PROGRESS", "ON_HOLD"].includes(to)) valid = true;
    if (from === "IN_PROGRESS" && ["COMPLETED", "ON_HOLD"].includes(to)) valid = true;

    if (!valid) {
      return reply.status(400).send({ error: `Invalid Production Plan status change from ${from} to ${to}` });
    }

    // BOM lookup & productRef resolution upon plan release
    if (status === "RELEASED") {
      const planWithReq = await prisma.productionPlan.findUnique({
        where: { id },
        include: { 
          productionRequirement: {
            include: { salesOrderItem: true }
          }
        }
      });
      if (!planWithReq) return reply.status(404).send({ error: "Plan details not found" });
      
      const req = planWithReq.productionRequirement;
      const productRef = req?.productRef || 
                         req?.salesOrderItem?.description || 
                         req?.salesOrderItem?.productRef || 
                         "Standard Assembly Product";

      // If requirement had empty productRef, persist the resolved reference
      if (req && !req.productRef) {
        await prisma.productionRequirement.update({
          where: { id: req.id },
          data: { productRef }
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.productionPlan.update({
        where: { id },
        data: { status }
      });

      await tx.auditLog.create({
        data: {
          entityType: "production-plan",
          entityId: id,
          actorId: actor.id,
          action: "PLAN_STATUS_CHANGED",
          prevStatus: from,
          newStatus: to
        }
      });

      // Synchronize related Sales Order to IN_FULFILLMENT upon plan release
      if (status === "RELEASED") {
        const planWithReq = await tx.productionPlan.findUnique({
          where: { id },
          include: {
            productionRequirement: {
              include: {
                salesOrder: true
              }
            }
          }
        });

        const salesOrder = planWithReq?.productionRequirement?.salesOrder;
        if (salesOrder) {
          const currentSOStatus = salesOrder.status;
          // Validate that the transition makes sense (only move from active initial states, not already fulfilled/cancelled)
          if (["CONFIRMED", "READY_FOR_FULFILLMENT", "PAYMENT_PENDING"].includes(currentSOStatus)) {
            await tx.salesOrder.update({
              where: { id: salesOrder.id },
              data: { status: "IN_FULFILLMENT" }
            });

            await tx.auditLog.create({
              data: {
                entityType: "sales-order",
                entityId: salesOrder.id,
                actorId: actor.id,
                action: "SALES_ORDER_STATUS_CHANGED",
                prevStatus: currentSOStatus,
                newStatus: "IN_FULFILLMENT"
              }
            });
          }
        }
      }

      return doc;
    });

    return updated;
  });


  // --- WORK ORDERS ---

  // GET /crm/production/work-orders
  fastify.get("/work-orders", productionPreHandler, async (request, reply) => {
    const { status, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.workOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          productionPlan: true,
          bom: true,
          supervisor: { select: { name: true } }
        }
      }),
      prisma.workOrder.count({ where })
    ]);

    return { orders, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/production/work-orders/:id
  fastify.get("/work-orders/:id", { preHandler: [requireRoles("SUPERVISOR", "INVENTORY_MANAGER", "PURCHASE_MANAGER", "PAX_TEST_ENGINEER", "ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        productionPlan: true,
        productionRequirement: { include: { customer: true } },
        bom: { include: { items: { include: { material: true } } } },
        supervisor: { select: { name: true, email: true } },
        operators: { include: { user: { select: { name: true, email: true } } } },
        packs: true,
        scheduling: true,
        execution: true,
        cellTestingRequirements: {
          include: {
            material: true
          }
        },
        inspections: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!wo) return reply.status(404).send({ error: "Work Order not found" });

    const auditHistory = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: "work-order", entityId: id },
          { entityType: "work-order-scheduling", entityId: wo.scheduling?.id || "none" },
          { entityType: "work-order-execution", entityId: wo.execution?.id || "none" },
          { entityType: "production-cell-testing-requirement", entityId: id }
        ]
      },
      orderBy: { timestamp: "desc" }
    });

    return { ...wo, auditHistory };
  });

  // GET /crm/production/work-orders/:id/cell-testing-requirements
  fastify.get(
    "/work-orders/:id/cell-testing-requirements",
    { preHandler: [requireRoles("SUPERVISOR", "TEST_ENGINEER", "INVENTORY_MANAGER", "PURCHASE_MANAGER", "PAX_TEST_ENGINEER", "ASSEMBLY_TECHNICIAN", "ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const requirements = await prisma.productionCellTestingRequirement.findMany({
        where: { workOrderId: id },
        include: {
          material: true,
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
              productRef: true,
              plannedQuantity: true,
              status: true,
              supervisor: { select: { name: true, email: true } }
            }
          }
        },
        orderBy: { createdAt: "asc" }
      });

      return { requirements };
    }
  );

  // POST /crm/production/work-orders (Single-instance per plan - in-place edit if already exists)
  fastify.post("/work-orders", productionPreHandler, async (request, reply) => {
    const data = WorkOrderCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    // If work order already exists for this production plan, edit it in place rather than creating duplicate
    if (data.productionPlanId) {
      const existingWO = await prisma.workOrder.findFirst({
        where: { productionPlanId: data.productionPlanId }
      });
      if (existingWO) {
        const updatedWO = await prisma.$transaction(async (tx) => {
          const doc = await tx.workOrder.update({
            where: { id: existingWO.id },
            data: {
              bomId: data.bomId || existingWO.bomId,
              plannedQuantity: data.plannedQuantity !== undefined ? data.plannedQuantity : existingWO.plannedQuantity,
              remainingQuantity: data.plannedQuantity !== undefined ? data.plannedQuantity - (existingWO.completedQuantity || 0) : existingWO.remainingQuantity,
              dueDate: data.dueDate ? new Date(data.dueDate) : existingWO.dueDate,
              supervisorId: data.supervisorId !== undefined ? data.supervisorId : existingWO.supervisorId,
              notes: data.notes !== undefined ? data.notes : existingWO.notes
            }
          });

          if (data.operatorIds) {
            await tx.workOrderOperator.deleteMany({ where: { workOrderId: existingWO.id } });
            for (const opId of data.operatorIds) {
              await tx.workOrderOperator.create({
                data: {
                  workOrderId: existingWO.id,
                  userId: opId,
                  role: "OPERATOR",
                  status: "ACTIVE"
                }
              });
            }
          }

          await tx.auditLog.create({
            data: {
              entityType: "work-order",
              entityId: doc.id,
              actorId: actor.id,
              action: "WORK_ORDER_EDITED",
              prevStatus: existingWO.status,
              newStatus: doc.status,
              metadata: { workOrderNumber: existingWO.workOrderNumber, changes: data }
            }
          });

          return doc;
        });

        wsManager.broadcastProduction("workorder:update", { id: updatedWO.id, workOrderNumber: updatedWO.workOrderNumber, action: "updated" });
        wsManager.broadcastProduction("production:update", { planId: data.productionPlanId });
        return updatedWO;
      }
    }

    const workOrderNumber = await generateWorkOrderNumber();

    // Splitting check
    if (data.productionRequirementId) {
      const req = await prisma.productionRequirement.findUnique({
        where: { id: data.productionRequirementId },
        include: { workOrders: true }
      });
      if (req) {
        const totalPlanned = req.workOrders.reduce((acc, x) => acc + x.plannedQuantity, 0);
        if (totalPlanned + data.plannedQuantity > req.requiredQuantity) {
          return reply.status(400).send({
            error: `Requested WO quantity of ${data.plannedQuantity} exceeds target requirement allocation bounds (Already planned: ${totalPlanned}/${req.requiredQuantity})`
          });
        }
      }
    }

    const wo = await prisma.$transaction(async (tx) => {
      const doc = await tx.workOrder.create({
        data: {
          workOrderNumber,
          productionPlanId: data.productionPlanId,
          productionRequirementId: data.productionRequirementId,
          salesOrderId: data.salesOrderId,
          productRef: data.productRef,
          bomId: data.bomId,
          plannedQuantity: data.plannedQuantity,
          remainingQuantity: data.plannedQuantity,
          dueDate: new Date(data.dueDate),
          supervisorId: data.supervisorId,
          notes: data.notes,
          status: "CREATED"
        }
      });

      if (data.operatorIds) {
        for (const opId of data.operatorIds) {
          await tx.workOrderOperator.create({
            data: {
              workOrderId: doc.id,
              userId: opId,
              role: "OPERATOR",
              status: "ACTIVE"
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          entityType: "work-order",
          entityId: doc.id,
          actorId: actor.id,
          action: "WORK_ORDER_CREATED",
          newStatus: "CREATED",
          metadata: { workOrderNumber }
        }
      });

      return doc;
    });

    wsManager.broadcastProduction("workorder:update", { id: wo.id, workOrderNumber: wo.workOrderNumber, action: "created" });
    wsManager.broadcastProduction("production:update", { planId: data.productionPlanId });

    return wo;
  });

  // PATCH /crm/production/work-orders/:id (Edit Work Order Parameters)
  fastify.patch("/work-orders/:id", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const actor = request.user as { id: string };

    const wo = await prisma.workOrder.findUnique({ where: { id } });
    if (!wo) return reply.status(404).send({ error: "Work Order not found" });

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.workOrder.update({
        where: { id },
        data: {
          bomId: data.bomId !== undefined ? data.bomId : undefined,
          plannedQuantity: data.plannedQuantity !== undefined ? Number(data.plannedQuantity) : undefined,
          remainingQuantity: data.plannedQuantity !== undefined ? Number(data.plannedQuantity) - (wo.completedQuantity || 0) : undefined,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          supervisorId: data.supervisorId !== undefined ? data.supervisorId : undefined,
          notes: data.notes !== undefined ? data.notes : undefined
        }
      });

      if (data.operatorIds && Array.isArray(data.operatorIds)) {
        await tx.workOrderOperator.deleteMany({ where: { workOrderId: id } });
        for (const opId of data.operatorIds) {
          await tx.workOrderOperator.create({
            data: {
              workOrderId: id,
              userId: opId,
              role: "OPERATOR",
              status: "ACTIVE"
            }
          });
        }
      }

      await tx.auditLog.create({
        data: {
          entityType: "work-order",
          entityId: doc.id,
          actorId: actor.id,
          action: "WORK_ORDER_EDITED",
          prevStatus: wo.status,
          newStatus: doc.status,
          metadata: { workOrderNumber: wo.workOrderNumber, changes: data }
        }
      });

      return doc;
    });

    wsManager.broadcastProduction("workorder:update", { id: updated.id, workOrderNumber: updated.workOrderNumber, action: "updated" });
    wsManager.broadcastProduction("production:update", { planId: wo.productionPlanId });

    return updated;
  });

  // PUT /crm/production/work-orders/:id/status
  fastify.put("/work-orders/:id/status", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: any };
    const actor = request.user as { id: string };

    const wo = await prisma.workOrder.findUnique({ where: { id } });
    if (!wo) return reply.status(404).send({ error: "Work Order not found" });

    const from = wo.status;
    const to = status;

    // Direct status updates to READY are blocked
    if (to === "READY") {
      return reply.status(400).send({ error: "Cannot transition status to READY manually. Use the /allocate endpoint." });
    }

    if (to === "COMPLETED") {
      return reply.status(400).send({ error: "Cannot transition status to COMPLETED manually. This is handled automatically upon successful QC inspection." });
    }

    let valid = false;
    if (from === "CREATED" && ["ASSIGNED", "CANCELLED"].includes(to)) valid = true;
    if (from === "ASSIGNED" && ["READY", "ON_HOLD", "CANCELLED"].includes(to)) valid = true;
    if (from === "READY" && ["IN_PROGRESS", "ON_HOLD"].includes(to)) valid = true;
    if (from === "IN_PROGRESS" && ["QC_PENDING", "ON_HOLD"].includes(to)) valid = true;
    if (from === "QC_PENDING" && ["COMPLETED"].includes(to)) valid = true;
    if (from === "COMPLETED" && ["CLOSED"].includes(to)) valid = true;

    if (!valid && from !== to) {
      return reply.status(400).send({ error: `Invalid Work Order status move from ${from} to ${to}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.workOrder.update({
        where: { id },
        data: { 
          status,
          startDate: to === "IN_PROGRESS" && !wo.startDate ? new Date() : wo.startDate
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "work-order",
          entityId: id,
          actorId: actor.id,
          action: "WORK_ORDER_STATUS_CHANGED",
          prevStatus: from,
          newStatus: to
        }
      });

      return doc;
    });

    return updated;
  });

  // POST /crm/production/work-orders/:id/allocate (Allocate inventory reservations)
  fastify.post("/work-orders/:id/allocate", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: { bom: { include: { items: { include: { material: true } } } } }
    });

    if (!wo) return reply.status(404).send({ error: "Work Order not found" });
    if (!wo.bom) return reply.status(400).send({ error: "No BOM associated with this Work Order" });

    try {
      const results = await prisma.$transaction(async (tx) => {
        // Sort items by materialId deterministically to prevent deadlocks in concurrent locking
        const sortedItems = [...wo.bom!.items].sort((a, b) => a.materialId.localeCompare(b.materialId));

        for (const item of sortedItems) {
          // Lock the material row for update
          await tx.$executeRawUnsafe(
            `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
            item.materialId
          );

          const neededQty = item.quantity * wo.plannedQuantity;

          // Fetch active reservations inside transaction
          const activeRes = await tx.inventoryReservation.findMany({
            where: { materialId: item.materialId, status: "RESERVED" }
          });
          const reservedQty = activeRes.reduce((acc, x) => acc + x.quantity, 0);

          // Fetch fresh, locked material count
          const freshMat = await tx.material.findUnique({ where: { id: item.materialId } });
          if (!freshMat) throw new Error("Material not found");

          const availableQty = Math.max(0, freshMat.quantity - reservedQty);

          if (availableQty < neededQty) {
            throw new Error(`Insufficient material for SKU ${freshMat.sku}. Needed: ${neededQty}, Available: ${availableQty}`);
          }

          // Create inventory reservation
          await tx.inventoryReservation.create({
            data: {
              materialId: item.materialId,
              quantity: neededQty,
              status: "RESERVED",
              salesOrderId: wo.salesOrderId || undefined
            }
          });

          // Stock ledger movements log (does not reduce physical stock)
          await tx.stockMovement.create({
            data: {
              materialId: item.materialId,
              quantity: -neededQty,
              movementType: "RESERVATION",
              source: "WORK_ORDER",
              referenceId: id,
              userId: actor.id,
              reason: `Reservation allocation for WO ${wo.workOrderNumber}`
            }
          });
        }

        // Advance status to READY
        const doc = await tx.workOrder.update({
          where: { id },
          data: { status: "READY" }
        });

        await tx.auditLog.create({
          data: {
            entityType: "work-order",
            entityId: id,
            actorId: actor.id,
            action: "MATERIALS_ALLOCATED",
            newStatus: "READY"
          }
        });

        return doc;
      });

      return results;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Material allocation transaction failed" });
    }
  });

  // POST /crm/production/work-orders/:id/spawn-purchase-request
  fastify.post("/work-orders/:id/spawn-purchase-request", productionPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { materialId, shortageQty } = request.body as { materialId: string; shortageQty: number };
    const actor = request.user as { id: string };

    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: { productionRequirement: true, salesOrder: true }
    });
    if (!wo) return reply.status(404).send({ error: "Work Order not found" });

    const reqId = wo.productionRequirementId || id;
    const requiredDate = wo.dueDate || new Date();

    // Check duplicate PR
    const duplicate = await prisma.purchaseRequest.findFirst({
      where: {
        OR: [
          { sourceReferenceId: reqId },
          { sourceReferenceId: id }
        ],
        items: { some: { materialId } },
        status: { notIn: ["CANCELLED", "REJECTED"] }
      }
    });

    if (duplicate) {
      return reply.status(400).send({ error: `A Purchase Request already exists for this material: ${duplicate.prNumber}` });
    }

    // Sequence PR
    const prNumber = await prisma.$queryRawUnsafe<any[]>(`SELECT count(*) FROM "PurchaseRequest"`);
    const count = parseInt(prNumber[0].count, 10) + 1;
    const prCode = `PR-PROD-${String(count).padStart(6, '0')}`;

    const pr = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.create({
        data: {
          prNumber: prCode,
          requestedById: actor.id,
          source: "PRODUCTION_REQUIREMENT",
          sourceReferenceId: reqId,
          priority: (wo.productionRequirement?.priority || wo.salesOrder?.priority || "NORMAL") as any,
          requiredDate: requiredDate,
          reason: `Production shortfall for Work Order ${wo.workOrderNumber} (${wo.productRef})`,
          status: "DRAFT"
        }
      });

      await tx.purchaseRequestItem.create({
        data: {
          purchaseRequestId: doc.id,
          materialId,
          requestedQuantity: shortageQty,
          requiredDate: requiredDate
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "work-order",
          entityId: id,
          actorId: actor.id,
          action: "SHORTAGE_PR_SPAWNED",
          metadata: { prNumber: prCode, materialId, shortageQty }
        }
      });

      return doc;
    });

    return pr;
  });

  // GET /crm/production/schedule/unscheduled - Retrieve unscheduled WorkOrders
  fastify.get("/schedule/unscheduled", productionPreHandler, async (request, reply) => {
    const unscheduled = await prisma.workOrder.findMany({
      where: {
        status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
        scheduling: null
      },
      include: {
        bom: {
          include: {
            items: {
              include: {
                material: true
              }
            }
          }
        },
        productionPlan: {
          include: {
            productionRequirement: {
              include: {
                customer: true,
                salesOrder: true
              }
            }
          }
        },
        salesOrder: {
          include: {
            customer: true
          }
        },
        productionRequirement: {
          include: {
            customer: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return unscheduled;
  });

  // GET /crm/production/schedule - Retrieve schedules for a date / date range
  fastify.get("/schedule", productionPreHandler, async (request, reply) => {
    const { date } = request.query as { date?: string };
    const queryDate = date ? date : new Date().toISOString().split("T")[0];
    const targetDate = new Date(queryDate + "T00:00:00.000Z");

    const schedules = await prisma.workOrderScheduling.findMany({
      where: { assignedDate: targetDate },
      include: {
        workOrder: {
          include: {
            bom: {
              include: {
                items: {
                  include: {
                    material: true
                  }
                }
              }
            },
            productionPlan: {
              include: {
                productionRequirement: {
                  include: {
                    customer: true,
                    salesOrder: true
                  }
                }
              }
            },
            salesOrder: {
              include: {
                customer: true
              }
            },
            productionRequirement: {
              include: {
                customer: true
              }
            }
          }
        }
      },
      orderBy: { sequence: "asc" }
    });
    return schedules;
  });

  // POST /crm/production/schedule - Schedule or reschedule a WorkOrder
  fastify.post("/schedule", productionPreHandler, async (request, reply) => {
    const { workOrderId, assignedDate, sequence, estimatedHrs } = WorkOrderScheduleSchema.parse(request.body);
    const actor = request.user as { id: string };

    const targetDate = new Date(assignedDate + "T00:00:00.000Z");

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Fetch work order
        const wo = await tx.workOrder.findUnique({ where: { id: workOrderId } });
        if (!wo) {
          throw new Error("WORK_ORDER_NOT_FOUND");
        }
        if (wo.status === "COMPLETED" || wo.status === "CLOSED" || wo.status === "CANCELLED") {
          throw new Error("TERMINAL_STATUS_BLOCK");
        }

        // 2. Check if a schedule already exists
        const existing = await tx.workOrderScheduling.findUnique({ where: { workOrderId } });

        if (existing) {
          const oldDateStr = existing.assignedDate.toISOString().split("T")[0];
          const newDateStr = targetDate.toISOString().split("T")[0];

          if (oldDateStr === newDateStr) {
            // Same date sequence update
            const oldSeq = existing.sequence;
            const newSeq = sequence;

            if (oldSeq !== newSeq) {
              // Park target at a temporary non-conflicting sequence (-1)
              await tx.workOrderScheduling.update({
                where: { workOrderId },
                data: { sequence: -1 }
              });

              if (newSeq < oldSeq) {
                // Shift affected sequences between newSeq and oldSeq - 1 by +1 (descending to avoid conflicts)
                const toShift = await tx.workOrderScheduling.findMany({
                  where: { assignedDate: targetDate, sequence: { gte: newSeq, lt: oldSeq } },
                  orderBy: { sequence: "desc" }
                });
                for (const s of toShift) {
                  await tx.workOrderScheduling.update({
                    where: { id: s.id },
                    data: { sequence: s.sequence + 1 }
                  });
                }
              } else {
                // Shift affected sequences between oldSeq + 1 and newSeq by -1 (ascending to avoid conflicts)
                const toShift = await tx.workOrderScheduling.findMany({
                  where: { assignedDate: targetDate, sequence: { gt: oldSeq, lte: newSeq } },
                  orderBy: { sequence: "asc" }
                });
                for (const s of toShift) {
                  await tx.workOrderScheduling.update({
                    where: { id: s.id },
                    data: { sequence: s.sequence - 1 }
                  });
                }
              }
            }

            const updated = await tx.workOrderScheduling.update({
              where: { workOrderId },
              data: { sequence: newSeq, estimatedHrs }
            });

            await tx.auditLog.create({
              data: {
                entityType: "work-order-scheduling",
                entityId: updated.id,
                actorId: actor.id,
                action: "SCHEDULE_UPDATED",
                prevStatus: "SCHEDULED",
                newStatus: "SCHEDULED",
                metadata: { prevSequence: oldSeq, newSequence: newSeq, estimatedHrs, assignedDate }
              }
            });

            return updated;
          } else {
            // Different date rescheduling:
            // Park target at a temporary non-conflicting sequence (-1)
            await tx.workOrderScheduling.update({
              where: { workOrderId },
              data: { sequence: -1 }
            });

            // First, remove gap from old date (ascending)
            const toShiftOld = await tx.workOrderScheduling.findMany({
              where: { assignedDate: existing.assignedDate, sequence: { gt: existing.sequence } },
              orderBy: { sequence: "asc" }
            });
            for (const s of toShiftOld) {
              await tx.workOrderScheduling.update({
                where: { id: s.id },
                data: { sequence: s.sequence - 1 }
              });
            }

            // Second, open space on new date (descending)
            const toShiftNew = await tx.workOrderScheduling.findMany({
              where: { assignedDate: targetDate, sequence: { gte: sequence } },
              orderBy: { sequence: "desc" }
            });
            for (const s of toShiftNew) {
              await tx.workOrderScheduling.update({
                where: { id: s.id },
                data: { sequence: s.sequence + 1 }
              });
            }

            const updated = await tx.workOrderScheduling.update({
              where: { workOrderId },
              data: { assignedDate: targetDate, sequence, estimatedHrs }
            });

            await tx.auditLog.create({
              data: {
                entityType: "work-order-scheduling",
                entityId: updated.id,
                actorId: actor.id,
                action: "SCHEDULE_RESCHEDULED",
                prevStatus: "SCHEDULED",
                newStatus: "SCHEDULED",
                metadata: { oldDate: oldDateStr, newDate: newDateStr, oldSequence: existing.sequence, newSequence: sequence, estimatedHrs }
              }
            });

            return updated;
          }
        } else {
          // Brand new schedule
          // Open space on new date (descending)
          const toShift = await tx.workOrderScheduling.findMany({
            where: { assignedDate: targetDate, sequence: { gte: sequence } },
            orderBy: { sequence: "desc" }
          });
          for (const s of toShift) {
            await tx.workOrderScheduling.update({
              where: { id: s.id },
              data: { sequence: s.sequence + 1 }
            });
          }

          const created = await tx.workOrderScheduling.create({
            data: { workOrderId, assignedDate: targetDate, sequence, estimatedHrs }
          });

          await tx.auditLog.create({
            data: {
              entityType: "work-order-scheduling",
              entityId: created.id,
              actorId: actor.id,
              action: "SCHEDULE_CREATED",
              newStatus: "SCHEDULED",
              metadata: { assignedDate, sequence, estimatedHrs }
            }
          });

          return created;
        }
      });

      return result;
    } catch (err: any) {
      if (err.message === "WORK_ORDER_NOT_FOUND") {
        return reply.status(404).send({ error: "Work Order not found" });
      }
      if (err.message === "TERMINAL_STATUS_BLOCK") {
        return reply.status(400).send({ error: "Work Order is in a terminal status and cannot be scheduled" });
      }
      return reply.status(400).send({ error: err.message || "Failed to schedule Work Order" });
    }
  });

  // DELETE /crm/production/schedule/:workOrderId - Remove scheduling
  fastify.delete("/schedule/:workOrderId", productionPreHandler, async (request, reply) => {
    const { workOrderId } = request.params as { workOrderId: string };
    const actor = request.user as { id: string };

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.workOrderScheduling.findUnique({ where: { workOrderId } });
        if (!existing) {
          throw new Error("SCHEDULE_NOT_FOUND");
        }

        // Delete schedule
        await tx.workOrderScheduling.delete({ where: { workOrderId } });

        // Close gap on date (ascending)
        const toShift = await tx.workOrderScheduling.findMany({
          where: { assignedDate: existing.assignedDate, sequence: { gt: existing.sequence } },
          orderBy: { sequence: "asc" }
        });
        for (const s of toShift) {
          await tx.workOrderScheduling.update({
            where: { id: s.id },
            data: { sequence: s.sequence - 1 }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "work-order-scheduling",
            entityId: existing.id,
            actorId: actor.id,
            action: "SCHEDULE_REMOVED",
            prevStatus: "SCHEDULED",
            newStatus: "UNSCHEDULED",
            metadata: { oldDate: existing.assignedDate.toISOString().split("T")[0], oldSequence: existing.sequence }
          }
        });
      });

      return { success: true };
    } catch (err: any) {
      if (err.message === "SCHEDULE_NOT_FOUND") {
        return reply.status(404).send({ error: "Scheduling record not found" });
      }
      return reply.status(400).send({ error: err.message || "Failed to remove schedule" });
    }
  });

  // Pre-handlers for execution roles
  const executionViewPreHandler = { preHandler: [requireRoles("SUPERVISOR", "PAX_TEST_ENGINEER", "ADMIN", "SUPERADMIN")] };
  const startPauseResumePreHandler = { preHandler: [requireRoles("SUPERVISOR", "ADMIN", "SUPERADMIN")] };
  const completePreHandler = { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] };

  // GET /crm/production/execution/dashboard
  fastify.get("/execution/dashboard", executionViewPreHandler, async (request, reply) => {
    const { date } = request.query as { date?: string };
    const queryDate = date ? date : new Date().toISOString().split("T")[0];
    const targetDate = new Date(queryDate + "T00:00:00.000Z");

    const schedules = await prisma.workOrderScheduling.findMany({
      where: { assignedDate: targetDate },
      include: {
        workOrder: {
          include: {
            execution: true,
            productionPlan: true,
            bom: true,
            cellTestingRequirements: true,
            packs: {
              include: {
                inspections: true,
                paxType: true
              }
            }
          }
        }
      },
      orderBy: { sequence: "asc" }
    });

    const ready: any[] = [];
    const inProgress: any[] = [];
    const paused: any[] = [];
    const completed: any[] = [];

    for (const item of schedules) {
      const status = item.workOrder?.status;
      if (status === "IN_PROGRESS") {
        inProgress.push(item);
      } else if (status === "ON_HOLD") {
        paused.push(item);
      } else if (status && ["QC_PENDING", "COMPLETED", "CLOSED", "CANCELLED"].includes(status)) {
        completed.push(item);
      } else {
        ready.push(item);
      }
    }

    return { ready, inProgress, paused, completed };
  });



  // POST /crm/production/work-orders/:id/start
  fastify.post("/work-orders/:id/start", startPauseResumePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };
    const { stationId: inputStationId } = (request.body as { stationId?: string }) || {};

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Resolve station: if not explicitly passed, resolve from actor's current assignment or first active station
        let resolvedStationId = inputStationId;
        let station: any = null;

        if (resolvedStationId) {
          station = await tx.productionStation.findUnique({ where: { id: resolvedStationId } });
          if (station && !station.isActive) {
            station = await tx.productionStation.update({
              where: { id: station.id },
              data: { isActive: true }
            });
          }
        }

        if (!station) {
          const activeAssignment = await tx.stationOperatorAssignment.findFirst({
            where: { operatorId: actor.id, releasedAt: null },
            include: { station: true }
          });
          if (activeAssignment && activeAssignment.station?.isActive) {
            station = activeAssignment.station;
            resolvedStationId = activeAssignment.stationId;
          } else {
            station = await tx.productionStation.findFirst({
              where: { isActive: true, type: "ASSEMBLY" }
            }) || await tx.productionStation.findFirst({
              where: { isActive: true }
            }) || await tx.productionStation.findFirst();

            if (!station) {
              station = await tx.productionStation.create({
                data: {
                  name: "Main Assembly Station 1",
                  code: "STN-ASSY-01",
                  type: "ASSEMBLY",
                  isActive: true
                }
              });
            } else if (!station.isActive) {
              station = await tx.productionStation.update({
                where: { id: station.id },
                data: { isActive: true }
              });
            }
            resolvedStationId = station.id;
          }
        }

        if (!station || !resolvedStationId) {
          throw new Error("STATION_NOT_FOUND");
        }

        const validStationId: string = station.id || resolvedStationId;

        // 2. Verify or auto-ensure scheduling record exists for today
        let scheduling = await tx.workOrderScheduling.findUnique({
          where: { workOrderId: id }
        });
        const todayStr = new Date().toISOString().split("T")[0];
        const targetDate = new Date(todayStr + "T00:00:00.000Z");

        if (!scheduling) {
          const count = await tx.workOrderScheduling.count({ where: { assignedDate: targetDate } });
          scheduling = await tx.workOrderScheduling.create({
            data: {
              workOrderId: id,
              assignedDate: targetDate,
              sequence: count + 1,
              estimatedHrs: 2.0
            }
          });
        } else {
          const schedDateStr = new Date(scheduling.assignedDate).toISOString().split("T")[0];
          if (schedDateStr !== todayStr) {
            // Update scheduling to today if starting now
            scheduling = await tx.workOrderScheduling.update({
              where: { id: scheduling.id },
              data: { assignedDate: targetDate }
            });
          }
        }

        // Concurrency pessimistic lock
        const rawWos = await tx.$queryRawUnsafe('SELECT * FROM "WorkOrder" WHERE id = $1 FOR UPDATE', id) as any[];
        const wo = rawWos[0];
        if (!wo) {
          throw new Error("WORK_ORDER_NOT_FOUND");
        }

        // Validate state transitions
        if (wo.status === "COMPLETED" || wo.status === "CLOSED" || wo.status === "CANCELLED") {
          throw new Error("TERMINAL_STATUS_BLOCK");
        }
        if (wo.status === "IN_PROGRESS") {
          throw new Error("ALREADY_IN_PROGRESS");
        }
        if (!["READY", "ASSIGNED", "CREATED", "ON_HOLD"].includes(wo.status)) {
          throw new Error("MATERIALS_NOT_ALLOCATED");
        }

        const now = new Date();

        // 3. Auto-release operator from other stations and check in to this station
        await tx.stationOperatorAssignment.updateMany({
          where: { operatorId: actor.id, releasedAt: null },
          data: { releasedAt: now }
        });
        await tx.stationOperatorAssignment.create({
          data: {
            stationId: validStationId,
            operatorId: actor.id,
            assignedAt: now
          }
        });

        // 4. Ensure technician is linked as active WorkOrderOperator
        const existingOp = await tx.workOrderOperator.findFirst({
          where: { workOrderId: id, userId: actor.id }
        });
        if (!existingOp) {
          await tx.workOrderOperator.create({
            data: {
              workOrderId: id,
              userId: actor.id,
              role: "OPERATOR",
              status: "ACTIVE"
            }
          });
        } else if (existingOp.status !== "ACTIVE") {
          await tx.workOrderOperator.update({
            where: { id: existingOp.id },
            data: { status: "ACTIVE" }
          });
        }

        const updated = await tx.workOrder.update({
          where: { id },
          data: {
            status: "IN_PROGRESS",
            startDate: wo.startDate || now
          }
        });

        const exec = await tx.workOrderExecution.upsert({
          where: { workOrderId: id },
          create: {
            workOrderId: id,
            startedAt: now,
            actualHours: 0
          },
          update: {
            startedAt: now,
            pausedAt: null,
            resumedAt: null,
            pauseReason: null
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "work-order",
            entityId: id,
            actorId: actor.id,
            action: "PRODUCTION_STARTED",
            prevStatus: wo.status,
            newStatus: "IN_PROGRESS",
            metadata: { stationId: validStationId, stationName: station.name }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "station",
            entityId: validStationId,
            actorId: actor.id,
            action: "STATION_WORK_START",
            newStatus: "IN_PROGRESS",
            metadata: { workOrderId: id, timestamp: now }
          }
        });

        // 5. Derive and activate Production Cell Testing Requirements from Work Order BOM
        let bom = null;
        if (wo.bomId) {
          bom = await tx.bOM.findUnique({
            where: { id: wo.bomId },
            include: { items: { include: { material: true } } }
          });
        }
        if (!bom && wo.productRef) {
          bom = await tx.bOM.findFirst({
            where: { name: { contains: wo.productRef, mode: "insensitive" } },
            include: { items: { include: { material: true } } }
          });
        }
        if (!bom) {
          bom = await tx.bOM.findFirst({
            include: { items: { include: { material: true } } }
          });
        }

        // Filter BOM items for cell materials
        const allBomItems = bom?.items || [];
        let cellItems = allBomItems.filter(item => {
          const cat = (item.material?.category || "").toUpperCase();
          const sku = (item.material?.sku || "").toUpperCase();
          const name = (item.material?.name || "").toUpperCase();
          const matType = (item.material?.materialType || "").toUpperCase();
          return cat === "CELLS" || cat.includes("CELL") || sku.startsWith("CELL-") || sku.startsWith("SKU-CELL") || name.includes("CELL") || matType === "CELL";
        });

        // Fallback: If no explicit cell item was in BOM items, find or create default cell material
        if (cellItems.length === 0) {
          const defaultCellMat = await tx.material.findFirst({
            where: {
              OR: [
                { category: { equals: "CELLS", mode: "insensitive" } },
                { sku: { startsWith: "CELL-" } },
                { sku: "SKU-CELL-001" }
              ]
            }
          }) || await tx.material.findFirst();

          if (defaultCellMat) {
            cellItems = [{
              id: "fallback-cell-item",
              bomId: bom?.id || "default",
              materialId: defaultCellMat.id,
              quantity: 16,
              material: defaultCellMat
            }];
          }
        }

        const woPlannedQty = wo.plannedQuantity || 1;
        const activatedRequirements: any[] = [];

        for (const cellItem of cellItems) {
          const cellSku = cellItem.material?.sku || "CELL-LFP-3200";
          const cellName = cellItem.material?.name || "Lithium Iron Phosphate Battery Cell";
          const requiredQuantity = (cellItem.quantity || 16) * woPlannedQty;

          const existingReq = await tx.productionCellTestingRequirement.findUnique({
            where: {
              workOrderId_cellSku: {
                workOrderId: id,
                cellSku
              }
            }
          });

          if (existingReq) {
            const currentTested = existingReq.testedQuantity;
            const remaining = Math.max(0, requiredQuantity - currentTested);
            const reqStatus = remaining === 0 ? "COMPLETED" : "IN_PROGRESS";

            const updatedReq = await tx.productionCellTestingRequirement.update({
              where: { id: existingReq.id },
              data: {
                requiredQuantity,
                remainingQuantity: remaining,
                status: reqStatus,
                materialId: cellItem.materialId,
                cellName
              }
            });
            activatedRequirements.push(updatedReq);
          } else {
            const lastPctr = await tx.productionCellTestingRequirement.findFirst({
              orderBy: { requirementNumber: "desc" }
            });
            let nextNum = 1;
            if (lastPctr && lastPctr.requirementNumber.startsWith("PCTR-")) {
              const parsed = parseInt(lastPctr.requirementNumber.replace("PCTR-", ""), 10);
              if (!isNaN(parsed)) nextNum = parsed + 1;
            }
            const requirementNumber = `PCTR-${String(nextNum).padStart(6, "0")}`;

            const newReq = await tx.productionCellTestingRequirement.create({
              data: {
                requirementNumber,
                workOrderId: id,
                materialId: cellItem.materialId,
                cellSku,
                cellName,
                requiredQuantity,
                testedQuantity: 0,
                remainingQuantity: requiredQuantity,
                status: "IN_PROGRESS"
              }
            });
            activatedRequirements.push(newReq);
          }
        }

        await tx.auditLog.create({
          data: {
            entityType: "production-cell-testing-requirement",
            entityId: id,
            actorId: actor.id,
            action: "PRODUCTION_CELL_REQUIREMENT_ACTIVATED",
            newStatus: "IN_PROGRESS",
            metadata: {
              workOrderId: id,
              requirements: activatedRequirements.map(r => ({
                id: r.id,
                requirementNumber: r.requirementNumber,
                cellSku: r.cellSku,
                requiredQuantity: r.requiredQuantity
              }))
            }
          }
        });

        return { workOrder: updated, execution: exec, cellRequirements: activatedRequirements };
      });

      wsManager.broadcastProduction("workorder:update", { id, status: "IN_PROGRESS", action: "started" });
      wsManager.broadcastProduction("production:update", { workOrderId: id, action: "started" });

      return result;
    } catch (err: any) {
      if (err.message === "STATION_ID_REQUIRED") {
        return reply.status(400).send({ error: "Station ID is required to start the Work Order" });
      }
      if (err.message === "STATION_NOT_FOUND") {
        return reply.status(404).send({ error: "Production Station not found" });
      }
      if (err.message === "STATION_INACTIVE") {
        return reply.status(400).send({ error: "Cannot check in to an inactive station" });
      }
      if (err.message === "NOT_SCHEDULED") {
        return reply.status(400).send({ error: "Work Order must be scheduled before it can be started" });
      }
      if (err.message === "NOT_SCHEDULED_FOR_TODAY") {
        return reply.status(400).send({ error: "Work Order is not scheduled for today" });
      }
      if (err.message === "WORK_ORDER_NOT_FOUND") {
        return reply.status(404).send({ error: "Work Order not found" });
      }
      if (err.message === "TERMINAL_STATUS_BLOCK") {
        return reply.status(400).send({ error: "Work Order is in a terminal status and cannot be started" });
      }
      if (err.message === "ALREADY_IN_PROGRESS") {
        return reply.status(400).send({ error: "Work Order is already in progress" });
      }
      if (err.message === "MATERIALS_NOT_ALLOCATED") {
        return reply.status(400).send({ error: "Work Order materials must be allocated first" });
      }
      return reply.status(400).send({ error: err.message || "Failed to start Work Order" });
    }
  });

  // POST /crm/production/work-orders/:id/pause
  fastify.post("/work-orders/:id/pause", startPauseResumePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const actor = request.user as { id: string };

    if (!reason || reason.trim() === "") {
      return reply.status(400).send({ error: "Pause reason is required" });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Concurrency pessimistic lock
        const rawWos = await tx.$queryRawUnsafe('SELECT * FROM "WorkOrder" WHERE id = $1 FOR UPDATE', id) as any[];
        const wo = rawWos[0];
        if (!wo) {
          throw new Error("WORK_ORDER_NOT_FOUND");
        }

        if (wo.status !== "IN_PROGRESS") {
          throw new Error("NOT_IN_PROGRESS");
        }

        const exec = await tx.workOrderExecution.findUnique({ where: { workOrderId: id } });

        const now = new Date();
        const lastActiveTime = exec ? (exec.resumedAt || exec.startedAt || now) : (wo.startDate || now);
        const elapsedMs = Math.max(0, now.getTime() - lastActiveTime.getTime());
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        const updatedHours = (exec?.actualHours || 0) + elapsedHours;

        const updatedExec = await tx.workOrderExecution.upsert({
          where: { workOrderId: id },
          create: {
            workOrderId: id,
            startedAt: wo.startDate || now,
            pausedAt: now,
            pauseReason: reason,
            actualHours: updatedHours
          },
          update: {
            pausedAt: now,
            pauseReason: reason,
            actualHours: updatedHours
          }
        });

        const updatedWo = await tx.workOrder.update({
          where: { id },
          data: { status: "ON_HOLD" }
        });

        await tx.auditLog.create({
          data: {
            entityType: "work-order",
            entityId: id,
            actorId: actor.id,
            action: "PRODUCTION_PAUSED",
            prevStatus: wo.status,
            newStatus: "ON_HOLD",
            metadata: { pauseReason: reason }
          }
        });

        const activeAssignment = await tx.stationOperatorAssignment.findFirst({
          where: { operatorId: actor.id, releasedAt: null }
        });
        if (activeAssignment) {
          await tx.auditLog.create({
            data: {
              entityType: "station",
              entityId: activeAssignment.stationId,
              actorId: actor.id,
              action: "STATION_WORK_PAUSE",
              newStatus: "ON_HOLD",
              metadata: { workOrderId: id, timestamp: now }
            }
          });
        }

        return { workOrder: updatedWo, execution: updatedExec };
      });

      return result;
    } catch (err: any) {
      if (err.message === "WORK_ORDER_NOT_FOUND") {
        return reply.status(404).send({ error: "Work Order not found" });
      }
      if (err.message === "NOT_IN_PROGRESS") {
        return reply.status(400).send({ error: "Only an IN_PROGRESS Work Order can be paused" });
      }
      return reply.status(400).send({ error: err.message || "Failed to pause Work Order" });
    }
  });

  // POST /crm/production/work-orders/:id/resume
  fastify.post("/work-orders/:id/resume", startPauseResumePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Concurrency pessimistic lock
        const rawWos = await tx.$queryRawUnsafe('SELECT * FROM "WorkOrder" WHERE id = $1 FOR UPDATE', id) as any[];
        const wo = rawWos[0];
        if (!wo) {
          throw new Error("WORK_ORDER_NOT_FOUND");
        }

        if (wo.status !== "ON_HOLD") {
          throw new Error("NOT_ON_HOLD");
        }

        const now = new Date();
        const updatedExec = await tx.workOrderExecution.upsert({
          where: { workOrderId: id },
          create: {
            workOrderId: id,
            startedAt: wo.startDate || now,
            resumedAt: now,
            pausedAt: null,
            pauseReason: null,
            actualHours: 0
          },
          update: {
            resumedAt: now,
            pausedAt: null,
            pauseReason: null
          }
        });

        const updatedWo = await tx.workOrder.update({
          where: { id },
          data: { status: "IN_PROGRESS" }
        });

        await tx.auditLog.create({
          data: {
            entityType: "work-order",
            entityId: id,
            actorId: actor.id,
            action: "PRODUCTION_RESUMED",
            prevStatus: wo.status,
            newStatus: "IN_PROGRESS"
          }
        });

        const activeAssignment = await tx.stationOperatorAssignment.findFirst({
          where: { operatorId: actor.id, releasedAt: null }
        });
        if (activeAssignment) {
          await tx.auditLog.create({
            data: {
              entityType: "station",
              entityId: activeAssignment.stationId,
              actorId: actor.id,
              action: "STATION_WORK_RESUME",
              newStatus: "IN_PROGRESS",
              metadata: { workOrderId: id, timestamp: now }
            }
          });
        }

        return { workOrder: updatedWo, execution: updatedExec };
      });

      return result;
    } catch (err: any) {
      if (err.message === "WORK_ORDER_NOT_FOUND") {
        return reply.status(404).send({ error: "Work Order not found" });
      }
      if (err.message === "NOT_ON_HOLD") {
        return reply.status(400).send({ error: "Only a PAUSED (ON_HOLD) Work Order can be resumed" });
      }
      return reply.status(400).send({ error: err.message || "Failed to resume Work Order" });
    }
  });

  // POST /crm/production/work-orders/:id/complete
  fastify.post("/work-orders/:id/complete", completePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { notes } = request.body as { notes?: string };
    const actor = request.user as { id: string };

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Concurrency pessimistic lock
        const rawWos = await tx.$queryRawUnsafe('SELECT * FROM "WorkOrder" WHERE id = $1 FOR UPDATE', id) as any[];
        const wo = rawWos[0];
        if (!wo) {
          throw new Error("WORK_ORDER_NOT_FOUND");
        }

        if (wo.status !== "IN_PROGRESS" && wo.status !== "ON_HOLD") {
          throw new Error("NOT_ELIGIBLE_FOR_COMPLETION");
        }

        const exec = await tx.workOrderExecution.findUnique({ where: { workOrderId: id } });

        const now = new Date();
        let updatedHours = exec?.actualHours || 0;

        if (wo.status === "IN_PROGRESS") {
          const lastActiveTime = exec ? (exec.resumedAt || exec.startedAt || now) : (wo.startDate || now);
          const elapsedMs = Math.max(0, now.getTime() - lastActiveTime.getTime());
          const elapsedHours = elapsedMs / (1000 * 60 * 60);
          updatedHours += elapsedHours;
        }

        const updatedExec = await tx.workOrderExecution.upsert({
          where: { workOrderId: id },
          create: {
            workOrderId: id,
            startedAt: wo.startDate || now,
            completedAt: now,
            completionNotes: notes || null,
            actualHours: updatedHours
          },
          update: {
            completedAt: now,
            completionNotes: notes || null,
            actualHours: updatedHours
          }
        });

        const updatedWo = await tx.workOrder.update({
          where: { id },
          data: { status: "QC_PENDING" }
        });

        await tx.auditLog.create({
          data: {
            entityType: "work-order",
            entityId: id,
            actorId: actor.id,
            action: "PRODUCTION_COMPLETED",
            prevStatus: wo.status,
            newStatus: "QC_PENDING",
            metadata: { completionNotes: notes }
          }
        });

        const activeAssignment = await tx.stationOperatorAssignment.findFirst({
          where: { operatorId: actor.id, releasedAt: null }
        });
        if (activeAssignment) {
          await tx.auditLog.create({
            data: {
              entityType: "station",
              entityId: activeAssignment.stationId,
              actorId: actor.id,
              action: "STATION_WORK_COMPLETE",
              newStatus: "QC_PENDING",
              metadata: { workOrderId: id, timestamp: now }
            }
          });
        }

        return { workOrder: updatedWo, execution: updatedExec };
      });

      return result;
    } catch (err: any) {
      if (err.message === "WORK_ORDER_NOT_FOUND") {
        return reply.status(404).send({ error: "Work Order not found" });
      }
      if (err.message === "NOT_ELIGIBLE_FOR_COMPLETION") {
        return reply.status(400).send({ error: "Work Order must be IN_PROGRESS or ON_HOLD to complete" });
      }
      return reply.status(400).send({ error: err.message || "Failed to complete Work Order" });
    }
  });
}
