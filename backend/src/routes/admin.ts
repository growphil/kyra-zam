import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { redis } from "../redis";
import { requireRoles } from "../middleware/rbac";
import { 
  VendorCreateSchema, 
  VendorUpdateSchema, 
  UserCreateSchema, 
  UserUpdateSchema,
  QcThresholdUpdateSchema,
  PaxTypeCreateSchema,
  PaxTypeUpdateSchema,
  MaterialMappingCreateSchema,
  MaterialMappingUpdateSchema,
  CellMappingCreateSchema,
  CellMappingUpdateSchema,
  FinancialSettingsUpdateSchema,
  FactoryDefaultsUpdateSchema,
  MaterialCategoryCreateSchema,
  VendorCategoryCreateSchema,
  CompanyAssetCreateSchema,
  CompanyAssetUpdateSchema,
  AssetMaintenanceCreateSchema,
  AssetAssignmentCreateSchema
} from "../schemas/zod.schemas";
import { Prisma } from "../generated/client";
import bcrypt from "bcryptjs";
import { wsManager } from "../websocket/manager";

export async function adminRoutes(fastify: FastifyInstance) {
  // GET /admin/vendors - list all vendors (active and inactive, with resolved actual categories)
  fastify.get(
    "/vendors",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN", "SALES_EXECUTIVE", "PURCHASE_MANAGER", "INVENTORY_MANAGER")] },
    async (request, reply) => {
      const { status, category, search } = (request.query as any) || {};

      const where: Prisma.VendorWhereInput = {};
      if (status === "active") {
        where.isActive = true;
      } else if (status === "inactive") {
        where.isActive = false;
      }

      if (search && typeof search === "string" && search.trim()) {
        const q = search.trim();
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { contact: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { address: { contains: q, mode: "insensitive" } },
        ];
      }

      const vendors = await prisma.vendor.findMany({
        where,
        orderBy: { name: "asc" },
        include: {
          purchaseOrders: {
            select: {
              items: {
                select: {
                  material: {
                    select: { category: true }
                  }
                }
              }
            }
          },
          assets: {
            select: { category: true }
          }
        }
      });

      // Derive actual supplied categories (combining explicit categories and PO/asset history)
      const enriched = vendors.map(v => {
        const catSet = new Set<string>();
        if (v.category) catSet.add(v.category.trim());
        if (Array.isArray(v.categories)) {
          v.categories.forEach((c: string) => {
            if (c && c.trim()) catSet.add(c.trim());
          });
        }
        v.purchaseOrders?.forEach((po: any) => {
          po.items?.forEach((it: any) => {
            if (it.material?.category) catSet.add(it.material.category.trim());
          });
        });
        v.assets?.forEach((a: any) => {
          if (a.category) catSet.add(a.category.trim());
        });

        const { purchaseOrders, assets, ...rest } = v;
        return {
          ...rest,
          categories: Array.from(catSet)
        };
      });

      // Filter by category if requested
      if (category && typeof category === "string" && category !== "ALL") {
        const filterCat = category.trim().toUpperCase();
        if (filterCat === "UNASSIGNED" || filterCat === "GENERAL") {
          return enriched.filter(v => v.categories.length === 0);
        }
        return enriched.filter(v => v.categories.some(c => c.toUpperCase() === filterCat));
      }

      return enriched;
    }
  );

  // POST /admin/vendors - create vendor
  fastify.post(
    "/vendors",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const data = VendorCreateSchema.parse(request.body);
      const catList = new Set<string>(data.categories || []);
      if (data.category && data.category.trim()) {
        catList.add(data.category.trim());
      }
      const vendor = await prisma.vendor.create({
        data: {
          name: data.name,
          contact: data.contact,
          phone: data.phone,
          email: data.email,
          address: data.address,
          category: data.category || (Array.from(catList)[0] ?? null),
          categories: Array.from(catList),
        },
      });
      return {
        ...vendor,
        categories: Array.from(catList)
      };
    }
  );

  // PATCH /admin/vendors/:id - update vendor status or contact details
  fastify.patch(
    "/vendors/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = VendorUpdateSchema.parse(request.body);

      const updateData: any = { ...data };
      if (data.categories !== undefined || data.category !== undefined) {
        const catList = new Set<string>(data.categories || []);
        if (data.category && data.category.trim()) {
          catList.add(data.category.trim());
        }
        updateData.categories = Array.from(catList);
        if (data.category !== undefined) {
          updateData.category = data.category || (Array.from(catList)[0] ?? null);
        }
      }
      
      const vendor = await prisma.vendor.update({
        where: { id },
        data: updateData,
        include: {
          purchaseOrders: {
            select: {
              items: {
                select: {
                  material: {
                    select: { category: true }
                  }
                }
              }
            }
          },
          assets: {
            select: { category: true }
          }
        }
      });

      const catSet = new Set<string>();
      if (vendor.category) catSet.add(vendor.category.trim());
      if (Array.isArray(vendor.categories)) {
        vendor.categories.forEach((c: string) => {
          if (c && c.trim()) catSet.add(c.trim());
        });
      }
      vendor.purchaseOrders?.forEach((po: any) => {
        po.items?.forEach((it: any) => {
          if (it.material?.category) catSet.add(it.material.category.trim());
        });
      });
      vendor.assets?.forEach((a: any) => {
        if (a.category) catSet.add(a.category.trim());
      });

      const { purchaseOrders, assets, ...rest } = vendor;
      return {
        ...rest,
        categories: Array.from(catSet)
      };
    }
  );

  // --- VENDOR CATEGORIES ---

  // GET /admin/vendor-categories - list all vendor categories
  fastify.get(
    "/vendor-categories",
    { preHandler: [fastify.authenticate] },
    async () => {
      let categories = await prisma.vendorCategory.findMany({
        orderBy: { name: "asc" }
      });

      if (categories.length === 0) {
        const defaults = [
          "CELLS",
          "BMS",
          "RAW_MATERIAL",
          "BUSBAR",
          "ELECTRONICS",
          "ENCLOSURE",
          "HARDWARE",
          "INSULATION",
          "EQUIPMENT",
          "PACKAGING",
          "LOGISTICS",
          "SERVICES"
        ];
        await prisma.vendorCategory.createMany({
          data: defaults.map(name => ({ name })),
          skipDuplicates: true
        });
        categories = await prisma.vendorCategory.findMany({
          orderBy: { name: "asc" }
        });
      }

      const allVendors = await prisma.vendor.findMany({
        select: { category: true, categories: true }
      });
      const countMap = new Map<string, number>();
      allVendors.forEach(v => {
        const set = new Set<string>();
        if (v.category) set.add(v.category.trim().toUpperCase());
        if (Array.isArray(v.categories)) {
          v.categories.forEach(c => {
            if (c) set.add(c.trim().toUpperCase());
          });
        }
        set.forEach(cat => {
          countMap.set(cat, (countMap.get(cat) || 0) + 1);
        });
      });

      return categories.map(c => ({
        ...c,
        vendorCount: countMap.get(c.name.toUpperCase()) || 0
      }));
    }
  );

  // POST /admin/vendor-categories - register new vendor category
  fastify.post(
    "/vendor-categories",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const data = VendorCategoryCreateSchema.parse(request.body);
      const user = request.user as { id: string };
      const formattedName = data.name.trim().toUpperCase();

      const existing = await prisma.vendorCategory.findUnique({
        where: { name: formattedName }
      });
      if (existing) {
        return reply.status(409).send({ error: `Vendor category "${formattedName}" already exists.` });
      }

      const created = await prisma.$transaction(async (tx) => {
        const cat = await tx.vendorCategory.create({
          data: { name: formattedName }
        });

        await tx.auditLog.create({
          data: {
            entityType: "vendor_category",
            entityId: cat.id,
            actorId: user.id,
            action: "VENDOR_CATEGORY_CREATED",
            metadata: { name: cat.name }
          }
        });

        return cat;
      });

      return created;
    }
  );

  // DELETE /admin/vendor-categories/:id - delete vendor category
  fastify.delete(
    "/vendor-categories/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const existing = await prisma.vendorCategory.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Vendor category not found" });
      }

      const inUseCount = await prisma.vendor.count({
        where: {
          OR: [
            { category: existing.name },
            { categories: { has: existing.name } }
          ]
        }
      });
      if (inUseCount > 0) {
        return reply.status(400).send({
          error: `Cannot delete category "${existing.name}" because it is currently assigned to ${inUseCount} vendor(s). Please reassign them first.`
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.vendorCategory.delete({ where: { id } });
        await tx.auditLog.create({
          data: {
            entityType: "vendor_category",
            entityId: id,
            actorId: user.id,
            action: "VENDOR_CATEGORY_DELETED",
            metadata: { name: existing.name }
          }
        });
      });

      return { success: true, message: `Vendor category "${existing.name}" deleted.` };
    }
  );

  // PATCH /admin/users/:id/active - deactivate user and revoke tokens
  fastify.patch(
    "/users/:id/active",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { isActive } = request.body as { isActive: boolean };

      const user = await prisma.user.update({
        where: { id },
        data: { isActive },
      });

      if (!isActive) {
        // Revoke all active refresh tokens for this user
        await prisma.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() }
        });

        // Update Redis cache immediately
        await redis.set(`user:${id}:active`, "false", "EX", 60);
      } else {
        await redis.set(`user:${id}:active`, "true", "EX", 60);
      }

      return { id: user.id, isActive: user.isActive };
    }
  );

  // GET /admin/users - list all users
  fastify.get(
    "/users",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN", "SUPERVISOR", "INVENTORY_MANAGER", "PURCHASE_MANAGER", "SALES_EXECUTIVE", "ACCOUNTANT", "MARKETING_MANAGER", "QC")] },
    async (request) => {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          roles: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return users;
    }
  );

  // POST /admin/users - create new user
  fastify.post(
    "/users",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { name, email, password, roles } = UserCreateSchema.parse(request.body);
      
      const passwordHash = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          roles: roles as any,
        }
      });
      
      return { id: user.id, name: user.name, email: user.email, roles: user.roles };
    }
  );

  // PATCH /admin/users/:id - update user
  fastify.patch(
    "/users/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = UserUpdateSchema.parse(request.body);
      
      const updateData: any = { ...data };
      if (data.password) {
        updateData.passwordHash = await bcrypt.hash(data.password, 10);
        delete updateData.password;
      }
      
      const user = await prisma.user.update({
        where: { id },
        data: updateData
      });
      
      return { id: user.id, name: user.name, email: user.email, roles: user.roles };
    }
  );

  // GET /admin/pax-types - list all pax types
  fastify.get(
    "/pax-types",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const types = await prisma.paxType.findMany({
        orderBy: { name: "asc" },
        include: {
          bom: {
            include: {
              items: {
                include: {
                  material: true
                }
              }
            }
          }
        }
      });
      return types;
    }
  );

  // POST /admin/pax-types - create new pax type
  fastify.post(
    "/pax-types",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const data = PaxTypeCreateSchema.parse(request.body);
      const user = request.user as { id: string };
      
      const type = await prisma.$transaction(async (tx) => {
        const created = await tx.paxType.create({
          data: { 
            name: data.name, 
            cellPartNumber: data.cellPartNumber ?? null,
            cellChemistry: data.cellChemistry ?? "LFP",
            nominalVoltage: data.nominalVoltage ?? 48.0,
            nominalCapacity: data.nominalCapacity ?? null,
            configuration: data.configuration ?? "16S1P",
            bomId: data.bomId ?? null,
            bomNumber: data.bomNumber ?? null,
            description: data.description ?? null,
            unitPrice: data.unitPrice ?? 0,
            cellCount: data.cellCount, 
            ahMin: data.ahMin, 
            ahMax: data.ahMax, 
            irMin: data.irMin, 
            irMax: data.irMax,
            retestAhMargin: data.retestAhMargin ?? 0.1,
            retestIrMargin: data.retestIrMargin ?? 2.0,
            hardFailAh: data.hardFailAh ?? 3.0,
            hardFailIr: data.hardFailIr ?? 70.0,
            allowedGrades: data.allowedGrades, 
            maxAhDifference: data.maxAhDifference, 
            maxIrDifference: data.maxIrDifference, 
            autoPackEnabled: data.autoPackEnabled,
            createdBy: user.id
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
            }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "pax_type",
            entityId: created.id,
            actorId: user.id,
            action: "PAX_TYPE_CREATED",
            metadata: {
              name: created.name,
              cellPartNumber: created.cellPartNumber,
              bomNumber: created.bomNumber,
              unitPrice: created.unitPrice,
              cellCount: created.cellCount,
              ahMin: created.ahMin,
              ahMax: created.ahMax,
              irMin: created.irMin,
              irMax: created.irMax
            }
          }
        });

        return created;
      });

      wsManager.broadcastAdmin("pax_type_created", { id: type.id, name: type.name });
      return type;
    }
  );

  // DELETE /admin/pax-types/:id
  fastify.delete(
    "/pax-types/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const existing = await prisma.paxType.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Production model not found" });
      }

      try {
        await prisma.$transaction(async (tx) => {
          // 1. Unreserve cells
          await tx.$executeRawUnsafe(
            `UPDATE "Cell" SET "reservedForPaxTypeId" = NULL WHERE "reservedForPaxTypeId" = $1`,
            id
          );

          // 2. Delete packing material configs
          await tx.$executeRawUnsafe(
            `DELETE FROM "PackingMaterialConfig" WHERE "paxTypeId" = $1`,
            id
          );

          // 3. Find any packs referencing this model
          const packs = await tx.$queryRawUnsafe<{ paxSerial: string }[]>(
            `SELECT "paxSerial" FROM "PaxPack" WHERE "paxTypeId" = $1`,
            id
          );
          const serials = packs.map((p) => p.paxSerial);

          if (serials.length > 0) {
            // Check if any packs have recorded customer sales
            const sales = await tx.$queryRawUnsafe<{ paxSerial: string }[]>(
              `SELECT "paxSerial" FROM "Sale" WHERE "paxSerial" = ANY($1::text[])`,
              serials
            );
            if (sales && sales.length > 0) {
              throw new Error(
                `Cannot delete model "${existing.name}" because ${sales.length} pack(s) have recorded customer sales orders.`
              );
            }

            // Check if any packs have recorded dispatches
            try {
              const dispatches = await tx.$queryRawUnsafe<{ id: string }[]>(
                `SELECT id FROM "DispatchItem" WHERE "paxSerial" = ANY($1::text[])`,
                serials
              );
              if (dispatches && dispatches.length > 0) {
                throw new Error(
                  `Cannot delete model "${existing.name}" because ${dispatches.length} pack(s) are associated with dispatches.`
                );
              }
            } catch (e: any) {
              if (e.message && e.message.includes("Cannot delete model")) throw e;
            }

            // Clean packing records and checklist items for these packs or this model
            await tx.$executeRawUnsafe(
              `DELETE FROM "PackingChecklistItem" WHERE "packingRecordId" IN (SELECT id FROM "PackingRecord" WHERE "paxTypeId" = $1 OR "paxSerial" = ANY($2::text[]))`,
              id,
              serials
            );
            await tx.$executeRawUnsafe(
              `DELETE FROM "PackingRecord" WHERE "paxTypeId" = $1 OR "paxSerial" = ANY($2::text[])`,
              id,
              serials
            );

            // Clean pack dependencies
            await tx.$executeRawUnsafe(`DELETE FROM "PaxCell" WHERE "paxSerial" = ANY($1::text[])`, serials);
            try { await tx.$executeRawUnsafe(`DELETE FROM "Repair" WHERE "paxSerial" = ANY($1::text[])`, serials); } catch {}
            try { await tx.$executeRawUnsafe(`DELETE FROM "QualityInspection" WHERE "paxSerial" = ANY($1::text[])`, serials); } catch {}
            try { await tx.$executeRawUnsafe(`DELETE FROM "Defect" WHERE "paxSerial" = ANY($1::text[])`, serials); } catch {}
            try { await tx.$executeRawUnsafe(`DELETE FROM "Warranty" WHERE "paxSerial" = ANY($1::text[])`, serials); } catch {}
            try { await tx.$executeRawUnsafe(`DELETE FROM "InventoryReservation" WHERE "paxSerial" = ANY($1::text[])`, serials); } catch {}

            // Delete packs
            await tx.$executeRawUnsafe(`DELETE FROM "PaxPack" WHERE "paxSerial" = ANY($1::text[])`, serials);
          } else {
            // Clean any orphaned packing records for this paxTypeId if no packs exist
            await tx.$executeRawUnsafe(
              `DELETE FROM "PackingChecklistItem" WHERE "packingRecordId" IN (SELECT id FROM "PackingRecord" WHERE "paxTypeId" = $1)`,
              id
            );
            await tx.$executeRawUnsafe(`DELETE FROM "PackingRecord" WHERE "paxTypeId" = $1`, id);
          }

          // 4. Audit Log
          try {
            await tx.auditLog.create({
              data: {
                entityType: "pax_type",
                entityId: id,
                actorId: user.id,
                action: "PAX_TYPE_DELETED",
                metadata: { name: existing.name }
              }
            });
          } catch (e: any) {
            request.log.warn({ err: e }, "Failed to create audit log for pax_type deletion");
          }

          // 5. Delete PaxType
          await tx.$executeRawUnsafe(`DELETE FROM "PaxType" WHERE id = $1`, id);
        });

        wsManager.broadcastAdmin("pax_type_deleted", { id });
        return { success: true };
      } catch (err: any) {
        request.log.error(err, "Failed to delete PaxType");
        return reply.status(400).send({
          error: err.message || "Failed to delete production model"
        });
      }
    }
  );

  // PATCH /admin/pax-types/:id
  fastify.patch(
    "/pax-types/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = PaxTypeUpdateSchema.parse(request.body);
      const user = request.user as { id: string };
      
      const type = await prisma.$transaction(async (tx) => {
        const prev = await tx.paxType.findUnique({ where: { id } });
        if (!prev) {
          throw new Error("PaxType not found");
        }

        const updateData: any = { ...data };
        const updated = await tx.paxType.update({
          where: { id },
          data: updateData,
          include: {
            bom: {
              include: {
                items: {
                  include: {
                    material: true
                  }
                }
              }
            }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "pax_type",
            entityId: id,
            actorId: user.id,
            action: "PAX_TYPE_UPDATED",
            metadata: {
              before: {
                name: prev.name,
                cellPartNumber: prev.cellPartNumber,
                bomNumber: prev.bomNumber,
                cellCount: prev.cellCount,
                ahMin: prev.ahMin,
                ahMax: prev.ahMax,
                irMin: prev.irMin,
                irMax: prev.irMax,
                retestAhMargin: prev.retestAhMargin,
                retestIrMargin: prev.retestIrMargin,
                hardFailAh: prev.hardFailAh,
                hardFailIr: prev.hardFailIr,
              },
              after: {
                name: updated.name,
                cellPartNumber: updated.cellPartNumber,
                bomNumber: updated.bomNumber,
                cellCount: updated.cellCount,
                ahMin: updated.ahMin,
                ahMax: updated.ahMax,
                irMin: updated.irMin,
                irMax: updated.irMax,
                retestAhMargin: updated.retestAhMargin,
                retestIrMargin: updated.retestIrMargin,
                hardFailAh: updated.hardFailAh,
                hardFailIr: updated.hardFailIr,
              }
            }
          }
        });

        return updated;
      });

      wsManager.broadcastAdmin("pax_type_updated", { id: type.id, name: type.name });
      return type;
    }
  );

  // GET /admin/qc-thresholds - get current QC thresholds
  fastify.get(
    "/qc-thresholds",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const config = await prisma.qcThreshold.findUnique({
        where: { id: "global" }
      });
      return config;
    }
  );

  // PUT /admin/qc-thresholds - update global QC threshold config
  fastify.put(
    "/qc-thresholds",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const validated = QcThresholdUpdateSchema.parse(request.body);
      const user = request.user as { id: string };

      let parsedLength: number | null = null;
      if (validated.serialDisplayLength !== undefined && validated.serialDisplayLength !== null && validated.serialDisplayLength !== "") {
        const parsed = typeof validated.serialDisplayLength === "number" 
          ? validated.serialDisplayLength 
          : parseInt(validated.serialDisplayLength as string, 10);
        if (!isNaN(parsed) && parsed > 0) {
          parsedLength = parsed;
        }
      }

      const config = await prisma.$transaction(async (tx) => {
        const previous = await tx.qcThreshold.findUnique({ where: { id: "global" } });

        const updated = await tx.qcThreshold.upsert({
          where: { id: "global" },
          update: { 
            ahMin: validated.ahMin, 
            ahMax: validated.ahMax, 
            irMin: validated.irMin, 
            irMax: validated.irMax, 
            serialDisplayLength: parsedLength, 
            updatedBy: user.id 
          },
          create: { 
            id: "global", 
            ahMin: validated.ahMin, 
            ahMax: validated.ahMax, 
            irMin: validated.irMin, 
            irMax: validated.irMax, 
            serialDisplayLength: parsedLength, 
            updatedBy: user.id 
          },
        });

        await tx.auditLog.create({
          data: {
            entityType: "qc_threshold",
            entityId: "global",
            actorId: user.id,
            action: "QC_GLOBAL_THRESHOLD_UPDATED",
            metadata: {
              before: previous ? {
                ahMin: previous.ahMin,
                ahMax: previous.ahMax,
                irMin: previous.irMin,
                irMax: previous.irMax,
                serialDisplayLength: previous.serialDisplayLength
              } : null,
              after: {
                ahMin: updated.ahMin,
                ahMax: updated.ahMax,
                irMin: updated.irMin,
                irMax: updated.irMax,
                serialDisplayLength: updated.serialDisplayLength
              }
            }
          }
        });

        return updated;
      });

      return config;
    }
  );

  // GET /admin/dashboard-stats - Live production metrics
  fastify.get(
    "/dashboard-stats",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [rawCount, testedCount, rejectedCount, paxCount, todayTestedCount] = await Promise.all([
        prisma.cell.count({ where: { status: "RAW" } }),
        prisma.cell.count({ where: { status: "CELL_TESTED" } }),
        prisma.cell.count({ where: { status: "REJECTED" } }),
        prisma.paxPack.count(),
        prisma.cell.count({ 
          where: { 
            status: "CELL_TESTED",
            updatedAt: { gte: today }
          } 
        }),
      ]);

      const latestRaw = await prisma.cell.findMany({
        where: { status: "RAW" },
        take: 10,
        orderBy: { createdAt: "desc" }
      });

      return {
        stats: {
          raw: rawCount,
          tested: testedCount,
          todayTested: todayTestedCount,
          rejected: rejectedCount,
          pax: paxCount,
        },
        latestRaw
      };
    }
  );

  // GET /admin/audit-logs
  fastify.get(
    "/audit-logs",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN", "PAX_TEST_ENGINEER", "ACCOUNTANT")] },
    async (request) => {
      const { entityType, action, page = 1, limit = 50 } = request.query as any;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (action) where.action = action;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { timestamp: "desc" },
          include: { actor: { select: { name: true, email: true } } }
        }),
        prisma.auditLog.count({ where }),
      ]);

      return { logs, total, page: Number(page), limit: Number(limit) };
    }
  );

  // POST /admin/pax-types/:id/set-production - Set as active production model
  fastify.post(
    "/pax-types/:id/set-production",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const target = await prisma.paxType.findUnique({ where: { id } });
      if (!target) {
        return reply.status(404).send({ error: "PaxType not found" });
      }

      await prisma.$transaction(async (tx) => {
        const previouslyActive = await tx.paxType.findFirst({ where: { isProductionActive: true } });

        await tx.paxType.updateMany({ data: { isProductionActive: false } });
        await tx.paxType.update({ where: { id }, data: { isProductionActive: true } });

        await tx.auditLog.create({
          data: {
            entityType: "pax_type",
            entityId: id,
            actorId: user.id,
            action: "PAX_PRODUCTION_MODEL_ACTIVATED",
            metadata: {
              previouslyActiveId: previouslyActive?.id ?? null,
              previouslyActiveName: previouslyActive?.name ?? null,
              activatedModelId: target.id,
              activatedModelName: target.name,
              qcParameters: {
                ahMin: target.ahMin,
                ahMax: target.ahMax,
                irMin: target.irMin,
                irMax: target.irMax,
                retestAhMargin: target.retestAhMargin,
                retestIrMargin: target.retestIrMargin,
                hardFailAh: target.hardFailAh,
                hardFailIr: target.hardFailIr,
              }
            }
          }
        });
      });

      wsManager.broadcastAdmin("pax_production_activated", { id, name: target.name });
      return { success: true, activeModel: target.name };
    }
  );

  // POST /admin/pax-types/clear-production
  fastify.post(
    "/pax-types/clear-production",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const user = request.user as { id: string };

      await prisma.$transaction(async (tx) => {
        const previouslyActive = await tx.paxType.findFirst({ where: { isProductionActive: true } });

        await tx.paxType.updateMany({ data: { isProductionActive: false } });

        await tx.auditLog.create({
          data: {
            entityType: "pax_type",
            entityId: previouslyActive?.id ?? "global",
            actorId: user.id,
            action: "PAX_PRODUCTION_MODEL_CLEARED",
            metadata: {
              clearedModelId: previouslyActive?.id ?? null,
              clearedModelName: previouslyActive?.name ?? null,
              fallback: "GLOBAL_QC_THRESHOLD"
            }
          }
        });
      });

      wsManager.broadcastAdmin("pax_production_cleared");
      return { success: true };
    }
  );

  // --- CELL CATEGORY ROUTES ---
  
  // GET /admin/cell-categories
  fastify.get(
    "/cell-categories",
    { preHandler: [fastify.authenticate] },
    async () => {
      return await (prisma as any).cellCategory.findMany({
        orderBy: { name: "asc" }
      });
    }
  );

  // POST /admin/cell-categories
  fastify.post(
    "/cell-categories",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request) => {
      const { name } = request.body as { name: string };
      return await (prisma as any).cellCategory.create({
        data: { name }
      });
    }
  );

  // DELETE /admin/cell-categories/:id
  fastify.delete(
    "/cell-categories/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request) => {
      const { id } = request.params as { id: string };
      await (prisma as any).cellCategory.delete({
        where: { id }
      });
      return { success: true };
    }
  );
  // --- BOM ROUTES ---
  
  // GET /admin/boms
  fastify.get(
    "/boms",
    { preHandler: [fastify.authenticate] },
    async () => {
      return await (prisma as any).bOM.findMany({
        orderBy: { name: "asc" },
        include: { items: { include: { material: true } } }
      });
    }
  );

  // POST /admin/boms
  fastify.post(
    "/boms",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { name, description, items = [] } = request.body as any;
      if (!name || !name.trim()) {
        return reply.status(400).send({ error: "BOM Name / Drawing Code is required" });
      }
      const existing = await (prisma as any).bOM.findUnique({ where: { name: name.trim() } });
      if (existing) {
        return reply.status(400).send({ error: `BOM with name "${name.trim()}" already exists` });
      }
      const created = await (prisma as any).bOM.create({
        data: { 
          name: name.trim(), 
          description: description?.trim() || null,
          items: {
            create: (items || []).map((item: any) => ({
              materialId: item.materialId,
              quantity: Math.max(1, Number(item.quantity) || 1)
            }))
          }
        },
        include: { items: { include: { material: true } } }
      });
      wsManager.broadcastBOM("bom_created", { id: created.id, name: created.name });
      return created;
    }
  );

  // PATCH /admin/boms/:id
  fastify.patch(
    "/boms/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name, description, items } = request.body as any;
      try {
        const updated = await (prisma as any).$transaction(async (tx: any) => {
          if (name && name.trim()) {
            const existing = await tx.bOM.findFirst({
              where: { name: name.trim(), NOT: { id } }
            });
            if (existing) {
              throw new Error(`BOM with name "${name.trim()}" already exists`);
            }
          }

          if (items !== undefined) {
            await tx.bOMItem.deleteMany({ where: { bomId: id } });
            if (Array.isArray(items) && items.length > 0) {
              await tx.bOMItem.createMany({
                data: items.map((item: any) => ({
                  bomId: id,
                  materialId: item.materialId,
                  quantity: Math.max(1, Number(item.quantity) || 1)
                }))
              });
            }
          }

          return await tx.bOM.update({
            where: { id },
            data: {
              ...(name ? { name: name.trim() } : {}),
              ...(description !== undefined ? { description: description?.trim() || null } : {})
            },
            include: { items: { include: { material: true } } }
          });
        });
        wsManager.broadcastBOM("bom_updated", { id: updated.id, name: updated.name });
        return updated;
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // DELETE /admin/boms/:id
  fastify.delete(
    "/boms/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const inUsePax = await (prisma as any).paxType.findFirst({ where: { bomId: id } });
        if (inUsePax) {
          return reply.status(400).send({ error: `Cannot delete BOM: Currently linked to Production Model "${inUsePax.name}"` });
        }
        await (prisma as any).$transaction([
          (prisma as any).bOMItem.deleteMany({ where: { bomId: id } }),
          (prisma as any).bOM.delete({ where: { id } })
        ]);
        wsManager.broadcastBOM("bom_deleted", { id });
        return { success: true };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to delete BOM" });
      }
    }
  );

  // DELETE /admin/clear-data - System reset for production data
  fastify.delete(
    "/clear-data",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { 
        clearPax = false, 
        clearSales = false, 
        clearAuditLogs = false,
        clearCells = false,
        clearService = false,
        clearScrap = false
      } = request.body as any;

      const results: any = {};

      await prisma.$transaction(async (tx) => {
        if (clearPax) {
          // Must clear dependencies first
          await tx.repair.deleteMany();
          await tx.sale.deleteMany();
          await tx.paxCell.deleteMany();
          await tx.paxPack.deleteMany();
          results.pax = "cleared";
        }
        if (clearSales && !clearPax) {
          // If we didn't clear pax (which clears all sales), just clear sales
          await tx.sale.deleteMany();
          results.sales = "cleared";
        }
        if (clearAuditLogs) {
          await tx.auditLog.deleteMany();
          results.auditLogs = "cleared";
        }
        if (clearCells) {
          // Ensure pax are cleared first if clearing all cells, or this will fail
          if (!clearPax) {
            await tx.repair.deleteMany();
            await tx.sale.deleteMany();
            await tx.paxCell.deleteMany();
            await tx.paxPack.deleteMany();
          }
          await tx.cell.deleteMany();
          results.cells = "cleared";
        }
        if (clearService) {
          await tx.serviceTestReport.deleteMany();
          await tx.serviceMaterialItem.deleteMany();
          await tx.serviceMaterialRequest.deleteMany();
          await tx.serviceRepairLog.deleteMany();
          await tx.serviceDelivery.deleteMany();
          await tx.serviceBattery.deleteMany();
          results.service = "cleared";
        }
        if (clearScrap) {
          await tx.scrapSale.deleteMany();
          await tx.scrapInventory.deleteMany();
          await tx.scrapEntry.deleteMany();
          results.scrap = "cleared";
        }
      });

      return { success: true, results };
    }
  );

  // POST /admin/wipe-all-data - Complete database wipe, preserving ONLY 12 seed users & base config
  fastify.post(
    "/wipe-all-data",
    { preHandler: [requireRoles("SUPERADMIN")] },
    async (request, reply) => {
      try {
        const STANDARD_SEED_USERS = [
          { name: "Arjun Mehta", email: "superadmin@kyrazam.com", roles: ["SUPERADMIN"], pass: "SuperAdmin@2025" },
          { name: "Priya Sharma", email: "admin@kyrazam.com", roles: ["ADMIN"], pass: "Admin@2025" },
          { name: "Ravi Kumar", email: "inv@kyrazam.com", roles: ["INVENTORY_MANAGER"], pass: "InvMgr@2025" },
          { name: "Sunita Patel", email: "test@kyrazam.com", roles: ["TEST_ENGINEER"], pass: "TestEng@2025" },
          { name: "Deepak Nair", email: "asm@kyrazam.com", roles: ["ASSEMBLY_TECHNICIAN"], pass: "AsmTech@2025" },
          { name: "Kiran Reddy", email: "paxtest@kyrazam.com", roles: ["PAX_TEST_ENGINEER"], pass: "PaxTest@2025" },
          { name: "Meena Iyer", email: "super@kyrazam.com", roles: ["SUPERVISOR"], pass: "Supervisor@2025" },
          { name: "Vikram Singh", email: "sales@kyrazam.com", roles: ["SALES_EXECUTIVE"], pass: "SalesExec@2025" },
          { name: "Ananya Bose", email: "acct@kyrazam.com", roles: ["ACCOUNTANT"], pass: "Accountant@2025" },
          { name: "Sanjay Gupta", email: "purchase@kyrazam.com", roles: ["PURCHASE_MANAGER"], pass: "PurchMgr@2025" },
          { name: "Rohit Sharma", email: "marketing@kyrazam.com", roles: ["MARKETING_MANAGER"], pass: "Marketing@2025" },
          { name: "Amit Patel", email: "qc@kyrazam.com", roles: ["QC"], pass: "QcEngineer@2025" }
        ];

        // 1. Fetch all public schema tables except migrations
        const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
          SELECT tablename FROM pg_tables 
          WHERE schemaname = 'public' 
            AND tablename NOT IN ('_prisma_migrations');
        `;

        // 2. Truncate all tables with CASCADE
        for (const { tablename } of tablenames) {
          try {
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
          } catch (err: any) {
            console.warn(`Could not truncate ${tablename}:`, err.message);
          }
        }

        // 3. Re-seed clean 12 standard users
        let superadminId: string | null = null;
        for (const u of STANDARD_SEED_USERS) {
          const passwordHash = await bcrypt.hash(u.pass, 12);
          const createdUser = await prisma.user.create({
            data: {
              name: u.name,
              email: u.email,
              roles: u.roles as any,
              passwordHash,
              isActive: true
            }
          });
          if (u.email === "superadmin@kyrazam.com") {
            superadminId = createdUser.id;
          }
        }

        // 4. Re-seed default factory settings
        await prisma.factorySetting.create({
          data: {
            id: "global",
            defaultPaymentTerms: "50% Advance, 50% on Dispatch",
            defaultAdvancePercentage: 50.0,
            defaultFreightAmount: 1200.0,
            defaultHandlingCharge: 450.0,
            defaultTaxRate: 18.0,
            defaultQuotationValidityDays: 30,
            defaultCurrency: "INR",
            defaultDeliveryTerms: "EXW - Ex Works",
            workingHoursPerDay: 8.0,
            productionDaysPerWeek: 6
          }
        });

        // 5. Create audit log entry
        if (superadminId) {
          await prisma.auditLog.create({
            data: {
              entityType: "SYSTEM",
              entityId: "DATABASE_GLOBAL",
              actorId: superadminId,
              action: "COMPLETE_SYSTEM_WIPE",
              metadata: {
                message: "Database completely wiped and reset to clean 12 seed users only by SuperAdmin.",
                timestamp: new Date().toISOString()
              }
            }
          });
        }

        return {
          success: true,
          message: "All database data has been completely wiped. Only the 12 clean seed users exist now."
        };
      } catch (err: any) {
        console.error("Wipe all data error:", err);
        return reply.status(500).send({
          error: "Failed to wipe database",
          details: err.message
        });
      }
    }
  );

  // ==========================================
  // FACTORY SETTINGS & MASTER MAPPING ENDPOINTS
  // ==========================================

  // GET /admin/factory/overview - high level summary of factory configurations
  fastify.get(
    "/factory/overview",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const [materialCount, activeMaterials, cellCount, activeCells, categoryCount, packingConfigsCount, factorySetting, assetCount, activeAssets] = await Promise.all([
        prisma.material.count(),
        prisma.material.count({ where: { isActive: true } }),
        prisma.cellMaster.count(),
        prisma.cellMaster.count({ where: { isActive: true } }),
        prisma.materialCategory.count(),
        prisma.packingMaterialConfig.count(),
        prisma.factorySetting.findUnique({ where: { id: "global" } }),
        prisma.companyAsset.count(),
        prisma.companyAsset.count({ where: { status: { in: ["OPERATIONAL", "IN_USE"] } } })
      ]);

      return {
        materialCount,
        activeMaterials,
        cellCount,
        activeCells,
        categoryCount,
        packingConfigsCount,
        assetCount,
        activeAssets,
        isConfigured: !!factorySetting,
        factorySetting
      };
    }
  );

  // --- MATERIAL CATEGORIES ---

  // GET /admin/factory/material-categories
  fastify.get(
    "/factory/material-categories",
    { preHandler: [fastify.authenticate] },
    async () => {
      const categories = await prisma.materialCategory.findMany({
        orderBy: { name: "asc" }
      });

      const materialGroups = await prisma.material.groupBy({
        by: ["category"],
        _count: { id: true }
      });
      const countMap = new Map(materialGroups.map((g) => [g.category, g._count.id]));

      return categories.map((c) => ({
        ...c,
        materialCount: countMap.get(c.name) || 0
      }));
    }
  );

  // POST /admin/factory/material-categories
  fastify.post(
    "/factory/material-categories",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const data = MaterialCategoryCreateSchema.parse(request.body);
      const user = request.user as { id: string };
      const formattedName = data.name.trim().toUpperCase();

      const existing = await prisma.materialCategory.findUnique({
        where: { name: formattedName }
      });
      if (existing) {
        return reply.status(409).send({ error: `Material category "${formattedName}" already exists.` });
      }

      const created = await prisma.$transaction(async (tx) => {
        const cat = await tx.materialCategory.create({
          data: { name: formattedName }
        });

        await tx.auditLog.create({
          data: {
            entityType: "material_category",
            entityId: cat.id,
            actorId: user.id,
            action: "FACTORY_MATERIAL_CATEGORY_CREATED",
            metadata: { name: cat.name }
          }
        });

        return cat;
      });

      return created;
    }
  );

  // DELETE /admin/factory/material-categories/:id
  fastify.delete(
    "/factory/material-categories/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const existing = await prisma.materialCategory.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Material category not found" });
      }

      const inUseCount = await prisma.material.count({
        where: { category: existing.name }
      });
      if (inUseCount > 0) {
        return reply.status(400).send({
          error: `Cannot delete category "${existing.name}" because it is currently assigned to ${inUseCount} material(s). Please reassign them first.`
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.materialCategory.delete({ where: { id } });

        await tx.auditLog.create({
          data: {
            entityType: "material_category",
            entityId: id,
            actorId: user.id,
            action: "FACTORY_MATERIAL_CATEGORY_DELETED",
            metadata: { name: existing.name }
          }
        });
      });

      return { success: true, message: `Category "${existing.name}" deleted.` };
    }
  );

  // --- MATERIAL PART NUMBER MAPPINGS ---

  // GET /admin/factory/material-mappings
  fastify.get(
    "/factory/material-mappings",
    { preHandler: [fastify.authenticate] },
    async () => {
      const materials = await prisma.material.findMany({
        where: {
          category: { notIn: ["CELL", "CELLS"] },
          materialType: { not: "CELL" }
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          materialCode: true,
          sku: true,
          category: true,
          unit: true,
          minStock: true,
          unitPrice: true,
          materialType: true,
          description: true,
          isActive: true,
          quantity: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return materials;
    }
  );

  // POST /admin/factory/material-mappings
  fastify.post(
    "/factory/material-mappings",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const data = MaterialMappingCreateSchema.parse(request.body);
      const user = request.user as { id: string };

      // Strictly prevent adding cells via raw materials section
      const catUpper = data.category.trim().toUpperCase();
      if (catUpper === "CELL" || catUpper === "CELLS" || data.materialType === "CELL") {
        return reply.status(400).send({ 
          error: "Battery Cells cannot be created in the Material Catalog. Please use the Cell Part Numbers section." 
        });
      }

      // Check if SKU already exists
      const existing = await prisma.material.findUnique({
        where: { sku: data.sku.trim() }
      });

      if (existing) {
        // If existing is marked inactive (e.g. was previously deleted/deactivated), reactivate and update with new details
        if (existing.isActive === false) {
          const reactivated = await prisma.$transaction(async (tx) => {
            const material = await tx.material.update({
              where: { id: existing.id },
              data: {
                name: data.name.trim(),
                materialCode: data.materialCode?.trim() || null,
                category: data.category.trim(),
                unit: data.unit.trim().toUpperCase(),
                description: data.description?.trim() || null,
                minStock: data.minStock ?? 5,
                unitPrice: data.unitPrice ?? 0,
                materialType: data.materialType || "QTZ",
                isActive: data.isActive ?? true
              }
            });

            await tx.auditLog.create({
              data: {
                entityType: "material_mapping",
                entityId: material.id,
                actorId: user.id,
                action: "FACTORY_MATERIAL_MAPPING_REACTIVATED",
                metadata: {
                  name: material.name,
                  materialCode: material.materialCode,
                  sku: material.sku,
                  category: material.category,
                  unit: material.unit,
                  isActive: material.isActive
                }
              }
            });

            return material;
          });

          return reactivated;
        }

        if (existing.category?.toUpperCase() === "CELLS" || existing.materialType === "CELL") {
          return reply.status(409).send({ 
            error: `SKU "${data.sku}" is already registered as a Battery Cell in Cell Part Numbers. Please use a unique SKU for raw materials.` 
          });
        }

        return reply.status(409).send({ error: `Material with Part Number / SKU "${data.sku}" already exists.` });
      }

      const created = await prisma.$transaction(async (tx) => {
        const material = await tx.material.create({
          data: {
            name: data.name.trim(),
            materialCode: data.materialCode?.trim() || null,
            sku: data.sku.trim(),
            category: data.category.trim(),
            unit: data.unit.trim().toUpperCase(),
            description: data.description?.trim() || null,
            minStock: data.minStock ?? 5,
            unitPrice: data.unitPrice ?? 0,
            materialType: data.materialType || "QTZ",
            isActive: data.isActive ?? true
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "material_mapping",
            entityId: material.id,
            actorId: user.id,
            action: "FACTORY_MATERIAL_MAPPING_CREATED",
            metadata: {
              name: material.name,
              materialCode: material.materialCode,
              sku: material.sku,
              category: material.category,
              unit: material.unit,
              isActive: material.isActive
            }
          }
        });

        return material;
      });

      return created;
    }
  );

  // PATCH /admin/factory/material-mappings/:id
  fastify.patch(
    "/factory/material-mappings/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = MaterialMappingUpdateSchema.parse(request.body);
      const user = request.user as { id: string };

      const existing = await prisma.material.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Material mapping not found" });
      }

      if (data.category) {
        const catUpper = data.category.trim().toUpperCase();
        if (catUpper === "CELL" || catUpper === "CELLS" || data.materialType === "CELL") {
          return reply.status(400).send({ 
            error: "Battery Cells must be managed in the Cell Part Numbers section." 
          });
        }
      }

      // If SKU is being changed, verify uniqueness
      if (data.sku && data.sku.trim() !== existing.sku) {
        const skuConflict = await prisma.material.findUnique({
          where: { sku: data.sku.trim() }
        });
        if (skuConflict && skuConflict.id !== id) {
          return reply.status(409).send({ error: `Material with Part Number / SKU "${data.sku}" already exists.` });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatePayload: any = {};
        if (data.name !== undefined) updatePayload.name = data.name.trim();
        if (data.materialCode !== undefined) updatePayload.materialCode = data.materialCode?.trim() || null;
        if (data.sku !== undefined) updatePayload.sku = data.sku.trim();
        if (data.category !== undefined) updatePayload.category = data.category.trim();
        if (data.unit !== undefined) updatePayload.unit = data.unit.trim().toUpperCase();
        if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;
        if (data.minStock !== undefined) updatePayload.minStock = data.minStock;
        if (data.unitPrice !== undefined) updatePayload.unitPrice = data.unitPrice;
        if (data.materialType !== undefined) updatePayload.materialType = data.materialType;
        if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

        const res = await tx.material.update({
          where: { id },
          data: updatePayload
        });

        const action = data.isActive === false 
          ? "FACTORY_MATERIAL_MAPPING_DISABLED" 
          : "FACTORY_MATERIAL_MAPPING_UPDATED";

        await tx.auditLog.create({
          data: {
            entityType: "material_mapping",
            entityId: id,
            actorId: user.id,
            action,
            metadata: {
              before: {
                name: existing.name,
                materialCode: existing.materialCode,
                sku: existing.sku,
                category: existing.category,
                unit: existing.unit,
                isActive: existing.isActive
              },
              after: {
                name: res.name,
                materialCode: res.materialCode,
                sku: res.sku,
                category: res.category,
                unit: res.unit,
                isActive: res.isActive
              }
            }
          }
        });

        return res;
      });

      return updated;
    }
  );

  // DELETE /admin/factory/material-mappings/:id
  fastify.delete(
    "/factory/material-mappings/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const existing = await prisma.material.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Material mapping not found" });
      }

      const bomCount = await prisma.bOMItem.count({ where: { materialId: id } });
      const movementCount = await prisma.stockMovement.count({ where: { materialId: id } });

      let wasDeletedPermanently = false;

      await prisma.$transaction(async (tx) => {
        if (bomCount === 0 && movementCount === 0) {
          try {
            await tx.material.delete({ where: { id } });
            wasDeletedPermanently = true;
          } catch {
            await tx.material.update({ where: { id }, data: { isActive: false } });
          }
        } else {
          // Soft delete / deactivate to preserve audit history and BOM associations
          await tx.material.update({
            where: { id },
            data: { isActive: false }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "material_mapping",
            entityId: id,
            actorId: user.id,
            action: wasDeletedPermanently ? "FACTORY_MATERIAL_MAPPING_DELETED_PERMANENT" : "FACTORY_MATERIAL_MAPPING_DEACTIVATED",
            metadata: { name: existing.name, sku: existing.sku, permanent: wasDeletedPermanently }
          }
        });
      });

      return { 
        success: true, 
        message: wasDeletedPermanently 
          ? `Material ${existing.sku} permanently removed.` 
          : `Material ${existing.sku} deactivated (preserved due to BOM/stock history).` 
      };
    }
  );

  // --- CELL PART NUMBER MAPPINGS ---

  // GET /admin/factory/cell-mappings
  fastify.get(
    "/factory/cell-mappings",
    { preHandler: [fastify.authenticate] },
    async () => {
      const cellMappings = await prisma.cellMaster.findMany({
        orderBy: [{ chemistry: "asc" }, { cellSku: "asc" }]
      });
      return cellMappings;
    }
  );

  // POST /admin/factory/cell-mappings
  fastify.post(
    "/factory/cell-mappings",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const data = CellMappingCreateSchema.parse(request.body);
      const user = request.user as { id: string };

      const existing = await prisma.cellMaster.findUnique({
        where: { cellSku: data.cellSku.trim() }
      });

      if (existing) {
        if (existing.isActive === false) {
          // Reactivate existing inactive cell master mapping
          const reactivated = await prisma.$transaction(async (tx) => {
            const cellMaster = await tx.cellMaster.update({
              where: { id: existing.id },
              data: {
                cellName: data.cellName.trim(),
                chemistry: data.chemistry.trim().toUpperCase(),
                nominalVoltage: data.nominalVoltage,
                nominalCapacity: data.nominalCapacity,
                supplier: data.supplier?.trim() || null,
                description: data.description?.trim() || null,
                isActive: data.isActive ?? true
              }
            });

            const existingMat = await tx.material.findUnique({
              where: { sku: cellMaster.cellSku }
            });

            if (existingMat) {
              await tx.material.update({
                where: { id: existingMat.id },
                data: {
                  name: cellMaster.cellName,
                  category: "CELLS",
                  materialType: "CELL",
                  unit: "PCS",
                  description: cellMaster.description || `Battery Cell (${cellMaster.chemistry}) - ${cellMaster.nominalVoltage}V ${cellMaster.nominalCapacity}Ah`,
                  isActive: cellMaster.isActive
                }
              });
            } else {
              await tx.material.create({
                data: {
                  sku: cellMaster.cellSku,
                  name: cellMaster.cellName,
                  category: "CELLS",
                  materialType: "CELL",
                  unit: "PCS",
                  description: cellMaster.description || `Battery Cell (${cellMaster.chemistry}) - ${cellMaster.nominalVoltage}V ${cellMaster.nominalCapacity}Ah`,
                  quantity: 0,
                  minStock: 100,
                  unitPrice: 0,
                  isActive: cellMaster.isActive
                }
              });
            }

            await tx.auditLog.create({
              data: {
                entityType: "cell_master_mapping",
                entityId: cellMaster.id,
                actorId: user.id,
                action: "FACTORY_CELL_MAPPING_REACTIVATED",
                metadata: {
                  cellSku: cellMaster.cellSku,
                  cellName: cellMaster.cellName,
                  chemistry: cellMaster.chemistry,
                  voltage: cellMaster.nominalVoltage,
                  capacity: cellMaster.nominalCapacity,
                  isActive: cellMaster.isActive
                }
              }
            });

            return cellMaster;
          });

          return reactivated;
        }

        return reply.status(409).send({ error: `Cell Part Number / SKU "${data.cellSku}" already exists.` });
      }

      const created = await prisma.$transaction(async (tx) => {
        const cellMaster = await tx.cellMaster.create({
          data: {
            cellSku: data.cellSku.trim(),
            cellName: data.cellName.trim(),
            chemistry: data.chemistry.trim().toUpperCase(),
            nominalVoltage: data.nominalVoltage,
            nominalCapacity: data.nominalCapacity,
            supplier: data.supplier?.trim() || null,
            description: data.description?.trim() || null,
            isActive: data.isActive ?? true
          }
        });

        // Automatically upsert into Material catalog with category "CELLS" & materialType "CELL"
        const existingMat = await tx.material.findUnique({
          where: { sku: cellMaster.cellSku }
        });

        if (existingMat) {
          await tx.material.update({
            where: { id: existingMat.id },
            data: {
              name: cellMaster.cellName,
              category: "CELLS",
              materialType: "CELL",
              unit: "PCS",
              description: cellMaster.description || `Battery Cell (${cellMaster.chemistry}) - ${cellMaster.nominalVoltage}V ${cellMaster.nominalCapacity}Ah`,
              isActive: cellMaster.isActive
            }
          });
        } else {
          await tx.material.create({
            data: {
              sku: cellMaster.cellSku,
              name: cellMaster.cellName,
              category: "CELLS",
              materialType: "CELL",
              unit: "PCS",
              description: cellMaster.description || `Battery Cell (${cellMaster.chemistry}) - ${cellMaster.nominalVoltage}V ${cellMaster.nominalCapacity}Ah`,
              quantity: 0,
              minStock: 100,
              unitPrice: 0,
              isActive: cellMaster.isActive
            }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "cell_master_mapping",
            entityId: cellMaster.id,
            actorId: user.id,
            action: "FACTORY_CELL_MAPPING_CREATED",
            metadata: {
              cellSku: cellMaster.cellSku,
              cellName: cellMaster.cellName,
              chemistry: cellMaster.chemistry,
              voltage: cellMaster.nominalVoltage,
              capacity: cellMaster.nominalCapacity,
              isActive: cellMaster.isActive
            }
          }
        });

        return cellMaster;
      });

      return created;
    }
  );

  // PATCH /admin/factory/cell-mappings/:id
  fastify.patch(
    "/factory/cell-mappings/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = CellMappingUpdateSchema.parse(request.body);
      const user = request.user as { id: string };

      const existing = await prisma.cellMaster.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Cell mapping not found" });
      }

      if (data.cellSku && data.cellSku.trim() !== existing.cellSku) {
        const conflict = await prisma.cellMaster.findUnique({
          where: { cellSku: data.cellSku.trim() }
        });
        if (conflict) {
          return reply.status(409).send({ error: `Cell SKU "${data.cellSku}" already exists.` });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatePayload: any = {};
        if (data.cellSku !== undefined) updatePayload.cellSku = data.cellSku.trim();
        if (data.cellName !== undefined) updatePayload.cellName = data.cellName.trim();
        if (data.chemistry !== undefined) updatePayload.chemistry = data.chemistry.trim().toUpperCase();
        if (data.nominalVoltage !== undefined) updatePayload.nominalVoltage = data.nominalVoltage;
        if (data.nominalCapacity !== undefined) updatePayload.nominalCapacity = data.nominalCapacity;
        if (data.supplier !== undefined) updatePayload.supplier = data.supplier?.trim() || null;
        if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;
        if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

        const res = await tx.cellMaster.update({
          where: { id },
          data: updatePayload
        });

        // Sync Material catalog
        if (existing.cellSku !== res.cellSku) {
          const oldMat = await tx.material.findUnique({ where: { sku: existing.cellSku } });
          if (oldMat) {
            await tx.material.update({
              where: { id: oldMat.id },
              data: {
                sku: res.cellSku,
                name: res.cellName,
                category: "CELLS",
                materialType: "CELL",
                description: res.description || `Battery Cell (${res.chemistry}) - ${res.nominalVoltage}V ${res.nominalCapacity}Ah`,
                isActive: res.isActive
              }
            });
          }
        } else {
          const mat = await tx.material.findUnique({ where: { sku: res.cellSku } });
          if (mat) {
            await tx.material.update({
              where: { id: mat.id },
              data: {
                name: res.cellName,
                category: "CELLS",
                materialType: "CELL",
                description: res.description || `Battery Cell (${res.chemistry}) - ${res.nominalVoltage}V ${res.nominalCapacity}Ah`,
                isActive: res.isActive
              }
            });
          }
        }

        const action = data.isActive === false
          ? "FACTORY_CELL_MAPPING_DISABLED"
          : "FACTORY_CELL_MAPPING_UPDATED";

        await tx.auditLog.create({
          data: {
            entityType: "cell_master_mapping",
            entityId: id,
            actorId: user.id,
            action,
            metadata: {
              before: {
                cellSku: existing.cellSku,
                cellName: existing.cellName,
                chemistry: existing.chemistry,
                voltage: existing.nominalVoltage,
                capacity: existing.nominalCapacity,
                isActive: existing.isActive
              },
              after: {
                cellSku: res.cellSku,
                cellName: res.cellName,
                chemistry: res.chemistry,
                voltage: res.nominalVoltage,
                capacity: res.nominalCapacity,
                isActive: res.isActive
              }
            }
          }
        });

        return res;
      });

      return updated;
    }
  );

  // DELETE /admin/factory/cell-mappings/:id
  fastify.delete(
    "/factory/cell-mappings/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const existing = await prisma.cellMaster.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Cell mapping not found" });
      }

      let wasDeletedPermanently = false;

      await prisma.$transaction(async (tx) => {
        const mat = await tx.material.findUnique({ where: { sku: existing.cellSku } });
        let canDeleteMat = false;
        if (mat) {
          const bomCount = await tx.bOMItem.count({ where: { materialId: mat.id } });
          const movementCount = await tx.stockMovement.count({ where: { materialId: mat.id } });
          if (bomCount === 0 && movementCount === 0) {
            canDeleteMat = true;
          }
        }

        if (canDeleteMat && mat) {
          try {
            await tx.material.delete({ where: { id: mat.id } });
            await tx.cellMaster.delete({ where: { id } });
            wasDeletedPermanently = true;
          } catch {
            await tx.cellMaster.update({ where: { id }, data: { isActive: false } });
            await tx.material.update({ where: { id: mat.id }, data: { isActive: false } });
          }
        } else {
          await tx.cellMaster.update({
            where: { id },
            data: { isActive: false }
          });

          if (mat) {
            await tx.material.update({
              where: { id: mat.id },
              data: { isActive: false }
            });
          }
        }

        await tx.auditLog.create({
          data: {
            entityType: "cell_master_mapping",
            entityId: id,
            actorId: user.id,
            action: wasDeletedPermanently ? "FACTORY_CELL_MAPPING_DELETED_PERMANENT" : "FACTORY_CELL_MAPPING_DEACTIVATED",
            metadata: { cellSku: existing.cellSku, cellName: existing.cellName, permanent: wasDeletedPermanently }
          }
        });
      });

      return { 
        success: true, 
        message: wasDeletedPermanently 
          ? `Cell mapping ${existing.cellSku} permanently removed.` 
          : `Cell mapping ${existing.cellSku} deactivated.` 
      };
    }
  );

  // --- FINANCIAL SETTINGS ENDPOINTS ---

  // GET /admin/factory/financial-settings
  fastify.get(
    "/factory/financial-settings",
    { preHandler: [fastify.authenticate] },
    async () => {
      let config = await prisma.factorySetting.findUnique({
        where: { id: "global" }
      });

      if (!config) {
        // Create default record if not yet initialized
        config = await prisma.factorySetting.create({
          data: {
            id: "global",
            defaultPaymentTerms: "100% Advance",
            defaultAdvancePercentage: new Prisma.Decimal("100.00"),
            defaultFreightAmount: new Prisma.Decimal("0.00"),
            defaultHandlingCharge: new Prisma.Decimal("0.00"),
            defaultTaxRate: new Prisma.Decimal("18.00"),
            defaultQuotationValidityDays: 30,
            defaultCurrency: "INR",
            minimumOrderValue: new Prisma.Decimal("0.00"),
            shippingCalculationMethod: "FLAT_RATE",
            freeShippingThreshold: new Prisma.Decimal("0.00"),
            defaultShippingCarrier: "Standard Road Logistics",
            shippingTaxRate: new Prisma.Decimal("18.00"),
            estimatedDeliveryLeadDays: 3,
            defaultUnitSystem: "METRIC",
            defaultTimezone: "Asia/Kolkata",
            workingHoursPerDay: new Prisma.Decimal("8.00"),
            productionDaysPerWeek: 6,
            defaultDeliveryTerms: "EXW - Ex Works"
          }
        });
      }

      return {
        defaultPaymentTerms: config.defaultPaymentTerms,
        defaultAdvancePercentage: Number(config.defaultAdvancePercentage),
        defaultFreightAmount: Number(config.defaultFreightAmount),
        defaultHandlingCharge: Number(config.defaultHandlingCharge),
        defaultTaxRate: Number(config.defaultTaxRate),
        defaultQuotationValidityDays: config.defaultQuotationValidityDays,
        defaultCurrency: config.defaultCurrency,
        minimumOrderValue: Number(config.minimumOrderValue),
        shippingCalculationMethod: (config as any).shippingCalculationMethod || "FLAT_RATE",
        freeShippingThreshold: Number((config as any).freeShippingThreshold || 0),
        defaultShippingCarrier: (config as any).defaultShippingCarrier || "Standard Road Logistics",
        shippingTaxRate: Number((config as any).shippingTaxRate || config.defaultTaxRate || 18),
        estimatedDeliveryLeadDays: (config as any).estimatedDeliveryLeadDays || 3,
        updatedAt: config.updatedAt
      };
    }
  );

  // PUT /admin/factory/financial-settings
  fastify.put(
    "/factory/financial-settings",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const data = FinancialSettingsUpdateSchema.parse(request.body);
      const user = request.user as { id: string };

      const updated = await prisma.$transaction(async (tx) => {
        const previous = await tx.factorySetting.findUnique({ where: { id: "global" } });

        const payloadData = {
          defaultPaymentTerms: data.defaultPaymentTerms,
          defaultAdvancePercentage: new Prisma.Decimal(data.defaultAdvancePercentage.toFixed(2)),
          defaultFreightAmount: new Prisma.Decimal(data.defaultFreightAmount.toFixed(2)),
          defaultHandlingCharge: new Prisma.Decimal(data.defaultHandlingCharge.toFixed(2)),
          defaultTaxRate: new Prisma.Decimal(data.defaultTaxRate.toFixed(2)),
          defaultQuotationValidityDays: data.defaultQuotationValidityDays,
          defaultCurrency: data.defaultCurrency.trim().toUpperCase(),
          minimumOrderValue: new Prisma.Decimal(data.minimumOrderValue.toFixed(2)),
          shippingCalculationMethod: data.shippingCalculationMethod || "FLAT_RATE",
          freeShippingThreshold: new Prisma.Decimal((data.freeShippingThreshold ?? 0).toFixed(2)),
          defaultShippingCarrier: data.defaultShippingCarrier || "Standard Road Logistics",
          shippingTaxRate: new Prisma.Decimal((data.shippingTaxRate ?? data.defaultTaxRate ?? 18).toFixed(2)),
          estimatedDeliveryLeadDays: data.estimatedDeliveryLeadDays ?? 3,
          updatedById: user.id
        };

        const saved = await tx.factorySetting.upsert({
          where: { id: "global" },
          create: {
            id: "global",
            ...payloadData
          },
          update: payloadData
        });

        await tx.auditLog.create({
          data: {
            entityType: "factory_financial_settings",
            entityId: "global",
            actorId: user.id,
            action: "FACTORY_FINANCIAL_SETTING_UPDATED",
            metadata: {
              before: previous ? {
                defaultPaymentTerms: previous.defaultPaymentTerms,
                defaultAdvancePercentage: Number(previous.defaultAdvancePercentage),
                defaultFreightAmount: Number(previous.defaultFreightAmount),
                defaultHandlingCharge: Number(previous.defaultHandlingCharge),
                defaultTaxRate: Number(previous.defaultTaxRate),
                defaultQuotationValidityDays: previous.defaultQuotationValidityDays,
                defaultCurrency: previous.defaultCurrency,
                minimumOrderValue: Number(previous.minimumOrderValue)
              } : null,
              after: {
                defaultPaymentTerms: saved.defaultPaymentTerms,
                defaultAdvancePercentage: Number(saved.defaultAdvancePercentage),
                defaultFreightAmount: Number(saved.defaultFreightAmount),
                defaultHandlingCharge: Number(saved.defaultHandlingCharge),
                defaultTaxRate: Number(saved.defaultTaxRate),
                defaultQuotationValidityDays: saved.defaultQuotationValidityDays,
                defaultCurrency: saved.defaultCurrency,
                minimumOrderValue: Number(saved.minimumOrderValue),
                shippingCalculationMethod: (saved as any).shippingCalculationMethod,
                freeShippingThreshold: Number((saved as any).freeShippingThreshold || 0),
                defaultShippingCarrier: (saved as any).defaultShippingCarrier,
                shippingTaxRate: Number((saved as any).shippingTaxRate || 18),
                estimatedDeliveryLeadDays: (saved as any).estimatedDeliveryLeadDays
              }
            }
          }
        });

        return saved;
      });

      return {
        defaultPaymentTerms: updated.defaultPaymentTerms,
        defaultAdvancePercentage: Number(updated.defaultAdvancePercentage),
        defaultFreightAmount: Number(updated.defaultFreightAmount),
        defaultHandlingCharge: Number(updated.defaultHandlingCharge),
        defaultTaxRate: Number(updated.defaultTaxRate),
        defaultQuotationValidityDays: updated.defaultQuotationValidityDays,
        defaultCurrency: updated.defaultCurrency,
        minimumOrderValue: Number(updated.minimumOrderValue),
        shippingCalculationMethod: (updated as any).shippingCalculationMethod || "FLAT_RATE",
        freeShippingThreshold: Number((updated as any).freeShippingThreshold || 0),
        defaultShippingCarrier: (updated as any).defaultShippingCarrier || "Standard Road Logistics",
        shippingTaxRate: Number((updated as any).shippingTaxRate || updated.defaultTaxRate || 18),
        estimatedDeliveryLeadDays: (updated as any).estimatedDeliveryLeadDays || 3,
        updatedAt: updated.updatedAt
      };
    }
  );

  // POST /admin/factory/financial-settings/reset (Reset to initial standards)
  fastify.post(
    "/factory/financial-settings/reset",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const user = request.user as { id: string };

      const resetData = {
        defaultPaymentTerms: "100% Advance",
        defaultAdvancePercentage: new Prisma.Decimal("100.00"),
        defaultFreightAmount: new Prisma.Decimal("0.00"),
        defaultHandlingCharge: new Prisma.Decimal("0.00"),
        defaultTaxRate: new Prisma.Decimal("18.00"),
        defaultQuotationValidityDays: 30,
        defaultCurrency: "INR",
        minimumOrderValue: new Prisma.Decimal("0.00"),
        shippingCalculationMethod: "FLAT_RATE",
        freeShippingThreshold: new Prisma.Decimal("0.00"),
        defaultShippingCarrier: "Standard Road Logistics",
        shippingTaxRate: new Prisma.Decimal("18.00"),
        estimatedDeliveryLeadDays: 3,
        updatedById: user.id
      };

      const saved = await prisma.factorySetting.upsert({
        where: { id: "global" },
        create: { id: "global", ...resetData },
        update: resetData
      });

      await prisma.auditLog.create({
        data: {
          entityType: "factory_financial_settings",
          entityId: "global",
          actorId: user.id,
          action: "FACTORY_FINANCIAL_SETTING_RESET",
          metadata: { resetToDefaults: true }
        }
      });

      return {
        defaultPaymentTerms: saved.defaultPaymentTerms,
        defaultAdvancePercentage: Number(saved.defaultAdvancePercentage),
        defaultFreightAmount: Number(saved.defaultFreightAmount),
        defaultHandlingCharge: Number(saved.defaultHandlingCharge),
        defaultTaxRate: Number(saved.defaultTaxRate),
        defaultQuotationValidityDays: saved.defaultQuotationValidityDays,
        defaultCurrency: saved.defaultCurrency,
        minimumOrderValue: Number(saved.minimumOrderValue),
        shippingCalculationMethod: (saved as any).shippingCalculationMethod || "FLAT_RATE",
        freeShippingThreshold: Number((saved as any).freeShippingThreshold || 0),
        defaultShippingCarrier: (saved as any).defaultShippingCarrier || "Standard Road Logistics",
        shippingTaxRate: Number((saved as any).shippingTaxRate || 18),
        estimatedDeliveryLeadDays: (saved as any).estimatedDeliveryLeadDays || 3,
        updatedAt: saved.updatedAt
      };
    }
  );

  // --- FACTORY OPERATIONAL DEFAULTS ENDPOINTS ---

  // GET /admin/factory/defaults
  fastify.get(
    "/factory/defaults",
    { preHandler: [fastify.authenticate] },
    async () => {
      let config = await prisma.factorySetting.findUnique({
        where: { id: "global" }
      });

      if (!config) {
        config = await prisma.factorySetting.create({
          data: {
            id: "global",
            defaultUnitSystem: "METRIC",
            defaultTimezone: "Asia/Kolkata",
            workingHoursPerDay: new Prisma.Decimal("8.00"),
            productionDaysPerWeek: 6,
            defaultDeliveryTerms: "EXW - Ex Works"
          }
        });
      }

      return {
        defaultUnitSystem: config.defaultUnitSystem,
        defaultTimezone: config.defaultTimezone,
        workingHoursPerDay: Number(config.workingHoursPerDay),
        productionDaysPerWeek: config.productionDaysPerWeek,
        defaultDeliveryTerms: config.defaultDeliveryTerms,
        updatedAt: config.updatedAt
      };
    }
  );

  // PUT /admin/factory/defaults
  fastify.put(
    "/factory/defaults",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const data = FactoryDefaultsUpdateSchema.parse(request.body);
      const user = request.user as { id: string };

      const updated = await prisma.$transaction(async (tx) => {
        const previous = await tx.factorySetting.findUnique({ where: { id: "global" } });

        const saved = await tx.factorySetting.upsert({
          where: { id: "global" },
          create: {
            id: "global",
            defaultUnitSystem: data.defaultUnitSystem.trim(),
            defaultTimezone: data.defaultTimezone.trim(),
            workingHoursPerDay: new Prisma.Decimal(data.workingHoursPerDay.toFixed(2)),
            productionDaysPerWeek: data.productionDaysPerWeek,
            defaultDeliveryTerms: data.defaultDeliveryTerms.trim(),
            updatedById: user.id
          },
          update: {
            defaultUnitSystem: data.defaultUnitSystem.trim(),
            defaultTimezone: data.defaultTimezone.trim(),
            workingHoursPerDay: new Prisma.Decimal(data.workingHoursPerDay.toFixed(2)),
            productionDaysPerWeek: data.productionDaysPerWeek,
            defaultDeliveryTerms: data.defaultDeliveryTerms.trim(),
            updatedById: user.id
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "factory_operational_defaults",
            entityId: "global",
            actorId: user.id,
            action: "FACTORY_DEFAULTS_UPDATED",
            metadata: {
              before: previous ? {
                defaultUnitSystem: previous.defaultUnitSystem,
                defaultTimezone: previous.defaultTimezone,
                workingHoursPerDay: Number(previous.workingHoursPerDay),
                productionDaysPerWeek: previous.productionDaysPerWeek,
                defaultDeliveryTerms: previous.defaultDeliveryTerms
              } : null,
              after: {
                defaultUnitSystem: saved.defaultUnitSystem,
                defaultTimezone: saved.defaultTimezone,
                workingHoursPerDay: Number(saved.workingHoursPerDay),
                productionDaysPerWeek: saved.productionDaysPerWeek,
                defaultDeliveryTerms: saved.defaultDeliveryTerms
              }
            }
          }
        });

        return saved;
      });

      return {
        defaultUnitSystem: updated.defaultUnitSystem,
        defaultTimezone: updated.defaultTimezone,
        workingHoursPerDay: Number(updated.workingHoursPerDay),
        productionDaysPerWeek: updated.productionDaysPerWeek,
        defaultDeliveryTerms: updated.defaultDeliveryTerms,
        updatedAt: updated.updatedAt
      };
    }
  );

  // POST /admin/factory/defaults/reset (Reset to initial standards)
  fastify.post(
    "/factory/defaults/reset",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const user = request.user as { id: string };

      const resetData = {
        defaultUnitSystem: "METRIC",
        defaultTimezone: "Asia/Kolkata",
        workingHoursPerDay: new Prisma.Decimal("8.00"),
        productionDaysPerWeek: 6,
        defaultDeliveryTerms: "EXW - Ex Works",
        updatedById: user.id
      };

      const saved = await prisma.factorySetting.upsert({
        where: { id: "global" },
        create: { id: "global", ...resetData },
        update: resetData
      });

      await prisma.auditLog.create({
        data: {
          entityType: "factory_operational_defaults",
          entityId: "global",
          actorId: user.id,
          action: "FACTORY_DEFAULTS_RESET",
          metadata: { resetToDefaults: true }
        }
      });

      return {
        defaultUnitSystem: saved.defaultUnitSystem,
        defaultTimezone: saved.defaultTimezone,
        workingHoursPerDay: Number(saved.workingHoursPerDay),
        productionDaysPerWeek: saved.productionDaysPerWeek,
        defaultDeliveryTerms: saved.defaultDeliveryTerms,
        updatedAt: saved.updatedAt
      };
    }
  );

  // ==========================================
  // COMPANY ASSET MANAGEMENT DOMAIN
  // ==========================================

  // GET /admin/factory/assets
  fastify.get(
    "/factory/assets",
    { preHandler: [fastify.authenticate] },
    async (request) => {
      const { search, category, status, department, location } = request.query as {
        search?: string;
        category?: string;
        status?: string;
        department?: string;
        location?: string;
      };

      const where: any = {};

      if (search && search.trim()) {
        const q = search.trim();
        where.OR = [
          { assetTag: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { serialNumber: { contains: q, mode: "insensitive" } },
          { modelNumber: { contains: q, mode: "insensitive" } },
          { manufacturer: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { department: { contains: q, mode: "insensitive" } }
        ];
      }

      if (category && category !== "ALL") {
        where.category = category as any;
      }

      if (status && status !== "ALL") {
        where.status = status as any;
      }

      if (department && department !== "ALL") {
        where.department = department;
      }

      if (location && location !== "ALL") {
        where.location = { contains: location, mode: "insensitive" };
      }

      const assets = await prisma.companyAsset.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        include: {
          assignedToUser: {
            select: { id: true, name: true, email: true }
          },
          warehouse: {
            select: { id: true, name: true, code: true }
          },
          vendor: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              maintenanceRecords: true,
              assignmentRecords: true
            }
          }
        }
      });

      return assets;
    }
  );

  // GET /admin/factory/assets/:id
  fastify.get(
    "/factory/assets/:id",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const asset = await prisma.companyAsset.findUnique({
        where: { id },
        include: {
          assignedToUser: {
            select: { id: true, name: true, email: true }
          },
          warehouse: {
            select: { id: true, name: true, code: true }
          },
          vendor: {
            select: { id: true, name: true, phone: true, email: true }
          },
          maintenanceRecords: {
            orderBy: { performedDate: "desc" },
            include: {
              performedBy: {
                select: { id: true, name: true, email: true }
              }
            }
          },
          assignmentRecords: {
            orderBy: { assignedDate: "desc" },
            include: {
              assignedTo: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      if (!asset) {
        return reply.status(404).send({ error: "Company asset not found" });
      }

      return asset;
    }
  );

  // POST /admin/factory/assets
  fastify.post(
    "/factory/assets",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const data = CompanyAssetCreateSchema.parse(request.body);
      const user = request.user as { id: string; name?: string };

      const existingTag = await prisma.companyAsset.findUnique({
        where: { assetTag: data.assetTag.trim() }
      });

      if (existingTag) {
        return reply.status(409).send({ error: `An asset with tag "${data.assetTag}" already exists.` });
      }

      if (data.assignedToUserId) {
        const assignedUser = await prisma.user.findUnique({
          where: { id: data.assignedToUserId }
        });
        if (!assignedUser) {
          return reply.status(400).send({ error: "Assigned personnel user does not exist." });
        }
      }

      if (data.warehouseId) {
        const wh = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } });
        if (!wh) {
          return reply.status(400).send({ error: "Referenced warehouse facility does not exist." });
        }
      }

      const created = await prisma.$transaction(async (tx) => {
        const asset = await tx.companyAsset.create({
          data: {
            assetTag: data.assetTag.trim(),
            name: data.name.trim(),
            description: data.description?.trim() || null,
            category: data.category as any,
            manufacturer: data.manufacturer?.trim() || null,
            modelNumber: data.modelNumber?.trim() || null,
            serialNumber: data.serialNumber?.trim() || null,
            purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
            purchaseCost: data.purchaseCost ?? 0,
            vendorId: data.vendorId || null,
            invoiceNumber: data.invoiceNumber?.trim() || null,
            warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
            warrantyDetails: data.warrantyDetails?.trim() || null,
            location: data.location?.trim() || null,
            warehouseId: data.warehouseId || null,
            department: data.department?.trim() || null,
            assignedToUserId: data.assignedToUserId || null,
            assignedDate: data.assignedToUserId ? (data.assignedDate ? new Date(data.assignedDate) : new Date()) : null,
            status: data.status as any,
            condition: data.condition as any,
            lastMaintenanceDate: data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate) : null,
            nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : null,
            maintenanceIntervalDays: data.maintenanceIntervalDays || null,
            notes: data.notes?.trim() || null,
            isActive: data.isActive ?? true
          }
        });

        if (data.assignedToUserId) {
          await tx.assetAssignmentHistory.create({
            data: {
              assetId: asset.id,
              assignedToId: data.assignedToUserId,
              assignedByName: user.name || "Administrator",
              department: data.department || null,
              location: data.location || null,
              assignedDate: new Date(),
              notes: "Initial asset assignment during asset onboarding"
            }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "company_asset",
            entityId: asset.id,
            actorId: user.id,
            action: "COMPANY_ASSET_CREATED",
            metadata: {
              assetTag: asset.assetTag,
              name: asset.name,
              category: asset.category,
              status: asset.status,
              assignedToUserId: asset.assignedToUserId
            }
          }
        });

        return asset;
      });

      return created;
    }
  );

  // PATCH /admin/factory/assets/:id
  fastify.patch(
    "/factory/assets/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = CompanyAssetUpdateSchema.parse(request.body);
      const user = request.user as { id: string; name?: string };

      const existing = await prisma.companyAsset.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Company asset not found" });
      }

      if (data.assetTag && data.assetTag.trim() !== existing.assetTag) {
        const conflict = await prisma.companyAsset.findUnique({
          where: { assetTag: data.assetTag.trim() }
        });
        if (conflict && conflict.id !== id) {
          return reply.status(409).send({ error: `Asset Tag "${data.assetTag}" is already assigned to another asset.` });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const payload: any = {};
        if (data.assetTag !== undefined) payload.assetTag = data.assetTag.trim();
        if (data.name !== undefined) payload.name = data.name.trim();
        if (data.description !== undefined) payload.description = data.description?.trim() || null;
        if (data.category !== undefined) payload.category = data.category as any;
        if (data.manufacturer !== undefined) payload.manufacturer = data.manufacturer?.trim() || null;
        if (data.modelNumber !== undefined) payload.modelNumber = data.modelNumber?.trim() || null;
        if (data.serialNumber !== undefined) payload.serialNumber = data.serialNumber?.trim() || null;
        if (data.purchaseDate !== undefined) payload.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;
        if (data.purchaseCost !== undefined) payload.purchaseCost = data.purchaseCost;
        if (data.vendorId !== undefined) payload.vendorId = data.vendorId || null;
        if (data.invoiceNumber !== undefined) payload.invoiceNumber = data.invoiceNumber?.trim() || null;
        if (data.warrantyExpiry !== undefined) payload.warrantyExpiry = data.warrantyExpiry ? new Date(data.warrantyExpiry) : null;
        if (data.warrantyDetails !== undefined) payload.warrantyDetails = data.warrantyDetails?.trim() || null;
        if (data.location !== undefined) payload.location = data.location?.trim() || null;
        if (data.warehouseId !== undefined) payload.warehouseId = data.warehouseId || null;
        if (data.department !== undefined) payload.department = data.department?.trim() || null;
        if (data.status !== undefined) payload.status = data.status as any;
        if (data.condition !== undefined) payload.condition = data.condition as any;
        if (data.lastMaintenanceDate !== undefined) payload.lastMaintenanceDate = data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate) : null;
        if (data.nextMaintenanceDate !== undefined) payload.nextMaintenanceDate = data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : null;
        if (data.maintenanceIntervalDays !== undefined) payload.maintenanceIntervalDays = data.maintenanceIntervalDays;
        if (data.notes !== undefined) payload.notes = data.notes?.trim() || null;
        if (data.isActive !== undefined) payload.isActive = data.isActive;
        if (data.retiredDate !== undefined) payload.retiredDate = data.retiredDate ? new Date(data.retiredDate) : null;
        if (data.retirementReason !== undefined) payload.retirementReason = data.retirementReason?.trim() || null;

        // Handle assignment change
        if (data.assignedToUserId !== undefined && data.assignedToUserId !== existing.assignedToUserId) {
          payload.assignedToUserId = data.assignedToUserId || null;
          payload.assignedDate = data.assignedToUserId ? new Date() : null;

          // Close active previous assignment history
          await tx.assetAssignmentHistory.updateMany({
            where: { assetId: id, returnedDate: null },
            data: { returnedDate: new Date() }
          });

          if (data.assignedToUserId) {
            await tx.assetAssignmentHistory.create({
              data: {
                assetId: id,
                assignedToId: data.assignedToUserId,
                assignedByName: user.name || "Administrator",
                department: data.department || existing.department,
                location: data.location || existing.location,
                assignedDate: new Date(),
                notes: "Asset reassigned via Asset Configuration Manager"
              }
            });
          }
        }

        const res = await tx.companyAsset.update({
          where: { id },
          data: payload,
          include: {
            assignedToUser: { select: { id: true, name: true, email: true } },
            warehouse: { select: { id: true, name: true, code: true } },
            vendor: { select: { id: true, name: true } }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "company_asset",
            entityId: id,
            actorId: user.id,
            action: data.status === "RETIRED" ? "COMPANY_ASSET_RETIRED" : "COMPANY_ASSET_UPDATED",
            metadata: {
              before: {
                name: existing.name,
                assetTag: existing.assetTag,
                status: existing.status,
                assignedToUserId: existing.assignedToUserId,
                location: existing.location
              },
              after: {
                name: res.name,
                assetTag: res.assetTag,
                status: res.status,
                assignedToUserId: res.assignedToUserId,
                location: res.location
              }
            }
          }
        });

        return res;
      });

      return updated;
    }
  );

  // POST /admin/factory/assets/:id/maintenance
  fastify.post(
    "/factory/assets/:id/maintenance",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = AssetMaintenanceCreateSchema.parse(request.body);
      const user = request.user as { id: string; name?: string };

      const asset = await prisma.companyAsset.findUnique({ where: { id } });
      if (!asset) {
        return reply.status(404).send({ error: "Company asset not found" });
      }

      const performedDate = data.performedDate ? new Date(data.performedDate) : new Date();
      const nextDueDate = data.nextDueDate ? new Date(data.nextDueDate) : null;

      const record = await prisma.$transaction(async (tx) => {
        const mRecord = await tx.assetMaintenanceRecord.create({
          data: {
            assetId: id,
            maintenanceType: data.maintenanceType,
            title: data.title.trim(),
            description: data.description?.trim() || null,
            serviceProvider: data.serviceProvider?.trim() || null,
            cost: data.cost ?? 0,
            performedDate,
            nextDueDate,
            performedById: user.id,
            status: data.status || "COMPLETED",
            notes: data.notes?.trim() || null
          }
        });

        await tx.companyAsset.update({
          where: { id },
          data: {
            lastMaintenanceDate: performedDate,
            nextMaintenanceDate: nextDueDate || undefined
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "company_asset",
            entityId: id,
            actorId: user.id,
            action: "COMPANY_ASSET_MAINTENANCE_LOGGED",
            metadata: {
              maintenanceRecordId: mRecord.id,
              type: data.maintenanceType,
              title: data.title,
              cost: data.cost
            }
          }
        });

        return mRecord;
      });

      return record;
    }
  );

  // POST /admin/factory/assets/:id/assign
  fastify.post(
    "/factory/assets/:id/assign",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = AssetAssignmentCreateSchema.parse(request.body);
      const user = request.user as { id: string; name?: string };

      const asset = await prisma.companyAsset.findUnique({ where: { id } });
      if (!asset) {
        return reply.status(404).send({ error: "Company asset not found" });
      }

      let targetUser: any = null;
      if (data.assignedToUserId) {
        targetUser = await prisma.user.findUnique({ where: { id: data.assignedToUserId } });
        if (!targetUser) {
          return reply.status(400).send({ error: "Target personnel user not found." });
        }
      }

      const updatedAsset = await prisma.$transaction(async (tx) => {
        // Close prior active assignment
        await tx.assetAssignmentHistory.updateMany({
          where: { assetId: id, returnedDate: null },
          data: { returnedDate: new Date() }
        });

        if (data.assignedToUserId) {
          await tx.assetAssignmentHistory.create({
            data: {
              assetId: id,
              assignedToId: data.assignedToUserId,
              assignedByName: user.name || "Administrator",
              department: data.department || targetUser?.department || asset.department,
              location: data.location || asset.location,
              assignedDate: new Date(),
              notes: data.notes?.trim() || null
            }
          });
        }

        const res = await tx.companyAsset.update({
          where: { id },
          data: {
            assignedToUserId: data.assignedToUserId || null,
            assignedDate: data.assignedToUserId ? new Date() : null,
            department: data.department || targetUser?.department || asset.department,
            location: data.location || asset.location,
            status: data.assignedToUserId
              ? (asset.status === "OPERATIONAL" ? "IN_USE" : asset.status)
              : (asset.status === "IN_USE" ? "OPERATIONAL" : asset.status)
          },
          include: {
            assignedToUser: { select: { id: true, name: true, email: true } }
          }
        });

        await tx.auditLog.create({
          data: {
            entityType: "company_asset",
            entityId: id,
            actorId: user.id,
            action: "COMPANY_ASSET_ASSIGNMENT_CHANGED",
            metadata: {
              previousUserId: asset.assignedToUserId,
              newUserId: data.assignedToUserId || null,
              department: res.department,
              location: res.location
            }
          }
        });

        return res;
      });

      return updatedAsset;
    }
  );

  // DELETE /admin/factory/assets/:id
  fastify.delete(
    "/factory/assets/:id",
    { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { id: string };

      const asset = await prisma.companyAsset.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              maintenanceRecords: true,
              assignmentRecords: true
            }
          }
        }
      });

      if (!asset) {
        return reply.status(404).send({ error: "Company asset not found" });
      }

      const hasHistory = (asset._count?.maintenanceRecords || 0) > 0 || (asset._count?.assignmentRecords || 0) > 0;

      let wasDeletedPermanently = false;

      await prisma.$transaction(async (tx) => {
        if (!hasHistory) {
          await tx.companyAsset.delete({ where: { id } });
          wasDeletedPermanently = true;
        } else {
          // Safeguard: retire the asset rather than hard-deleting historical records
          await tx.companyAsset.update({
            where: { id },
            data: {
              status: "RETIRED",
              isActive: false,
              retiredDate: new Date(),
              retirementReason: "Retired by Administrator via Factory Asset Manager"
            }
          });
        }

        await tx.auditLog.create({
          data: {
            entityType: "company_asset",
            entityId: id,
            actorId: user.id,
            action: wasDeletedPermanently ? "COMPANY_ASSET_DELETED_PERMANENT" : "COMPANY_ASSET_RETIRED",
            metadata: {
              assetTag: asset.assetTag,
              name: asset.name,
              permanent: wasDeletedPermanently,
              hasMaintenanceHistory: (asset._count?.maintenanceRecords || 0) > 0
            }
          }
        });
      });

      return {
        success: true,
        permanent: wasDeletedPermanently,
        message: wasDeletedPermanently
          ? `Asset ${asset.assetTag} permanently deleted.`
          : `Asset ${asset.assetTag} safely retired from service. Historical records preserved.`
      };
    }
  );
}

