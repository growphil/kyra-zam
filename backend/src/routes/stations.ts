import { FastifyInstance } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";
import { z } from "zod";

const StationCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(["ASSEMBLY", "TESTING"]),
  isActive: z.boolean().default(true),
});

const StationUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  type: z.enum(["ASSEMBLY", "TESTING"]).optional(),
  isActive: z.boolean().optional(),
});

const StationAssignSchema = z.object({
  stationId: z.string().uuid(),
  operatorId: z.string().uuid().optional(),
});

export async function stationRoutes(fastify: FastifyInstance) {
  // GET / - List all stations
  fastify.get("/", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    let stations = await prisma.productionStation.findMany({
      include: {
        assignments: {
          where: { releasedAt: null },
          include: { operator: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    if (stations.length === 0) {
      // Auto-provision standard workstations so shopfloor operations can start immediately
      await prisma.productionStation.createMany({
        data: [
          { name: "Main Assembly Station 1", code: "STN-ASSY-01", type: "ASSEMBLY", isActive: true },
          { name: "Main Assembly Station 2", code: "STN-ASSY-02", type: "ASSEMBLY", isActive: true },
          { name: "Battery Module Testing Station 1", code: "STN-TEST-01", type: "TESTING", isActive: true },
          { name: "PAX Quality Station 1", code: "STN-PAX-01", type: "TESTING", isActive: true }
        ],
        skipDuplicates: true
      });

      stations = await prisma.productionStation.findMany({
        include: {
          assignments: {
            where: { releasedAt: null },
            include: { operator: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { name: "asc" },
      });
    }

    return stations;
  });

  // POST / - Create a new station
  fastify.post("/", { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] }, async (request, reply) => {
    const data = StationCreateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const existingName = await prisma.productionStation.findFirst({ where: { name: data.name } });
    if (existingName) {
      return reply.status(400).send({ error: `Station name "${data.name}" already exists.` });
    }

    const existingCode = await prisma.productionStation.findFirst({ where: { code: data.code } });
    if (existingCode) {
      return reply.status(400).send({ error: `Station code "${data.code}" already exists.` });
    }

    const station = await prisma.productionStation.create({
      data,
    });

    await prisma.auditLog.create({
      data: {
        entityType: "station",
        entityId: station.id,
        actorId: actor.id,
        action: "STATION_CREATED",
        newStatus: station.isActive ? "ACTIVE" : "INACTIVE",
        metadata: { name: station.name, code: station.code, type: station.type },
      },
    });

    return station;
  });

  // PUT /:id - Update station details
  fastify.put("/:id", { preHandler: [requireRoles("ADMIN", "SUPERADMIN")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = StationUpdateSchema.parse(request.body);
    const actor = request.user as { id: string };

    const station = await prisma.productionStation.findUnique({ where: { id } });
    if (!station) {
      return reply.status(404).send({ error: "Station not found." });
    }

    if (data.name) {
      const existingName = await prisma.productionStation.findFirst({ where: { name: data.name, NOT: { id } } });
      if (existingName) {
        return reply.status(400).send({ error: `Station name "${data.name}" already exists.` });
      }
    }

    if (data.code) {
      const existingCode = await prisma.productionStation.findFirst({ where: { code: data.code, NOT: { id } } });
      if (existingCode) {
        return reply.status(400).send({ error: `Station code "${data.code}" already exists.` });
      }
    }

    const updated = await prisma.productionStation.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        entityType: "station",
        entityId: id,
        actorId: actor.id,
        action: "STATION_UPDATED",
        prevStatus: station.isActive ? "ACTIVE" : "INACTIVE",
        newStatus: updated.isActive ? "ACTIVE" : "INACTIVE",
        metadata: { updates: data },
      },
    });

    return updated;
  });

  // POST /assign - Check-in/Assign operator to a station
  fastify.post("/assign", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { stationId, operatorId } = StationAssignSchema.parse(request.body);
    const actor = request.user as { id: string; roles: string[] };

    const targetOperatorId = operatorId || actor.id;

    // Check permissions: only admins/supervisors can assign other operators
    if (targetOperatorId !== actor.id && !actor.roles.includes("ADMIN") && !actor.roles.includes("SUPERADMIN") && !actor.roles.includes("SUPERVISOR")) {
      return reply.status(403).send({ error: "Access denied. Only supervisors or admins can assign other operators." });
    }

    // Verify station exists and is active
    const station = await prisma.productionStation.findUnique({ where: { id: stationId } });
    if (!station) {
      return reply.status(404).send({ error: "Station not found." });
    }
    if (!station.isActive) {
      return reply.status(400).send({ error: "Cannot check in to an inactive station." });
    }

    // Perform inside a transaction
    const assignment = await prisma.$transaction(async (tx) => {
      // 1. Release operator from any existing active assignment
      await tx.stationOperatorAssignment.updateMany({
        where: { operatorId: targetOperatorId, releasedAt: null },
        data: { releasedAt: new Date() },
      });

      // 2. Create new active assignment
      const doc = await tx.stationOperatorAssignment.create({
        data: {
          stationId,
          operatorId: targetOperatorId,
        },
        include: {
          station: true,
          operator: { select: { id: true, name: true, email: true } },
        },
      });

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          entityType: "station",
          entityId: stationId,
          actorId: actor.id,
          action: "STATION_CHECK_IN",
          newStatus: "ASSIGNED",
          metadata: { operatorId: targetOperatorId },
        },
      });

      return doc;
    });

    return assignment;
  });

  // POST /release - Check-out/Release operator from station
  fastify.post("/release", { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = request.body as any;
    const operatorId = body?.operatorId || null;
    const actor = request.user as { id: string; roles: string[] };

    const targetOperatorId = operatorId || actor.id;

    if (targetOperatorId !== actor.id && !actor.roles.includes("ADMIN") && !actor.roles.includes("SUPERADMIN") && !actor.roles.includes("SUPERVISOR")) {
      return reply.status(403).send({ error: "Access denied. Only supervisors or admins can release other operators." });
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const active = await tx.stationOperatorAssignment.findFirst({
        where: { operatorId: targetOperatorId, releasedAt: null },
      });

      if (!active) {
        return { message: "No active assignment found to release." };
      }

      await tx.stationOperatorAssignment.update({
        where: { id: active.id },
        data: { releasedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          entityType: "station",
          entityId: active.stationId,
          actorId: actor.id,
          action: "STATION_CHECK_OUT",
          prevStatus: "ASSIGNED",
          newStatus: "RELEASED",
          metadata: { operatorId: targetOperatorId },
        },
      });

      return { success: true, releasedAssignmentId: active.id };
    });

    return assignment;
  });

  // GET /active-assignments - Get all active assignments
  fastify.get("/active-assignments", { preHandler: [fastify.authenticate] }, async (request) => {
    return prisma.stationOperatorAssignment.findMany({
      where: { releasedAt: null },
      include: {
        station: true,
        operator: { select: { id: true, name: true, email: true } },
      },
    });
  });
}
