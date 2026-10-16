import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { wsManager } from "../websocket/manager";
import { 
  CustomerCreateSchema, 
  CustomerUpdateSchema, 
  LeadCreateSchema, 
  LeadUpdateSchema, 
  ActivityCreateSchema, 
  ActivityUpdateSchema 
} from "../schemas/zod.schemas";

// Notification helper
async function triggerCrmNotification(targetUserId: string | null, targetRole: string | null, message: string) {
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
      console.error("Failed to save notification to DB:", err);
    }
  }
  try {
    if (targetRole) {
      await wsManager.broadcastToRoles([targetRole as any], "notification", { message });
    } else if (targetUserId) {
      await wsManager.sendToUser(targetUserId, "notification", { message });
    }
    // Real-time CRM sync broadcast
    wsManager.broadcastCRM("crm:update", { message, targetRole, targetUserId });
  } catch (e) {
    console.warn("WebSocket notification broadcast failed:", e);
  }
}

// Generate sequential customer code in format KY-001, KY-002, ..., KY-999, KY-1000
export async function generateCustomerCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const customers = await prisma.customer.findMany({
      select: { customerCode: true }
    });
    let maxNum = 0;
    for (const c of customers) {
      const match = c.customerCode?.match(/KY-(\d+)/i) || c.customerCode?.match(/CUS-(\d+)/i) || c.customerCode?.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextNum = maxNum + 1;
    const numStr = nextNum < 1000 
      ? `KY-${String(nextNum).padStart(3, '0')}`
      : `KY-${nextNum}`;

    const exists = await prisma.customer.findUnique({ where: { customerCode: numStr } });
    if (!exists) return numStr;
    attempts++;
  }
  return `KY-${Date.now().toString().slice(-4)}`;
}

// Safely normalize any legacy customer codes into KY-001, KY-002, etc.
export async function ensureCustomerCodesFormatted() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'asc' }
    });
    let nextSeq = 1;
    for (const customer of customers) {
      if (!customer.customerCode || !/^KY-\d+$/i.test(customer.customerCode)) {
        let code = nextSeq < 1000 ? `KY-${String(nextSeq).padStart(3, '0')}` : `KY-${nextSeq}`;
        while (await prisma.customer.findUnique({ where: { customerCode: code } })) {
          nextSeq++;
          code = nextSeq < 1000 ? `KY-${String(nextSeq).padStart(3, '0')}` : `KY-${nextSeq}`;
        }
        await prisma.customer.update({
          where: { id: customer.id },
          data: { customerCode: code }
        });
        nextSeq++;
      }
    }
  } catch (err) {
    console.warn("ensureCustomerCodesFormatted warning:", err);
  }
}

