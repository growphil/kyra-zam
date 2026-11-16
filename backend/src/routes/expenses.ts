import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import {
  ExpenseCreateSchema,
  ExpenseRejectSchema,
  ExpenseApproveSchema,
  ExpenseThresholdUpdateSchema,
  ExpenseCategoryCreateSchema,
  ExpenseCategoryUpdateSchema
} from "../schemas/expense.schemas";
import {
  ExpenseApprovalEngine,
  getActiveThreshold
} from "../services/expenseApprovalEngine";
import { Prisma } from "../generated/client";
import { wsManager } from "../websocket/manager";
import path from "path";
import fs from "fs";
import util from "util";
import { pipeline } from "stream";
import { v4 as uuidv4 } from "uuid";

const pump = util.promisify(pipeline);

export async function expenseRoutes(fastify: FastifyInstance) {
  // Pre-handlers
  const generalPreHandler = {
    preHandler: [requireRoles("ADMIN", "ACCOUNTANT", "SUPERADMIN")]
  };
  const accountantPreHandler = {
    preHandler: [requireRoles("ACCOUNTANT", "SUPERADMIN")]
  };
  const superadminPreHandler = {
    preHandler: [requireRoles("SUPERADMIN")]
  };

  // -------------------------------------------------------------------------
  // 1. DASHBOARD & SUMMARY REPORTS
  // -------------------------------------------------------------------------
  fastify.get("/reports/summary", generalPreHandler, async (request, reply) => {
    const user = request.user as { id: string; roles: string[] };
    const { startDate, endDate, department } = (request.query as any) || {};

    const where: Prisma.ExpenseWhereInput = {};
    if (startDate && endDate) {
      where.expenseDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    if (department) {
      where.department = department;
    }

    // Role-based visibility
    const isSuperAdmin = user.roles.includes("SUPERADMIN") || user.roles.includes("ULTRA_ADMIN");
    const isAccountant = user.roles.includes("ACCOUNTANT");
    // ADMIN can see all or own depending on team configuration; if only admin, allow viewing authorized expenses

    const [
      allExpenses,
      approvedCount,
      autoApprovedCount,
      pendingCount,
      rejectedCount,
      totalLedgerAgg
    ] = await Promise.all([
      prisma.expense.findMany({
        where,
        select: { amount: true, status: true, expenseDate: true }
      }),
      prisma.expense.count({ where: { ...where, status: "APPROVED" } }),
      prisma.expense.count({ where: { ...where, status: "AUTO_APPROVED" } }),
      prisma.expense.count({ where: { ...where, status: "PENDING_VERIFICATION" } }),
      prisma.expense.count({ where: { ...where, status: "REJECTED" } }),
      prisma.expenseLedger.aggregate({
        _sum: { amount: true }
      })
    ]);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let totalAmount = new Prisma.Decimal(0);
    let approvedAmount = new Prisma.Decimal(0);
    let pendingAmount = new Prisma.Decimal(0);
    let rejectedAmount = new Prisma.Decimal(0);
    let currentMonthAmount = new Prisma.Decimal(0);

    for (const exp of allExpenses) {
      totalAmount = totalAmount.add(exp.amount);
      if (exp.status === "APPROVED" || exp.status === "AUTO_APPROVED") {
        approvedAmount = approvedAmount.add(exp.amount);
      } else if (exp.status === "PENDING_VERIFICATION") {
        pendingAmount = pendingAmount.add(exp.amount);
      } else if (exp.status === "REJECTED") {
        rejectedAmount = rejectedAmount.add(exp.amount);
      }

      if (exp.expenseDate >= currentMonthStart && exp.expenseDate <= currentMonthEnd) {
        if (exp.status === "APPROVED" || exp.status === "AUTO_APPROVED") {
          currentMonthAmount = currentMonthAmount.add(exp.amount);
        }
      }
    }

    const threshold = await getActiveThreshold();

    return {
      stats: {
        totalExpensesCount: allExpenses.length,
        totalExpensesAmount: totalAmount.toNumber(),
        approvedCount,
        approvedAmount: approvedAmount.toNumber(),
        autoApprovedCount,
        pendingCount,
        pendingAmount: pendingAmount.toNumber(),
        rejectedCount,
        rejectedAmount: rejectedAmount.toNumber(),
        currentMonthAmount: currentMonthAmount.toNumber(),
        officialLedgerTotal: totalLedgerAgg._sum.amount?.toNumber() || 0,
        activeThreshold: threshold ? threshold.amount.toNumber() : 5000,
        thresholdCurrency: threshold?.currency || "ZMW"
      }
    };
  });

  // GET /expenses/reports/monthly - Monthly trend breakdown
  fastify.get("/reports/monthly", generalPreHandler, async (request, reply) => {
    const expenses = await prisma.expense.findMany({
      where: { status: { in: ["APPROVED", "AUTO_APPROVED"] } },
      select: { amount: true, expenseDate: true, status: true },
      orderBy: { expenseDate: "asc" }
    });

    const monthsMap: Record<string, { month: string; amount: number; count: number }> = {};

    for (const exp of expenses) {
      const d = new Date(exp.expenseDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthsMap[key]) {
        monthsMap[key] = { month: key, amount: 0, count: 0 };
      }
      monthsMap[key].amount += exp.amount.toNumber();
      monthsMap[key].count += 1;
    }

    return { monthlyTrends: Object.values(monthsMap) };
  });

  // GET /expenses/reports/category - Category breakdown
  fastify.get("/reports/category", generalPreHandler, async (request, reply) => {
    const expenses = await prisma.expense.findMany({
      where: { status: { in: ["APPROVED", "AUTO_APPROVED"] } },
      include: { category: true }
    });

    const catMap: Record<string, { categoryId: string; name: string; totalAmount: number; count: number }> = {};

    for (const exp of expenses) {
      const cId = exp.categoryId;
      if (!catMap[cId]) {
        catMap[cId] = {
          categoryId: cId,
          name: exp.category.name,
          totalAmount: 0,
          count: 0
        };
      }
      catMap[cId].totalAmount += exp.amount.toNumber();
      catMap[cId].count += 1;
    }

    return { categories: Object.values(catMap).sort((a, b) => b.totalAmount - a.totalAmount) };
  });

  // GET /expenses/reports/department - Department breakdown
  fastify.get("/reports/department", generalPreHandler, async (request, reply) => {
    const expenses = await prisma.expense.findMany({
      where: { status: { in: ["APPROVED", "AUTO_APPROVED"] } },
      select: { amount: true, department: true }
    });

    const deptMap: Record<string, { department: string; totalAmount: number; count: number }> = {};

    for (const exp of expenses) {
      const dept = exp.department || "Unassigned";
      if (!deptMap[dept]) {
        deptMap[dept] = { department: dept, totalAmount: 0, count: 0 };
      }
      deptMap[dept].totalAmount += exp.amount.toNumber();
      deptMap[dept].count += 1;
    }

    return { departments: Object.values(deptMap).sort((a, b) => b.totalAmount - a.totalAmount) };
  });

  // GET /expenses/reports/export - CSV Export
  fastify.get("/reports/export", generalPreHandler, async (request, reply) => {
    const expenses = await prisma.expense.findMany({
      include: {
        category: true,
        submittedBy: { select: { name: true, email: true } },
        approvedBy: { select: { name: true } },
        rejectedBy: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const headers = [
      "Expense Number",
      "Title",
      "Category",
      "Amount",
      "Currency",
      "Expense Date",
      "Status",
      "Approval Method",
      "Submitted By",
      "Approved By",
      "Payment Method",
      "Vendor Name",
      "Invoice Number",
      "Created At"
    ];

    const rows = expenses.map((e) => [
      e.expenseNumber,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${e.category.name.replace(/"/g, '""')}"`,
      e.amount.toString(),
      e.currency,
      new Date(e.expenseDate).toISOString().split("T")[0],
      e.status,
      e.approvalMethod || "N/A",
      `"${e.submittedBy.name.replace(/"/g, '""')}"`,
      e.approvedBy ? `"${e.approvedBy.name.replace(/"/g, '""')}"` : "N/A",
      e.paymentMethod,
      e.vendorName ? `"${e.vendorName.replace(/"/g, '""')}"` : "",
      e.invoiceNumber ? `"${e.invoiceNumber.replace(/"/g, '""')}"` : "",
      new Date(e.createdAt).toISOString()
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", `attachment; filename="kyra-expenses-${new Date().toISOString().split("T")[0]}.csv"`);
    return reply.send(csvContent);
  });

  // -------------------------------------------------------------------------
  // 2. EXPENSE CREATION & LISTING
  // -------------------------------------------------------------------------

  // Direct Multipart Upload for Expense Proof
  fastify.post("/upload-proof", generalPreHandler, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const originalName = data.filename || "receipt.png";
    const ext = path.extname(originalName).toLowerCase();
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

    if (!allowed.includes(ext)) {
      return reply.status(400).send({
        error: `File type "${ext}" is not supported. Allowed formats: PDF, JPG, JPEG, PNG, WEBP.`
      });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "expenses");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueFileName = `expense-proof-${uuidv4()}${ext}`;
    const targetPath = path.join(uploadDir, uniqueFileName);

    await pump(data.file, fs.createWriteStream(targetPath));

    const stat = fs.statSync(targetPath);
    const publicUrl = `/public/uploads/expenses/${uniqueFileName}`;

    return {
      fileName: originalName,
      fileUrl: publicUrl,
      mimeType: data.mimetype,
      fileSize: stat.size,
      documentType: ext === ".pdf" ? "TAX_INVOICE" : "RECEIPT"
    };
  });

  // POST /expenses - Create Expense
  fastify.post("/", generalPreHandler, async (request, reply) => {
    const user = request.user as { id: string; email: string; roles: string[] };
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, roles: true }
    });

    if (!dbUser) return reply.status(401).send({ error: "User not found" });

    const parsed = ExpenseCreateSchema.parse(request.body);

    const category = await prisma.expenseCategory.findUnique({
      where: { id: parsed.categoryId }
    });

    if (!category || !category.isActive) {
      return reply.status(400).send({ error: "Selected expense category is invalid or inactive" });
    }

    const amountDecimal = new Prisma.Decimal(parsed.amount);

    try {
      const result = await prisma.$transaction(async (tx) => {
        return ExpenseApprovalEngine.processSubmission(
          tx,
          {
            title: parsed.title,
            description: parsed.description,
            categoryId: parsed.categoryId,
            amount: amountDecimal,
            currency: parsed.currency || "ZMW",
            expenseDate: new Date(parsed.expenseDate),
            department: parsed.department,
            costCentre: parsed.costCentre,
            vendorName: parsed.vendorName,
            vendorContact: parsed.vendorContact,
            invoiceNumber: parsed.invoiceNumber,
            paymentMethod: parsed.paymentMethod,
            paymentReference: parsed.paymentReference,
            paymentStatus: parsed.paymentStatus,
            attachments: parsed.attachments
          },
          {
            id: dbUser.id,
            name: dbUser.name,
            roles: dbUser.roles as string[]
          }
        );
      });

      const { expense, ledgerEntry, initialStatus } = result;

      // Realtime Notification & WebSocket Alerts
      const rolesToNotify: string[] = [];
      let notifMessage = "";

      if (initialStatus === "AUTO_APPROVED") {
        notifMessage = `Your expense ${expense.expenseNumber} (${parsed.currency} ${parsed.amount}) has been automatically approved.`;
        await prisma.notification.create({
          data: {
            userId: user.id,
            message: notifMessage,
            channel: "IN_APP",
            status: "SENT"
          }
        });
        rolesToNotify.push("ACCOUNTANT", "SUPERADMIN");
      } else {
        const isAdmin = user.roles.includes("ADMIN") && !user.roles.includes("SUPERADMIN");
        if (isAdmin) {
          notifMessage = `New expense ${expense.expenseNumber} submitted by ADMIN. Verification required.`;
          rolesToNotify.push("ACCOUNTANT", "SUPERADMIN");
        } else {
          notifMessage = `New expense ${expense.expenseNumber} (${parsed.currency} ${parsed.amount}) exceeds auto-approval threshold. Superadmin approval required.`;
          rolesToNotify.push("SUPERADMIN");
        }

        for (const r of rolesToNotify) {
          await prisma.notification.create({
            data: {
              role: r as any,
              message: notifMessage,
              channel: "IN_APP",
              status: "SENT"
            }
          });
        }
      }

      try {
        await wsManager.broadcast("expense_created", {
          expenseId: expense.id,
          expenseNumber: expense.expenseNumber,
          status: expense.status,
          amount: expense.amount.toNumber(),
          currency: expense.currency,
          submittedBy: dbUser.name
        });
        if (rolesToNotify.length > 0) {
          await wsManager.broadcastToRoles(rolesToNotify as any, "notification", {
            message: notifMessage
          });
        }
      } catch (wsErr) {
        console.warn("WebSocket notification error:", wsErr);
      }

      return reply.status(201).send({
        success: true,
        message:
          initialStatus === "AUTO_APPROVED"
            ? "Expense automatically approved and recorded in official ledger."
            : "Expense submitted and routed to verification queue.",
        expense,
        ledgerEntry
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to process expense submission" });
    }
  });

  // GET /expenses - List expenses with filters and pagination
  fastify.get("/", generalPreHandler, async (request, reply) => {
    const user = request.user as { id: string; roles: string[] };
    const query = (request.query as any) || {};

    const page = parseInt(query.page || "1", 10);
    const limit = Math.min(parseInt(query.limit || "20", 10), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {};

    if (query.status && query.status !== "ALL") {
      where.status = query.status;
    }
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }
    if (query.department) {
      where.department = query.department;
    }
    if (query.submittedById) {
      where.submittedById = query.submittedById;
    }
    if (query.currency) {
      where.currency = query.currency;
    }
    if (query.minAmount || query.maxAmount) {
      where.amount = {};
      if (query.minAmount) where.amount.gte = new Prisma.Decimal(query.minAmount);
      if (query.maxAmount) where.amount.lte = new Prisma.Decimal(query.maxAmount);
    }
    if (query.startDate && query.endDate) {
      where.expenseDate = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate)
      };
    }
    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { expenseNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { vendorName: { contains: q, mode: "insensitive" } },
        { invoiceNumber: { contains: q, mode: "insensitive" } }
      ];
    }

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true } },
          submittedBy: { select: { id: true, name: true, email: true, roles: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          rejectedBy: { select: { id: true, name: true, email: true } },
          ledgerEntry: { select: { id: true, ledgerNumber: true, approvedAt: true } },
          _count: { select: { attachments: true } }
        }
      })
    ]);

    return {
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  });

  // GET /expenses/my - Expenses submitted by current user
  fastify.get("/my", generalPreHandler, async (request, reply) => {
    const user = request.user as { id: string };
    const query = (request.query as any) || {};

    const where: Prisma.ExpenseWhereInput = {
      submittedById: user.id
    };

    if (query.status && query.status !== "ALL") {
      where.status = query.status;
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        ledgerEntry: true,
        attachments: true
      }
    });

    return { expenses };
  });

  // GET /expenses/:id - Expense Detail View
  fastify.get("/:id", generalPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        category: true,
        submittedBy: { select: { id: true, name: true, email: true, roles: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        rejectedBy: { select: { id: true, name: true, email: true } },
        attachments: {
          include: {
            uploadedBy: { select: { id: true, name: true } }
          }
        },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: "desc" }
        },
        ledgerEntry: true,
        auditLogs: {
          include: {
            actor: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!expense) return reply.status(404).send({ error: "Expense not found" });

    return expense;
  });

  // POST /expenses/:id/attachments - Add Attachment to Expense
  fastify.post("/:id/attachments", generalPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };
    const body = (request.body || {}) as any;

    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) return reply.status(404).send({ error: "Expense not found" });

    if (!body.fileName || !body.fileUrl) {
      return reply.status(400).send({ error: "fileName and fileUrl are required" });
    }

    const attachment = await prisma.expenseAttachment.create({
      data: {
        expenseId: id,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        mimeType: body.mimeType || "application/octet-stream",
        fileSize: body.fileSize || 0,
        documentType: body.documentType || "RECEIPT",
        uploadedById: user.id
      }
    });

    await prisma.expenseAuditLog.create({
      data: {
        expenseId: id,
        actorId: user.id,
        action: "ATTACHMENT_ADDED",
        metadata: { fileName: body.fileName, documentType: body.documentType }
      }
    });

    return attachment;
  });

  // -------------------------------------------------------------------------
  // 3. SUPERADMIN APPROVAL QUEUE & ACTIONS
  // -------------------------------------------------------------------------

  // GET /expenses/pending - Superadmin Queue
  fastify.get("/pending", superadminPreHandler, async (request, reply) => {
    const expenses = await prisma.expense.findMany({
      where: { status: "PENDING_VERIFICATION" },
      include: {
        category: true,
        submittedBy: { select: { id: true, name: true, email: true, roles: true } },
        attachments: true
      },
      orderBy: { createdAt: "asc" }
    });

    const activeThreshold = await getActiveThreshold();

    return {
      count: expenses.length,
      threshold: activeThreshold ? activeThreshold.amount.toNumber() : 5000,
      thresholdCurrency: activeThreshold?.currency || "ZMW",
      pendingExpenses: expenses
    };
  });

  // POST /expenses/:id/approve - Superadmin Approve
  fastify.post("/:id/approve", superadminPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };
    const { notes } = ExpenseApproveSchema.parse(request.body || {});

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true }
    });
    if (!dbUser) return reply.status(401).send({ error: "User not found" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        return ExpenseApprovalEngine.superadminApprove(tx, id, dbUser, notes);
      });

      // Notification to Submitter
      const notifMessage = `Your expense ${result.updatedExpense.expenseNumber} has been APPROVED by Superadmin.`;
      await prisma.notification.create({
        data: {
          userId: result.updatedExpense.submittedById,
          message: notifMessage,
          channel: "IN_APP",
          status: "SENT"
        }
      });

      try {
        await wsManager.broadcast("expense_approved", {
          expenseId: result.updatedExpense.id,
          expenseNumber: result.updatedExpense.expenseNumber,
          approvedBy: dbUser.name,
          ledgerNumber: result.ledgerEntry.ledgerNumber
        });
      } catch (e) {}

      return {
        success: true,
        message: "Expense successfully approved by Superadmin and recorded in official ledger.",
        expense: result.updatedExpense,
        ledgerEntry: result.ledgerEntry
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to approve expense" });
    }
  });

  // POST /expenses/:id/reject - Superadmin Reject
  fastify.post("/:id/reject", superadminPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };
    const { reason } = ExpenseRejectSchema.parse(request.body);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true }
    });
    if (!dbUser) return reply.status(401).send({ error: "User not found" });

    try {
      const updatedExpense = await prisma.$transaction(async (tx) => {
        return ExpenseApprovalEngine.superadminReject(tx, id, dbUser, reason);
      });

      // Notification to Submitter
      const notifMessage = `Your expense ${updatedExpense.expenseNumber} was REJECTED by Superadmin. Reason: ${reason}`;
      await prisma.notification.create({
        data: {
          userId: updatedExpense.submittedById,
          message: notifMessage,
          channel: "IN_APP",
          status: "SENT"
        }
      });

      try {
        await wsManager.broadcast("expense_rejected", {
          expenseId: updatedExpense.id,
          expenseNumber: updatedExpense.expenseNumber,
          rejectedBy: dbUser.name,
          reason
        });
      } catch (e) {}

      return {
        success: true,
        message: "Expense successfully rejected with documented reason.",
        expense: updatedExpense
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to reject expense" });
    }
  });

  // -------------------------------------------------------------------------
  // 4. ACCOUNTANT VERIFICATION QUEUE (ADMIN-CREATED EXPENSES)
  // -------------------------------------------------------------------------

  // GET /expenses/accountant-pending - Accountant Queue for ADMIN-created expenses
  fastify.get("/accountant-pending", accountantPreHandler, async (request, reply) => {
    const user = request.user as { id: string };

    // Fetch pending expenses created by users who have the ADMIN role
    const expenses = await prisma.expense.findMany({
      where: {
        status: "PENDING_VERIFICATION",
        submittedBy: {
          roles: { has: "ADMIN" as any }
        }
      },
      include: {
        category: true,
        submittedBy: { select: { id: true, name: true, email: true, roles: true } },
        attachments: true
      },
      orderBy: { createdAt: "asc" }
    });

    const activeThreshold = await getActiveThreshold();

    return {
      count: expenses.length,
      threshold: activeThreshold ? activeThreshold.amount.toNumber() : 5000,
      thresholdCurrency: activeThreshold?.currency || "ZMW",
      pendingExpenses: expenses
    };
  });

  // POST /expenses/:id/accountant-approve - Accountant Approves ADMIN expense
  fastify.post("/:id/accountant-approve", accountantPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };
    const { notes } = ExpenseApproveSchema.parse(request.body || {});

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, roles: true }
    });
    if (!dbUser) return reply.status(401).send({ error: "User not found" });

    try {
      const result = await prisma.$transaction(async (tx) => {
        return ExpenseApprovalEngine.accountantApprove(tx, id, {
          id: dbUser.id,
          name: dbUser.name,
          roles: dbUser.roles as string[]
        }, notes);
      });

      // Notify the ADMIN submitter
      const notifMessage = `Your expense ${result.updatedExpense.expenseNumber} has been APPROVED by Accountant ${dbUser.name}.`;
      await prisma.notification.create({
        data: {
          userId: result.updatedExpense.submittedById,
          message: notifMessage,
          channel: "IN_APP",
          status: "SENT"
        }
      });

      try {
        await wsManager.broadcast("expense_approved", {
          expenseId: result.updatedExpense.id,
          expenseNumber: result.updatedExpense.expenseNumber,
          approvedBy: dbUser.name,
          ledgerNumber: result.ledgerEntry.ledgerNumber
        });
      } catch (e) {}

      return {
        success: true,
        message: "Expense successfully verified, approved and posted to official expense ledger.",
        expense: result.updatedExpense,
        ledgerEntry: result.ledgerEntry
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to approve expense" });
    }
  });

  // POST /expenses/:id/accountant-reject - Accountant Rejects ADMIN expense
  fastify.post("/:id/accountant-reject", accountantPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };
    const { reason } = ExpenseRejectSchema.parse(request.body);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true }
    });
    if (!dbUser) return reply.status(401).send({ error: "User not found" });

    try {
      const updatedExpense = await prisma.$transaction(async (tx) => {
        return ExpenseApprovalEngine.accountantReject(tx, id, dbUser, reason);
      });

      // Notify the ADMIN submitter
      const notifMessage = `Your expense ${updatedExpense.expenseNumber} was REJECTED by Accountant. Reason: ${reason}`;
      await prisma.notification.create({
        data: {
          userId: updatedExpense.submittedById,
          message: notifMessage,
          channel: "IN_APP",
          status: "SENT"
        }
      });

      try {
        await wsManager.broadcast("expense_rejected", {
          expenseId: updatedExpense.id,
          expenseNumber: updatedExpense.expenseNumber,
          rejectedBy: dbUser.name,
          reason
        });
      } catch (e) {}

      return {
        success: true,
        message: "Expense successfully rejected with documented reason.",
        expense: updatedExpense
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to reject expense" });
    }
  });

  // -------------------------------------------------------------------------
  // 5. THRESHOLD SETTINGS & HISTORY
  // -------------------------------------------------------------------------

  // GET /expenses/settings/threshold - View Active Threshold (All Authorized Roles)
  fastify.get("/settings/threshold", generalPreHandler, async (request, reply) => {
    const active = await getActiveThreshold();
    return {
      activeThreshold: active
        ? {
            id: active.id,
            amount: active.amount.toNumber(),
            currency: active.currency,
            effectiveFrom: active.effectiveFrom,
            isActive: active.isActive,
            createdByName: active.createdBy?.name || "System",
            changeReason: active.changeReason
          }
        : {
            amount: 5000,
            currency: "ZMW",
            isActive: true
          }
    };
  });

  // PUT /expenses/settings/threshold - Update Threshold (SUPERADMIN ONLY)
  fastify.put("/settings/threshold", superadminPreHandler, async (request, reply) => {
    const user = request.user as { id: string };
    const { amount, currency, changeReason } = ExpenseThresholdUpdateSchema.parse(request.body);

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return reply.status(401).send({ error: "User not found" });

    const newAmount = new Prisma.Decimal(amount);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Deactivate current active threshold
      await tx.expenseThreshold.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // 2. Create new active threshold
      const newThreshold = await tx.expenseThreshold.create({
        data: {
          amount: newAmount,
          currency: currency || "ZMW",
          effectiveFrom: new Date(),
          isActive: true,
          createdById: user.id,
          changeReason
        },
        include: { createdBy: { select: { id: true, name: true, email: true } } }
      });

      // 3. Log in ExpenseAuditLog
      await tx.expenseAuditLog.create({
        data: {
          actorId: user.id,
          action: "THRESHOLD_CHANGED",
          newStatus: `${newAmount.toString()} ${currency || "ZMW"}`,
          metadata: {
            newThresholdId: newThreshold.id,
            amount: newAmount.toNumber(),
            currency: currency || "ZMW",
            changeReason
          }
        }
      });

      return newThreshold;
    });

    const notifMessage = `Expense auto-approval threshold updated to ${result.currency} ${result.amount.toString()} by Superadmin.`;
    const targetRoles = ["ADMIN", "ACCOUNTANT", "SUPERADMIN"];
    for (const r of targetRoles) {
      await prisma.notification.create({
        data: {
          role: r as any,
          message: notifMessage,
          channel: "IN_APP",
          status: "SENT"
        }
      });
    }

    try {
      await wsManager.broadcastToRoles(targetRoles as any, "notification", { message: notifMessage });
      await wsManager.broadcast("threshold_updated", {
        amount: result.amount.toNumber(),
        currency: result.currency
      });
    } catch (e) {}

    return {
      success: true,
      message: "Expense auto-approval threshold successfully updated.",
      threshold: result
    };
  });

  // GET /expenses/settings/threshold/history - Threshold Audit History
  fastify.get("/settings/threshold/history", generalPreHandler, async (request, reply) => {
    const history = await prisma.expenseThreshold.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } }
      }
    });

    return { history };
  });

  // -------------------------------------------------------------------------
  // 6. EXPENSE CATEGORIES
  // -------------------------------------------------------------------------

  // GET /expenses/categories - List Categories
  fastify.get("/categories", generalPreHandler, async (request, reply) => {
    const { activeOnly } = (request.query as any) || {};
    const where: Prisma.ExpenseCategoryWhereInput = {};
    if (activeOnly === "true") {
      where.isActive = true;
    }

    const categories = await prisma.expenseCategory.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { expenses: true } }
      }
    });

    return { categories };
  });

  // POST /expenses/categories - Create Category (Superadmin or Admin)
  fastify.post("/categories", generalPreHandler, async (request, reply) => {
    const user = request.user as { id: string };
    const { name, description } = ExpenseCategoryCreateSchema.parse(request.body);

    const existing = await prisma.expenseCategory.findUnique({ where: { name } });
    if (existing) {
      return reply.status(400).send({ error: `Category "${name}" already exists` });
    }

    const category = await prisma.expenseCategory.create({
      data: { name, description, isActive: true }
    });

    await prisma.expenseAuditLog.create({
      data: {
        actorId: user.id,
        action: "CATEGORY_CREATED",
        metadata: { categoryId: category.id, name }
      }
    });

    return reply.status(201).send(category);
  });

  // PATCH /expenses/categories/:id - Update Category
  fastify.patch("/categories/:id", superadminPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };
    const data = ExpenseCategoryUpdateSchema.parse(request.body);

    const category = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!category) return reply.status(404).send({ error: "Category not found" });

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data
    });

    await prisma.expenseAuditLog.create({
      data: {
        actorId: user.id,
        action: "CATEGORY_UPDATED",
        metadata: { categoryId: id, updates: data }
      }
    });

    return updated;
  });

  // PATCH /expenses/categories/:id/status - Toggle Status
  fastify.patch("/categories/:id/status", superadminPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };

    const category = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!category) return reply.status(404).send({ error: "Category not found" });

    const updated = await prisma.expenseCategory.update({
      where: { id },
      data: { isActive: !category.isActive }
    });

    await prisma.expenseAuditLog.create({
      data: {
        actorId: user.id,
        action: "CATEGORY_STATUS_TOGGLED",
        previousStatus: String(category.isActive),
        newStatus: String(updated.isActive),
        metadata: { categoryId: id, name: category.name }
      }
    });

    return updated;
  });

  // DELETE /expenses/categories/:id - Delete Category (Strictly blocked if referenced)
  fastify.delete("/categories/:id", superadminPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { id: string };

    const category = await prisma.expenseCategory.findUnique({
      where: { id },
      include: { _count: { select: { expenses: true } } }
    });

    if (!category) return reply.status(404).send({ error: "Category not found" });

    if (category._count.expenses > 0) {
      return reply.status(400).send({
        error: `Cannot delete category "${category.name}" because it is referenced by ${category._count.expenses} financial expense records. You may deactivate it instead.`
      });
    }

    await prisma.expenseCategory.delete({ where: { id } });

    await prisma.expenseAuditLog.create({
      data: {
        actorId: user.id,
        action: "CATEGORY_DELETED",
        metadata: { categoryId: id, name: category.name }
      }
    });

    return { success: true, message: `Category "${category.name}" deleted.` };
  });

  // -------------------------------------------------------------------------
  // 7. OFFICIAL EXPENSE LEDGER
  // -------------------------------------------------------------------------

  // GET /expenses/ledger - Official Expense Ledger (ONLY approved expenses)
  fastify.get("/ledger", generalPreHandler, async (request, reply) => {
    const query = (request.query as any) || {};

    const page = parseInt(query.page || "1", 10);
    const limit = Math.min(parseInt(query.limit || "20", 10), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseLedgerWhereInput = {};

    if (query.categoryName) {
      where.categoryName = query.categoryName;
    }
    if (query.department) {
      where.department = query.department;
    }
    if (query.approvalMethod) {
      where.approvalMethod = query.approvalMethod;
    }
    if (query.currency) {
      where.currency = query.currency;
    }
    if (query.startDate && query.endDate) {
      where.expenseDate = {
        gte: new Date(query.startDate),
        lte: new Date(query.endDate)
      };
    }
    if (query.search && query.search.trim()) {
      const q = query.search.trim();
      where.OR = [
        { ledgerNumber: { contains: q, mode: "insensitive" } },
        { expenseNumber: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { vendorName: { contains: q, mode: "insensitive" } },
        { submittedByName: { contains: q, mode: "insensitive" } },
        { approvedByName: { contains: q, mode: "insensitive" } }
      ];
    }

    const [total, entries, totalAgg] = await Promise.all([
      prisma.expenseLedger.count({ where }),
      prisma.expenseLedger.findMany({
        where,
        skip,
        take: limit,
        orderBy: { approvedAt: "desc" },
        include: {
          expense: {
            include: {
              attachments: true
            }
          }
        }
      }),
      prisma.expenseLedger.aggregate({
        where,
        _sum: { amount: true }
      })
    ]);

    return {
      entries,
      totalAmount: totalAgg._sum.amount?.toNumber() || 0,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  });

  // -------------------------------------------------------------------------
  // 8. AUDIT LOGS
  // -------------------------------------------------------------------------

  // GET /expenses/audit-logs - View Expense Audit Logs
  fastify.get("/audit-logs", superadminPreHandler, async (request, reply) => {
    const { expenseId, actorId, action, page = "1", limit = "50" } = (request.query as any) || {};

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ExpenseAuditLogWhereInput = {};
    if (expenseId) where.expenseId = expenseId;
    if (actorId) where.actorId = actorId;
    if (action) where.action = action;

    const [total, logs] = await Promise.all([
      prisma.expenseAuditLog.count({ where }),
      prisma.expenseAuditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, name: true, email: true, roles: true } },
          expense: { select: { id: true, expenseNumber: true, title: true, amount: true, currency: true } }
        }
      })
    ]);

    return {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  });
}
