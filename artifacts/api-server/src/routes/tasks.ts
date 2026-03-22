import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, taskCommentsTable, salesTargetsTable, productsTable, salesInvoiceItemsTable, salesInvoicesTable, usersTable } from "@workspace/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/audit";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { assignedToMe, status, priority } = req.query;
    const tasks = await db.select({
      id: tasksTable.id,
      companyId: tasksTable.companyId,
      title: tasksTable.title,
      description: tasksTable.description,
      assignedToId: tasksTable.assignedToId,
      assignedToName: sql<string>`(SELECT name FROM users WHERE id = ${tasksTable.assignedToId})`,
      createdById: tasksTable.createdById,
      createdByName: sql<string>`(SELECT name FROM users WHERE id = ${tasksTable.createdById})`,
      priority: tasksTable.priority,
      status: tasksTable.status,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
    }).from(tasksTable).where(eq(tasksTable.companyId, req.companyId!));

    let filtered = tasks;
    if (assignedToMe === "true") filtered = filtered.filter(t => t.assignedToId === req.userId);
    if (status) filtered = filtered.filter(t => t.status === status);
    if (priority) filtered = filtered.filter(t => t.priority === priority);

    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "List tasks error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, description, assignedToId, priority, dueDate } = req.body;
    if (!title) { res.status(400).json({ error: "Bad Request", message: "عنوان المهمة مطلوب" }); return; }
    const inserted = await db.insert(tasksTable).values({
      companyId: req.companyId!,
      title,
      description,
      assignedToId: assignedToId || null,
      createdById: req.userId,
      priority: priority ?? "medium",
      status: "new",
      dueDate: dueDate || null,
    }).returning();
    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم إنشاء مهمة جديدة: ${title}` });
    const t = inserted[0];
    res.status(201).json({ ...t, assignedToName: null, createdByName: null });
  } catch (err) {
    req.log.error({ err }, "Create task error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tasks = await db.select({
      id: tasksTable.id,
      companyId: tasksTable.companyId,
      title: tasksTable.title,
      description: tasksTable.description,
      assignedToId: tasksTable.assignedToId,
      assignedToName: sql<string>`(SELECT name FROM users WHERE id = ${tasksTable.assignedToId})`,
      createdById: tasksTable.createdById,
      createdByName: sql<string>`(SELECT name FROM users WHERE id = ${tasksTable.createdById})`,
      priority: tasksTable.priority,
      status: tasksTable.status,
      dueDate: tasksTable.dueDate,
      createdAt: tasksTable.createdAt,
    }).from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.companyId, req.companyId!))).limit(1);

    if (!tasks.length) { res.status(404).json({ error: "Not found" }); return; }

    const comments = await db.select({
      id: taskCommentsTable.id,
      taskId: taskCommentsTable.taskId,
      userId: taskCommentsTable.userId,
      userName: sql<string>`(SELECT name FROM users WHERE id = ${taskCommentsTable.userId})`,
      content: taskCommentsTable.content,
      createdAt: taskCommentsTable.createdAt,
    }).from(taskCommentsTable).where(eq(taskCommentsTable.taskId, id));

    res.json({ ...tasks[0], comments });
  } catch (err) {
    req.log.error({ err }, "Get task error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, status, priority, assignedToId, dueDate } = req.body;

    const tasks = await db.select().from(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.companyId, req.companyId!))).limit(1);
    if (!tasks.length) { res.status(404).json({ error: "Not found" }); return; }
    const task = tasks[0];

    if ((status === "completed" || status === "cancelled") && req.userRole !== "admin" && task.createdById !== req.userId) {
      res.status(403).json({ error: "Forbidden", message: "لا يمكنك إغلاق هذه المهمة" });
      return;
    }

    const updated = await db.update(tasksTable)
      .set({ title, description, status, priority, assignedToId: assignedToId || null, dueDate: dueDate || null })
      .where(eq(tasksTable.id, id))
      .returning();

    const t = updated[0];
    res.json({ ...t, assignedToName: null, createdByName: null });
  } catch (err) {
    req.log.error({ err }, "Update task error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: "Bad Request", message: "المحتوى مطلوب" }); return; }
    const inserted = await db.insert(taskCommentsTable).values({
      taskId: id,
      userId: req.userId,
      content,
    }).returning();
    res.status(201).json({ ...inserted[0], userName: null });
  } catch (err) {
    req.log.error({ err }, "Add comment error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/sales-targets", requireAuth, async (req, res) => {
  try {
    const targets = await db.select({
      id: salesTargetsTable.id,
      companyId: salesTargetsTable.companyId,
      productId: salesTargetsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      currentStock: productsTable.currentQuantity,
      targetQuantity: salesTargetsTable.targetQuantity,
      period: salesTargetsTable.period,
      startDate: salesTargetsTable.startDate,
      endDate: salesTargetsTable.endDate,
      createdAt: salesTargetsTable.createdAt,
    }).from(salesTargetsTable)
      .leftJoin(productsTable, eq(salesTargetsTable.productId, productsTable.id))
      .where(eq(salesTargetsTable.companyId, req.companyId!));

    const result = await Promise.all(targets.map(async (t) => {
      const soldResult = await db.select({
        totalSold: sql<number>`COALESCE(SUM(sii.quantity::numeric), 0)`,
      }).from(salesInvoiceItemsTable.as("sii" as any))
        .leftJoin(salesInvoicesTable, eq(salesInvoiceItemsTable.invoiceId, salesInvoicesTable.id))
        .where(and(
          eq(salesInvoiceItemsTable.productId, t.productId),
          eq(salesInvoicesTable.status, "confirmed"),
          gte(salesInvoicesTable.createdAt, new Date(t.startDate)),
          lte(salesInvoicesTable.createdAt, new Date(t.endDate + "T23:59:59"))
        ));

      const soldQty = parseFloat(String(soldResult[0]?.totalSold ?? 0));
      const targetQty = parseFloat(t.targetQuantity as any);
      const progress = targetQty > 0 ? Math.min(100, (soldQty / targetQty) * 100) : 0;

      return {
        id: t.id,
        companyId: t.companyId,
        productId: t.productId,
        productName: t.productName ?? "غير معروف",
        productCode: t.productCode ?? "",
        currentStock: parseFloat(String(t.currentStock ?? 0)),
        targetQuantity: targetQty,
        soldQuantity: soldQty,
        progressPercent: Math.round(progress * 100) / 100,
        period: t.period,
        startDate: t.startDate,
        endDate: t.endDate,
        createdAt: t.createdAt,
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "List targets error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/sales-targets", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { productId, targetQuantity, period, startDate, endDate } = req.body;
    if (!productId || !targetQuantity || !period || !startDate || !endDate) {
      res.status(400).json({ error: "Bad Request", message: "جميع الحقول مطلوبة" });
      return;
    }
    const product = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
    if (!product.length) { res.status(404).json({ error: "Product not found" }); return; }

    const inserted = await db.insert(salesTargetsTable).values({
      companyId: req.companyId!,
      productId,
      targetQuantity: targetQuantity.toString(),
      period,
      startDate,
      endDate,
    }).returning();

    const t = inserted[0];
    res.status(201).json({
      id: t.id, companyId: t.companyId, productId: t.productId,
      productName: product[0].name, productCode: product[0].code,
      currentStock: parseFloat(product[0].currentQuantity as any),
      targetQuantity: parseFloat(t.targetQuantity as any),
      soldQuantity: 0, progressPercent: 0,
      period: t.period, startDate: t.startDate, endDate: t.endDate, createdAt: t.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Create target error");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/sales-targets/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(salesTargetsTable).where(and(eq(salesTargetsTable.id, id), eq(salesTargetsTable.companyId, req.companyId!)));
    res.json({ success: true, message: "تم حذف الهدف" });
  } catch (err) {
    req.log.error({ err }, "Delete target error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
