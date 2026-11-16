import { prisma } from "../prisma";
import { Prisma } from "../generated/client";
import { wsManager } from "../websocket/manager";

export async function generateExpenseNumber(): Promise<string> {
  const last = await prisma.expense.findFirst({
    orderBy: { expenseNumber: "desc" }
  });
  let next = 1;
  if (last?.expenseNumber) {
    const match = last.expenseNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `EXP-${String(next).padStart(6, "0")}`;
}

export async function generateLedgerNumber(): Promise<string> {
  const last = await prisma.expenseLedger.findFirst({
    orderBy: { ledgerNumber: "desc" }
  });
  let next = 1;
  if (last?.ledgerNumber) {
    const match = last.ledgerNumber.match(/\d+/);
    if (match) next = parseInt(match[0], 10) + 1;
  }
  return `EL-${String(next).padStart(6, "0")}`;
}

export async function getActiveThreshold() {
  let threshold = await prisma.expenseThreshold.findFirst({
    where: { isActive: true },
    orderBy: { effectiveFrom: "desc" },
    include: { createdBy: { select: { id: true, name: true, email: true } } }
  });

  if (!threshold) {
    // Fallback baseline: 5,000 ZMW
    const adminUser = await prisma.user.findFirst({
      where: { roles: { has: "SUPERADMIN" as any } }
    });
    if (adminUser) {
      threshold = await prisma.expenseThreshold.create({
        data: {
          amount: new Prisma.Decimal(5000),
          currency: "ZMW",
          effectiveFrom: new Date(),
          isActive: true,
          createdById: adminUser.id,
          changeReason: "System default fallback threshold"
        },
        include: { createdBy: { select: { id: true, name: true, email: true } } }
      });
    }
  }

  return threshold;
}

export class ExpenseApprovalEngine {
  /**
   * Evaluates submission when an expense is initially created.
   * - ACCOUNTANT: if amount <= active threshold -> AUTO_APPROVED + ExpenseLedger entry.
   *               if amount > active threshold -> PENDING_VERIFICATION (Superadmin queue).
   * - ADMIN: ALWAYS PENDING_VERIFICATION (Accountant queue).
   * - SUPERADMIN: PENDING_VERIFICATION (No self-approval; requires independent approval).
   */
  static async processSubmission(
    tx: Prisma.TransactionClient,
    expenseData: {
      title: string;
      description: string;
      categoryId: string;
      amount: Prisma.Decimal;
      currency: string;
      expenseDate: Date;
      department?: string | null;
      costCentre?: string | null;
      vendorName?: string | null;
      vendorContact?: string | null;
      invoiceNumber?: string | null;
      paymentMethod: string;
      paymentReference?: string | null;
      paymentStatus: any;
      attachments?: Array<{
        fileName: string;
        fileUrl: string;
        mimeType: string;
        fileSize: number;
        documentType?: string;
      }>;
    },
    creator: { id: string; name: string; roles: string[] }
  ) {
    const activeThreshold = await getActiveThreshold();
    const thresholdAmount = activeThreshold ? activeThreshold.amount : new Prisma.Decimal(5000);
    const thresholdCurrency = activeThreshold ? activeThreshold.currency : "ZMW";

    const expenseNumber = await generateExpenseNumber();
    const isAccountant = creator.roles.includes("ACCOUNTANT") && !creator.roles.includes("SUPERADMIN") && !creator.roles.includes("ULTRA_ADMIN");
    const isAdmin = creator.roles.includes("ADMIN") && !creator.roles.includes("SUPERADMIN") && !creator.roles.includes("ULTRA_ADMIN");

    let initialStatus: "AUTO_APPROVED" | "PENDING_VERIFICATION" = "PENDING_VERIFICATION";
    let approvalMethod: "AUTO" | null = null;
    let approvedAt: Date | null = null;

    // Accountant rule: amount <= threshold => AUTO_APPROVED
    if (isAccountant && expenseData.amount.lte(thresholdAmount)) {
      initialStatus = "AUTO_APPROVED";
      approvalMethod = "AUTO";
      approvedAt = new Date();
    }

    // 1. Create Expense record
    const createdExpense = await tx.expense.create({
      data: {
        expenseNumber,
        title: expenseData.title,
        description: expenseData.description,
        categoryId: expenseData.categoryId,
        amount: expenseData.amount,
        currency: expenseData.currency,
        expenseDate: expenseData.expenseDate,
        department: expenseData.department || null,
        costCentre: expenseData.costCentre || null,
        vendorName: expenseData.vendorName || null,
        vendorContact: expenseData.vendorContact || null,
        invoiceNumber: expenseData.invoiceNumber || null,
        paymentMethod: expenseData.paymentMethod,
        paymentReference: expenseData.paymentReference || null,
        paymentStatus: expenseData.paymentStatus || "UNPAID",
        status: initialStatus,
        approvalMethod: approvalMethod,
        submittedById: creator.id,
        approvedById: null, // System approved, no user ID
        thresholdSnapshot: thresholdAmount,
        thresholdCurrency: thresholdCurrency,
        submittedAt: new Date(),
        approvedAt: approvedAt,
        attachments: {
          create: (expenseData.attachments || []).map((att) => ({
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            mimeType: att.mimeType,
            fileSize: att.fileSize,
            documentType: att.documentType || "RECEIPT",
            uploadedById: creator.id
          }))
        }
      },
      include: {
        category: true,
        attachments: true,
        submittedBy: { select: { id: true, name: true, email: true, roles: true } }
      }
    });

    // 2. If AUTO_APPROVED, immediately record in ExpenseLedger and Approval records
    let ledgerEntry: any = null;
    if (initialStatus === "AUTO_APPROVED") {
      const ledgerNumber = await generateLedgerNumber();
      ledgerEntry = await tx.expenseLedger.create({
        data: {
          ledgerNumber,
          expenseId: createdExpense.id,
          expenseNumber: createdExpense.expenseNumber,
          expenseDate: createdExpense.expenseDate,
          categoryName: createdExpense.category.name,
          description: createdExpense.description,
          vendorName: createdExpense.vendorName,
          amount: createdExpense.amount,
          currency: createdExpense.currency,
          department: createdExpense.department,
          paymentMethod: createdExpense.paymentMethod,
          submittedByName: creator.name,
          submittedById: creator.id,
          approvedByName: "SYSTEM",
          approvedById: null,
          approvalMethod: "AUTO",
          approvedAt: approvedAt!
        }
      });

      await tx.expenseApproval.create({
        data: {
          expenseId: createdExpense.id,
          approverId: null,
          action: "AUTO_APPROVED",
          approvalLevel: "SYSTEM",
          reason: `Auto-approved within active threshold (${thresholdAmount.toString()} ${thresholdCurrency})`
        }
      });

      await tx.expenseAuditLog.create({
        data: {
          expenseId: createdExpense.id,
          actorId: creator.id,
          action: "AUTO_APPROVED",
          previousStatus: "DRAFT",
          newStatus: "AUTO_APPROVED",
          metadata: {
            expenseNumber,
            amount: expenseData.amount.toNumber(),
            threshold: thresholdAmount.toNumber(),
            currency: expenseData.currency,
            ledgerNumber
          }
        }
      });
    } else {
      // PENDING_VERIFICATION Audit Log
      await tx.expenseAuditLog.create({
        data: {
          expenseId: createdExpense.id,
          actorId: creator.id,
          action: "SUBMITTED",
          previousStatus: "DRAFT",
          newStatus: "PENDING_VERIFICATION",
          metadata: {
            expenseNumber,
            amount: expenseData.amount.toNumber(),
            threshold: thresholdAmount.toNumber(),
            creatorRoles: creator.roles,
            reason: isAccountant
              ? "Exceeds auto-approval threshold; routed to Superadmin"
              : isAdmin
              ? "Admin submission; routed to Accountant verification queue"
              : "Submission pending independent verification"
          }
        }
      });
    }

    return { expense: createdExpense, ledgerEntry, initialStatus };
  }

  /**
   * Superadmin Approves an Expense (e.g. above-threshold Accountant expense)
   */
  static async superadminApprove(
    tx: Prisma.TransactionClient,
    expenseId: string,
    actor: { id: string; name: string },
    notes?: string
  ) {
    const expense = await tx.expense.findUnique({
      where: { id: expenseId },
      include: {
        category: true,
        submittedBy: { select: { id: true, name: true, email: true } },
        ledgerEntry: true
      }
    });

    if (!expense) throw new Error("Expense not found");

    if (expense.status === "APPROVED" || expense.status === "AUTO_APPROVED") {
      throw new Error(`Expense ${expense.expenseNumber} is already approved.`);
    }

    if (expense.status !== "PENDING_VERIFICATION") {
      throw new Error(`Only expenses in PENDING_VERIFICATION status can be approved (current: ${expense.status}).`);
    }

    // Four-Eyes / Separation of Duties: Submitter cannot approve own expense
    if (expense.submittedById === actor.id) {
      throw new Error("Separation of Duties Violation: You submitted this expense and cannot approve your own submission.");
    }

    const approvedAt = new Date();
    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: "APPROVED",
        approvalMethod: "SUPERADMIN",
        approvedById: actor.id,
        approvedAt
      }
    });

    // Create unique ledger entry (idempotent check)
    let ledgerEntry = expense.ledgerEntry;
    if (!ledgerEntry) {
      const ledgerNumber = await generateLedgerNumber();
      ledgerEntry = await tx.expenseLedger.create({
        data: {
          ledgerNumber,
          expenseId: expense.id,
          expenseNumber: expense.expenseNumber,
          expenseDate: expense.expenseDate,
          categoryName: expense.category.name,
          description: expense.description,
          vendorName: expense.vendorName,
          amount: expense.amount,
          currency: expense.currency,
          department: expense.department,
          paymentMethod: expense.paymentMethod,
          submittedByName: expense.submittedBy.name,
          submittedById: expense.submittedById,
          approvedByName: actor.name,
          approvedById: actor.id,
          approvalMethod: "SUPERADMIN",
          approvedAt
        }
      });
    }

    await tx.expenseApproval.create({
      data: {
        expenseId: expense.id,
        approverId: actor.id,
        action: "APPROVED",
        approvalLevel: "SUPERADMIN",
        reason: notes || "Approved by Superadmin"
      }
    });

    await tx.expenseAuditLog.create({
      data: {
        expenseId: expense.id,
        actorId: actor.id,
        action: "SUPERADMIN_APPROVED",
        previousStatus: expense.status,
        newStatus: "APPROVED",
        metadata: {
          expenseNumber: expense.expenseNumber,
          amount: expense.amount.toNumber(),
          approverId: actor.id,
          ledgerNumber: ledgerEntry.ledgerNumber,
          notes
        }
      }
    });

    return { updatedExpense, ledgerEntry };
  }

  /**
   * Superadmin Rejects an Expense
   */
  static async superadminReject(
    tx: Prisma.TransactionClient,
    expenseId: string,
    actor: { id: string; name: string },
    reason: string
  ) {
    if (!reason || !reason.trim()) {
      throw new Error("A non-empty rejection reason is required.");
    }

    const expense = await tx.expense.findUnique({
      where: { id: expenseId },
      include: { submittedBy: { select: { id: true, name: true, email: true } } }
    });

    if (!expense) throw new Error("Expense not found");

    if (expense.status === "APPROVED" || expense.status === "AUTO_APPROVED") {
      throw new Error(`Cannot reject an already approved expense ${expense.expenseNumber}.`);
    }

    if (expense.status !== "PENDING_VERIFICATION") {
      throw new Error(`Only expenses in PENDING_VERIFICATION status can be rejected (current: ${expense.status}).`);
    }

    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: "REJECTED",
        rejectedById: actor.id,
        rejectionReason: reason.trim(),
        rejectedAt: new Date()
      }
    });

    await tx.expenseApproval.create({
      data: {
        expenseId: expense.id,
        approverId: actor.id,
        action: "REJECTED",
        approvalLevel: "SUPERADMIN",
        reason: reason.trim()
      }
    });

    await tx.expenseAuditLog.create({
      data: {
        expenseId: expense.id,
        actorId: actor.id,
        action: "SUPERADMIN_REJECTED",
        previousStatus: expense.status,
        newStatus: "REJECTED",
        metadata: {
          expenseNumber: expense.expenseNumber,
          amount: expense.amount.toNumber(),
          reason: reason.trim()
        }
      }
    });

    return updatedExpense;
  }

  /**
   * Accountant Approves an ADMIN-created expense
   */
  static async accountantApprove(
    tx: Prisma.TransactionClient,
    expenseId: string,
    actor: { id: string; name: string; roles: string[] },
    notes?: string
  ) {
    const expense = await tx.expense.findUnique({
      where: { id: expenseId },
      include: {
        category: true,
        submittedBy: { select: { id: true, name: true, email: true, roles: true } },
        ledgerEntry: true
      }
    });

    if (!expense) throw new Error("Expense not found");

    if (expense.status === "APPROVED" || expense.status === "AUTO_APPROVED") {
      throw new Error(`Expense ${expense.expenseNumber} is already approved.`);
    }

    if (expense.status !== "PENDING_VERIFICATION") {
      throw new Error(`Only expenses in PENDING_VERIFICATION status can be approved (current: ${expense.status}).`);
    }

    // Four-Eyes / Separation of Duties: Submitter cannot approve own expense
    if (expense.submittedById === actor.id) {
      throw new Error("Separation of Duties Violation: You submitted this expense and cannot approve your own submission.");
    }

    const approvedAt = new Date();
    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: "APPROVED",
        approvalMethod: "ACCOUNTANT",
        approvedById: actor.id,
        approvedAt
      }
    });

    // Create unique ledger entry (idempotent check)
    let ledgerEntry = expense.ledgerEntry;
    if (!ledgerEntry) {
      const ledgerNumber = await generateLedgerNumber();
      ledgerEntry = await tx.expenseLedger.create({
        data: {
          ledgerNumber,
          expenseId: expense.id,
          expenseNumber: expense.expenseNumber,
          expenseDate: expense.expenseDate,
          categoryName: expense.category.name,
          description: expense.description,
          vendorName: expense.vendorName,
          amount: expense.amount,
          currency: expense.currency,
          department: expense.department,
          paymentMethod: expense.paymentMethod,
          submittedByName: expense.submittedBy.name,
          submittedById: expense.submittedById,
          approvedByName: actor.name,
          approvedById: actor.id,
          approvalMethod: "ACCOUNTANT",
          approvedAt
        }
      });
    }

    await tx.expenseApproval.create({
      data: {
        expenseId: expense.id,
        approverId: actor.id,
        action: "APPROVED",
        approvalLevel: "ACCOUNTANT",
        reason: notes || "Verified and approved by Accountant"
      }
    });

    await tx.expenseAuditLog.create({
      data: {
        expenseId: expense.id,
        actorId: actor.id,
        action: "ACCOUNTANT_APPROVED",
        previousStatus: expense.status,
        newStatus: "APPROVED",
        metadata: {
          expenseNumber: expense.expenseNumber,
          amount: expense.amount.toNumber(),
          approverId: actor.id,
          ledgerNumber: ledgerEntry.ledgerNumber,
          notes
        }
      }
    });

    return { updatedExpense, ledgerEntry };
  }

  /**
   * Accountant Rejects an ADMIN-created expense
   */
  static async accountantReject(
    tx: Prisma.TransactionClient,
    expenseId: string,
    actor: { id: string; name: string },
    reason: string
  ) {
    if (!reason || !reason.trim()) {
      throw new Error("A non-empty rejection reason is required.");
    }

    const expense = await tx.expense.findUnique({
      where: { id: expenseId },
      include: { submittedBy: { select: { id: true, name: true, email: true } } }
    });

    if (!expense) throw new Error("Expense not found");

    if (expense.status === "APPROVED" || expense.status === "AUTO_APPROVED") {
      throw new Error(`Cannot reject an already approved expense ${expense.expenseNumber}.`);
    }

    if (expense.status !== "PENDING_VERIFICATION") {
      throw new Error(`Only expenses in PENDING_VERIFICATION status can be rejected (current: ${expense.status}).`);
    }

    const updatedExpense = await tx.expense.update({
      where: { id: expenseId },
      data: {
        status: "REJECTED",
        rejectedById: actor.id,
        rejectionReason: reason.trim(),
        rejectedAt: new Date()
      }
    });

    await tx.expenseApproval.create({
      data: {
        expenseId: expense.id,
        approverId: actor.id,
        action: "REJECTED",
        approvalLevel: "ACCOUNTANT",
        reason: reason.trim()
      }
    });

    await tx.expenseAuditLog.create({
      data: {
        expenseId: expense.id,
        actorId: actor.id,
        action: "ACCOUNTANT_REJECTED",
        previousStatus: expense.status,
        newStatus: "REJECTED",
        metadata: {
          expenseNumber: expense.expenseNumber,
          amount: expense.amount.toNumber(),
          reason: reason.trim()
        }
      }
    });

    return updatedExpense;
  }
}
