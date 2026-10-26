import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";
import { StorageService } from "../services/storage.service";
import { 
  PurchaseRequestCreateSchema,
  PurchaseOrderCreateSchema,
  GoodsReceiptCreateSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  BrandCreateSchema,
  SupplierInvoiceCreateSchema,
  BlindReceivingSubmitSchema
} from "../schemas/zod.schemas";

// Notification helper
async function triggerProcurementNotification(targetUserId: string | null, targetRole: string | null, message: string) {
  const channels = ["IN_APP", "EMAIL", "WHATSAPP"];
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
    // Real-time procurement sync broadcast
    wsManager.broadcastProcurement("procurement:update", { message, targetRole, targetUserId });
  } catch (e) {
    console.warn("WebSocket notification broadcast failed:", e);
  }
}

// Sequential generators
async function generatePRNumber(): Promise<string> {
  const last = await prisma.purchaseRequest.findFirst({ orderBy: { prNumber: 'desc' } });
  let nextNum = 1;
  if (last) {
    const match = last.prNumber.match(/\d+/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  return `PR-${String(nextNum).padStart(6, '0')}`;
}

async function generatePONumber(): Promise<string> {
  const last = await prisma.purchaseOrder.findFirst({ orderBy: { poNumber: 'desc' } });
  let nextNum = 1;
  if (last) {
    const match = last.poNumber.match(/\d+/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  return `PO-${String(nextNum).padStart(6, '0')}`;
}

async function generateGRNNumber(): Promise<string> {
  const last = await prisma.goodsReceipt.findFirst({ orderBy: { grnNumber: 'desc' } });
  let nextNum = 1;
  if (last) {
    const match = last.grnNumber.match(/\d+/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  return `GRN-${String(nextNum).padStart(6, '0')}`;
}

// Category prefix mapper for CAT-SECNO format
export function getCategoryPrefix(category: string): string {
  const norm = (category || "").trim().toUpperCase();
  if (norm.includes("BMS")) return "BMS";
  if (norm.includes("CELL")) return "CELL";
  if (norm.includes("WIRE") || norm.includes("HARNESS")) return "WIRE";
  if (norm.includes("ENCLOSURE") || norm.includes("CASING") || norm.includes("BOX")) return "ENCL";
  if (norm.includes("CONNECTOR")) return "CONN";
  if (norm.includes("INVERTER")) return "INV";
  if (norm.includes("CHARGER")) return "CHG";
  if (norm.includes("PACKAG")) return "PACK";
  if (norm.includes("RAW") || norm.includes("MATERIAL")) return "MAT";
  
  // Custom categories: extract uppercase alphanumeric characters, length 3-4
  const alphanumeric = norm.replace(/[^A-Z0-9]/g, "");
  return alphanumeric.slice(0, 4) || "PRD";
}

// Generate CAT-SECNO part number (checking existing products and historical audit logs to prevent sequence reuse)
async function generateCategoryPartNumber(category: string, tx?: any): Promise<string> {
  const db = tx || prisma;
  const prefix = getCategoryPrefix(category);
  const products = await db.product.findMany({
    where: {
      partNumber: { startsWith: `${prefix}-` }
    },
    select: { partNumber: true }
  });

  let maxNum = 0;
  for (const p of products) {
    const match = p.partNumber.match(new RegExp(`^${prefix}-(\\d+)`, "i"));
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  // Also inspect historical audit logs so deleted product numbers are never reused
  try {
    const auditLogs = await db.auditLog.findMany({
      where: {
        entityType: "product_master"
      },
      select: { metadata: true }
    });
    for (const log of auditLogs) {
      const meta = log.metadata as any;
      if (meta?.partNumber && typeof meta.partNumber === "string") {
        const match = meta.partNumber.match(new RegExp(`^${prefix}-(\\d+)`, "i"));
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }
  } catch (e) {
    // Non-blocking fallback
  }

  const nextNum = maxNum + 1;
  return `${prefix}-${String(nextNum).padStart(3, "0")}`;
}

// Helper to normalize 3-letter alphanumeric code (padded with X if needed)
function normalize3Char(str: string, fallback: string): string {
  const clean = (str || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (clean.length === 0) return fallback;
  if (clean.length >= 3) return clean.slice(0, 3);
  return clean.padEnd(3, "X");
}

// Generate unique brand code without colliding on Brand.code @unique
async function generateUniqueBrandCode(brandName: string): Promise<string> {
  const baseCode = normalize3Char(brandName, "BRD");
  let brandCode = baseCode;
  let existing = await prisma.brand.findUnique({ where: { code: brandCode } });
  let counter = 1;
  while (existing) {
    brandCode = `${baseCode.slice(0, 2)}${counter}`;
    existing = await prisma.brand.findUnique({ where: { code: brandCode } });
    counter++;
  }
  return brandCode;
}

// Generate Structured UIN: VEN3-BILLSEQ-BRAND3-BRANDSEQ-PARTNO
async function generateStructuredProductUIN(params: {
  vendorId?: string | null;
  brand: string;
  partNumber: string;
}): Promise<string> {
  let ven3 = "KYR"; // Default KYRA ZAM standard
  if (params.vendorId) {
    const vendor = await prisma.vendor.findUnique({ where: { id: params.vendorId } });
    if (vendor) {
      ven3 = normalize3Char(vendor.name, "VEN");
    }
  }

  const billSeq = "001";
  const brand3 = normalize3Char(params.brand, "BRD");

  const brandCount = await prisma.product.count({
    where: {
      brand: { equals: params.brand.trim().toUpperCase(), mode: "insensitive" }
    }
  });
  let brandSeqNum = brandCount + 1;
  let brandSeq = String(brandSeqNum).padStart(3, "0");

  const partNo = params.partNumber.trim().toUpperCase();

  let proposedUIN = `${ven3}-${billSeq}-${brand3}-${brandSeq}-${partNo}`;

  // Collision safety loop
  let exists = await prisma.product.findUnique({ where: { uin: proposedUIN } });
  while (exists) {
    brandSeqNum++;
    brandSeq = String(brandSeqNum).padStart(3, "0");
    proposedUIN = `${ven3}-${billSeq}-${brand3}-${brandSeq}-${partNo}`;
    exists = await prisma.product.findUnique({ where: { uin: proposedUIN } });
  }

  return proposedUIN;
}

export async function procurementRoutes(fastify: FastifyInstance) {
  // Read operations available across procurement & inventory roles
  const purchasePreHandler = { preHandler: [requireRoles("PURCHASE_MANAGER", "INVENTORY_MANAGER", "ADMIN", "SUPERADMIN")] };
  
  // PO & Product Master creation/edit restricted to Purchase Managers and Admins (Inventory Managers blocked from PO modifications)
  const poWriteHandler = { preHandler: [requireRoles("PURCHASE_MANAGER", "ADMIN", "SUPERADMIN")] };
  
  // High-authority operations: PO approvals & rejections restricted to Admins
  const poApproveHandler = { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] };

  // Receiving operations for Inventory Managers and Admins
  const receivingHandler = { preHandler: [requireRoles("INVENTORY_MANAGER", "ADMIN", "SUPERADMIN", "PURCHASE_MANAGER")] };

  // GET /crm/procurement/dashboard
  fastify.get("/dashboard", purchasePreHandler, async (request, reply) => {
    const [
      totalPR,
      draftPR,
      pendingPR,
      approvedPR,
      totalPO,
      sentPO,
      totalGRN,
      pendingQCGRN
    ] = await Promise.all([
      prisma.purchaseRequest.count(),
      prisma.purchaseRequest.count({ where: { status: "DRAFT" } }),
      prisma.purchaseRequest.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.purchaseRequest.count({ where: { status: "APPROVED" } }),
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({ where: { status: "SENT" } }),
      prisma.goodsReceipt.count(),
      prisma.goodsReceipt.count({ where: { status: "QC_PENDING" } })
    ]);

    return {
      stats: {
        totalPR,
        draftPR,
        pendingPR,
        approvedPR,
        totalPO,
        sentPO,
        totalGRN,
        pendingQCGRN
      }
    };
  });

  // --- PURCHASE REQUEST ENDPOINTS ---
  
  // GET /crm/procurement/purchase-requests
  fastify.get("/purchase-requests", purchasePreHandler, async (request, reply) => {
    const { search, status, priority, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (search) {
      where.OR = [
        { prNumber: { contains: search, mode: "insensitive" } },
        { reason: { contains: search, mode: "insensitive" } }
      ];
    }
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [requests, total] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          requestedBy: { select: { name: true } },
          items: { include: { material: true } }
        }
      }),
      prisma.purchaseRequest.count({ where })
    ]);

    return { requests, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/procurement/purchase-requests/:id
  fastify.get("/purchase-requests/:id", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { name: true, email: true } },
        items: { include: { material: true } },
        approvals: {
          include: {
            requestedBy: { select: { name: true } },
            decidedBy: { select: { name: true } }
          }
        }
      }
    });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });
    return pr;
  });

  // POST /crm/procurement/purchase-requests
  fastify.post("/purchase-requests", purchasePreHandler, async (request, reply) => {
    const data = PurchaseRequestCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const prNumber = await generatePRNumber();

    const pr = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.create({
        data: {
          prNumber,
          requestedById: actor.id,
          source: data.source,
          sourceReferenceId: data.sourceReferenceId,
          priority: data.priority,
          requiredDate: new Date(data.requiredDate),
          reason: data.reason,
          notes: data.notes,
          status: "DRAFT"
        }
      });

      for (const item of data.items) {
        await tx.purchaseRequestItem.create({
          data: {
            purchaseRequestId: doc.id,
            materialId: item.materialId,
            requestedQuantity: item.requestedQuantity,
            requiredDate: new Date(item.requiredDate),
            specification: item.specification,
            notes: item.notes
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase-request",
          entityId: doc.id,
          actorId: actor.id,
          action: "PURCHASE_REQUEST_CREATED",
          newStatus: "DRAFT",
          metadata: { prNumber }
        }
      });

      return doc;
    });

    return pr;
  });

  // PUT /crm/procurement/purchase-requests/:id/submit
  fastify.put("/purchase-requests/:id/submit", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });

    if (pr.status !== "DRAFT" && pr.status !== "REJECTED") {
      return reply.status(400).send({ error: `Cannot submit PR in status ${pr.status}` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.update({
        where: { id },
        data: { status: "PENDING_APPROVAL" }
      });

      await tx.purchaseRequestApproval.create({
        data: {
          purchaseRequestId: id,
          requestedById: actor.id,
          status: "PENDING"
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "purchase-request",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_REQUEST_SUBMITTED",
          prevStatus: pr.status,
          newStatus: "PENDING_APPROVAL"
        }
      });

      return doc;
    });

    await triggerProcurementNotification(null, "ADMIN", `Purchase Request ${pr.prNumber} submitted for approval.`);
    return updated;
  });

  // PUT /crm/procurement/purchase-requests/:id/approve
  fastify.put("/purchase-requests/:id/approve", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { comments } = request.body as { comments?: string };
    const actor = request.user as { id: string };

    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });

    const userRoles = (request.user as any)?.roles || [];
    if (pr.requestedById === actor.id && !userRoles.includes("ADMIN") && !userRoles.includes("SUPERADMIN")) {
      return reply.status(403).send({ error: "Access denied: cannot approve your own Purchase Request" });
    }

    if (pr.status !== "PENDING_APPROVAL") {
      return reply.status(400).send({ error: "PR is not pending approval" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.update({
        where: { id },
        data: { status: "APPROVED" }
      });

      const pending = await tx.purchaseRequestApproval.findFirst({
        where: { purchaseRequestId: id, status: "PENDING" }
      });
      if (pending) {
        await tx.purchaseRequestApproval.update({
          where: { id: pending.id },
          data: {
            status: "APPROVED",
            decidedById: actor.id,
            comments
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase-request",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_REQUEST_APPROVED",
          prevStatus: "PENDING_APPROVAL",
          newStatus: "APPROVED"
        }
      });

      return doc;
    });

    await triggerProcurementNotification(pr.requestedById, null, `Your PR ${pr.prNumber} has been approved.`);
    return updated;
  });

  // PUT /crm/procurement/purchase-requests/:id/reject
  fastify.put("/purchase-requests/:id/reject", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { comments, reason } = request.body as { comments?: string; reason: string };
    const actor = request.user as { id: string };

    if (!reason) return reply.status(400).send({ error: "Rejection reason is required" });

    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });

    const userRoles = (request.user as any)?.roles || [];
    if (pr.requestedById === actor.id && !userRoles.includes("ADMIN") && !userRoles.includes("SUPERADMIN")) {
      return reply.status(403).send({ error: "Access denied: cannot reject your own Purchase Request" });
    }

    if (pr.status !== "PENDING_APPROVAL") {
      return reply.status(400).send({ error: "PR is not pending approval" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseRequest.update({
        where: { id },
        data: { status: "REJECTED" }
      });

      const pending = await tx.purchaseRequestApproval.findFirst({
        where: { purchaseRequestId: id, status: "PENDING" }
      });
      if (pending) {
        await tx.purchaseRequestApproval.update({
          where: { id: pending.id },
          data: {
            status: "REJECTED",
            decidedById: actor.id,
            comments,
            reason
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase-request",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_REQUEST_REJECTED",
          prevStatus: "PENDING_APPROVAL",
          newStatus: "REJECTED"
        }
      });

      return doc;
    });

    await triggerProcurementNotification(pr.requestedById, null, `Your PR ${pr.prNumber} has been REJECTED. Reason: ${reason}`);
    return updated;
  });

  // PUT /crm/procurement/purchase-requests/:id/cancel
  fastify.put("/purchase-requests/:id/cancel", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const pr = await prisma.purchaseRequest.findUnique({ where: { id } });
    if (!pr) return reply.status(404).send({ error: "Purchase Request not found" });

    if (["COMPLETED", "CANCELLED", "ORDERED"].includes(pr.status)) {
      return reply.status(400).send({ error: `Cannot cancel request in status ${pr.status}` });
    }

    const updated = await prisma.purchaseRequest.update({
      where: { id },
      data: { status: "CANCELLED" }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "purchase-request",
        entityId: id,
        actorId: actor.id,
        action: "PURCHASE_REQUEST_CANCELLED",
        prevStatus: pr.status,
        newStatus: "CANCELLED"
      }
    });

    return updated;
  });


  // =========================================================
  // --- PRODUCT CATALOG & UIN ENDPOINTS ---
  // =========================================================

  // GET /crm/procurement/products (Search & catalog picker)
  fastify.get("/products", purchasePreHandler, async (request, reply) => {
    const { search, brand, brandId, category, isActive, page = "1", limit = "50" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { partNumber: { contains: search, mode: "insensitive" } },
        { manufacturerPartNumber: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { uin: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } }
      ];
    }
    if (brandId) where.brandId = brandId;
    else if (brand) where.brand = { equals: brand, mode: "insensitive" };
    if (category) where.category = { equals: category, mode: "insensitive" };
    if (isActive !== undefined && isActive !== "" && isActive !== "ALL") {
      where.isActive = isActive === "true" || isActive === true;
    } else if (isActive !== "ALL") {
      where.isActive = true;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ brand: "asc" }, { name: "asc" }],
        skip,
        take,
        include: {
          material: { select: { id: true, name: true, sku: true, unit: true, unitPrice: true } },
          brandRef: { select: { id: true, name: true, code: true } }
        }
      }),
      prisma.product.count({ where })
    ]);

    return { products, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/procurement/products/:id
  fastify.get("/products/:id", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        material: true,
        brandRef: true
      }
    });
    if (!product) return reply.status(404).send({ error: "Product not found" });
    return product;
  });

  // GET /crm/procurement/products/part-numbers (Part-number-first search across all registered brands)
  fastify.get("/products/part-numbers", purchasePreHandler, async (request, reply) => {
    const { search, category, limit = "50" } = request.query as any;

    const where: any = { isActive: true };
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { partNumber: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { uin: { contains: q, mode: "insensitive" } }
      ];
    }
    if (category && category !== "ALL") {
      where.category = { equals: category, mode: "insensitive" };
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: [{ partNumber: "asc" }, { brand: "asc" }],
      take: parseInt(limit, 10),
      include: {
        brandRef: { select: { id: true, name: true, code: true } },
        material: { select: { id: true, name: true, sku: true, unitPrice: true } }
      }
    });

    // Group results by partNumber (product-family-first)
    const groupedMap = new Map<string, {
      partNumber: string;
      name: string;
      category: string;
      unit: string;
      technicalSpecs: string | null;
      description: string | null;
      imageUrl: string | null;
      materialId: string | null;
      brands: Array<{
        productId: string;
        brand: string;
        brandId: string | null;
        brandCode: string | null;
        uin: string;
        imageUrl: string | null;
        unitPrice: number;
      }>;
    }>();

    for (const prod of products) {
      const key = prod.partNumber.trim().toUpperCase();
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          partNumber: prod.partNumber,
          name: prod.name,
          category: prod.category,
          unit: prod.unit,
          technicalSpecs: prod.technicalSpecs,
          description: prod.description,
          imageUrl: prod.imageUrl,
          materialId: prod.materialId,
          brands: []
        });
      }
      const group = groupedMap.get(key)!;
      if (!group.technicalSpecs && prod.technicalSpecs) group.technicalSpecs = prod.technicalSpecs;
      if (!group.description && prod.description) group.description = prod.description;
      if (!group.imageUrl && prod.imageUrl) group.imageUrl = prod.imageUrl;

      group.brands.push({
        productId: prod.id,
        brand: prod.brand,
        brandId: prod.brandId,
        brandCode: prod.brandRef?.code || null,
        uin: prod.uin,
        imageUrl: prod.imageUrl,
        unitPrice: prod.material?.unitPrice || 0
      });
    }

    const partNumbers = Array.from(groupedMap.values());
    return { partNumbers, total: partNumbers.length };
  });

  // GET /crm/procurement/products/next-part-number?category=BMS (Preview CAT-SECNO)
  fastify.get("/products/next-part-number", purchasePreHandler, async (request, reply) => {
    const { category } = request.query as { category?: string };
    if (!category) return reply.status(400).send({ error: "Category is required" });
    const nextPartNumber = await generateCategoryPartNumber(category);
    const prefix = getCategoryPrefix(category);
    const count = await prisma.product.count({
      where: {
        category: { equals: category, mode: "insensitive" }
      }
    });
    const nextSequence = nextPartNumber.split("-")[1] || "001";
    return { 
      nextPartNumber, 
      partNumber: nextPartNumber, 
      prefix, 
      count, 
      nextSequence 
    };
  });

  // GET /crm/procurement/brands/next-sequence?brand=DALY (Preview brand sequence based on Brand.nextSequence)
  fastify.get("/brands/next-sequence", purchasePreHandler, async (request, reply) => {
    const { brand, brandId } = request.query as { brand?: string; brandId?: string };
    if (!brand && !brandId) return reply.status(400).send({ error: "Brand or brandId is required" });

    let brandRecord = null;
    if (brandId) {
      brandRecord = await prisma.brand.findUnique({ where: { id: brandId } });
    }
    if (!brandRecord && brand) {
      brandRecord = await prisma.brand.findFirst({
        where: { name: { equals: brand.trim(), mode: "insensitive" } }
      });
    }

    const nextSeqNum = brandRecord ? brandRecord.nextSequence : 1;
    const nextSeq = String(nextSeqNum).padStart(3, "0");
    const brandName = brandRecord ? brandRecord.name : (brand || "").trim().toUpperCase();
    const brandCode = brandRecord?.code || normalize3Char(brandName, "BRD");
    const count = brandRecord
      ? await prisma.product.count({ where: { brandId: brandRecord.id } })
      : 0;

    return {
      brand: brandName,
      brandId: brandRecord?.id || null,
      count,
      nextSeqNum,
      brandSeq: nextSeq,
      brandCode
    };
  });

  // GET /crm/procurement/brands
  fastify.get("/brands", purchasePreHandler, async (request, reply) => {
    const { search } = (request.query as { search?: string }) || {};
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } }
      ];
    }
    const brands = await prisma.brand.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: true } }
      }
    });
    return { brands };
  });

  // POST /crm/procurement/brands (Register Brand Master)
  fastify.post("/brands", poWriteHandler, async (request, reply) => {
    const data = BrandCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const normalizedName = data.name.trim();
    const normalizedCode = data.code ? data.code.trim().toUpperCase() : normalize3Char(normalizedName, "BRD");

    const existing = await prisma.brand.findFirst({
      where: {
        OR: [
          { name: { equals: normalizedName, mode: "insensitive" } },
          { code: { equals: normalizedCode, mode: "insensitive" } }
        ]
      }
    });

    if (existing) {
      return reply.status(200).send({
        brand: existing,
        isExisting: true,
        message: `Brand "${existing.name}" already exists.`
      });
    }

    const created = await prisma.brand.create({
      data: {
        name: normalizedName,
        code: normalizedCode,
        description: data.description?.trim() || null,
        country: data.country?.trim() || null,
        website: data.website?.trim() || null,
        isActive: data.isActive ?? true
      }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "brand_master",
        entityId: created.id,
        actorId: actor.id,
        action: "BRAND_MASTER_REGISTERED",
        metadata: { name: created.name, code: created.code }
      }
    });

    return reply.status(201).send({
      brand: created,
      isExisting: false,
      message: `Brand "${created.name}" registered successfully.`
    });
  });

  // POST /crm/procurement/products (Brand-Aware Identity, CAT-SECNO & Structured UIN)
  fastify.post("/products", poWriteHandler, async (request, reply) => {
    const data = ProductCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    // Auto-generate CAT-SECNO part number if not provided
    const normalizedPartNumber = data.partNumber && data.partNumber.trim()
      ? data.partNumber.trim().toUpperCase()
      : await generateCategoryPartNumber(data.category);

    const normalizedBrand = data.brand.trim().toUpperCase();

    // 1. Ensure Brand master record is resolved with persistent brandId
    let brandRecord = null;
    if (data.brandId) {
      brandRecord = await prisma.brand.findUnique({ where: { id: data.brandId } });
    }
    if (!brandRecord) {
      brandRecord = await prisma.brand.findFirst({
        where: { name: { equals: normalizedBrand, mode: "insensitive" } }
      });
    }
    if (!brandRecord) {
      try {
        const brandCode = await generateUniqueBrandCode(normalizedBrand);
        brandRecord = await prisma.brand.create({
          data: {
            name: normalizedBrand,
            code: brandCode,
            nextSequence: 1
          }
        });
      } catch (err: any) {
        // Concurrent request registered the same brand first -> reuse it
        if (err?.code !== "P2002") throw err;
        brandRecord = await prisma.brand.findFirst({
          where: { name: { equals: normalizedBrand, mode: "insensitive" } }
        });
        if (!brandRecord) throw err;
      }
    }
    const brandId = brandRecord.id;

    // Guard: a client-supplied materialId (e.g. from a selected part-number family) must not
    // belong to a product of a DIFFERENT brand, otherwise the new brand identity would share
    // (and later overwrite) another brand's Factory Material record.
    let safeMaterialId: string | undefined = data.materialId || undefined;
    if (safeMaterialId) {
      const foreignOwner = await prisma.product.findFirst({
        where: { materialId: safeMaterialId, brandId: { not: brandId } },
        select: { id: true }
      });
      if (foreignOwner) safeMaterialId = undefined;
    }

    const findExistingIdentity = () =>
      prisma.product.findFirst({
        where: {
          partNumber: normalizedPartNumber,
          OR: [
            { brandId: brandRecord!.id },
            { brand: { equals: brandRecord!.name, mode: "insensitive" } }
          ]
        },
        include: { material: true, brandRef: true }
      });

    // 2. Duplicate protection: Same Part Number + Same BrandId -> Return or reuse existing product
    const existing = await findExistingIdentity();

    if (existing) {
      // Heal missing brandId or materialId if needed
      if (!existing.brandId || !existing.materialId) {
        const updateData: any = {};
        if (!existing.brandId) updateData.brandId = brandRecord.id;
        if (!existing.materialId && safeMaterialId) updateData.materialId = safeMaterialId;

        if (Object.keys(updateData).length > 0) {
          const healed = await prisma.product.update({
            where: { id: existing.id },
            data: updateData,
            include: { material: true, brandRef: true }
          });
          return reply.status(200).send({
            product: healed,
            isExisting: true,
            message: `Product "${existing.name}" is already registered under brand "${existing.brand}" with UIN "${existing.uin}". Reusing registered product master.`
          });
        }
      }

      return reply.status(200).send({
        product: existing,
        isExisting: true,
        message: `Product "${existing.name}" is already registered under brand "${existing.brand}" with UIN "${existing.uin}". Reusing registered product master.`
      });
    }

    // 3. Concurrency-Safe Brand Sequence Increment, UIN Allocation & Material Synchronization in Transaction
    let result: Awaited<ReturnType<typeof findExistingIdentity>> & {};
    try {
    result = await prisma.$transaction(async (tx) => {
      // Atomically increment brand sequence counter with row-level lock
      const lockedBrand = await tx.brand.update({
        where: { id: brandRecord.id },
        data: { nextSequence: { increment: 1 } },
        select: { id: true, name: true, code: true, nextSequence: true }
      });

      const allocatedSeqNum = lockedBrand.nextSequence - 1;
      const brandSeq = String(allocatedSeqNum).padStart(3, "0");
      const brandCode = lockedBrand.code || normalize3Char(lockedBrand.name, "BRD");

      // Vendor prefix
      let ven3 = "KYR";
      if (data.vendorId) {
        const vendor = await tx.vendor.findUnique({ where: { id: data.vendorId } });
        if (vendor) {
          ven3 = normalize3Char(vendor.name, "VEN");
        }
      }
      const billSeq = "001";

      // Collision-safe UIN generation
      let uin = `${ven3}-${billSeq}-${brandCode}-${brandSeq}-${normalizedPartNumber}`;
      let existsUin = await tx.product.findUnique({ where: { uin } });
      let collCounter = allocatedSeqNum;
      while (existsUin) {
        collCounter++;
        uin = `${ven3}-${billSeq}-${brandCode}-${String(collCounter).padStart(3, "0")}-${normalizedPartNumber}`;
        existsUin = await tx.product.findUnique({ where: { uin } });
      }

      // 4. Synchronize Factory Material record without overwriting other brands
      let materialRecord = null;
      if (safeMaterialId) {
        materialRecord = await tx.material.findUnique({ where: { id: safeMaterialId } });
      }

      if (!materialRecord) {
        // Check if a material with base partNumber exists
        const existingBaseMaterial = await tx.material.findUnique({
          where: { sku: normalizedPartNumber }
        });

        let targetMaterialSku = normalizedPartNumber;
        if (existingBaseMaterial) {
          // Check if this existing material belongs to a DIFFERENT brand
          const productOfOtherBrand = await tx.product.findFirst({
            where: {
              materialId: existingBaseMaterial.id,
              brandId: { not: lockedBrand.id }
            }
          });

          if (productOfOtherBrand) {
            // Material belongs to another brand! Create brand-isolated Material SKU
            targetMaterialSku = `${brandCode}-${normalizedPartNumber}`;
            const existingBrandMaterial = await tx.material.findUnique({
              where: { sku: targetMaterialSku }
            });
            if (existingBrandMaterial) {
              materialRecord = existingBrandMaterial;
            }
          } else {
            materialRecord = existingBaseMaterial;
          }
        }

        if (!materialRecord) {
          const isCellCategory = ["CELL", "CELLS"].includes(data.category.trim().toUpperCase());
          materialRecord = await tx.material.create({
            data: {
              sku: targetMaterialSku,
              materialCode: `MAT-${targetMaterialSku}`,
              name: targetMaterialSku === normalizedPartNumber 
                ? data.name.trim() 
                : `${data.name.trim()} (${lockedBrand.name})`,
              category: data.category.trim(),
              unit: data.unit?.trim().toUpperCase() || "PCS",
              description: data.description?.trim() || `Product Master SKU (${lockedBrand.name})`,
              minStock: 5,
              unitPrice: 0,
              materialType: isCellCategory ? "CELL" : "QTZ",
              isActive: true
            }
          });

          await tx.auditLog.create({
            data: {
              entityType: "material_mapping",
              entityId: materialRecord.id,
              actorId: actor.id,
              action: "FACTORY_MATERIAL_AUTO_CREATED_FROM_PRODUCT",
              metadata: {
                sku: materialRecord.sku,
                name: materialRecord.name,
                category: materialRecord.category,
                partNumber: normalizedPartNumber,
                brand: lockedBrand.name,
                brandId: lockedBrand.id,
                source: "PRODUCT_MASTER_AUTO_SYNC"
              }
            }
          });
        }
      }

      // 5. Create new Product identity with persistent brandId and unique UIN
      const created = await tx.product.create({
        data: {
          uin,
          name: data.name.trim(),
          partNumber: normalizedPartNumber,
          manufacturerPartNumber: data.manufacturerPartNumber?.trim() || null,
          brand: lockedBrand.name,
          brandId: lockedBrand.id,
          category: data.category.trim(),
          materialId: materialRecord.id,
          technicalSpecs: data.technicalSpecs?.trim() || null,
          unit: data.unit?.trim().toUpperCase() || "PCS",
          description: data.description?.trim() || null,
          imageUrl: data.imageUrl?.trim() || null,
          isActive: data.isActive ?? true
        },
        include: { material: true, brandRef: true }
      });

      await tx.auditLog.create({
        data: {
          entityType: "product_master",
          entityId: created.id,
          actorId: actor.id,
          action: "PRODUCT_MASTER_REGISTERED",
          metadata: {
            uin: created.uin,
            name: created.name,
            partNumber: created.partNumber,
            manufacturerPartNumber: created.manufacturerPartNumber,
            brand: created.brand,
            brandId: created.brandId,
            category: created.category,
            materialId: created.materialId
          }
        }
      });

      return created;
    });
    } catch (err: any) {
      // Concurrency safety: a parallel request registered the same part number + brand first.
      // The DB unique constraint (partNumber, brandId) rejected ours -> reuse the winner.
      if (err?.code === "P2002") {
        const winner = await findExistingIdentity();
        if (winner) {
          return reply.status(200).send({
            product: winner,
            isExisting: true,
            message: `Product "${winner.name}" is already registered under brand "${winner.brand}" with UIN "${winner.uin}". Reusing registered product master.`
          });
        }
        return reply.status(409).send({ error: "A conflicting product identity was registered concurrently. Please retry." });
      }
      throw err;
    }

    return reply.status(201).send({
      product: result,
      isExisting: false,
      message: `Product "${result.name}" registered successfully with UIN "${result.uin}" and saved to Factory Material SKUs (${result.material?.sku || result.partNumber}).`
    });
  });

  // PUT /crm/procurement/products/:id (Edit Product Master & Update Image)
  fastify.put("/products/:id", poWriteHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = ProductUpdateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return reply.status(404).send({ error: "Product not found in Product Master Catalog." });
    }

    const nextPartNumber = data.partNumber !== undefined ? data.partNumber.trim().toUpperCase() : existingProduct.partNumber;
    let nextBrandId = data.brandId !== undefined ? (data.brandId || null) : existingProduct.brandId;
    let nextBrand = data.brand !== undefined ? data.brand.trim() : existingProduct.brand;

    if (data.brand && !data.brandId) {
      const bRec = await prisma.brand.findFirst({
        where: { name: { equals: data.brand.trim(), mode: "insensitive" } }
      });
      if (bRec) {
        nextBrandId = bRec.id;
        nextBrand = bRec.name;
      }
    }

    // If partNumber or brandId changed, enforce unique constraint against other products
    if (nextPartNumber !== existingProduct.partNumber || nextBrandId !== existingProduct.brandId) {
      const conflict = await prisma.product.findFirst({
        where: {
          id: { not: id },
          partNumber: nextPartNumber,
          OR: [
            ...(nextBrandId ? [{ brandId: nextBrandId }] : []),
            { brand: { equals: nextBrand, mode: "insensitive" } }
          ]
        }
      });
      if (conflict) {
        return reply.status(400).send({
          error: `A product with Part Number "${nextPartNumber}" and Brand "${nextBrand}" is already registered (UIN: ${conflict.uin}).`
        });
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name.trim() : undefined,
        partNumber: data.partNumber !== undefined ? nextPartNumber : undefined,
        manufacturerPartNumber: data.manufacturerPartNumber !== undefined ? (data.manufacturerPartNumber?.trim() || null) : undefined,
        brand: data.brand !== undefined ? nextBrand : undefined,
        brandId: nextBrandId !== undefined ? nextBrandId : undefined,
        category: data.category !== undefined ? data.category.trim() : undefined,
        materialId: data.materialId !== undefined ? (data.materialId || null) : undefined,
        technicalSpecs: data.technicalSpecs !== undefined ? (data.technicalSpecs?.trim() || null) : undefined,
        unit: data.unit !== undefined ? data.unit.trim().toUpperCase() : undefined,
        description: data.description !== undefined ? (data.description?.trim() || null) : undefined,
        imageUrl: data.imageUrl !== undefined ? (data.imageUrl?.trim() || null) : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined
      },
      include: {
        material: { select: { id: true, name: true, sku: true, unit: true, unitPrice: true } },
        brandRef: { select: { id: true, name: true, code: true } }
      }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "product_master",
        entityId: updated.id,
        actorId: actor.id,
        action: "PRODUCT_MASTER_UPDATED",
        metadata: {
          uin: updated.uin,
          name: updated.name,
          partNumber: updated.partNumber,
          brand: updated.brand,
          brandId: updated.brandId,
          imageUrl: updated.imageUrl
        }
      }
    });

    // Safely sync to linked Material SKU in Factory Settings
    if (updated.materialId) {
      await prisma.material.update({
        where: { id: updated.materialId },
        data: {
          name: updated.name,
          category: updated.category,
          unit: updated.unit,
          description: updated.description || undefined,
          isActive: updated.isActive
        }
      }).catch((e) => console.warn("Could not sync material on product update", e));
    }

    return reply.status(200).send({
      product: updated,
      message: `Product "${updated.name}" updated successfully in Product Master Catalog and synced to Factory Material SKUs.`
    });
  });

  // DELETE /crm/procurement/products/:id (Permanent Deletion • Irreversible)
  fastify.delete("/products/:id", poWriteHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    const existing = await prisma.product.findUnique({
      where: { id },
      include: {
        material: true,
        purchaseOrderItems: { select: { id: true } }
      }
    });

    if (!existing) {
      return reply.status(404).send({ error: "Product not found" });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete associated purchase order items
      await tx.purchaseOrderItem.deleteMany({
        where: { productId: id }
      });

      // 2. Delete the Product record
      await tx.product.delete({
        where: { id }
      });

      // 3. If material is linked and no other products or active BOMs use it, purge material
      if (existing.materialId) {
        const otherProductCount = await tx.product.count({
          where: { materialId: existing.materialId }
        });
        const bomCount = await tx.bOMItem.count({
          where: { materialId: existing.materialId }
        });
        const movementCount = await tx.stockMovement.count({
          where: { materialId: existing.materialId }
        });
        if (otherProductCount === 0 && bomCount === 0 && movementCount === 0) {
          await tx.materialLocationBalance.deleteMany({ where: { materialId: existing.materialId } });
          await tx.inventoryReservation.deleteMany({ where: { materialId: existing.materialId } });
          await tx.material.delete({ where: { id: existing.materialId } });
        }
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "product_master",
          entityId: id,
          actorId: user?.id || "system",
          action: "PRODUCT_MASTER_PERMANENTLY_PURGED",
          metadata: {
            name: existing.name,
            partNumber: existing.partNumber,
            brand: existing.brand,
            uin: existing.uin,
            permanent: true
          }
        }
      });
    });

    return reply.status(200).send({
      success: true,
      message: `Product "${existing.name}" (${existing.uin}) permanently deleted.`
    });
  });

  // POST /crm/procurement/products/upload-image (Validated image upload: JPEG, PNG, WebP, max 5MB)
  fastify.post("/products/upload-image", poWriteHandler, async (request, reply) => {
    try {
      const fileData = await (request as any).file();
      if (!fileData) {
        return reply.status(400).send({ error: "No image file provided in request." });
      }

      const buffer = await fileData.toBuffer();
      const uploadResult = await StorageService.uploadProductImage(
        buffer,
        fileData.filename,
        fileData.mimetype
      );

      return {
        url: uploadResult.url,
        fileName: uploadResult.fileName,
        storageDriver: uploadResult.storageDriver
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to upload product image" });
    }
  });

  // POST /crm/procurement/products/check-duplicate
  fastify.post("/products/check-duplicate", purchasePreHandler, async (request, reply) => {
    const { partNumber, manufacturerPartNumber, search, brand, brandId } = request.body as {
      partNumber?: string;
      manufacturerPartNumber?: string;
      search?: string;
      brand?: string;
      brandId?: string;
    };

    const targetPart = partNumber ? partNumber.trim().toUpperCase() : undefined;
    const targetMpn = manufacturerPartNumber ? manufacturerPartNumber.trim() : undefined;
    const targetSearch = search ? search.trim() : undefined;

    if (!targetPart && !targetMpn && !targetSearch) {
      return reply.status(400).send({ error: "Either partNumber, manufacturerPartNumber, or search query is required." });
    }

    let targetBrandId = brandId;
    let targetBrandName = brand ? brand.trim() : undefined;

    if (!targetBrandId && targetBrandName) {
      const bRec = await prisma.brand.findFirst({
        where: { name: { equals: targetBrandName, mode: "insensitive" } }
      });
      if (bRec) {
        targetBrandId = bRec.id;
        targetBrandName = bRec.name;
      }
    }

    // 1. Exact matches within target brand
    let exactMatches: any[] = [];
    if (targetBrandId || targetBrandName) {
      const brandCondition: any = targetBrandId
        ? { brandId: targetBrandId }
        : { brand: { equals: targetBrandName, mode: "insensitive" } };

      const orConditions: any[] = [
        ...(targetPart ? [{ partNumber: targetPart }] : []),
        ...(targetMpn ? [{ manufacturerPartNumber: { equals: targetMpn, mode: "insensitive" } }] : []),
        ...(targetSearch ? [
          { name: { contains: targetSearch, mode: "insensitive" } },
          { partNumber: { contains: targetSearch, mode: "insensitive" } },
          { manufacturerPartNumber: { contains: targetSearch, mode: "insensitive" } },
          { uin: { contains: targetSearch, mode: "insensitive" } }
        ] : [])
      ];

      exactMatches = await prisma.product.findMany({
        where: {
          AND: [
            brandCondition,
            { OR: orConditions }
          ]
        },
        include: { material: true, brandRef: true }
      });
    }

    // 2. Cross-brand matches (same part number, MPN or search across other or all brands)
    const crossOrConditions: any[] = [
      ...(targetPart ? [{ partNumber: targetPart }] : []),
      ...(targetMpn ? [{ manufacturerPartNumber: { equals: targetMpn, mode: "insensitive" } }] : []),
      ...(targetSearch ? [
        { name: { contains: targetSearch, mode: "insensitive" } },
        { partNumber: { contains: targetSearch, mode: "insensitive" } },
        { manufacturerPartNumber: { contains: targetSearch, mode: "insensitive" } },
        { brand: { contains: targetSearch, mode: "insensitive" } },
        { uin: { contains: targetSearch, mode: "insensitive" } }
      ] : [])
    ];

    const crossWhere: any = {
      AND: [
        ...(targetBrandId ? [{ brandId: { not: targetBrandId } }] : []),
        { OR: crossOrConditions }
      ]
    };

    const crossBrandMatches = await prisma.product.findMany({
      where: crossWhere,
      take: 20,
      include: { material: true, brandRef: true }
    });

    return {
      hasExactMatch: exactMatches.length > 0,
      exactMatches,
      hasCrossBrandMatch: crossBrandMatches.length > 0,
      crossBrandMatches,
      matches: exactMatches.length > 0 ? exactMatches : crossBrandMatches
    };
  });


  // =========================================================
  // --- PURCHASE ORDER ENDPOINTS ---
  // =========================================================

  // GET /crm/procurement/purchase-orders/next-number (Server-generated preview)
  fastify.get("/purchase-orders/next-number", purchasePreHandler, async () => {
    const nextPoNumber = await generatePONumber();
    return { nextPoNumber };
  });

  // GET /crm/procurement/purchase-orders (List)
  fastify.get("/purchase-orders", purchasePreHandler, async (request, reply) => {
    const { search, status, vendorId, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { quotationReference: { contains: search, mode: "insensitive" } },
        { vendor: { name: { contains: search, mode: "insensitive" } } }
      ];
    }
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          vendor: { select: { id: true, name: true, email: true, phone: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          paxType: { select: { id: true, name: true } },
          supplierInvoices: {
            select: { id: true, invoiceNumber: true, invoiceDate: true },
            orderBy: { createdAt: "desc" },
            take: 1
          },
          _count: {
            select: { items: true, attachments: true, goodsReceipts: true, supplierInvoices: true }
          }
        }
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    const mappedOrders = orders.map(po => {
      let invoiceNum = (po as any).supplierInvoices?.[0]?.invoiceNumber || null;
      if (!invoiceNum && (po as any).quotationReference) {
        invoiceNum = (po as any).quotationReference.trim();
      }
      return {
        ...po,
        supplierInvoiceNumber: invoiceNum,
        invoiceNumber: invoiceNum
      };
    });

    return { orders: mappedOrders, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/procurement/purchase-orders/:id (Detailed View)
  fastify.get("/purchase-orders/:id", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        createdBy: { select: { id: true, name: true, email: true } },
        purchaseRequest: {
          include: { requestedBy: { select: { name: true } } }
        },
        paxType: { select: { id: true, name: true } },
        items: {
          include: {
            product: true,
            material: true
          }
        },
        attachments: true,
        approvals: {
          include: {
            requestedBy: { select: { name: true, email: true } },
            decidedBy: { select: { name: true, email: true } }
          },
          orderBy: { createdAt: "desc" }
        },
        goodsReceipts: {
          include: {
            receivedBy: { select: { name: true } },
            items: true
          }
        },
        supplierInvoices: {
          include: {
            items: true
          }
        }
      }
    });

    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    let invoiceNum = po.supplierInvoices?.[0]?.invoiceNumber || null;
    if (!invoiceNum && po.quotationReference) {
      invoiceNum = po.quotationReference.trim();
    }

    return {
      ...po,
      supplierInvoiceNumber: invoiceNum,
      invoiceNumber: invoiceNum
    };
  });

  // POST /crm/procurement/purchase-orders (Server Calculation & Concurrency-Safe Generation)
  fastify.post("/purchase-orders", poWriteHandler, async (request, reply) => {
    const data = PurchaseOrderCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    // Verify vendor
    const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
    if (!vendor) return reply.status(400).send({ error: "Selected Vendor not found in vendor registry." });

    // Financial arithmetic on server
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    // Resolve authoritative brand-specific product identities for lines that reference a product
    const referencedProductIds = Array.from(
      new Set(data.items.map((it) => it.productId).filter((id): id is string => !!id))
    );
    const productRecords = referencedProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: referencedProductIds } },
          select: { id: true, partNumber: true, brand: true, uin: true, materialId: true, isActive: true }
        })
      : [];
    const productById = new Map(productRecords.map((p) => [p.id, p]));
    const missingProduct = referencedProductIds.find((id) => !productById.has(id));
    if (missingProduct) {
      return reply.status(400).send({ error: `Product master ${missingProduct} referenced by a PO line was not found.` });
    }

    const computedItems = data.items.map(item => {
      const lineSub = item.quantityOrdered * item.unitPrice;
      const discount = Math.min(lineSub, item.discount || 0);
      const taxable = Math.max(0, lineSub - discount);
      const taxAmount = (taxable * (item.taxRate || 0)) / 100;
      const lineTotal = taxable + taxAmount;

      subtotal += lineSub;
      discountTotal += discount;
      taxTotal += taxAmount;

      const prod = item.productId ? productById.get(item.productId) : undefined;

      return {
        productId: item.productId || null,
        materialId: prod ? (prod.materialId || item.materialId || null) : (item.materialId || null),
        brand: prod ? prod.brand : (item.brand || null),
        partNumber: prod ? prod.partNumber : (item.partNumber || null),
        productUin: prod ? prod.uin : (item.productUin || null),
        imageUrl: item.imageUrl || null,
        batchNumber: item.batchNumber?.trim() || null,
        description: item.description,
        quantityOrdered: item.quantityOrdered,
        quantityPending: item.quantityOrdered,
        unitPrice: item.unitPrice,
        discount,
        taxRate: item.taxRate,
        taxAmount,
        lineSubtotal: lineSub,
        lineTotal,
        specification: item.specification || null,
        expectedDeliveryDate: item.expectedDeliveryDate ? new Date(item.expectedDeliveryDate) : null
      };
    });

    // 0. Idempotency & Retry Duplicate Check
    const additionalCharges = data.additionalCharges || 0;
    const grandTotal = subtotal - discountTotal + taxTotal + additionalCharges;

    if (data.idempotencyKey && data.idempotencyKey.trim()) {
      const existingAudit = await prisma.auditLog.findFirst({
        where: {
          entityType: "purchase_order",
          action: { in: ["PURCHASE_ORDER_CREATED", "PURCHASE_ORDER_AUTO_APPROVED", "PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL"] },
          metadata: { path: ["idempotencyKey"], equals: data.idempotencyKey.trim() }
        },
        orderBy: { timestamp: "desc" }
      });
      if (existingAudit?.entityId) {
        const existingPO = await prisma.purchaseOrder.findUnique({
          where: { id: existingAudit.entityId },
          include: { items: true, vendor: true, attachments: true, approvals: true }
        });
        if (existingPO) {
          return reply.status(200).send(existingPO);
        }
      }
    } else {
      const recentDuplicate = await prisma.purchaseOrder.findFirst({
        where: {
          createdById: actor.id,
          vendorId: data.vendorId,
          quotationReference: data.quotationReference?.trim() || null,
          createdAt: { gte: new Date(Date.now() - 5000) }
        },
        include: { items: true, vendor: true, attachments: true, approvals: true }
      });
      if (
        recentDuplicate && 
        recentDuplicate.items.length === data.items.length &&
        Math.abs(Number(recentDuplicate.grandTotal) - grandTotal) < 0.01
      ) {
        return reply.status(200).send(recentDuplicate);
      }
    }

    // Determine initial approval & status policy
    const userRoles = (request.user as any)?.roles || [];
    const isAdminOrSuperAdmin = userRoles.includes("ADMIN") || userRoles.includes("SUPERADMIN");
    const isDraft = data.isDraft === true || data.status === "DRAFT";
    const shouldAutoApprove = !isDraft && isAdminOrSuperAdmin;
    const initialStatus = isDraft 
      ? "DRAFT" 
      : (shouldAutoApprove ? (data.issueToVendor ? "SENT" : "APPROVED") : "PENDING_APPROVAL");

    // Concurrency-safe PO creation with retry loop against duplicate poNumber
    let attempts = 0;
    let createdPO: any = null;

    while (attempts < 5 && !createdPO) {
      try {
        const poNumber = await generatePONumber();

        createdPO = await prisma.$transaction(async (tx) => {
          const doc = await tx.purchaseOrder.create({
            data: {
              poNumber,
              vendorId: data.vendorId,
              purchaseRequestId: data.purchaseRequestId || null,
              quotationReference: data.quotationReference?.trim() || null,
              projectRef: data.projectRef?.trim() || null,
              paxTypeId: data.paxTypeId || null,
              createdById: actor.id,
              orderDate: new Date(),
              expectedDeliveryDate: new Date(data.expectedDeliveryDate),
              status: initialStatus,
              currency: data.currency || "INR",
              subtotal,
              discount: discountTotal,
              tax: taxTotal,
              additionalCharges,
              grandTotal,
              paymentTerms: data.paymentTerms,
              deliveryTerms: data.deliveryTerms,
              billingAddress: data.billingAddress,
              deliveryAddress: data.deliveryAddress,
              notes: data.notes?.trim() || null
            }
          });

          // Insert items
          for (const item of computedItems) {
            await tx.purchaseOrderItem.create({
              data: {
                purchaseOrderId: doc.id,
                ...item
              }
            });
          }

          // Insert attachments if passed
          if (data.attachments && data.attachments.length > 0) {
            for (const att of data.attachments) {
              await tx.purchaseOrderAttachment.create({
                data: {
                  purchaseOrderId: doc.id,
                  fileName: att.fileName,
                  fileUrl: att.fileUrl,
                  fileSize: att.fileSize || null,
                  fileType: att.fileType || null,
                  uploadedById: actor.id
                }
              });
            }
          }

          // Link or create Supplier Invoice if supplied on creation
          if (data.supplierInvoiceNumber && data.supplierInvoiceNumber.trim()) {
            const normInv = data.supplierInvoiceNumber.trim();
            const existingInv = await tx.supplierInvoice.findFirst({
              where: { vendorId: data.vendorId, invoiceNumber: normInv }
            });
            if (existingInv) {
              await tx.supplierInvoice.update({
                where: { id: existingInv.id },
                data: { purchaseOrderId: doc.id }
              });
            } else {
              await tx.supplierInvoice.create({
                data: {
                  invoiceNumber: normInv,
                  purchaseOrderId: doc.id,
                  vendorId: data.vendorId,
                  invoiceDate: new Date(),
                  status: "VERIFIED",
                  currency: data.currency || "INR",
                  subtotal,
                  tax: taxTotal,
                  grandTotal,
                  notes: "Recorded during Purchase Order creation",
                  createdById: actor.id
                }
              });
            }
          }

          // Record approval trail
          if (shouldAutoApprove) {
            await tx.purchaseOrderApproval.create({
              data: {
                purchaseOrderId: doc.id,
                requestedById: actor.id,
                decidedById: actor.id,
                status: "APPROVED",
                comments: "Auto-approved per Admin/Superadmin PO Creation Policy"
              }
            });
          } else if (!isDraft) {
            // Submitted by non-admin: pending review
            await tx.purchaseOrderApproval.create({
              data: {
                purchaseOrderId: doc.id,
                requestedById: actor.id,
                status: "PENDING"
              }
            });
          }

          // Update linked PR if present
          if (data.purchaseRequestId) {
            await tx.purchaseRequest.update({
              where: { id: data.purchaseRequestId },
              data: { status: "ORDERED" }
            });
          }

          // Audit log
          const auditAction = shouldAutoApprove
            ? "PURCHASE_ORDER_AUTO_APPROVED"
            : (isDraft ? "PURCHASE_ORDER_CREATED" : "PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL");

          await tx.auditLog.create({
            data: {
              entityType: "purchase_order",
              entityId: doc.id,
              actorId: actor.id,
              action: auditAction,
              prevStatus: isDraft ? undefined : "DRAFT",
              newStatus: doc.status,
              metadata: {
                poNumber: doc.poNumber,
                vendorName: vendor.name,
                itemCount: computedItems.length,
                grandTotal: Number(grandTotal),
                idempotencyKey: data.idempotencyKey?.trim() || null,
                policy: shouldAutoApprove ? "ADMIN_SUPERADMIN_AUTO_APPROVAL" : undefined,
                issuedToVendor: doc.status === "SENT"
              }
            }
          });

          const fullDoc = await tx.purchaseOrder.findUnique({
            where: { id: doc.id },
            include: { items: true, vendor: true, approvals: true }
          });
          return fullDoc;
        });
      } catch (err: any) {
        if (err?.code === "P2002" && attempts < 4) {
          attempts++;
          continue;
        }
        throw err;
      }
    }

    await triggerProcurementNotification(null, "ADMIN", `New Purchase Order ${createdPO.poNumber} created as DRAFT.`);
    return reply.status(201).send(createdPO);
  });

  // PUT /crm/procurement/purchase-orders/:id (Update Draft PO)
  fastify.put("/purchase-orders/:id", poWriteHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = PurchaseOrderCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    if (po.status !== "DRAFT" && po.status !== "REJECTED") {
      return reply.status(400).send({ error: `Cannot edit Purchase Order in status ${po.status}. Only DRAFT or REJECTED orders can be modified.` });
    }

    // Financial calculations
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    const computedItems = data.items.map(item => {
      const lineSub = item.quantityOrdered * item.unitPrice;
      const discount = Math.min(lineSub, item.discount || 0);
      const taxable = Math.max(0, lineSub - discount);
      const taxAmount = (taxable * (item.taxRate || 0)) / 100;
      const lineTotal = taxable + taxAmount;

      subtotal += lineSub;
      discountTotal += discount;
      taxTotal += taxAmount;

      return {
        productId: item.productId || null,
        materialId: item.materialId || null,
        brand: item.brand || null,
        partNumber: item.partNumber || null,
        productUin: item.productUin || null,
        imageUrl: item.imageUrl || null,
        batchNumber: item.batchNumber?.trim() || null,
        description: item.description,
        quantityOrdered: item.quantityOrdered,
        quantityPending: item.quantityOrdered,
        unitPrice: item.unitPrice,
        discount,
        taxRate: item.taxRate,
        taxAmount,
        lineSubtotal: lineSub,
        lineTotal,
        specification: item.specification || null,
        expectedDeliveryDate: item.expectedDeliveryDate ? new Date(item.expectedDeliveryDate) : null
      };
    });

    const additionalCharges = data.additionalCharges || 0;
    const grandTotal = subtotal - discountTotal + taxTotal + additionalCharges;

    const updated = await prisma.$transaction(async (tx) => {
      // Delete existing items and recreate
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });

      const doc = await tx.purchaseOrder.update({
        where: { id },
        data: {
          vendorId: data.vendorId,
          quotationReference: data.quotationReference?.trim() || null,
          projectRef: data.projectRef?.trim() || null,
          paxTypeId: data.paxTypeId || null,
          expectedDeliveryDate: new Date(data.expectedDeliveryDate),
          currency: data.currency || "INR",
          subtotal,
          discount: discountTotal,
          tax: taxTotal,
          additionalCharges,
          grandTotal,
          paymentTerms: data.paymentTerms,
          deliveryTerms: data.deliveryTerms,
          billingAddress: data.billingAddress,
          deliveryAddress: data.deliveryAddress,
          notes: data.notes?.trim() || null
        }
      });

      for (const item of computedItems) {
        await tx.purchaseOrderItem.create({
          data: {
            purchaseOrderId: id,
            ...item
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase_order",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_ORDER_UPDATED",
          metadata: { poNumber: po.poNumber, grandTotal: Number(grandTotal) }
        }
      });

      return doc;
    });

    return updated;
  });

  // PUT /crm/procurement/purchase-orders/:id/submit (Submit for Approval or Auto-Approve if Admin/Superadmin)
  fastify.put("/purchase-orders/:id/submit", poWriteHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { issueToVendor } = (request.body as { issueToVendor?: boolean }) || {};
    const actor = request.user as { id: string; roles?: string[] };
    const userRoles = actor?.roles || [];
    const isAdminOrSuperAdmin = userRoles.includes("ADMIN") || userRoles.includes("SUPERADMIN");

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    if (po.status === "APPROVED" || po.status === "SENT") {
      return reply.status(200).send(po);
    }

    if (po.status !== "DRAFT" && po.status !== "REJECTED") {
      return reply.status(400).send({ error: `Cannot submit Purchase Order in status ${po.status}.` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (isAdminOrSuperAdmin) {
        // Auto-approve workflow for Admin / Superadmin
        const nextStatus = issueToVendor ? "SENT" : "APPROVED";
        const doc = await tx.purchaseOrder.update({
          where: { id },
          data: { status: nextStatus as any }
        });

        const pendingApproval = await tx.purchaseOrderApproval.findFirst({
          where: { purchaseOrderId: id, status: "PENDING" },
          orderBy: { createdAt: "desc" }
        });

        if (pendingApproval) {
          await tx.purchaseOrderApproval.update({
            where: { id: pendingApproval.id },
            data: {
              status: "APPROVED",
              decidedById: actor.id,
              comments: "Auto-approved by Administrator submission"
            }
          });
        } else {
          await tx.purchaseOrderApproval.create({
            data: {
              purchaseOrderId: id,
              requestedById: actor.id,
              decidedById: actor.id,
              status: "APPROVED",
              comments: "Auto-approved by Administrator submission"
            }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "purchase_order",
            entityId: id,
            actorId: actor.id,
            action: "PURCHASE_ORDER_AUTO_APPROVED",
            prevStatus: po.status,
            newStatus: nextStatus,
            metadata: { autoApproved: true, issuedToVendor: Boolean(issueToVendor) }
          }
        });

        return doc;
      } else {
        // Standard segregation of duties for non-admins (e.g. PURCHASE_MANAGER)
        const doc = await tx.purchaseOrder.update({
          where: { id },
          data: { status: "PENDING_APPROVAL" }
        });

        await tx.purchaseOrderApproval.create({
          data: {
            purchaseOrderId: id,
            requestedById: actor.id,
            status: "PENDING"
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "purchase_order",
            entityId: id,
            actorId: actor.id,
            action: "PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL",
            prevStatus: po.status,
            newStatus: "PENDING_APPROVAL"
          }
        });

        return doc;
      }
    });

    if (isAdminOrSuperAdmin) {
      await triggerProcurementNotification(null, "INVENTORY_MANAGER", `Purchase Order ${po.poNumber} is APPROVED and ready for receiving.`);
    } else {
      await triggerProcurementNotification(null, "ADMIN", `Purchase Order ${po.poNumber} has been submitted for approval.`);
    }

    return updated;
  });

  // PUT /crm/procurement/purchase-orders/:id/issue-to-vendor (Issue PO to Vendor: APPROVED -> SENT)
  fastify.put("/purchase-orders/:id/issue-to-vendor", poWriteHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    if (po.status !== "APPROVED") {
      return reply.status(400).send({ error: `Cannot issue PO to vendor from status "${po.status}". PO must be APPROVED first.` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseOrder.update({
        where: { id },
        data: { status: "SENT" }
      });

      await tx.auditLog.create({
        data: {
          entityType: "purchase_order",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_ORDER_ISSUED_TO_VENDOR",
          prevStatus: "APPROVED",
          newStatus: "SENT"
        }
      });

      return doc;
    });

    await triggerProcurementNotification(null, "INVENTORY_MANAGER", `Purchase Order ${po.poNumber} has been issued to vendor and is ready for receiving.`);
    return updated;
  });

  // PUT /crm/procurement/purchase-orders/:id/approve (Admin Approval with Segregation-of-Duties)
  fastify.put("/purchase-orders/:id/approve", poApproveHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { comments } = (request.body as { comments?: string }) || {};
    const actor = request.user as { id: string };

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    if (po.status !== "PENDING_APPROVAL" && po.status !== "DRAFT") {
      return reply.status(400).send({ error: `Purchase Order cannot be approved from status "${po.status}".` });
    }

    // Segregation of Duties: Ordinary admins cannot self-approve their own created PO
    const userRoles = (request.user as any)?.roles || [];
    const isSuperAdmin = userRoles.includes("SUPERADMIN");
    if (po.createdById === actor.id && !isSuperAdmin) {
      return reply.status(403).send({ 
        error: "Segregation of duties violation: PO creator cannot approve their own Purchase Order. A separate administrator or superadmin must approve." 
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseOrder.update({
        where: { id },
        data: { status: "APPROVED" }
      });

      const pendingApproval = await tx.purchaseOrderApproval.findFirst({
        where: { purchaseOrderId: id, status: "PENDING" },
        orderBy: { createdAt: "desc" }
      });

      if (pendingApproval) {
        await tx.purchaseOrderApproval.update({
          where: { id: pendingApproval.id },
          data: {
            status: "APPROVED",
            decidedById: actor.id,
            comments: comments || "Approved by Administrator"
          }
        });
      } else {
        await tx.purchaseOrderApproval.create({
          data: {
            purchaseOrderId: id,
            requestedById: po.createdById,
            decidedById: actor.id,
            status: "APPROVED",
            comments: comments || "Direct Approval by Administrator"
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase_order",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_ORDER_APPROVED",
          prevStatus: po.status,
          newStatus: "APPROVED",
          metadata: { comments }
        }
      });

      return doc;
    });

    await triggerProcurementNotification(po.createdById, null, `Your Purchase Order ${po.poNumber} has been APPROVED.`);
    return updated;
  });

  // PUT /crm/procurement/purchase-orders/:id/reject (Admin Rejection)
  fastify.put("/purchase-orders/:id/reject", poApproveHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { reason, comments } = (request.body as { reason: string; comments?: string }) || {};
    const actor = request.user as { id: string };

    if (!reason || !reason.trim()) {
      return reply.status(400).send({ error: "Rejection reason is mandatory when rejecting a Purchase Order." });
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    if (po.status !== "PENDING_APPROVAL" && po.status !== "DRAFT") {
      return reply.status(400).send({ error: `Cannot reject PO in status "${po.status}".` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.purchaseOrder.update({
        where: { id },
        data: { status: "REJECTED" }
      });

      const pendingApproval = await tx.purchaseOrderApproval.findFirst({
        where: { purchaseOrderId: id, status: "PENDING" },
        orderBy: { createdAt: "desc" }
      });

      if (pendingApproval) {
        await tx.purchaseOrderApproval.update({
          where: { id: pendingApproval.id },
          data: {
            status: "REJECTED",
            decidedById: actor.id,
            reason: reason.trim(),
            comments: comments?.trim() || null
          }
        });
      } else {
        await tx.purchaseOrderApproval.create({
          data: {
            purchaseOrderId: id,
            requestedById: po.createdById,
            decidedById: actor.id,
            status: "REJECTED",
            reason: reason.trim(),
            comments: comments?.trim() || null
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "purchase_order",
          entityId: id,
          actorId: actor.id,
          action: "PURCHASE_ORDER_REJECTED",
          prevStatus: po.status,
          newStatus: "REJECTED",
          metadata: { reason, comments }
        }
      });

      return doc;
    });

    await triggerProcurementNotification(po.createdById, null, `Your Purchase Order ${po.poNumber} was REJECTED: ${reason}`);
    return updated;
  });

  // POST /crm/procurement/purchase-orders/:id/attachments (Upload Quotation/Specs Attachment)
  fastify.post("/purchase-orders/:id/attachments", poWriteHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    try {
      const fileData = await (request as any).file();
      if (!fileData) return reply.status(400).send({ error: "No file provided for upload" });

      const buffer = await fileData.toBuffer();
      const uploadResult = await StorageService.uploadPOAttachment(
        buffer,
        fileData.filename,
        fileData.mimetype
      );

      const attachment = await prisma.purchaseOrderAttachment.create({
        data: {
          purchaseOrderId: id,
          fileName: fileData.filename,
          fileUrl: uploadResult.url,
          fileSize: buffer.length,
          fileType: fileData.mimetype,
          uploadedById: actor.id
        }
      });

      return reply.status(201).send(attachment);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to upload attachment" });
    }
  });

  // PUT /crm/procurement/purchase-orders/:id/status (Workflow state moves)
  fastify.put("/purchase-orders/:id/status", poWriteHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: any };
    const actor = request.user as { id: string };

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    const from = po.status;
    const to = status;

    let valid = false;
    if (from === "DRAFT" && ["PENDING_APPROVAL", "CANCELLED"].includes(to)) valid = true;
    if (from === "PENDING_APPROVAL" && ["APPROVED", "REJECTED"].includes(to)) valid = true;
    if (from === "APPROVED" && ["SENT", "CANCELLED"].includes(to)) valid = true;
    if (from === "SENT" && ["CANCELLED"].includes(to)) valid = true;

    if (!valid && from !== to) {
      return reply.status(400).send({ error: `Invalid PO status move from ${from} to ${to}` });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "purchase_order",
        entityId: id,
        actorId: actor.id,
        action: "PURCHASE_ORDER_STATUS_CHANGED",
        prevStatus: from,
        newStatus: to
      }
    });

    return updated;
  });


  // =========================================================
  // --- SUPPLIER INVOICES (PO -> Invoice Integration) ---
  // =========================================================

  // GET /crm/procurement/supplier-invoices
  fastify.get("/supplier-invoices", purchasePreHandler, async (request, reply) => {
    const { purchaseOrderId, vendorId } = request.query as any;
    const where: any = {};
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (vendorId) where.vendorId = vendorId;

    const invoices = await prisma.supplierInvoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        vendor: { select: { name: true } },
        purchaseOrder: { select: { poNumber: true } },
        items: true
      }
    });

    return invoices;
  });

  // POST /crm/procurement/supplier-invoices (Record Billed Products against PO)
  fastify.post("/supplier-invoices", poWriteHandler, async (request, reply) => {
    const data = SupplierInvoiceCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: { items: true }
    });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    if (po.vendorId !== data.vendorId) {
      return reply.status(400).send({ error: "Invoice vendor must match the Purchase Order vendor." });
    }
    const INVOICEABLE = ["APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED"];
    if (!INVOICEABLE.includes(po.status)) {
      return reply.status(400).send({ error: `Supplier invoices cannot be recorded for a PO in status ${po.status}.` });
    }

    // Each billed line must reference a product/material ordered on this PO
    const lineKey = (it: { productId?: string | null; materialId?: string | null }) =>
      it.productId ? `P:${it.productId}` : it.materialId ? `M:${it.materialId}` : null;
    const orderedByKey = new Map<string, { qty: number; description: string }>();
    for (const poItem of po.items) {
      const key = lineKey(poItem);
      if (!key) continue;
      const prev = orderedByKey.get(key);
      orderedByKey.set(key, {
        qty: (prev?.qty || 0) + poItem.quantityOrdered,
        description: prev?.description || poItem.description
      });
    }
    const requestedByKey = new Map<string, number>();
    for (const item of data.items) {
      const key = lineKey(item);
      if (!key || !orderedByKey.has(key)) {
        return reply.status(400).send({ error: `Line "${item.description}" is not part of PO ${po.poNumber}.` });
      }
      requestedByKey.set(key, (requestedByKey.get(key) || 0) + item.quantityBilled);
    }

    const normalizedInvoiceNumber = data.invoiceNumber.trim().toUpperCase();
    const duplicate = await prisma.supplierInvoice.findFirst({
      where: { invoiceNumber: normalizedInvoiceNumber, vendorId: data.vendorId },
      select: { id: true }
    });
    if (duplicate) {
      return reply.status(409).send({ error: `Invoice ${normalizedInvoiceNumber} is already recorded for this supplier.` });
    }

    // Validate billed products against PO items
    let subtotal = 0;
    let taxTotal = 0;

    const itemsToCreate = data.items.map(item => {
      const lineSub = item.quantityBilled * item.unitPrice;
      const taxAmount = (lineSub * (item.taxRate || 0)) / 100;
      const lineTotal = lineSub + taxAmount;

      subtotal += lineSub;
      taxTotal += taxAmount;

      return {
        productId: item.productId || null,
        materialId: item.materialId || null,
        description: item.description,
        quantityBilled: item.quantityBilled,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        lineTotal
      };
    });

    const grandTotal = subtotal + taxTotal;

    let invoice;
    try {
    invoice = await prisma.$transaction(async (tx) => {
      // Row-lock the PO so concurrent invoices for the same PO are serialized (over-billing guard)
      await tx.purchaseOrder.update({ where: { id: po.id }, data: { updatedAt: new Date() } });

      const priorItems = await tx.supplierInvoiceItem.findMany({
        where: { supplierInvoice: { purchaseOrderId: po.id, status: { not: "CANCELLED" } } },
        select: { productId: true, materialId: true, quantityBilled: true }
      });
      const billedByKey = new Map<string, number>();
      for (const pi of priorItems) {
        const key = lineKey(pi);
        if (key) billedByKey.set(key, (billedByKey.get(key) || 0) + pi.quantityBilled);
      }
      for (const [key, qty] of requestedByKey) {
        const ordered = orderedByKey.get(key)!;
        const already = billedByKey.get(key) || 0;
        if (already + qty > ordered.qty) {
          const err: any = new Error(
            `Over-billing: "${ordered.description}" ordered ${ordered.qty}, already billed ${already}, attempted ${qty}.`
          );
          err.statusCode = 400;
          throw err;
        }
      }

      const doc = await tx.supplierInvoice.create({
        data: {
          invoiceNumber: normalizedInvoiceNumber,
          purchaseOrderId: data.purchaseOrderId,
          vendorId: data.vendorId,
          invoiceDate: new Date(data.invoiceDate),
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          status: "VERIFIED",
          currency: po.currency,
          subtotal,
          tax: taxTotal,
          grandTotal,
          notes: data.notes?.trim() || null,
          attachmentUrl: data.attachmentUrl || null,
          createdById: actor.id
        }
      });

      for (const it of itemsToCreate) {
        await tx.supplierInvoiceItem.create({
          data: {
            supplierInvoiceId: doc.id,
            ...it
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "supplier_invoice",
          entityId: doc.id,
          actorId: actor.id,
          action: "SUPPLIER_INVOICE_RECORDED",
          metadata: {
            invoiceNumber: doc.invoiceNumber,
            poNumber: po.poNumber,
            grandTotal: Number(grandTotal)
          }
        }
      });

      return doc;
    });
    } catch (err: any) {
      if (err?.statusCode === 400) return reply.status(400).send({ error: err.message });
      if (err?.code === "P2002") {
        return reply.status(409).send({ error: `Invoice ${normalizedInvoiceNumber} is already recorded for this supplier.` });
      }
      throw err;
    }

    return reply.status(201).send(invoice);
  });



  // --- GOODS RECEIPT ENDPOINTS ---

  // GET /crm/procurement/goods-receipts
  fastify.get("/goods-receipts", purchasePreHandler, async (request, reply) => {
    const { search, status, vendorId, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (search) {
      where.grnNumber = { contains: search, mode: "insensitive" };
    }
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;

    const [receipts, total] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          vendor: { select: { name: true } },
          receivedBy: { select: { name: true } },
          purchaseOrder: { select: { poNumber: true } }
        }
      }),
      prisma.goodsReceipt.count({ where })
    ]);

    return { receipts, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/procurement/goods-receipts/:id
  fastify.get("/goods-receipts/:id", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const grn = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        vendor: true,
        receivedBy: { select: { name: true, email: true } },
        purchaseOrder: true,
        warehouse: true,
        items: { include: { material: true } }
      }
    });
    if (!grn) return reply.status(404).send({ error: "Goods Receipt not found" });
    return grn;
  });

  // POST /crm/procurement/goods-receipts (EXPECTED status)
  fastify.post("/goods-receipts", purchasePreHandler, async (request, reply) => {
    const data = GoodsReceiptCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const po = await prisma.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId } });
    if (!po) return reply.status(400).send({ error: "Purchase Order not found" });

    if (po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
      return reply.status(400).send({ error: "PO must be under status SENT or PARTIALLY_RECEIVED to spawn GRN" });
    }

    const grnNumber = await generateGRNNumber();

    const grn = await prisma.$transaction(async (tx) => {
      const doc = await tx.goodsReceipt.create({
        data: {
          grnNumber,
          purchaseOrderId: data.purchaseOrderId,
          vendorId: data.vendorId,
          warehouseId: data.warehouseId,
          receivedById: actor.id,
          status: "EXPECTED",
          notes: data.notes
        }
      });

      for (const item of data.items) {
        await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: doc.id,
            materialId: item.materialId,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: item.quantityReceived,
            batchNumber: item.batchNumber,
            serialNumber: item.serialNumber,
            notes: item.notes
          }
        });
      }

      await tx.auditLog.create({
        data: {
          entityType: "goods-receipt",
          entityId: doc.id,
          actorId: actor.id,
          action: "GOODS_RECEIPT_EXPECTED_CREATED",
          newStatus: "EXPECTED",
          metadata: { grnNumber }
        }
      });

      return doc;
    });

    return grn;
  });

  // PUT /crm/procurement/goods-receipts/:id/receive (Moves to RECEIVING / QC_PENDING)
  fastify.put("/goods-receipts/:id/receive", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { items } = request.body as { items: Array<{ itemId: string; quantityReceived: number }> };
    const actor = request.user as { id: string };

    const grn = await prisma.goodsReceipt.findUnique({ where: { id } });
    if (!grn) return reply.status(404).send({ error: "Goods Receipt not found" });

    if (grn.status !== "EXPECTED") {
      return reply.status(400).send({ error: "Goods Receipt has already been received/processed" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.goodsReceiptItem.update({
          where: { id: item.itemId },
          data: { 
            quantityReceived: item.quantityReceived,
            inspectionStatus: "PENDING"
          }
        });
      }

      const doc = await tx.goodsReceipt.update({
        where: { id },
        data: { status: "QC_PENDING" }
      });

      await tx.auditLog.create({
        data: {
          entityType: "goods-receipt",
          entityId: id,
          actorId: actor.id,
          action: "GOODS_RECEIPT_RECEIVED_QC_PENDING",
          prevStatus: "EXPECTED",
          newStatus: "QC_PENDING"
        }
      });

      return doc;
    });

    return updated;
  });

  // PUT /crm/procurement/goods-receipts/:id/inspect (Record accepted/rejected quantities)
  fastify.put("/goods-receipts/:id/inspect", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { items } = request.body as { items: Array<{ itemId: string; acceptedQty: number; rejectedQty: number; damagedQty?: number }> };
    const actor = request.user as { id: string };

    const grn = await prisma.goodsReceipt.findUnique({ where: { id } });
    if (!grn) return reply.status(404).send({ error: "Goods Receipt not found" });

    if (grn.status !== "QC_PENDING") {
      return reply.status(400).send({ error: "Goods Receipt is not pending QC inspection" });
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const row = await tx.goodsReceiptItem.findUnique({ where: { id: item.itemId } });
        if (!row) throw new Error("GRN Item not found");

        if (item.acceptedQty + item.rejectedQty > row.quantityReceived) {
          throw new Error(`QC sums exceed received quantity bounds. Received: ${row.quantityReceived}`);
        }

        await tx.goodsReceiptItem.update({
          where: { id: item.itemId },
          data: {
            quantityAccepted: item.acceptedQty,
            quantityRejected: item.rejectedQty,
            quantityDamaged: item.damagedQty || 0,
            inspectionStatus: item.acceptedQty > 0 ? "PASSED" : "FAILED"
          }
        });
      }

      const allItems = await tx.goodsReceiptItem.findMany({ where: { goodsReceiptId: id } });
      const totalAcc = allItems.reduce((acc, x) => acc + x.quantityAccepted, 0);
      const totalRej = allItems.reduce((acc, x) => acc + x.quantityRejected, 0);

      let nextStatus = "ACCEPTED";
      if (totalAcc > 0 && totalRej > 0) nextStatus = "PARTIALLY_ACCEPTED";
      else if (totalAcc === 0 && totalRej > 0) nextStatus = "REJECTED";

      const doc = await tx.goodsReceipt.update({
        where: { id },
        data: { status: nextStatus as any }
      });

      await tx.auditLog.create({
        data: {
          entityType: "goods-receipt",
          entityId: id,
          actorId: actor.id,
          action: "GOODS_RECEIPT_INSPECTED",
          prevStatus: "QC_PENDING",
          newStatus: nextStatus as any
        }
      });

      return doc;
    });

    return updated;
  });

  // PUT /crm/procurement/goods-receipts/:id/stock (STOCKED: Increases inventory & movement logs)
  fastify.put("/goods-receipts/:id/stock", purchasePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { warehouseId, locationId } = request.body as { warehouseId: string; locationId?: string };
    const actor = request.user as { id: string };

    const grn = await prisma.goodsReceipt.findUnique({ 
      where: { id },
      include: { items: true }
    });
    if (!grn) return reply.status(404).send({ error: "Goods Receipt not found" });

    if (!["ACCEPTED", "PARTIALLY_ACCEPTED"].includes(grn.status)) {
      return reply.status(400).send({ error: `Only accepted/partially accepted goods can be stocked. Current status: ${grn.status}` });
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Sort items deterministically to prevent deadlocks
        const sortedItems = [...grn.items].sort((a, b) => 
          (a.materialId || a.productId || a.id).localeCompare(b.materialId || b.productId || b.id)
        );

        // 1. Finalize stock movements
        for (const item of sortedItems) {
          const acceptedQty = item.quantityAccepted;
          if (acceptedQty <= 0) continue;

          // If item is linked to raw Material SKU
          if (item.materialId) {
            // Lock the Material row first
            await tx.$executeRawUnsafe(
              `SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`,
              item.materialId
            );

            // Increase raw material stock
            const material = await tx.material.findUnique({ where: { id: item.materialId } });
            if (!material) throw new Error(`Material SKU not found: ${item.materialId}`);

            const beforeQty = material.quantity;
            const afterQty = beforeQty + acceptedQty;

            await tx.material.update({
              where: { id: item.materialId },
              data: { quantity: afterQty }
            });

            // Stock location balances if location provided
            if (warehouseId && locationId) {
              const balance = await tx.materialLocationBalance.findUnique({
                where: {
                  materialId_warehouseId_locationId: {
                    materialId: item.materialId,
                    warehouseId,
                    locationId
                  }
                }
              });

              if (balance) {
                await tx.materialLocationBalance.update({
                  where: { id: balance.id },
                  data: { quantity: balance.quantity + acceptedQty }
                });
              } else {
                await tx.materialLocationBalance.create({
                  data: {
                    materialId: item.materialId,
                    warehouseId,
                    locationId,
                    quantity: acceptedQty
                  }
                });
              }
            }

            // Create stock movement record
            await tx.stockMovement.create({
              data: {
                materialId: item.materialId,
                quantity: acceptedQty,
                movementType: "RECEIPT",
                source: "GOODS_RECEIPT",
                referenceId: id,
                warehouseId,
                locationId,
                userId: actor.id,
                reason: `GRN: ${grn.grnNumber} Stocking`
              }
            });
          }

          // Update Purchase Order Items pending totals
          const poItem = await tx.purchaseOrderItem.findFirst({
            where: {
              purchaseOrderId: grn.purchaseOrderId,
              OR: [
                ...(item.productId ? [{ productId: item.productId }] : []),
                ...(item.materialId ? [{ materialId: item.materialId }] : [])
              ]
            }
          });

          if (poItem) {
            const processed = poItem.quantityReceived + acceptedQty;
            const pending = Math.max(0, poItem.quantityOrdered - processed - poItem.quantityCancelled);
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: {
                quantityReceived: processed,
                quantityPending: pending
              }
            });
          }
        }

        // 2. Adjust Purchase Order status
        const allPOItems = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: grn.purchaseOrderId }
        });
        const poAllPending = allPOItems.reduce((acc, x) => acc + x.quantityPending, 0);
        const poAllReceived = allPOItems.reduce((acc, x) => acc + x.quantityReceived, 0);

        let poStatus = "PARTIALLY_RECEIVED";
        if (poAllPending === 0) poStatus = "RECEIVED";

        await tx.purchaseOrder.update({
          where: { id: grn.purchaseOrderId },
          data: { status: poStatus as any }
        });

        // 3. Mark GRN as STOCKED
        const finalizedGRN = await tx.goodsReceipt.update({
          where: { id },
          data: { 
            status: "STOCKED",
            warehouseId 
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "goods-receipt",
            entityId: id,
            actorId: actor.id,
            action: "GOODS_RECEIPT_STOCKED_INVENTORY",
            prevStatus: grn.status,
            newStatus: "STOCKED"
          }
        });

        // 4. Auto-recheck open shortage requirements affected by incoming GRN materials
        const receivedMaterialIds = grn.items
          .map(item => item.materialId)
          .filter((id): id is string => Boolean(id));

        if (receivedMaterialIds.length > 0) {
          const bomsWithIncoming = await tx.bOM.findMany({
            where: {
              items: {
                some: {
                  materialId: { in: receivedMaterialIds }
                }
              }
            },
            select: { name: true }
          });
          const bomNames = bomsWithIncoming.map(b => b.name);

          const allShortageReqs = await tx.productionRequirement.findMany({
            where: {
              status: "MATERIAL_SHORTAGE"
            }
          });
          
          const shortageReqs = allShortageReqs.filter(req => {
            return req.productRef && bomNames.some(bomName => bomName.toLowerCase().includes(req.productRef!.toLowerCase()));
          });

          for (const req of shortageReqs) {
            if (!req.productRef) continue;
            // Strict BOM match by name (No findFirst fallback!)
            const bom = await tx.bOM.findFirst({
              where: { name: { contains: req.productRef, mode: "insensitive" } },
              include: { items: { include: { material: true } } }
            });
            if (bom) {
              let hasShortage = false;
              for (const item of bom.items) {
                const neededQty = item.quantity * req.requiredQuantity;
                const activeRes = await tx.inventoryReservation.findMany({
                  where: { materialId: item.materialId, status: "RESERVED" }
                });
                const reservedQty = activeRes.reduce((acc, x) => acc + x.quantity, 0);

                const freshMat = await tx.material.findUnique({ where: { id: item.materialId } });
                const physicalStock = freshMat ? freshMat.quantity : 0;
                const availableQty = Math.max(0, physicalStock - reservedQty);

                if (neededQty > availableQty) {
                  hasShortage = true;
                  break;
                }
              }
              if (!hasShortage) {
                await tx.productionRequirement.update({
                  where: { id: req.id },
                  data: { status: "READY" }
                });
                await tx.auditLog.create({
                  data: {
                    entityType: "production-requirement",
                    entityId: req.id,
                    actorId: actor.id,
                    action: "STATUS_CHANGED",
                    prevStatus: "MATERIAL_SHORTAGE",
                    newStatus: "READY",
                    metadata: { remarks: "Auto-transitioned via GRN stock replenishment" }
                  }
                });
              }
            }
          }
        }

        return finalizedGRN;
      });

      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || "Failed to stock goods receipt items" });
    }
  });

  // =========================================================
  // --- INVENTORY RECEIVING & BLIND VERIFICATION ENDPOINTS ---
  // =========================================================

  // GET /crm/procurement/receiving/purchase-orders (PO Receiving List: strictly strips commercial totals)
  fastify.get("/receiving/purchase-orders", receivingHandler, async (request, reply) => {
    const { search, status, page = "1", limit = "20" } = request.query as any;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};
    if (status) {
      where.status = status;
    } else {
      where.status = { in: ["APPROVED", "SENT", "RECEIVED"] };
    }

    if (search) {
      where.OR = [
        { poNumber: { contains: search, mode: "insensitive" } },
        { vendor: { name: { contains: search, mode: "insensitive" } } },
        { supplierInvoices: { some: { invoiceNumber: { contains: search, mode: "insensitive" } } } }
      ];
    }

    const [pos, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { orderDate: "desc" },
        skip,
        take,
        include: {
          vendor: { select: { id: true, name: true, contact: true, email: true, phone: true } },
          supplierInvoices: { 
            select: { id: true, invoiceNumber: true, invoiceDate: true, status: true },
            orderBy: { createdAt: "desc" },
            take: 1
          },
          goodsReceipts: {
            select: { id: true, grnNumber: true, notes: true },
            orderBy: { createdAt: "desc" },
            take: 1
          },
          items: {
            select: { id: true, quantityOrdered: true, quantityReceived: true, quantityPending: true }
          }
        }
      }),
      prisma.purchaseOrder.count({ where })
    ]);

    const receivingList = pos.map(po => {
      const totalLines = po.items.length;
      const completedLines = po.items.filter(i => i.quantityPending === 0).length;

      let invoiceNum = po.supplierInvoices?.[0]?.invoiceNumber || null;
      if (!invoiceNum && po.goodsReceipts?.[0]?.notes) {
        const match = po.goodsReceipts[0].notes.match(/(?:Invoice:\s*|Supplier Invoice:\s*)([^\s|]+)/i);
        if (match) invoiceNum = match[1];
      }
      if (!invoiceNum && po.quotationReference) {
        invoiceNum = po.quotationReference.trim();
      }
      if (!invoiceNum && po.notes) {
        const match = po.notes.match(/(?:Invoice:\s*|Supplier Invoice:\s*|Bill:\s*)([^\s|]+)/i);
        if (match) invoiceNum = match[1];
      }

      return {
        id: po.id,
        poNumber: po.poNumber,
        vendorName: po.vendor.name,
        vendorContact: po.vendor.contact,
        supplierInvoiceNumber: invoiceNum,
        invoiceNumber: invoiceNum,
        orderDate: po.orderDate,
        expectedDeliveryDate: po.expectedDeliveryDate,
        status: po.status,
        totalLines,
        completedLines,
        isFullyReceived: po.status === "RECEIVED" || (totalLines > 0 && completedLines === totalLines)
      };
    });

    return {
      purchaseOrders: receivingList,
      total,
      page: parseInt(page, 10),
      limit: take
    };
  });

  // GET /crm/procurement/receiving/purchase-orders/:id (Blind Receiving Details: strictly no ordered quantities or prices)
  fastify.get("/receiving/purchase-orders/:id", receivingHandler, async (request, reply) => {
    const { id } = request.params as { id: string };

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        vendor: { select: { id: true, name: true, contact: true, email: true, phone: true } },
        supplierInvoices: {
          select: { id: true, invoiceNumber: true, invoiceDate: true, status: true },
          orderBy: { createdAt: "desc" }
        },
        goodsReceipts: {
          select: { id: true, grnNumber: true, notes: true },
          orderBy: { createdAt: "desc" },
          take: 1
        },
        items: {
          include: {
            product: {
              include: {
                material: true
              }
            },
            material: true
          }
        }
      }
    });

    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    const RECEIVABLE_STATUSES = ["APPROVED", "SENT", "RECEIVED"];
    if (!RECEIVABLE_STATUSES.includes(po.status)) {
      return reply.status(400).send({ 
        error: `Purchase Order ${po.poNumber} is in status ${po.status} and is not authorized for receiving.` 
      });
    }

    const blindItems = po.items.map(it => {
      const matType = it.material?.materialType || it.product?.material?.materialType || "NQZ";
      const isQCRequired = matType === "QTZ";

      return {
        id: it.id,
        productId: it.productId,
        materialId: it.materialId,
        productName: it.product?.name || it.material?.name || it.description,
        partNumber: it.product?.partNumber || it.material?.materialCode || it.partNumber || "",
        productUin: it.product?.uin || it.material?.sku || it.productUin || "",
        brand: it.product?.brand || it.brand || "Standard",
        category: it.product?.category || it.material?.category || "General",
        unit: it.product?.unit || it.material?.unit || "PCS",
        batchNumber: it.batchNumber || null,
        imageUrl: it.product?.imageUrl || it.imageUrl || null,
        specification: it.specification || it.product?.technicalSpecs || null,
        materialType: matType,
        isQualityInspectionRequired: isQCRequired,
        quantityReceived: it.quantityReceived
        // Strictly omit quantityOrdered, unitPrice, taxRate, taxAmount, lineSubtotal, lineTotal
      };
    });

    let invoiceNum = po.supplierInvoices?.[0]?.invoiceNumber || null;
    if (!invoiceNum && (po as any).goodsReceipts?.[0]?.notes) {
      const match = (po as any).goodsReceipts[0].notes.match(/(?:Invoice:\s*|Supplier Invoice:\s*)([^\s|]+)/i);
      if (match) invoiceNum = match[1];
    }
    if (!invoiceNum && po.quotationReference) {
      invoiceNum = po.quotationReference.trim();
    }
    if (!invoiceNum && po.notes) {
      const match = po.notes.match(/(?:Invoice:\s*|Supplier Invoice:\s*|Bill:\s*)([^\s|]+)/i);
      if (match) invoiceNum = match[1];
    }

    return {
      id: po.id,
      poNumber: po.poNumber,
      vendor: po.vendor,
      supplierInvoiceNumber: invoiceNum,
      invoiceNumber: invoiceNum,
      supplierInvoices: po.supplierInvoices,
      orderDate: po.orderDate,
      expectedDeliveryDate: po.expectedDeliveryDate,
      status: po.status,
      deliveryTerms: po.deliveryTerms,
      notes: po.notes,
      items: blindItems
    };
  });

  // POST /crm/procurement/receiving/purchase-orders/:id/receive (Blind Receiving Submission & Server-side Reconciliation)
  fastify.post("/receiving/purchase-orders/:id/receive", receivingHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { id: string };
    const data = BlindReceivingSubmitSchema.parse(request.body);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Concurrency lock: serialize concurrent receipts for the same PO
        await tx.$executeRawUnsafe(`SELECT * FROM "PurchaseOrder" WHERE id = $1 FOR UPDATE`, id);

        const po = await tx.purchaseOrder.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                material: true,
                product: { include: { material: true } }
              }
            },
            vendor: true
          }
        });

        if (!po) {
          const err: any = new Error("Purchase Order not found");
          err.statusCode = 404;
          throw err;
        }

        if (po.status === "RECEIVED") {
          const err: any = new Error(`Purchase Order ${po.poNumber} has already been fully received.`);
          err.statusCode = 400;
          throw err;
        }

        const RECEIVABLE = ["APPROVED", "SENT"];
        if (!RECEIVABLE.includes(po.status)) {
          const err: any = new Error(`Purchase Order cannot be received in status "${po.status}".`);
          err.statusCode = 400;
          throw err;
        }

        // Handle Draft Save (Does NOT post inventory or mark PO received)
        if (data.isDraft) {
          const grnNumber = await generateGRNNumber();
          let warehouseId = data.warehouseId;
          if (!warehouseId) {
            const wh = await tx.warehouse.findFirst();
            warehouseId = wh?.id;
          }

          const draftGrn = await tx.goodsReceipt.create({
            data: {
              grnNumber,
              purchaseOrderId: po.id,
              vendorId: po.vendorId,
              warehouseId,
              receivedById: actor.id,
              status: "RECEIVING",
              notes: data.supplierInvoiceNumber ? `DRAFT - Invoice: ${data.supplierInvoiceNumber}` : "DRAFT Receiving Record"
            }
          });

          if (data.supplierInvoiceNumber && data.supplierInvoiceNumber.trim()) {
            const normInvNum = data.supplierInvoiceNumber.trim();
            const existingInv = await tx.supplierInvoice.findFirst({
              where: { vendorId: po.vendorId, invoiceNumber: normInvNum }
            });
            if (!existingInv) {
              await tx.supplierInvoice.create({
                data: {
                  invoiceNumber: normInvNum,
                  purchaseOrderId: po.id,
                  vendorId: po.vendorId,
                  invoiceDate: new Date(),
                  status: "DRAFT",
                  currency: po.currency,
                  subtotal: 0,
                  tax: 0,
                  grandTotal: 0,
                  notes: `DRAFT - Invoice: ${normInvNum}`,
                  createdById: actor.id
                }
              });
            } else if (!existingInv.purchaseOrderId) {
              await tx.supplierInvoice.update({
                where: { id: existingInv.id },
                data: { purchaseOrderId: po.id }
              });
            }
          }

          for (const item of data.items) {
            const poItem = po.items.find(i => i.id === item.poItemId);
            if (!poItem) continue;
            await tx.goodsReceiptItem.create({
              data: {
                goodsReceiptId: draftGrn.id,
                productId: poItem.productId,
                materialId: poItem.materialId,
                quantityOrdered: poItem.quantityOrdered,
                quantityReceived: item.passedQty + item.defectiveQty,
                quantityAccepted: item.passedQty,
                quantityRejected: item.defectiveQty,
                batchNumber: item.batchNumber || poItem.batchNumber || null,
                inspectionStatus: "DRAFT",
                notes: [item.shortageNotes, item.defectNotes, item.notes].filter(Boolean).join(" | ") || null
              }
            });
          }

          await tx.auditLog.create({
            data: {
              entityType: "purchase_order",
              entityId: po.id,
              actorId: actor.id,
              action: "GOODS_RECEIPT_DRAFT_SAVED",
              metadata: { grnNumber, itemsCount: data.items.length }
            }
          });

          return { success: true, isDraft: true, grnNumber, message: "Receiving draft saved successfully without posting inventory." };
        }

        // Server-side outstanding quantity calculation & full receipt validation
        for (const item of data.items) {
          const poItem = po.items.find(i => i.id === item.poItemId);
          if (!poItem) {
            const err: any = new Error(`Invalid line item ID: ${item.poItemId}`);
            err.statusCode = 400;
            throw err;
          }

          const outstanding = poItem.quantityOrdered - poItem.quantityReceived - poItem.quantityCancelled;
          const entered = item.passedQty + item.defectiveQty;

          if (entered !== outstanding) {
            const productName = poItem.product?.name || poItem.material?.name || poItem.description;
            const err: any = new Error(
              `Quantity mismatch for "${productName}". Full receipt required — entered count does not match the authorized purchase order.`
            );
            err.statusCode = 400;
            throw err;
          }
        }

        // Warehouse resolution
        let warehouseId = data.warehouseId;
        if (!warehouseId) {
          const wh = await tx.warehouse.findFirst();
          if (wh) {
            warehouseId = wh.id;
          } else {
            // Auto-create default warehouse if none exists
            const defaultWh = await tx.warehouse.create({
              data: {
                name: "Central Warehouse",
                code: "WH-CENTRAL"
              }
            });
            warehouseId = defaultWh.id;
          }
        }

        // Supplier Invoice traceability
        if (data.supplierInvoiceNumber && data.supplierInvoiceNumber.trim()) {
          const normInvNum = data.supplierInvoiceNumber.trim();
          const existingInv = await tx.supplierInvoice.findFirst({
            where: { vendorId: po.vendorId, invoiceNumber: normInvNum }
          });
          if (!existingInv) {
            await tx.supplierInvoice.create({
              data: {
                invoiceNumber: normInvNum,
                purchaseOrderId: po.id,
                vendorId: po.vendorId,
                invoiceDate: new Date(),
                status: "VERIFIED",
                currency: po.currency,
                subtotal: 0,
                tax: 0,
                grandTotal: 0,
                notes: `Recorded during receiving verification`,
                createdById: actor.id
              }
            });
          }
        }

        // Check if any received item requires Quality Control (QTZ)
        let anyQTZPassed = false;
        for (const item of data.items) {
          const poItem = po.items.find(i => i.id === item.poItemId);
          const isQTZ = poItem?.material?.materialType === "QTZ" || poItem?.product?.material?.materialType === "QTZ";
          if (isQTZ && item.passedQty > 0) {
            anyQTZPassed = true;
          }
        }

        const grnNumber = await generateGRNNumber();
        const grnStatus = anyQTZPassed ? "QC_PENDING" : "STOCKED";

        const grn = await tx.goodsReceipt.create({
          data: {
            grnNumber,
            purchaseOrderId: po.id,
            vendorId: po.vendorId,
            warehouseId,
            receivedById: actor.id,
            status: grnStatus,
            notes: data.supplierInvoiceNumber ? `Supplier Invoice: ${data.supplierInvoiceNumber.trim()}` : null
          }
        });

        // Process each item and apply stock posting rules
        for (const item of data.items) {
          const poItem = po.items.find(i => i.id === item.poItemId)!;
          const entered = item.passedQty + item.defectiveQty;
          const isQTZ = poItem.material?.materialType === "QTZ" || poItem.product?.material?.materialType === "QTZ";

          await tx.goodsReceiptItem.create({
            data: {
              goodsReceiptId: grn.id,
              productId: poItem.productId,
              materialId: poItem.materialId,
              quantityOrdered: poItem.quantityOrdered,
              quantityReceived: entered,
              quantityAccepted: item.passedQty,
              quantityRejected: item.defectiveQty,
              batchNumber: item.batchNumber || poItem.batchNumber || null,
              inspectionStatus: isQTZ ? "PENDING" : (item.passedQty > 0 ? "PASSED" : "FAILED"),
              notes: [item.shortageNotes, item.defectNotes, item.notes].filter(Boolean).join(" | ") || null
            }
          });

          // Update Purchase Order Item received and pending balances
          const newQtyReceived = poItem.quantityReceived + item.passedQty;
          const newQtyPending = Math.max(0, poItem.quantityOrdered - newQtyReceived - poItem.quantityCancelled);
          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              quantityReceived: newQtyReceived,
              quantityPending: newQtyPending,
              ...(item.batchNumber ? { batchNumber: item.batchNumber } : {})
            }
          });

          // Stock Posting Rules:
          // 1. Defective stock NEVER increases usable stock in Material
          // 2. QTZ materials remain quarantined in QC_PENDING (no stock posted until QC inspection passes)
          // 3. NQZ materials post accepted quantity to Material and create StockMovement
          if (!isQTZ && item.passedQty > 0 && poItem.materialId) {
            await tx.$executeRawUnsafe(`SELECT * FROM "Material" WHERE id = $1 FOR UPDATE`, poItem.materialId);
            const mat = await tx.material.findUnique({ where: { id: poItem.materialId } });
            if (mat) {
              await tx.material.update({
                where: { id: poItem.materialId },
                data: { quantity: mat.quantity + item.passedQty }
              });

              await tx.stockMovement.create({
                data: {
                  materialId: poItem.materialId,
                  quantity: item.passedQty,
                  movementType: "RECEIPT",
                  source: "GOODS_RECEIPT",
                  referenceId: grn.id,
                  warehouseId,
                  userId: actor.id,
                  reason: `Blind Receiving GRN: ${grnNumber} (NQZ Auto-Stock)`
                }
              });
            }
          }
        }

        // PO status update: Full receipt required, transitions directly to RECEIVED
        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: { status: "RECEIVED" as any }
        });

        // Audit Trail
        await tx.auditLog.create({
          data: {
            entityType: "purchase_order",
            entityId: po.id,
            actorId: actor.id,
            action: "GOODS_RECEIPT_BLIND_RECEIVED",
            prevStatus: po.status,
            newStatus: "RECEIVED",
            metadata: {
              grnNumber,
              grnId: grn.id,
              grnStatus,
              remainingPending: 0,
              supplierInvoiceNumber: data.supplierInvoiceNumber || null
            }
          }
        });

        return {
          success: true,
          grnNumber,
          grnId: grn.id,
          grnStatus,
          poStatus: "RECEIVED",
          remainingPending: 0,
          message: "Purchase Order completely received."
        };
      });

      return reply.status(200).send(result);
    } catch (err: any) {
      if (err?.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      return reply.status(400).send({ error: err.message || "Failed to process receipt" });
    }
  });

  // PATCH /crm/procurement/receiving/purchase-orders/:id/invoice (Quick Invoice Recording)
  fastify.patch("/receiving/purchase-orders/:id/invoice", receivingHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { invoiceNumber } = (request.body as any) || {};
    const actor = request.user as { id: string };

    if (!invoiceNumber || typeof invoiceNumber !== "string" || !invoiceNumber.trim()) {
      return reply.status(400).send({ error: "Valid invoice number is required" });
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { vendor: true }
    });
    if (!po) return reply.status(404).send({ error: "Purchase Order not found" });

    const norm = invoiceNumber.trim();
    const existing = await prisma.supplierInvoice.findFirst({
      where: { vendorId: po.vendorId, invoiceNumber: norm }
    });

    if (existing) {
      await prisma.supplierInvoice.update({
        where: { id: existing.id },
        data: { purchaseOrderId: po.id }
      });
    } else {
      await prisma.supplierInvoice.create({
        data: {
          invoiceNumber: norm,
          purchaseOrderId: po.id,
          vendorId: po.vendorId,
          invoiceDate: new Date(),
          status: "VERIFIED",
          currency: po.currency,
          subtotal: 0,
          tax: 0,
          grandTotal: 0,
          notes: "Recorded by Inventory Manager",
          createdById: actor.id
        }
      });
    }

    // Also update any goods receipt notes if they exist
    const latestGrn = await prisma.goodsReceipt.findFirst({
      where: { purchaseOrderId: po.id },
      orderBy: { createdAt: "desc" }
    });
    if (latestGrn) {
      await prisma.goodsReceipt.update({
        where: { id: latestGrn.id },
        data: { notes: `Supplier Invoice: ${norm}` }
      });
    }

    return reply.status(200).send({ success: true, invoiceNumber: norm });
  });
}
