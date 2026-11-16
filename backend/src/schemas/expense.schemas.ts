import { z } from "zod";

export const ExpenseCreateSchema = z.object({
  title: z.string().min(2, "Expense title must be at least 2 characters").max(200),
  description: z.string().min(2, "Description is required"),
  categoryId: z.string().uuid("Invalid category ID format"),
  amount: z.number().positive("Expense amount must be greater than zero"),
  currency: z.string().min(3).max(5).default("ZMW"),
  expenseDate: z.string().or(z.date()),
  department: z.string().optional().nullable(),
  costCentre: z.string().optional().nullable(),
  vendorName: z.string().optional().nullable(),
  vendorContact: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "COMPANY_CARD", "OTHER"]).default("BANK_TRANSFER"),
  paymentReference: z.string().optional().nullable(),
  paymentStatus: z.enum(["UNPAID", "PAID", "PARTIALLY_PAID"]).default("UNPAID"),
  attachments: z.array(
    z.object({
      fileName: z.string(),
      fileUrl: z.string(),
      mimeType: z.string(),
      fileSize: z.number().int().nonnegative(),
      documentType: z.string().default("RECEIPT")
    })
  ).optional().default([])
});

export const ExpenseRejectSchema = z.object({
  reason: z.string().min(3, "Rejection reason must be at least 3 characters")
});

export const ExpenseApproveSchema = z.object({
  notes: z.string().optional()
});

export const ExpenseThresholdUpdateSchema = z.object({
  amount: z.number().positive("Threshold amount must be greater than zero"),
  currency: z.string().min(3).max(5).default("ZMW"),
  changeReason: z.string().min(3, "Change reason must be at least 3 characters")
});

export const ExpenseCategoryCreateSchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters"),
  description: z.string().optional().nullable()
});

export const ExpenseCategoryUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});
