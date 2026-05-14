import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable, purchaseOrdersTable, purchaseOrderItemsTable, financialTransactionsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/audit";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const suppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.companyId, req.companyId!));
    res.json(suppliers);
  } catch (err) {
    req.log.error({ err }, "List suppliers error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address, notes } = req.body;
    if (!name) { res.status(400).json({ error: "Bad Request", message: "اسم المورد مطلوب" }); return; }
    const discountPercent = 0;
    const inserted = await db.insert(suppliersTable).values({
      companyId: req.companyId!,
      name,
      contactPerson,
      phone,
      email,
      address,
      discountPercent: discountPercent ?? 0,
      notes,
    }).returning();
    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم إضافة مورد جديد: ${name}` });
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Create supplier error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const suppliers = await db.select().from(suppliersTable).where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, req.companyId!))).limit(1);
    if (!suppliers.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(suppliers[0]);
  } catch (err) {
    req.log.error({ err }, "Get supplier error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, contactPerson, phone, email, address, notes } = req.body;
    const updated = await db.update(suppliersTable)
      .set({ name, contactPerson, phone, email, address, notes })
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, req.companyId!)))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update supplier error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id/statement", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const supplier = await db.select().from(suppliersTable)
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, req.companyId!)))
      .limit(1);
    if (!supplier.length) { res.status(404).json({ error: "Not found" }); return; }

    const pos = await db.select().from(purchaseOrdersTable)
      .where(and(eq(purchaseOrdersTable.supplierId, id), eq(purchaseOrdersTable.companyId, req.companyId!)))
      .orderBy(desc(purchaseOrdersTable.createdAt));

    const payments = await db.select().from(financialTransactionsTable)
      .where(and(
        eq(financialTransactionsTable.supplierId, id),
        eq(financialTransactionsTable.companyId, req.companyId!),
        eq(financialTransactionsTable.type, "out"),
      ))
      .orderBy(desc(financialTransactionsTable.transactionDate));

    const totalPurchases = pos.reduce((s, p) => s + parseFloat(p.netAmount ?? "0"), 0);
    const totalPaid = payments.reduce((s, t) => s + parseFloat(t.amount ?? "0"), 0);

    const entries: Array<{
      date: string; type: "purchase" | "payment"; description: string;
      debit: number; credit: number; balance: number;
    }> = [];

    const allEvents = [
      ...pos.map(p => ({
        date: p.createdAt.toISOString().slice(0, 10),
        type: "purchase" as const,
        description: `أمر شراء #${p.orderNumber}`,
        debit: parseFloat(p.netAmount ?? "0"),
        credit: 0,
        ref: p.createdAt.getTime(),
      })),
      ...payments.map(t => ({
        date: typeof t.transactionDate === "string" ? t.transactionDate : (t.transactionDate as Date).toISOString().slice(0, 10),
        type: "payment" as const,
        description: t.description,
        debit: 0,
        credit: parseFloat(t.amount ?? "0"),
        ref: new Date(t.createdAt).getTime(),
      })),
    ].sort((a, b) => a.ref - b.ref);

    let running = 0;
    for (const e of allEvents) {
      running += e.debit - e.credit;
      entries.push({ date: e.date, type: e.type, description: e.description, debit: e.debit, credit: e.credit, balance: running });
    }

    res.json({
      supplier: supplier[0],
      totalPurchases: totalPurchases.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      balance: (totalPurchases - totalPaid).toFixed(2),
      entries,
    });
  } catch (err) {
    req.log.error({ err }, "Supplier statement error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/bulk-import", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const { suppliers } = req.body as { suppliers: Array<{ name: string; contactPerson?: string; phone?: string; email?: string; address?: string; notes?: string }> };
    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      res.status(400).json({ error: "Bad Request", message: "قائمة الموردين مطلوبة" });
      return;
    }
    const valid = suppliers.filter(s => s && s.name && s.name.trim());
    if (valid.length === 0) {
      res.status(400).json({ error: "Bad Request", message: "كل الصفوف فارغة أو بدون اسم" });
      return;
    }
    const inserted = await db.insert(suppliersTable).values(
      valid.map(s => ({
        companyId: req.companyId!,
        name: s.name.trim(),
        contactPerson: s.contactPerson?.trim() || null,
        phone: s.phone?.trim() || null,
        email: s.email?.trim() || null,
        address: s.address?.trim() || null,
        notes: s.notes?.trim() || null,
        discountPercent: "0",
      }))
    ).returning();
    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم استيراد ${inserted.length} مورد دفعة واحدة` });
    res.status(201).json({ inserted: inserted.length, skipped: suppliers.length - valid.length, suppliers: inserted });
  } catch (err) {
    req.log.error({ err }, "Bulk import suppliers error");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(suppliersTable).where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, req.companyId!)));
    res.json({ success: true, message: "تم حذف المورد" });
  } catch (err) {
    req.log.error({ err }, "Delete supplier error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
