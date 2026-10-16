import { prisma } from "../prisma";

interface AuditEntry {
  entityType : "cell" | "pax";
  entityId   : string;
  actorId    : string;
  action     : string;
  prevStatus?: string;
  newStatus? : string;
  metadata?  : any;
}

export async function writeAudit(entry: AuditEntry) {
  await prisma.auditLog.create({
    data: {
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorId: entry.actorId,
      action: entry.action,
      prevStatus: entry.prevStatus ?? null,
      newStatus: entry.newStatus ?? null,
      metadata: entry.metadata ?? null,
    },
  });
}
