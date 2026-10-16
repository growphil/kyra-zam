import { z } from "zod";

export const CellInwardSchema = z.object({
  serialNumber : z.string().min(1).max(100),
  batchNumber  : z.string().optional().nullable(),
  voltage      : z.number().min(0).max(100),
  category     : z.string().min(1),
  cycles       : z.number().int().min(0),
});

export const PartNumberInwardSchema = z.object({
  partNumber   : z.string().min(1, "Part Number is required"),
  quantity     : z.number().int().positive("Quantity must be greater than 0"),
  batchNumber  : z.string().min(1, "Batch Number is required"),
  category     : z.string().min(1, "Category is required"),
  voltage      : z.number().min(0).max(100).default(3.2),
  cycles       : z.number().int().min(0).default(0),
  notes        : z.string().optional().nullable(),
});

export const BulkInwardBatchSchema = z.object({
  batches: z.array(PartNumberInwardSchema).min(1, "At least one batch record is required"),
});

export const PaxCreateSchema = z.object({
  paxTypeId   : z.string().min(1, "paxTypeId is required"),
  cellSerials : z.array(z.string()).min(1, "At least one cell serial is required"),
  workOrderId : z.string().optional().nullable(),
});

export const PaxTestSchema = z.object({
  result: z.enum(["pass", "fail"]),
});

export const SupervisorApproveSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().optional(),  // required if action === "reject"
  reclaimedMaterials: z.array(
    z.object({
      materialId: z.string().uuid(),
      quantity: z.number().int().positive()
    })
  ).optional()
}).refine(d => d.action !== "reject" || !!d.reason, {
  message: "Reason required when rejecting",
  path: ["reason"],
});

export const VendorSaleSchema = z.object({
  paxSerial : z.string(),
  vendorId  : z.string().min(1),
  amount    : z.number().positive(),
});

export const CustomerSaleSchema = z.object({
  paxSerial    : z.string(),
  customerName : z.string().min(1),
  amount       : z.number().positive(),
});

export const RepairSchema = z.object({
  paxSerial      : z.string(),
  fixType        : z.enum(["cell_swap", "wiring", "bms", "other"]),
  diagnosisNotes : z.string().min(1),
});

export const LoginSchema = z.object({
  email    : z.string().email(),
  password : z.string().min(8),
});

export const VendorCreateSchema = z.object({
  name       : z.string().min(1),
  contact    : z.string().optional(),
  phone      : z.string().optional(),
  email      : z.string().email().optional().or(z.literal("")),
  address    : z.string().optional(),
  category   : z.string().optional().nullable(),
  categories : z.array(z.string()).optional(),
});

export const VendorUpdateSchema = z.object({
  name       : z.string().min(1).optional(),
  contact    : z.string().optional().nullable(),
  phone      : z.string().optional().nullable(),
  email      : z.string().email().optional().or(z.literal("")).nullable(),
  address    : z.string().optional().nullable(),
  category   : z.string().optional().nullable(),
  categories : z.array(z.string()).optional(),
  isActive   : z.boolean().optional(),
});

export const ManualLinkSchema = z.object({
  serialFromFile : z.string().min(1),
  dbSerial       : z.string().min(1),
  ahValue        : z.number().positive().nullable(),
  irValue        : z.number().positive().nullable(),
});

export const ApplyCellSchema = z.object({
  cellSerial: z.string().min(1),
  machineSerial: z.string().optional(),
  batchNumber: z.string().optional().nullable(),
  voltage: z.number().optional().nullable(),
  ahValue: z.number().positive().nullable(),
  irValue: z.number().positive().nullable(),
  grade: z.string().optional().nullable(),
  qcPrediction: z.enum(["PASS", "FAIL", "HOLD", "RETEST", "UNMATCHED", "incomplete"]).optional().nullable(),
  sourceFile: z.string().optional(),
  machineId: z.string().optional().nullable(),
  machineCalibrationDate: z.string().optional().nullable(),
  machineOperator: z.string().optional().nullable(),
  ambientTemperature: z.number().optional().nullable(),
  cellTemperature: z.number().optional().nullable(),
  productionRequirementId: z.string().optional().nullable(),
});

export const UserCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(z.string()).min(1),
});

export const UserUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  roles: z.array(z.string()).min(1).optional(),
  password: z.string().min(8).optional(),
});