async function generateLeadNumber(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const lastLead = await prisma.lead.findFirst({
      orderBy: { leadNumber: 'desc' }
    });
    let nextNum = 1;
    if (lastLead) {
      const match = lastLead.leadNumber.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }
    const numStr = `LEAD-${String(nextNum).padStart(6, '0')}`;
    const exists = await prisma.lead.findUnique({ where: { leadNumber: numStr } });
    if (!exists) return numStr;
    attempts++;
  }
  return `LEAD-${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function crmRoutes(fastify: FastifyInstance) {
  // Ensure legacy customer codes are formatted on startup
  ensureCustomerCodesFormatted().catch(err => console.warn("Failed customer code formatting:", err));
  // Pre-handler check roles
  const crmReadPreHandler = { preHandler: [requireRoles("SALES_EXECUTIVE", "MARKETING_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN")] };
  const crmWritePreHandler = { preHandler: [requireRoles("SALES_EXECUTIVE", "MARKETING_MANAGER", "ADMIN", "SUPERADMIN")] };
  const customerReadPreHandler = { preHandler: [requireRoles("SALES_EXECUTIVE", "MARKETING_MANAGER", "ACCOUNTANT", "ADMIN", "SUPERADMIN", "SELLER")] };
  const customerWritePreHandler = { preHandler: [requireRoles("SALES_EXECUTIVE", "MARKETING_MANAGER", "ADMIN", "SUPERADMIN", "SELLER")] };

  // GET /crm/users (accessible to all authenticated users for dropdown assignments)
  fastify.get("/users", { preHandler: [fastify.authenticate] }, async (request) => {
    const { role } = (request.query as { role?: string }) || {};
    const where: any = { isActive: true };
    if (role) {
      where.roles = { has: role as any };
    }
    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, roles: true, email: true },
      orderBy: { name: "asc" }
    });
    return users;
  });

  // GET /crm/dashboard
  fastify.get("/dashboard", crmReadPreHandler, async (request, reply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      lostLeads,
      highPriorityLeads,
      todayFollowUps,
      overdueFollowUps,
      totalCustomers,
      totalQuotations,
      leadsBySourceData,
      urgentFollowUps,
      recentLeads,
      recentActivities
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: "NEW" } }),
      prisma.lead.count({ where: { status: "CONTACTED" } }),
      prisma.lead.count({ where: { status: "QUALIFIED" } }),
      prisma.lead.count({ where: { status: "CONVERTED" } }),
      prisma.lead.count({ where: { status: "LOST" } }),
      prisma.lead.count({ where: { priority: { in: ["HIGH", "URGENT"] } } }),
      prisma.lead.count({ 
        where: { 
          expectedFollowUpDate: {
            gte: today,
            lt: tomorrow
          },
          status: { notIn: ["CONVERTED", "LOST"] }
        } 
      }),
      prisma.lead.count({
        where: {
          expectedFollowUpDate: {
            lt: today
          },
          status: { notIn: ["CONVERTED", "LOST"] }
        }
      }),
      prisma.customer.count(),
      prisma.quotation.count(),
      prisma.lead.groupBy({
        by: ['source'],
        _count: { id: true }
      }),
      prisma.lead.findMany({
        where: {
          expectedFollowUpDate: { lte: tomorrow },
          status: { notIn: ["CONVERTED", "LOST"] }
        },
        take: 6,
        orderBy: { expectedFollowUpDate: 'asc' },
        include: {
          assignedUser: { select: { id: true, name: true } }
        }
      }),
      prisma.lead.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedUser: { select: { id: true, name: true } }
        }
      }),
      prisma.activity.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          lead: true,
          customer: true,
          assignedUser: { select: { id: true, name: true } }
        }
      })
    ]);

    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0.0";
    const qualificationRate = totalLeads > 0 ? (((qualifiedLeads + convertedLeads) / totalLeads) * 100).toFixed(1) : "0.0";

    const leadsBySource = leadsBySourceData.map(item => ({
      source: item.source || "Direct / Other",
      count: item._count.id
    })).sort((a, b) => b.count - a.count);

    return {
      stats: {
        totalLeads,
        newLeads,
        contactedLeads,
        qualifiedLeads,
        convertedLeads,
        lostLeads,
        highPriorityLeads,
        todayFollowUps,
        overdueFollowUps,
        totalCustomers,
        totalQuotations,
        conversionRate,
        qualificationRate
      },
      leadsBySource,
      urgentFollowUps,
      recentLeads,
      recentActivities
    };
  });

  // --- LEADS ---

  // GET /crm/leads
  fastify.get("/leads", crmReadPreHandler, async (request, reply) => {
    const { 
      search, 
      status, 
      priority, 
      source, 
      assignedUserId,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      limit = "20"
    } = request.query as any;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { leadNumber: { contains: search, mode: "insensitive" } }
      ];
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (source) where.source = source;
    if (assignedUserId) where.assignedUserId = assignedUserId;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take,
        include: { assignedUser: { select: { id: true, name: true } } }
      }),
      prisma.lead.count({ where })
    ]);

    return { leads, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/leads/:id
  fastify.get("/leads/:id", crmReadPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true } },
        convertedByUser: { select: { id: true, name: true } },
        convertedCustomer: true,
        activities: {
          orderBy: { createdAt: "desc" },
          include: { createdByUser: { select: { name: true } } }
        }
      }
    });

    if (!lead) return reply.status(404).send({ error: "Lead not found" });
    return lead;
  });

  // POST /crm/leads
  fastify.post("/leads", crmWritePreHandler, async (request, reply) => {
    const data = LeadCreateSchema.parse(request.body);
    const actor = request.user as { id: string };
    const leadNumber = await generateLeadNumber();
    const assignedUserId = data.assignedUserId && data.assignedUserId.trim() ? data.assignedUserId.trim() : null;

    const lead = await prisma.lead.create({
      data: {
        name: data.name.trim().replace(/\s+/g, " "),
        companyName: data.companyName ? data.companyName.trim() : null,
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        alternatePhone: data.alternatePhone ? data.alternatePhone.trim() : null,
        source: data.source.trim(),
        priority: data.priority,
        requirementSummary: data.requirementSummary ? data.requirementSummary.trim() : null,
        notes: data.notes ? data.notes.trim() : null,
        leadNumber,
        assignedUserId,
        expectedFollowUpDate: data.expectedFollowUpDate ? new Date(data.expectedFollowUpDate) : null
      },
      include: { assignedUser: true }
    });

    if (actor?.id) {
      try {
        await prisma.auditLog.create({
          data: {
            entityType: "lead",
            entityId: lead.id,
            actorId: actor.id,
            action: "LEAD_CREATED",
            newStatus: lead.status,
            metadata: { leadNumber: lead.leadNumber }
          }
        });
      } catch (auditErr) {
        console.warn("Audit log creation warning:", auditErr);
      }
    }

    if (lead.assignedUserId) {
      await triggerCrmNotification(
        lead.assignedUserId,
        null,
        `Lead ${lead.leadNumber} (${lead.name}) has been assigned to you.`
      );
    }

    return lead;
  });

  // PUT /crm/leads/:id
  fastify.put("/leads/:id", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = LeadUpdateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const original = await prisma.lead.findUnique({ where: { id } });
    if (!original) return reply.status(404).send({ error: "Lead not found" });

    // Status transition validation
    if (data.status && original.status === "CONVERTED") {
      return reply.status(400).send({ error: "Cannot change status of a converted lead" });
    }

    const assignedUserId = data.assignedUserId !== undefined 
      ? (data.assignedUserId && data.assignedUserId.trim() ? data.assignedUserId.trim() : null)
      : undefined;

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim().replace(/\s+/g, " ") } : {}),
        ...(data.companyName !== undefined ? { companyName: data.companyName ? data.companyName.trim() : null } : {}),
        ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
        ...(data.phone ? { phone: data.phone.trim() } : {}),
        ...(data.alternatePhone !== undefined ? { alternatePhone: data.alternatePhone ? data.alternatePhone.trim() : null } : {}),
        ...(data.source ? { source: data.source.trim() } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.priority ? { priority: data.priority } : {}),
        ...(data.requirementSummary !== undefined ? { requirementSummary: data.requirementSummary ? data.requirementSummary.trim() : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes ? data.notes.trim() : null } : {}),
        ...(assignedUserId !== undefined ? { assignedUserId } : {}),
        ...(data.expectedFollowUpDate !== undefined ? { expectedFollowUpDate: data.expectedFollowUpDate ? new Date(data.expectedFollowUpDate) : null } : {})
      }
    });

    // Logging audit events
    if (actor?.id) {
      try {
        if (data.status && data.status !== original.status) {
          await prisma.auditLog.create({
            data: {
              entityType: "lead",
              entityId: id,
              actorId: actor.id,
              action: data.status === "LOST" ? "LEAD_MARKED_LOST" : "LEAD_STATUS_CHANGED",
              prevStatus: original.status,
              newStatus: data.status
            }
          });
        }

        if (data.priority && data.priority !== original.priority) {
          await prisma.auditLog.create({
            data: {
              entityType: "lead",
              entityId: id,
              actorId: actor.id,
              action: "LEAD_PRIORITY_CHANGED",
              prevStatus: original.priority,
              newStatus: data.priority
            }
          });
        }

        if (data.assignedUserId && data.assignedUserId !== original.assignedUserId) {
          await prisma.auditLog.create({
            data: {
              entityType: "lead",
              entityId: id,
              actorId: actor.id,
              action: original.assignedUserId ? "LEAD_REASSIGNED" : "LEAD_ASSIGNED",
              metadata: { from: original.assignedUserId, to: data.assignedUserId }
            }
          });
        }
      } catch (auditErr) {
        console.warn("Audit log creation warning:", auditErr);
      }
    }

    if (data.assignedUserId && data.assignedUserId !== original.assignedUserId) {
      await triggerCrmNotification(
        data.assignedUserId,
        null,
        `Lead ${updated.leadNumber} has been assigned to you.`
      );
    }

    return updated;
  });

  // POST /crm/leads/:id/convert
  fastify.post("/leads/:id/convert", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { bypassDuplicateCheck = false } = request.body as { bypassDuplicateCheck?: boolean };
    const actor = request.user as { id: string };

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.status(404).send({ error: "Lead not found" });
    if (lead.status === "CONVERTED") {
      return reply.status(400).send({ error: "Lead is already converted" });
    }

    // Duplicate detection
    if (!bypassDuplicateCheck) {
      const leadPhoneDigits = lead.phone.replace(/\D/g, "");
      const trailingDigits = leadPhoneDigits.length >= 7 ? leadPhoneDigits.slice(-10) : "";

      const match = await prisma.customer.findFirst({
        where: {
          OR: [
            { email: { equals: lead.email, mode: "insensitive" as const } },
            { phone: { equals: lead.phone } },
            ...(trailingDigits ? [{ phone: { contains: trailingDigits } }] : []),
            ...(lead.companyName ? [{ name: { equals: lead.companyName, mode: "insensitive" as const } }] : [])
          ]
        }
      });

      if (match) {
        return reply.status(409).send({
          duplicateFound: true,
          existingCustomer: match,
          message: "Potential duplicate customer detected."
        });
      }
    }

    const customerCode = await generateCustomerCode();

    // Transaction-safe conversion
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create customer
      const customer = await tx.customer.create({
        data: {
          customerCode,
          type: lead.companyName ? "BUSINESS" : "INDIVIDUAL",
          name: lead.companyName || lead.name,
          contactPerson: lead.companyName ? lead.name : null,
          email: lead.email,
          phone: lead.phone,
          alternatePhone: lead.alternatePhone,
          billingAddress: "Pending", // To be filled by user
          shippingAddress: "Pending",
          city: "Pending",
          state: "Pending",
          country: "India",
          postalCode: "000000",
          notes: lead.notes,
          assignedUserId: lead.assignedUserId,
          status: "ACTIVE"
        }
      });

      // 2. Mark Lead as CONVERTED and link Customer
      const updatedLead = await tx.lead.update({
        where: { id },
        data: {
          status: "CONVERTED",
          convertedAt: new Date(),
          convertedByUserId: actor.id,
          convertedCustomerId: customer.id
        }
      });

      // 3. Link existing activities to Customer
      await tx.activity.updateMany({
        where: { leadId: id },
        data: { customerId: customer.id }
      });

      // 4. Create Audit Log for conversion
      await tx.auditLog.create({
        data: {
          entityType: "lead",
          entityId: lead.id,
          actorId: actor.id,
          action: "LEAD_CONVERTED",
          prevStatus: lead.status,
          newStatus: "CONVERTED",
          metadata: { customerId: customer.id, customerCode }
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "customer",
          entityId: customer.id,
          actorId: actor.id,
          action: "CUSTOMER_CREATED",
          newStatus: "ACTIVE",
          metadata: { leadId: lead.id, leadNumber: lead.leadNumber }
        }
      });

      return { customer, lead: updatedLead };
    });

    await triggerCrmNotification(
      lead.assignedUserId,
      null,
      `Lead ${lead.leadNumber} has been successfully converted to Customer ${result.customer.customerCode}.`
    );

    return result;
  });

  // --- CUSTOMERS ---

  // GET /crm/customers
  fastify.get("/customers", customerReadPreHandler, async (request, reply) => {
    const { 
      search, 
      type, 
      status, 
      sortBy = "createdAt",
      sortOrder = "desc",
      page = "1",
      limit = "20"
    } = request.query as any;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { customerCode: { contains: search, mode: "insensitive" } }
      ];
    }

    if (type) where.type = type;
    if (status) where.status = status;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take,
        include: { assignedUser: { select: { id: true, name: true } } }
      }),
      prisma.customer.count({ where })
    ]);

    return { customers, total, page: parseInt(page, 10), limit: take };
  });

  // GET /crm/customers/:id
  fastify.get("/customers/:id", customerReadPreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, name: true } },
        leads: { orderBy: { createdAt: "desc" } },
        activities: {
          orderBy: { createdAt: "desc" },
          include: { createdByUser: { select: { name: true } } }
        }
      }
    });

    if (!customer) return reply.status(404).send({ error: "Customer not found" });
    return customer;
  });

  // POST /crm/customers
  fastify.post("/customers", customerWritePreHandler, async (request, reply) => {
    const data = CustomerCreateSchema.parse(request.body);
    const actor = request.user as { id: string };
    const { bypassDuplicateCheck = false } = request.body as any;

    const name = data.name.trim().replace(/\s+/g, " ");
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim();
    const alternatePhone = data.alternatePhone ? data.alternatePhone.trim() : null;
    const taxGst = data.taxGst ? data.taxGst.trim().toUpperCase() : null;
    const contactPerson = data.type === "BUSINESS" && data.contactPerson ? data.contactPerson.trim().replace(/\s+/g, " ") : null;

    if (!bypassDuplicateCheck) {
      const match = await prisma.customer.findFirst({
        where: {
          OR: [
            { email: { equals: email, mode: "insensitive" as const } },
            { phone: { equals: phone } },
            ...(taxGst ? [{ taxGst: { equals: taxGst, mode: "insensitive" as const } }] : []),
            ...(data.type === "BUSINESS" ? [{ name: { equals: name, mode: "insensitive" as const } }] : [])
          ]
        }
      });

      if (match) {
        return reply.status(409).send({
          duplicateFound: true,
          existingCustomer: match,
          message: `Customer already exists (${match.customerCode} - ${match.name}) with matching contact or tax details.`
        });
      }
    }

    const customerCode = await generateCustomerCode();

    const customer = await prisma.customer.create({
      data: {
        type: data.type,
        name,
        contactPerson,
        email,
        phone,
        alternatePhone,
        billingAddress: data.billingAddress.trim(),
        shippingAddress: data.shippingAddress.trim(),
        city: data.city.trim(),
        state: data.state.trim(),
        country: data.country.trim(),
        postalCode: data.postalCode.trim(),
        taxGst,
        notes: data.notes?.trim() || null,
        assignedUserId: data.assignedUserId || null,
        customerCode,
        status: "ACTIVE"
      }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "customer",
        entityId: customer.id,
        actorId: actor.id,
        action: "CUSTOMER_CREATED",
        newStatus: customer.status,
        metadata: { customerCode, email, phone }
      }
    });

    return customer;
  });

  // PUT /crm/customers/:id
  fastify.put("/customers/:id", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = CustomerUpdateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const original = await prisma.customer.findUnique({ where: { id } });
    if (!original) return reply.status(404).send({ error: "Customer not found" });

    const updated = await prisma.customer.update({
      where: { id },
      data
    });

    if (data.status && data.status !== original.status) {
      await prisma.auditLog.create({
        data: {
          entityType: "customer",
          entityId: id,
          actorId: actor.id,
          action: "CUSTOMER_STATUS_CHANGED",
          prevStatus: original.status,
          newStatus: data.status
        }
      });
    } else {
      await prisma.auditLog.create({
        data: {
          entityType: "customer",
          entityId: id,
          actorId: actor.id,
          action: "CUSTOMER_UPDATED"
        }
      });
    }

    return updated;
  });

  // --- ACTIVITIES ---

  // POST /crm/activities
  fastify.post("/activities", crmWritePreHandler, async (request, reply) => {
    const data = ActivityCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const activity = await prisma.activity.create({
      data: {
        activityType: data.activityType,
        subject: data.subject,
        description: data.description,
        leadId: data.leadId,
        customerId: data.customerId,
        assignedUserId: data.assignedUserId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        createdByUserId: actor.id
      }
    });

    await prisma.auditLog.create({
      data: {
        entityType: "activity",
        entityId: activity.id,
        actorId: actor.id,
        action: "ACTIVITY_CREATED",
        newStatus: activity.status
      }
    });

    if (activity.assignedUserId) {
      await triggerCrmNotification(
        activity.assignedUserId,
        null,
        `New CRM Activity assigned: ${activity.subject}`
      );
    }

    return activity;
  });

  // PUT /crm/activities/:id
  fastify.put("/activities/:id", crmWritePreHandler, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = ActivityUpdateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const original = await prisma.activity.findUnique({ where: { id } });
    if (!original) return reply.status(404).send({ error: "Activity not found" });

    const updateData: any = {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    };

    if (data.status === "COMPLETED") {
      updateData.completionDate = new Date();
    } else if (data.status === "CANCELLED" || data.status === "PENDING") {
      updateData.completionDate = null;
    }

    const updated = await prisma.activity.update({
      where: { id },
      data: updateData
    });

    if (data.status && data.status !== original.status) {
      await prisma.auditLog.create({
        data: {
          entityType: "activity",
          entityId: id,
          actorId: actor.id,
          action: data.status === "COMPLETED" ? "ACTIVITY_COMPLETED" : "ACTIVITY_CANCELLED",
          prevStatus: original.status,
          newStatus: data.status
        }
      });
    }

    return updated;
  });

  // GET /crm/search - Global exact & substring search for IDs/numbers/serials
  fastify.get("/search", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.trim().length < 3) {
      return reply.status(400).send({ error: "Search query must be at least 3 characters long" });
    }

    const query = q.trim();

    const [
      cells,
      packs,
      salesOrders,
      purchaseOrders,
      goodsReceipts,
      dispatchOrders,
      workOrders,
      warranties,
      serviceBatteries,
      invoices
    ] = await Promise.all([
      // 1. Cells
      prisma.cell.findMany({
        where: { serialNumber: { contains: query, mode: "insensitive" } },
        take: 5,
        select: { serialNumber: true, status: true, category: true }
      }),
      // 2. PaxPacks
      prisma.paxPack.findMany({
        where: { paxSerial: { contains: query, mode: "insensitive" } },
        take: 5,
        select: { paxSerial: true, status: true }
      }),
      // 3. SalesOrders
      prisma.salesOrder.findMany({
        where: { salesOrderNumber: { contains: query, mode: "insensitive" } },
        take: 5,
        select: { id: true, salesOrderNumber: true, status: true, grandTotal: true }
      }),
      // 4. PurchaseOrders
      prisma.purchaseOrder.findMany({
        where: { poNumber: { contains: query, mode: "insensitive" } },
        take: 5,
        select: { id: true, poNumber: true, status: true }
      }),
      // 5. GoodsReceipts
      prisma.goodsReceipt.findMany({
        where: { grnNumber: { contains: query, mode: "insensitive" } },
        take: 5,
        select: { id: true, grnNumber: true, status: true }
      }),
      // 6. DispatchOrders
      prisma.dispatchOrder.findMany({
        where: { dispatchNumber: { contains: query, mode: "insensitive" } },
        take: 5,
        select: { id: true, dispatchNumber: true, status: true }
      }),
      // 7. WorkOrders
      prisma.workOrder.findMany({
        where: { workOrderNumber: { contains: query, mode: "insensitive" } },
        take: 5,
        select: { id: true, workOrderNumber: true, status: true, plannedQuantity: true }
      }),
      // 8. Warranties
      prisma.warranty.findMany({
        where: { 
          OR: [
            { warrantyNumber: { contains: query, mode: "insensitive" } },
            { paxSerial: { contains: query, mode: "insensitive" } }
          ]
        },
        take: 5,
        select: { id: true, warrantyNumber: true, paxSerial: true, status: true }
      }),
      // 9. ServiceBatteries
      prisma.serviceBattery.findMany({
        where: {
          OR: [
            { serviceId: { contains: query, mode: "insensitive" } },
            { serialNumber: { contains: query, mode: "insensitive" } },
            { originalBatterySerial: { contains: query, mode: "insensitive" } }
          ]
        },
        take: 5,
        select: { id: true, serviceId: true, serialNumber: true, status: true }
      }),
      // 10. Invoices
      prisma.invoice.findMany({
        where: { invoiceNumber: { contains: query, mode: "insensitive" } },
        take: 5,
        select: { id: true, invoiceNumber: true, status: true, grandTotal: true }
      })
    ]);

    return {
      cells,
      packs,
      salesOrders,
      purchaseOrders,
      goodsReceipts,
      dispatchOrders,
      workOrders,
      warranties,
      serviceBatteries,
      invoices
    };
  });
}
