import { Router } from "express";
import { db } from "@workspace/db";
import { safesTable, financialTransactionsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const safes = await db.select().from(safesTable).where(eq(safesTable.companyId, req.companyId!));
    const withBalance = await Promise.all(safes.map(async (s) => {
      const [inRow] = await db.select({ total: sql<string>`coalesce(sum(amount),0)` })
        .from(financialTransactionsTable)
        .where(and(eq(financialTransactionsTable.safeId, s.id), eq(financialTransactionsTable.type, "in"), eq(financialTransactionsTable.companyId, req.companyId!)));
      const [outRow] = await db.select({ total: sql<string>`coalesce(sum(amount),0)` })
        .from(financialTransactionsTable)
        .where(and(eq(financialTransactionsTable.safeId, s.id), eq(financialTransactionsTable.type, "out"), eq(financialTransactionsTable.companyId, req.companyId!)));
      const balance = parseFloat(s.initialBalance) + parseFloat(inRow?.total ?? "0") - parseFloat(outRow?.total ?? "0");
      return { ...s, currentBalance: balance.toFixed(2) };
    }));
    res.json(withBalance);
  } catch (err) {
    req.log.error({ err }, "List safes error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, requireRole("admin", "accountant", "procurement"), async (req, res) => {
  try {
    const { name, initialBalance, notes } = req.body;
    if (!name) { res.status(400).json({ error: "Bad Request", message: "اسم الخزينة مطلوب" }); return; }
    const inserted = await db.insert(safesTable).values({
      companyId: req.companyId!,
      name,
      initialBalance: initialBalance ?? 0,
      notes,
    }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Create safe error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", requireAuth, requireRole("admin", "accountant"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, initialBalance, notes } = req.body;
    const updated = await db.update(safesTable)
      .set({ name, initialBalance, notes })
      .where(and(eq(safesTable.id, id), eq(safesTable.companyId, req.companyId!)))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update safe error");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(safesTable).where(and(eq(safesTable.id, id), eq(safesTable.companyId, req.companyId!)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete safe error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