export const CustomerCreateSchema = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]).default("INDIVIDUAL"),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name cannot exceed 120 characters")
    .regex(/^[\p{L}\p{N}\s&.'\-\/(),]+$/u, "Name contains invalid characters"),
  contactPerson: z
    .string()
    .max(80, "Contact Person cannot exceed 80 characters")
    .regex(/^[\p{L}\s'.-]+$/u, "Contact Person can only contain letters, spaces, hyphens, apostrophes, and periods")
    .refine(val => !/\d/.test(val), "Contact Person cannot contain numbers")
    .optional()
    .nullable(),
  email: z.string().email("Invalid email address format"),
  phone: z
    .string()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^\+?[1-9]\d{6,14}$/, "Phone number must be a valid international number"),
  alternatePhone: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || /^\+?[1-9]\d{6,14}$/.test(val),
      "Alternate Phone number must be a valid international number"
    ),
  billingAddress: z.string().min(1, "Billing Address is required"),
  shippingAddress: z.string().min(1, "Shipping Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required").default("India"),
  postalCode: z.string().min(2, "Postal code is required"),
  taxGst: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(val.trim()),
      "Invalid GSTIN format (must be 15-character alphanumeric e.g. 33AATCM3839R1ZI)"
    ),
  notes: z.string().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
});

export const CustomerUpdateSchema = z.object({
  type: z.enum(["INDIVIDUAL", "BUSINESS"]).optional(),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(120, "Name cannot exceed 120 characters")
    .regex(/^[\p{L}\p{N}\s&.'\-\/(),]+$/u, "Name contains invalid characters")
    .optional(),
  contactPerson: z
    .string()
    .max(80, "Contact Person cannot exceed 80 characters")
    .regex(/^[\p{L}\s'.-]+$/u, "Contact Person can only contain letters, spaces, hyphens, apostrophes, and periods")
    .refine(val => !/\d/.test(val), "Contact Person cannot contain numbers")
    .optional()
    .nullable(),
  email: z.string().email("Invalid email address format").optional(),
  phone: z
    .string()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^\+?[1-9]\d{6,14}$/, "Phone number must be a valid international number")
    .optional(),
  alternatePhone: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || /^\+?[1-9]\d{6,14}$/.test(val),
      "Alternate Phone number must be a valid international number"
    ),
  billingAddress: z.string().min(1).optional(),
  shippingAddress: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  postalCode: z.string().min(2).optional(),
  taxGst: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(val.trim()),
      "Invalid GSTIN format (must be 15-character alphanumeric e.g. 33AATCM3839R1ZI)"
    ),
  notes: z.string().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
});

export const LeadCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Contact Name must be at least 2 characters")
    .max(80, "Contact Name cannot exceed 80 characters")
    .regex(/^[\p{L}\s'.-]+$/u, "Contact Name can only contain letters, spaces, hyphens, apostrophes, and periods")
    .refine((val) => !/\d/.test(val), "Contact Name cannot contain numbers"),
  companyName: z.string().max(120, "Company Name cannot exceed 120 characters").optional().nullable(),
  email: z.string().email("Invalid email address format"),
  phone: z
    .string()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^\+?[1-9]\d{6,14}$/, "Phone number must be a valid international number"),
  alternatePhone: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\+?[1-9]\d{6,14}$/.test(val.trim()), "Alternate phone number must be a valid international number"),
  source: z.string().min(1, "Lead Source is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  requirementSummary: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  expectedFollowUpDate: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
});

export const LeadUpdateSchema = z.object({
  name: z
    .string()
    .min(2, "Contact Name must be at least 2 characters")
    .max(80, "Contact Name cannot exceed 80 characters")
    .regex(/^[\p{L}\s'.-]+$/u, "Contact Name can only contain letters, spaces, hyphens, apostrophes, and periods")
    .refine((val) => !/\d/.test(val), "Contact Name cannot contain numbers")
    .optional(),
  companyName: z.string().max(120, "Company Name cannot exceed 120 characters").optional().nullable(),
  email: z.string().email("Invalid email address format").optional(),
  phone: z
    .string()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^\+?[1-9]\d{6,14}$/, "Phone number must be a valid international number")
    .optional(),
  alternatePhone: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || /^\+?[1-9]\d{6,14}$/.test(val.trim()), "Alternate phone number must be a valid international number"),
  source: z.string().min(1, "Lead Source is required").optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "CONVERTED", "LOST"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  requirementSummary: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  expectedFollowUpDate: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
});

