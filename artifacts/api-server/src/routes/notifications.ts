import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /notifications
router.get("/", requireAuth, async (req, res) => {
  try {
    const rows = await db.select()
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, req.userId!),
        eq(notificationsTable.companyId, req.companyId!)
      ))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List notifications error");
    res.status(500).json({ error: "Server error" });
  }
});

// GET /notifications/unread-count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(
        eq(notificationsTable.userId, req.userId!),
        eq(notificationsTable.companyId, req.companyId!),
        eq(notificationsTable.isRead, false)
      ));
    res.json({ count: Number(row?.count ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Unread count error");
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /notifications/read-all
router.put("/read-all", requireAuth, async (req, res) => {
  try {
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(
        eq(notificationsTable.userId, req.userId!),
        eq(notificationsTable.companyId, req.companyId!),
        eq(notificationsTable.isRead, false)
      ));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Read all error");
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /notifications/:id/read
router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(notificationsTable)
      .set({ isRead: true })
      .where(and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, req.userId!),
        eq(notificationsTable.companyId, req.companyId!)
      ));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Mark read error");
    res.status(500).json({ error: "Server error" });
  }
});

// POST /notifications — internal use to create notifications
router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId, title, body, type = "info", relatedId, relatedType } = req.body;
    const inserted = await db.insert(notificationsTable).values({
      companyId: req.companyId!,
      userId: userId ?? req.userId!,
      title,
      body,
      type,
      relatedId,
      relatedType,
    }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Create notification error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
