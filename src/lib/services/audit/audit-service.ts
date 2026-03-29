import { prisma } from "@/lib/db";

export interface AuditLogEntry {
  companyId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, { before: any; after: any }>;
  ipAddress?: string;
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      companyId: entry.companyId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      changes: entry.changes as any,
      ipAddress: entry.ipAddress,
    },
  });
}

/** Compute a diff of changed fields between old and new objects */
export function computeChanges(
  oldData: Record<string, any>,
  newData: Record<string, any>,
  fields: string[]
): Record<string, { before: any; after: any }> | undefined {
  const changes: Record<string, { before: any; after: any }> = {};
  for (const field of fields) {
    const before = oldData[field] ?? null;
    const after = newData[field] ?? null;
    const beforeStr = JSON.stringify(before);
    const afterStr = JSON.stringify(after);
    if (beforeStr !== afterStr) {
      changes[field] = { before, after };
    }
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}