export const ActivityCreateSchema = z.object({
  activityType: z.enum(["CALL", "MEETING", "FOLLOW_UP", "EMAIL", "NOTE", "TASK"]),
  subject: z.string().min(1),
  description: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

export const ActivityUpdateSchema = z.object({
  subject: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional(),
  dueDate: z.string().optional().nullable(),
  completionDate: z.string().optional().nullable(),
});

export const QuotationItemSchema = z.object({
  productRef: z.string().optional().nullable(),
  materialId: z.string().optional().nullable(),
  description: z.string().min(1, "Item description is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  discount: z.number().min(0, "Discount cannot be negative").max(100, "Discount cannot exceed 100%").default(0),
  taxRate: z.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%").default(0),
  specification: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const QuotationCreateSchema = z.object({
  customerId: z.string().uuid("Please select a valid customer"),
  leadId: z.string().uuid().optional().nullable(),
  assignedSalesUserId: z.string().uuid().optional().nullable(),
  validUntil: z.string().min(1, "Validity expiry date is required"), // expect YYYY-MM-DD
  currency: z.string().default("INR"),
  freight: z.number().nonnegative("Freight charges must be non-negative").optional().default(0),
  additionalCharges: z.number().nonnegative("Additional charges must be non-negative").default(0),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  deliveryTerms: z.string().min(1, "Delivery notes are required"),
  notes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  customerNotes: z.string().optional().nullable(),
  items: z.array(QuotationItemSchema).min(1, "At least one line item is required"),
});

export const QuotationUpdateSchema = z.object({
  assignedSalesUserId: z.string().uuid().optional().nullable(),
  validUntil: z.string().optional(),
  currency: z.string().optional(),
  freight: z.number().nonnegative().optional(),
  additionalCharges: z.number().nonnegative().optional(),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  notes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  customerNotes: z.string().optional().nullable(),
  items: z.array(QuotationItemSchema).min(1).optional(),
});

export const SalesOrderConvertSchema = z.object({
  requiredDeliveryDate: z.string().min(1),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export const SalesOrderUpdateSchema = z.object({
  requiredDeliveryDate: z.string().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignedSalesUserId: z.string().uuid().optional().nullable(),
  paymentTerms: z.string().optional(),
  deliveryTerms: z.string().optional(),
  customerNotes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
});

export const PurchaseRequestItemSchema = z.object({
  materialId: z.string().uuid(),
  requestedQuantity: z.number().int().positive(),
  requiredDate: z.string().min(1),
  specification: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const PurchaseRequestCreateSchema = z.object({
  source: z.enum(["MANUAL", "SALES_ORDER", "PRODUCTION_REQUIREMENT", "LOW_STOCK", "SERVICE"]).default("MANUAL"),
  sourceReferenceId: z.string().uuid().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  requiredDate: z.string().min(1),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(PurchaseRequestItemSchema).min(1),
});

export const PurchaseOrderItemSchema = z.object({
  materialId: z.string().uuid(),
  description: z.string().min(1),
  quantityOrdered: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().nonnegative().default(0),
  specification: z.string().optional().nullable(),
});

export const PurchaseOrderCreateSchema = z.object({
  vendorId: z.string().uuid(),
  purchaseRequestId: z.string().uuid().optional().nullable(),
  expectedDeliveryDate: z.string().min(1),
  currency: z.string().default("INR"),
  additionalCharges: z.number().nonnegative().default(0),
  paymentTerms: z.string().min(1),
  deliveryTerms: z.string().min(1),
  billingAddress: z.string().min(1),
  deliveryAddress: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z.array(PurchaseOrderItemSchema).min(1),
});

export const GoodsReceiptItemSchema = z.object({
  materialId: z.string().uuid(),
  quantityOrdered: z.number().int().nonnegative(),
  quantityReceived: z.number().int().nonnegative(),
  batchNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const GoodsReceiptCreateSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  vendorId: z.string().uuid(),
  warehouseId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(GoodsReceiptItemSchema).min(1),
});

export const WarehouseCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional().nullable(),
});

export const WarehouseLocationCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
});

export const ProductionRequirementCreateSchema = z.object({
  salesOrderId: z.string().uuid(),
  salesOrderItemId: z.string().uuid(),
  customerId: z.string().uuid(),
  productRef: z.string().optional().nullable(),
  requiredQuantity: z.number().int().positive(),
  requiredDeliveryDate: z.string(),
  priority: z.string().default("NORMAL"),
  notes: z.string().optional().nullable(),
});

export const ProductionPlanCreateSchema = z.object({
  productionRequirementId: z.string().uuid(),
  plannedStartDate: z.string(),
  plannedCompletionDate: z.string(),
  priority: z.string().default("NORMAL"),
  plannedQuantity: z.number().int().positive(),
  supervisorId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const WorkOrderCreateSchema = z.object({
  productionPlanId: z.string().uuid().optional().nullable(),
  productionRequirementId: z.string().uuid().optional().nullable(),
  salesOrderId: z.string().uuid().optional().nullable(),
  productRef: z.string().optional().nullable(),
  bomId: z.string().uuid().optional().nullable(),
  plannedQuantity: z.number().int().positive(),
  dueDate: z.string(),
  supervisorId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  operatorIds: z.array(z.string().uuid()).optional(),
});

export const QualityCheckpointCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  expectedValue: z.string().optional().nullable(),
  actualValue: z.string().optional().nullable(),
  result: z.enum(["PASS", "FAIL"]),
  notes: z.string().optional().nullable(),
});

export const QualityInspectionCreateSchema = z.object({
  workOrderId: z.string().uuid().optional().nullable(),
  paxSerial: z.string().optional().nullable(),
  inspectionType: z.enum(["IN_PROCESS", "FINAL"]),
  result: z.enum(["PASS", "FAIL", "HOLD", "RETEST"]),
  notes: z.string().optional().nullable(),
  checkpoints: z.array(QualityCheckpointCreateSchema).min(1),
});

export const DefectCreateSchema = z.object({
  workOrderId: z.string().uuid().optional().nullable(),
  paxSerial: z.string().optional().nullable(),
  inspectionId: z.string().uuid().optional().nullable(),
  defectType: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().min(1),
  rootCause: z.string().optional().nullable(),
  disposition: z.string().optional().nullable(),
  reclaimedMaterials: z.array(z.object({
    materialId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).optional().nullable(),
});

export const DispatchItemCreateSchema = z.object({
  salesOrderItemId: z.string().uuid(),
  productRef: z.string().optional().nullable(),
  quantityOrdered: z.number().int().positive(),
  quantityDispatched: z.number().int().positive(),
  paxSerial: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const DispatchOrderCreateSchema = z.object({
  salesOrderId: z.string().uuid(),
  customerId: z.string().uuid(),
  plannedDispatchDate: z.string(),
  deliveryAddressSnapshot: z.string().min(1),
  priority: z.string().default("NORMAL"),
  shippingMethod: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(DispatchItemCreateSchema).min(1),
});

export const InvoiceItemCreateSchema = z.object({
  salesOrderItemId: z.string().uuid().optional().nullable(),
  productRef: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  discount: z.number().nonnegative().default(0),
  taxRate: z.number().nonnegative().default(0),
});

export const InvoiceCreateSchema = z.object({
  customerId: z.string().uuid(),
  salesOrderId: z.string().uuid().optional().nullable(),
  dispatchOrderId: z.string().uuid().optional().nullable(),
  dueDate: z.string(),
  currency: z.string().default("INR"),
  additionalCharges: z.number().nonnegative().default(0),
  paymentTerms: z.string().optional().nullable(),
  billingAddressSnapshot: z.string().optional().nullable(),
  shippingAddressSnapshot: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(InvoiceItemCreateSchema).optional(),
  status: z.enum(["DRAFT", "ISSUED"]).optional().default("ISSUED"),
});

export const PaymentCreateSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  invoiceId: z.string().uuid().optional().nullable(),
  salesOrderId: z.string().uuid().optional().nullable(),
  amount: z.number().positive("Payment amount must be greater than 0"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "UPI", "CHEQUE", "OTHER"]),
  referenceNumber: z.string().optional().nullable(),
  bankDetails: z.string().optional().nullable(),
  paymentProofUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const PaymentVerificationRejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export const WarrantyCreateSchema = z.object({
  customerId: z.string().uuid(),
  paxSerial: z.string().min(1),
  salesOrderId: z.string().uuid().optional().nullable(),
  invoiceId: z.string().uuid().optional().nullable(),
  deliveryDate: z.string(),
  warrantyDurationMonths: z.number().int().positive().default(12),
  coverageType: z.string().default("FULL"),
  terms: z.string().optional().nullable(),
  exclusions: z.string().optional().nullable(),
});

export const WarrantyClaimSchema = z.object({
  warrantyId: z.string().uuid(),
  serviceRequestId: z.string().uuid().optional().nullable(),
  defectDescription: z.string().min(1),
  approved: z.boolean(),
  reason: z.string().optional().nullable(),
});

export const WorkOrderScheduleSchema = z.object({
  workOrderId: z.string().uuid(),
  assignedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be in YYYY-MM-DD format"),
  sequence: z.number().int().positive(),
  estimatedHrs: z.number().positive()
});

export const CellSwapSchema = z.object({
  paxSerial: z.string(),
  oldCellSerial: z.string(),
  newCellSerial: z.string(),
  defectId: z.string().uuid().optional().nullable(),
  diagnosisNotes: z.string().min(1),
  fixType: z.enum(["cell_swap", "wiring", "bms", "other"]).default("cell_swap"),
  oldCellDisposition: z.enum(["REJECTED", "CELL_TESTED"]).default("REJECTED"),
});

export const QcThresholdUpdateSchema = z.object({
  ahMin: z.number().positive("AH Minimum must be greater than 0"),
  ahMax: z.number().positive("AH Maximum must be greater than 0"),
  irMin: z.number().positive("IR Minimum must be greater than 0"),
  irMax: z.number().positive("IR Maximum must be greater than 0"),
  retestAhMargin: z.number().nonnegative().optional().nullable(),
  retestIrMargin: z.number().nonnegative().optional().nullable(),
  hardFailAh: z.number().nonnegative().optional().nullable(),
  hardFailIr: z.number().nonnegative().optional().nullable(),
  serialDisplayLength: z.union([
    z.number().int().min(1).max(50),
    z.string().regex(/^\d+$/).transform(Number),
    z.null(),
    z.literal("")
  ]).optional().nullable(),
}).refine(data => data.ahMin <= data.ahMax, {
  message: "AH Minimum cannot exceed AH Maximum",
  path: ["ahMin"],
}).refine(data => data.irMin <= data.irMax, {
  message: "IR Minimum cannot exceed IR Maximum",
  path: ["irMin"],
});

export const PaxTypeCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  cellPartNumber: z.string().optional().nullable(),
  cellChemistry: z.string().default("LFP").optional().nullable(),
  nominalVoltage: z.number().positive().default(48.0).optional().nullable(),
  nominalCapacity: z.number().positive().optional().nullable(),
  configuration: z.string().default("16S1P").optional().nullable(),
  bomId: z.string().uuid().optional().nullable(),
  bomNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unitPrice: z.number().nonnegative("Unit price must be non-negative").default(0).optional(),
  cellCount: z.number().int().positive("Cell count must be positive"),
  ahMin: z.number().positive("AH Minimum must be positive"),
  ahMax: z.number().positive("AH Maximum must be positive"),
  irMin: z.number().positive("IR Minimum must be positive"),
  irMax: z.number().positive("IR Maximum must be positive"),
  retestAhMargin: z.number().nonnegative().default(0.1).optional().nullable(),
  retestIrMargin: z.number().nonnegative().default(2.0).optional().nullable(),
  hardFailAh: z.number().nonnegative().default(3.0).optional().nullable(),
  hardFailIr: z.number().nonnegative().default(70.0).optional().nullable(),
  allowedGrades: z.array(z.string()).min(1, "At least one allowed grade is required"),
  maxAhDifference: z.number().nonnegative("Max AH difference must be non-negative"),
  maxIrDifference: z.number().nonnegative("Max IR difference must be non-negative"),
  autoPackEnabled: z.boolean().default(false),
}).refine(data => data.ahMin <= data.ahMax, {
  message: "AH Minimum cannot exceed AH Maximum",
  path: ["ahMin"],
}).refine(data => data.irMin <= data.irMax, {
  message: "IR Minimum cannot exceed IR Maximum",
  path: ["irMin"],
});

export const PaxTypeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  cellPartNumber: z.string().optional().nullable(),
  cellChemistry: z.string().optional().nullable(),
  nominalVoltage: z.number().positive().optional().nullable(),
  nominalCapacity: z.number().positive().optional().nullable(),
  configuration: z.string().optional().nullable(),
  bomId: z.string().uuid().optional().nullable(),
  bomNumber: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unitPrice: z.number().nonnegative("Unit price must be non-negative").optional(),
  cellCount: z.number().int().positive().optional(),
  ahMin: z.number().positive().optional(),
  ahMax: z.number().positive().optional(),
  irMin: z.number().positive().optional(),
  irMax: z.number().positive().optional(),
  retestAhMargin: z.number().nonnegative().optional().nullable(),
  retestIrMargin: z.number().nonnegative().optional().nullable(),
  hardFailAh: z.number().nonnegative().optional().nullable(),
  hardFailIr: z.number().nonnegative().optional().nullable(),
  allowedGrades: z.array(z.string()).min(1).optional(),
  maxAhDifference: z.number().nonnegative().optional(),
  maxIrDifference: z.number().nonnegative().optional(),
  autoPackEnabled: z.boolean().optional(),
}).refine(data => {
  if (data.ahMin !== undefined && data.ahMax !== undefined) {
    return data.ahMin <= data.ahMax;
  }
  return true;
}, {
  message: "AH Minimum cannot exceed AH Maximum",
  path: ["ahMin"],
}).refine(data => {
  if (data.irMin !== undefined && data.irMax !== undefined) {
    return data.irMin <= data.irMax;
  }
  return true;
}, {
  message: "IR Minimum cannot exceed IR Maximum",
  path: ["irMin"],
});

export const MaterialMappingCreateSchema = z.object({
  name: z.string().min(1, "Material name is required"),
  materialCode: z.string().optional().nullable(),
  sku: z.string().min(1, "Part Number / SKU is required"),
  category: z.string().min(1, "Category is required"),
  unit: z.string().min(1, "Unit is required").default("PCS"),
  description: z.string().optional().nullable(),
  minStock: z.number().int().nonnegative().optional().default(5),
  unitPrice: z.number().nonnegative().optional().default(0),
  materialType: z.string().optional().default("QTZ"),
  isActive: z.boolean().optional().default(true),
});

export const MaterialMappingUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  materialCode: z.string().optional().nullable(),
  sku: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  minStock: z.number().int().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  materialType: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const CellMappingCreateSchema = z.object({
  cellSku: z.string().min(1, "Cell Part Number / SKU is required"),
  cellName: z.string().min(1, "Cell Name is required"),
  chemistry: z.string().min(1, "Chemistry is required").default("LFP"),
  nominalVoltage: z.number().positive("Nominal voltage must be positive").default(3.2),
  nominalCapacity: z.number().positive("Nominal capacity must be positive").default(3.2),
  supplier: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const CellMappingUpdateSchema = z.object({
  cellSku: z.string().min(1).optional(),
  cellName: z.string().min(1).optional(),
  chemistry: z.string().min(1).optional(),
  nominalVoltage: z.number().positive().optional(),
  nominalCapacity: z.number().positive().optional(),
  supplier: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const FinancialSettingsUpdateSchema = z.object({
  defaultPaymentTerms: z.string().min(1, "Default payment terms are required"),
  defaultAdvancePercentage: z.number().min(0).max(100, "Advance percentage must be between 0 and 100"),
  defaultFreightAmount: z.number().min(0, "Freight amount must be non-negative"),
  defaultHandlingCharge: z.number().min(0, "Handling charge must be non-negative"),
  defaultTaxRate: z.number().min(0).max(100, "Tax rate must be between 0 and 100"),
  defaultQuotationValidityDays: z.number().int().positive("Quotation validity days must be positive"),
  defaultCurrency: z.string().min(1, "Currency is required"),
  minimumOrderValue: z.number().min(0, "Minimum order value must be non-negative"),
  // Shipping & Logistics Charge Configuration
  shippingCalculationMethod: z.string().optional().default("FLAT_RATE"),
  freeShippingThreshold: z.number().min(0, "Free shipping threshold must be non-negative").optional().default(0),
  defaultShippingCarrier: z.string().optional().default("Standard Road Logistics"),
  shippingTaxRate: z.number().min(0).max(100, "Shipping tax rate must be between 0 and 100").optional().default(18),
  estimatedDeliveryLeadDays: z.number().int().min(0, "Lead days must be non-negative").optional().default(3),
});

export const FactoryDefaultsUpdateSchema = z.object({
  defaultUnitSystem: z.string().min(1, "Unit system is required"),
  defaultTimezone: z.string().min(1, "Timezone is required"),
  workingHoursPerDay: z.number().positive().max(24, "Working hours per day must be between 0 and 24"),
  productionDaysPerWeek: z.number().int().min(1).max(7, "Production days per week must be between 1 and 7"),
  defaultDeliveryTerms: z.string().min(1, "Delivery terms are required"),
});

export const MaterialCategoryCreateSchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
});

export const VendorCategoryCreateSchema = z.object({
  name: z.string().min(1, "Vendor category name is required").max(100),
});

export const CompanyAssetCreateSchema = z.object({
  assetTag: z.string().min(1, "Asset Tag / Unique ID is required").max(100),
  name: z.string().min(1, "Asset Name is required").max(200),
  description: z.string().optional().nullable(),
  category: z.enum([
    "MACHINERY",
    "TESTING_EQUIPMENT",
    "TOOLING",
    "IT_HARDWARE",
    "VEHICLE",
    "FURNITURE",
    "SAFETY_EQUIPMENT",
    "FACILITY",
    "OTHER"
  ]).default("OTHER"),
  manufacturer: z.string().optional().nullable(),
  modelNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseCost: z.number().nonnegative().optional().nullable().default(0),
  vendorId: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  warrantyDetails: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  assignedDate: z.string().optional().nullable(),
  status: z.enum([
    "OPERATIONAL",
    "IN_USE",
    "UNDER_MAINTENANCE",
    "CALIBRATION_DUE",
    "STANDBY",
    "RETIRED",
    "DISPOSED"
  ]).default("OPERATIONAL"),
  condition: z.enum([
    "NEW",
    "EXCELLENT",
    "GOOD",
    "FAIR",
    "POOR",
    "DAMAGED"
  ]).default("GOOD"),
  lastMaintenanceDate: z.string().optional().nullable(),
  nextMaintenanceDate: z.string().optional().nullable(),
  maintenanceIntervalDays: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const CompanyAssetUpdateSchema = z.object({
  assetTag: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  category: z.enum([
    "MACHINERY",
    "TESTING_EQUIPMENT",
    "TOOLING",
    "IT_HARDWARE",
    "VEHICLE",
    "FURNITURE",
    "SAFETY_EQUIPMENT",
    "FACILITY",
    "OTHER"
  ]).optional(),
  manufacturer: z.string().optional().nullable(),
  modelNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseCost: z.number().nonnegative().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  warrantyExpiry: z.string().optional().nullable(),
  warrantyDetails: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  assignedDate: z.string().optional().nullable(),
  status: z.enum([
    "OPERATIONAL",
    "IN_USE",
    "UNDER_MAINTENANCE",
    "CALIBRATION_DUE",
    "STANDBY",
    "RETIRED",
    "DISPOSED"
  ]).optional(),
  condition: z.enum([
    "NEW",
    "EXCELLENT",
    "GOOD",
    "FAIR",
    "POOR",
    "DAMAGED"
  ]).optional(),
  lastMaintenanceDate: z.string().optional().nullable(),
  nextMaintenanceDate: z.string().optional().nullable(),
  maintenanceIntervalDays: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  retiredDate: z.string().optional().nullable(),
  retirementReason: z.string().optional().nullable(),
});

export const AssetMaintenanceCreateSchema = z.object({
  maintenanceType: z.string().optional(),
  type: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  serviceProvider: z.string().optional().nullable(),
  cost: z.number().nonnegative().optional().nullable().default(0),
  performedDate: z.string().optional().nullable(),
  nextDueDate: z.string().optional().nullable(),
  nextDue: z.string().optional().nullable(),
  status: z.string().optional().default("COMPLETED"),
  notes: z.string().optional().nullable(),
  updateAssetCondition: z.string().optional().nullable(),
}).transform((val) => ({
  ...val,
  maintenanceType: val.maintenanceType || val.type || "PREVENTIVE",
  nextDueDate: val.nextDueDate || val.nextDue || null
}));

export const AssetAssignmentCreateSchema = z.object({
  assignedToUserId: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});






