import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { Prisma } from "../generated/client";

export async function reportsRoutes(fastify: FastifyInstance) {
  const readPreHandler = { preHandler: [requireRoles("SUPERVISOR", "ADMIN", "SUPERADMIN")] };

  // GET /crm/reports/control-tower
  fastify.get("/control-tower", readPreHandler, async (request, reply) => {
    const { startDate, endDate } = request.query as any;

    const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const dateFilterSales = { createdAt: { gte: start, lte: end } };
    const dateFilterProd = { createdAt: { gte: start, lte: end } };
    const dateFilterPayments = { paymentDate: { gte: start, lte: end } };

    // --- 1. SALES METRICS ---
    const [quotes, salesOrders] = await Promise.all([
      prisma.quotation.findMany({ where: dateFilterSales }),
      prisma.salesOrder.findMany({ where: dateFilterSales, include: { items: true } })
    ]);

    let totalQuoteValue = 0;
    let acceptedQuoteValue = 0;
    let acceptedQuoteCount = 0;
    for (const q of quotes) {
      const val = parseFloat(q.grandTotal.toString());
      totalQuoteValue += val;
      if (q.status === "ACCEPTED") {
        acceptedQuoteValue += val;
        acceptedQuoteCount++;
      }
    }
    const quotationConversionRate = quotes.length > 0 ? (acceptedQuoteCount / quotes.length) * 100 : 0;

    let totalSalesOrderValue = 0;
    let openSalesOrderCount = 0;
    for (const so of salesOrders) {
      totalSalesOrderValue += parseFloat(so.grandTotal.toString());
      if (so.status !== "FULFILLED" && so.status !== "CANCELLED") {
        openSalesOrderCount++;
      }
    }

    // --- 2. PRODUCTION METRICS ---
    const workOrders = await prisma.workOrder.findMany({
      where: dateFilterProd
    });

    let activeWOs = 0;
    let plannedQty = 0;
    let completedQty = 0;
    for (const wo of workOrders) {
      plannedQty += wo.plannedQuantity;
      completedQty += wo.completedQuantity;
      if (wo.status === "IN_PROGRESS" || wo.status === "QC_PENDING") {
        activeWOs++;
      }
    }
    const productionCompletionRate = plannedQty > 0 ? (completedQty / plannedQty) * 100 : 0;

    // --- 3. INVENTORY & SHORTAGES ---
    // Fetch materials
    const materials = await prisma.material.findMany();
    let totalInventoryValue = 0;
    let lowStockCount = 0;
    const shortagesList: any[] = [];

    for (const m of materials) {
      const stock = m.quantity || 0;
      totalInventoryValue += stock * parseFloat(m.unitPrice?.toString() || "0");
      if (stock < (m.minStock || 0)) {
        lowStockCount++;
      }
      if (stock < 0) {
        shortagesList.push({
          materialCode: m.sku,
          name: m.name,
          available: stock,
          required: 0,
          shortage: Math.abs(stock)
        });
      }
    }

    // --- 4. QUALITY METRICS ---
    const [inspections, defects] = await Promise.all([
      prisma.qualityInspection.findMany({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.defect.findMany({ where: { createdAt: { gte: start, lte: end } } })
    ]);

    let qcPassed = 0;
    let qcFailed = 0;
    for (const insp of inspections) {
      if (insp.result === "PASS") qcPassed++;
      if (insp.result === "FAIL") qcFailed++;
    }

    const openDefects = defects.filter(d => d.status === "OPEN").length;
    const criticalDefects = defects.filter(d => d.status === "OPEN" && d.severity === "CRITICAL").length;

    // --- 5. DISPATCH METRICS ---
    const dispatches = await prisma.dispatchOrder.findMany({
      where: { plannedDispatchDate: { gte: start, lte: end } }
    });

    let pendingDispatches = 0;
    let inTransitDispatches = 0;
    let deliveredDispatches = 0;
    let deliveryExceptions = 0;

    for (const dob of dispatches) {
      if (dob.status === "DRAFT" || dob.status === "READY_TO_PICK" || dob.status === "PICKING" || dob.status === "PICKED" || dob.status === "PACKED") {
        pendingDispatches++;
      } else if (dob.status === "IN_TRANSIT" || dob.status === "DISPATCHED") {
        inTransitDispatches++;
      } else if (dob.status === "DELIVERED") {
        deliveredDispatches++;
      } else if (dob.status === "DELIVERY_EXCEPTION") {
        deliveryExceptions++;
      }
    }

    // --- 6. FINANCE METRICS ---
    const invoices = await prisma.invoice.findMany({
      where: { invoiceDate: { gte: start, lte: end } }
    });

    let totalInvoiced = new Prisma.Decimal(0);
    let totalCollected = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);
    let overdueReceivables = new Prisma.Decimal(0);

    const now = new Date();

    // Receivables Aging
    let ageCurrent = 0;
    let age1To30 = 0;
    let age31To60 = 0;
    let age61To90 = 0;
    let age90Plus = 0;

    for (const inv of invoices) {
      totalInvoiced = totalInvoiced.add(inv.grandTotal);
      totalCollected = totalCollected.add(inv.paidAmount);
      totalOutstanding = totalOutstanding.add(inv.outstandingAmount);

      const isOverdue = inv.outstandingAmount.gt(0) && new Date(inv.dueDate) < now;
      if (isOverdue) {
        overdueReceivables = overdueReceivables.add(inv.outstandingAmount);
        
        const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        const val = parseFloat(inv.outstandingAmount.toString());
        if (days <= 30) age1To30 += val;
        else if (days <= 60) age31To60 += val;
        else if (days <= 90) age61To90 += val;
        else age90Plus += val;
      } else if (inv.outstandingAmount.gt(0)) {
        ageCurrent += parseFloat(inv.outstandingAmount.toString());
      }
    }

    // --- 7. SERVICE METRICS ---
    const [warranties, serviceTickets] = await Promise.all([
      prisma.warranty.findMany({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.serviceBattery.findMany({ where: { receivedDate: { gte: start, lte: end } } })
    ]);

    const activeWarranties = warranties.filter(w => w.status === "ACTIVE").length;
    const openServiceRequests = serviceTickets.filter(t => t.status !== "READY_FOR_DELIVERY").length;
    const repairsInProgress = serviceTickets.filter(t => t.status === "REPAIR_IN_PROGRESS").length;

    // --- 8. DYNAMIC OPERATIONAL ALERTS ---
    const alerts: any[] = [];

    // Critical shortage alerts
    for (const m of shortagesList) {
      alerts.push({
        module: "INVENTORY",
        title: `Material Shortage: ${m.name}`,
        desc: `Available quantity is in deficit. Current balance: ${m.available}`,
        severity: "CRITICAL",
        createdAt: now
      });
    }

    // Critical defect alerts
    if (criticalDefects > 0) {
      alerts.push({
        module: "QUALITY",
        title: `${criticalDefects} Critical Defects Active`,
        desc: "High-priority battery matching defects report open in quality inspection board.",
        severity: "CRITICAL",
        createdAt: now
      });
    }

    // Overdue invoices
    if (overdueReceivables.gt(0)) {
      alerts.push({
        module: "FINANCE",
        title: `Overdue Receivables Outstanding`,
        desc: `₹ ${overdueReceivables.toNumber().toLocaleString()} customer invoices have passed due date rules.`,
        severity: "HIGH",
        createdAt: now
      });
    }

    // High value quotations awaiting approval
    const highValQuotes = quotes.filter(q => q.status === "PENDING_APPROVAL" && parseFloat(q.grandTotal.toString()) > 500000);
    if (highValQuotes.length > 0) {
      alerts.push({
        module: "SALES",
        title: `${highValQuotes.length} High-value Quotes Pending`,
        desc: "Management reviews required on proposal values exceeding ₹ 5,00,000.",
        severity: "HIGH",
        createdAt: now
      });
    }

    return {
      dateRange: { start, end },
      sales: {
        totalQuotations: quotes.length,
        totalQuoteValue,
        acceptedQuoteValue,
        quotationConversionRate,
        activeSalesOrders: salesOrders.length,
        totalSalesOrderValue
      },
      production: {
        activeWorkOrders: activeWOs,
        plannedProduction: plannedQty,
        completedProduction: completedQty,
        productionCompletionRate
      },
      inventory: {
        totalInventoryValue,
        lowStockCount,
        shortages: shortagesList
      },
      quality: {
        qcPassed,
        qcFailed,
        openDefects,
        criticalDefects
      },
      dispatch: {
        pendingDispatches,
        inTransitDispatches,
        deliveredDispatches,
        deliveryExceptions
      },
      finance: {
        totalInvoiced: totalInvoiced.toNumber(),
        totalCollected: totalCollected.toNumber(),
        totalOutstanding: totalOutstanding.toNumber(),
        overdueReceivables: overdueReceivables.toNumber(),
        aging: {
          current: ageCurrent,
          age1To30,
          age31To60,
          age61To90,
          age90Plus
        }
      },
      service: {
        activeWarranties,
        openServiceRequests,
        repairsInProgress
      },
      alerts
    };
  });

  // GET /crm/reports/oee - Station Cycle Time & OEE Report (Phase 3.0-F)
  fastify.get("/oee", readPreHandler, async (request, reply) => {
    try {
      const stations = await prisma.productionStation.findMany();
      const reports: any[] = [];

      for (const station of stations) {
        // 1. Availability calculation
        const assignments = await prisma.stationOperatorAssignment.findMany({
          where: { stationId: station.id }
        });
        let scheduledMs = 0;
        const now = new Date();
        for (const ass of assignments) {
          const start = new Date(ass.assignedAt);
          const end = ass.releasedAt ? new Date(ass.releasedAt) : now;
          scheduledMs += Math.max(0, end.getTime() - start.getTime());
        }
        const scheduledHours = scheduledMs / (1000 * 60 * 60) || 8.0; // Default to 8.0 hours

        // Get audit logs for station work timers
        const logs = await prisma.auditLog.findMany({
          where: {
            entityType: "station",
            entityId: station.id
          },
          orderBy: { timestamp: "asc" }
        });

        // Group logs by workOrderId
        const logsByWo: Record<string, any[]> = {};
        for (const log of logs) {
          const meta = log.metadata as any;
          if (meta && meta.workOrderId) {
            if (!logsByWo[meta.workOrderId]) logsByWo[meta.workOrderId] = [];
            logsByWo[meta.workOrderId].push(log);
          }
        }

        let activeMs = 0;
        for (const woId in logsByWo) {
          const woLogs = logsByWo[woId];
          let lastStartTime: Date | null = null;

          for (const log of woLogs) {
            const timestamp = new Date(log.timestamp);
            if (log.action === "STATION_WORK_START" || log.action === "STATION_WORK_RESUME") {
              lastStartTime = timestamp;
            } else if ((log.action === "STATION_WORK_PAUSE" || log.action === "STATION_WORK_COMPLETE") && lastStartTime) {
              activeMs += Math.max(0, timestamp.getTime() - lastStartTime.getTime());
              lastStartTime = null;
            }
          }
          if (lastStartTime) {
            activeMs += Math.max(0, now.getTime() - lastStartTime.getTime());
          }
        }
        const activeHours = activeMs / (1000 * 60 * 60) || 0;

        const availability = Math.min(100, Math.max(0, scheduledHours > 0 ? (activeHours / scheduledHours) * 100 : 100));
        const safeAvail = isNaN(availability) || !isFinite(availability) ? 100 : availability;

        // 2. Performance calculation
        const packsCount = await prisma.paxPack.count({
          where: { assembledAtStationId: station.id }
        });
        const standardCycleTime = 0.5; // 30 mins standard per pack
        const idealOutputHours = packsCount * standardCycleTime;
        const performance = Math.min(100, Math.max(0, activeHours > 0 ? (idealOutputHours / activeHours) * 100 : 100));
        const safePerf = isNaN(performance) || !isFinite(performance) ? 100 : performance;

        // 3. Quality calculation
        const paxSerialsAtStation = await prisma.paxPack.findMany({
          where: { assembledAtStationId: station.id },
          select: { paxSerial: true }
        });
        const serials = paxSerialsAtStation.map(p => p.paxSerial);

        let quality = 100;
        let totalInspections = 0;
        let passedInspections = 0;

        if (serials.length > 0) {
          const inspectionsCount = await prisma.qualityInspection.count({
            where: { paxSerial: { in: serials } }
          });
          const passedCount = await prisma.qualityInspection.count({
            where: { paxSerial: { in: serials }, result: "PASS" }
          });
          totalInspections = inspectionsCount;
          passedInspections = passedCount;
          quality = totalInspections > 0 ? (passedInspections / totalInspections) * 100 : 100;
        }
        const safeQual = isNaN(quality) || !isFinite(quality) ? 100 : quality;

        const oee = (safeAvail / 100) * (safePerf / 100) * (safeQual / 100) * 100;
        const safeOee = isNaN(oee) || !isFinite(oee) ? 100 : oee;

        reports.push({
          stationId: station.id,
          stationName: station.name,
          stationCode: station.code,
          stationType: station.type,
          scheduledHours: Number(scheduledHours.toFixed(2)),
          activeHours: Number(activeHours.toFixed(2)),
          packsAssembled: packsCount,
          totalInspections,
          passedInspections,
          metrics: {
            availability: Number(safeAvail.toFixed(2)),
            performance: Number(safePerf.toFixed(2)),
            quality: Number(safeQual.toFixed(2)),
            oee: Number(safeOee.toFixed(2))
          }
        });
      }

      return { stations: reports };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to generate OEE report" });
    }
  });
}

