import { Router } from "express";
import { db } from "@workspace/db";
import { auditLogsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await db.select({
      id: auditLogsTable.id,
      userId: auditLogsTable.userId,
      userName: sql<string>`(SELECT name FROM users WHERE id = ${auditLogsTable.userId})`,
      action: auditLogsTable.action,
      entity: auditLogsTable.entity,
      entityId: auditLogsTable.entityId,
      details: auditLogsTable.details,
      createdAt: auditLogsTable.createdAt,
    }).from(auditLogsTable)
      .where(eq(auditLogsTable.companyId!, req.companyId!))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit);
    res.json(logs);
  } catch (err) {
    req.log.error({ err }, "List audit logs error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
