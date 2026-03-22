import { db, auditLogsTable, activityLogsTable } from "@workspace/db";

export async function logAudit(params: {
  companyId?: number;
  userId?: number;
  action: string;
  entity: string;
  entityId?: number;
  details?: string;
}) {
  try {
    await db.insert(auditLogsTable).values({
      companyId: params.companyId,
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
    });
  } catch (_) {}
}

export async function logActivity(params: {
  companyId?: number;
  userId?: number;
  description: string;
}) {
  try {
    await db.insert(activityLogsTable).values({
      companyId: params.companyId,
      userId: params.userId,
      description: params.description,
    });
  } catch (_) {}
}
