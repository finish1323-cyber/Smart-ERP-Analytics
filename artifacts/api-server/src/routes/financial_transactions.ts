import { Router } from "express";
import { db } from "@workspace/db";
import {
  financialTransactionsTable,
  paymentInstallmentsTable,
  safesTable,
  suppliersTable,
  purchaseOrdersTable,
} from "@workspace/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/audit";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { type, category, safeId, supplierId, customerId, dateFrom, dateTo } = req.query as Record<string, string>;
    const conditions = [eq(financialTransactionsTable.companyId, req.companyId!)];
    if (type) conditions.push(eq(financialTransactionsTable.type, type as "in" | "out"));
    if (category) conditions.push(eq(financialTransactionsTable.category, category as any));
    if (safeId) conditions.push(eq(financialTransactionsTable.safeId, parseInt(safeId)));
    if (supplierId) conditions.push(eq(financialTransactionsTable.supplierId, parseInt(supplierId)));
    if (customerId) conditions.push(eq(financialTransactionsTable.customerId, parseInt(customerId)));
    if (dateFrom) conditions.push(gte(financialTransactionsTable.transactionDate, dateFrom));
    if (dateTo) conditions.push(lte(financialTransactionsTable.transactionDate, dateTo));

    const rows = await db.select({
      id: financialTransactionsTable.id,
      companyId: financialTransactionsTable.companyId,
      safeId: financialTransactionsTable.safeId,
      safeName: safesTable.name,
      type: financialTransactionsTable.type,
      category: financialTransactionsTable.category,
      amount: financialTransactionsTable.amount,
      description: financialTransactionsTable.description,
      supplierId: financialTransactionsTable.supplierId,
      supplierName: suppliersTable.name,
      customerId: financialTransactionsTable.customerId,
      purchaseOrderId: financialTransactionsTable.purchaseOrderId,
      saleInvoiceId: financialTransactionsTable.saleInvoiceId,
      transactionDate: financialTransactionsTable.transactionDate,
      notes: financialTransactionsTable.notes,
      createdAt: financialTransactionsTable.createdAt,
    })
      .from(financialTransactionsTable)
      .leftJoin(safesTable, eq(financialTransactionsTable.safeId, safesTable.id))
      .leftJoin(suppliersTable, eq(financialTransactionsTable.supplierId, suppliersTable.id))
      .where(and(...conditions))
      .orderBy(desc(financialTransactionsTable.transactionDate), desc(financialTransactionsTable.id));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List transactions error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/summary", requireAuth, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query as Record<string, string>;
    const conditions = [eq(financialTransactionsTable.companyId, req.companyId!)];
    if (dateFrom) conditions.push(gte(financialTransactionsTable.transactionDate, dateFrom));
    if (dateTo) conditions.push(lte(financialTransactionsTable.transactionDate, dateTo));

    const [inRow] = await db.select({ total: sql<string>`coalesce(sum(amount),0)` })
      .from(financialTransactionsTable)
      .where(and(...conditions, eq(financialTransactionsTable.type, "in")));
    const [outRow] = await db.select({ total: sql<string>`coalesce(sum(amount),0)` })
      .from(financialTransactionsTable)
      .where(and(...conditions, eq(financialTransactionsTable.type, "out")));

    const safes = await db.select().from(safesTable).where(eq(safesTable.companyId, req.companyId!));
    const safeBalances = await Promise.all(safes.map(async (s) => {
      const [inS] = await db.select({ total: sql<string>`coalesce(sum(amount),0)` })
        .from(financialTransactionsTable)
        .where(and(eq(financialTransactionsTable.safeId, s.id), eq(financialTransactionsTable.type, "in"), eq(financialTransactionsTable.companyId, req.companyId!)));
      const [outS] = await db.select({ total: sql<string>`coalesce(sum(amount),0)` })
        .from(financialTransactionsTable)
        .where(and(eq(financialTransactionsTable.safeId, s.id), eq(financialTransactionsTable.type, "out"), eq(financialTransactionsTable.companyId, req.companyId!)));
      return { id: s.id, name: s.name, balance: (parseFloat(s.initialBalance) + parseFloat(inS?.total ?? "0") - parseFloat(outS?.total ?? "0")).toFixed(2) };
    }));

    res.json({
      totalIn: parseFloat(inRow?.total ?? "0").toFixed(2),
      totalOut: parseFloat(outRow?.total ?? "0").toFixed(2),
      net: (parseFloat(inRow?.total ?? "0") - parseFloat(outRow?.total ?? "0")).toFixed(2),
      safes: safeBalances,
    });
  } catch (err) {
    req.log.error({ err }, "Summary error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, requireRole("admin", "accountant", "procurement"), async (req, res) => {
  try {
    const {
      safeId, type, category, amount, description,
      supplierId, customerId, purchaseOrderId, saleInvoiceId,
      transactionDate, notes,
    } = req.body;
    if (!type || !category || !amount || !description || !transactionDate) {
      res.status(400).json({ error: "Bad Request", message: "بيانات ناقصة" });
      return;
    }

    const inserted = await db.insert(financialTransactionsTable).values({
      companyId: req.companyId!,
      safeId: safeId ?? null,
      type,
      category,
      amount,
      description,
      supplierId: supplierId ?? null,
      customerId: customerId ?? null,
      purchaseOrderId: purchaseOrderId ?? null,
      saleInvoiceId: saleInvoiceId ?? null,
      transactionDate,
      notes,
      createdByUserId: req.userId,
    }).returning();

    if (purchaseOrderId && type === "out" && category === "purchase_payment") {
      const [po] = await db.select().from(purchaseOrdersTable)
        .where(and(eq(purchaseOrdersTable.id, purchaseOrderId), eq(purchaseOrdersTable.companyId, req.companyId!)));
      if (po) {
        const newPaid = (parseFloat(po.paidAmount ?? "0") + parseFloat(amount)).toFixed(2);
        await db.update(purchaseOrdersTable).set({ paidAmount: newPaid }).where(eq(purchaseOrdersTable.id, purchaseOrderId));
      }
    }

    await logActivity({ companyId: req.companyId, userId: req.userId, description: `معاملة مالية جديدة: ${description}` });
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Create transaction error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", requireAuth, requireRole("admin", "accountant"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { safeId, type, category, amount, description, supplierId, customerId, purchaseOrderId, saleInvoiceId, transactionDate, notes } = req.body;
    const updated = await db.update(financialTransactionsTable)
      .set({ safeId, type, category, amount, description, supplierId, customerId, purchaseOrderId, saleInvoiceId, transactionDate, notes })
      .where(and(eq(financialTransactionsTable.id, id), eq(financialTransactionsTable.companyId, req.companyId!)))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update transaction error");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin", "accountant"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(financialTransactionsTable)
      .where(and(eq(financialTransactionsTable.id, id), eq(financialTransactionsTable.companyId, req.companyId!)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete transaction error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/installments", requireAuth, async (req, res) => {
  try {
    const { purchaseOrderId, status } = req.query as Record<string, string>;
    const conditions = [eq(paymentInstallmentsTable.companyId, req.companyId!)];
    if (purchaseOrderId) conditions.push(eq(paymentInstallmentsTable.purchaseOrderId, parseInt(purchaseOrderId)));
    if (status) conditions.push(eq(paymentInstallmentsTable.status, status as any));

    const today = new Date().toISOString().slice(0, 10);
    const rows = await db.select().from(paymentInstallmentsTable).where(and(...conditions));
    const updated = rows.map(r => ({
      ...r,
      status: r.status === "pending" && r.dueDate < today ? "overdue" : r.status,
    }));
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "List installments error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/installments", requireAuth, requireRole("admin", "accountant", "procurement"), async (req, res) => {
  try {
    const { purchaseOrderId, installments } = req.body as {
      purchaseOrderId: number;
      installments: Array<{ amount: number; dueDate: string; notes?: string }>;
    };
    if (!purchaseOrderId || !Array.isArray(installments) || installments.length === 0) {
      res.status(400).json({ error: "Bad Request", message: "بيانات ناقصة" });
      return;
    }
    await db.delete(paymentInstallmentsTable).where(
      and(eq(paymentInstallmentsTable.purchaseOrderId, purchaseOrderId), eq(paymentInstallmentsTable.companyId, req.companyId!))
    );
    const inserted = await db.insert(paymentInstallmentsTable).values(
      installments.map(i => ({
        companyId: req.companyId!,
        purchaseOrderId,
        amount: String(i.amount),
        dueDate: i.dueDate,
        notes: i.notes,
      }))
    ).returning();
    res.status(201).json(inserted);
  } catch (err) {
    req.log.error({ err }, "Create installments error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/installments/:id/pay", requireAuth, requireRole("admin", "accountant", "procurement"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { safeId, amount, notes } = req.body;
    const [inst] = await db.select().from(paymentInstallmentsTable)
      .where(and(eq(paymentInstallmentsTable.id, id), eq(paymentInstallmentsTable.companyId, req.companyId!)));
    if (!inst) { res.status(404).json({ error: "Not found" }); return; }

    const newPaid = parseFloat(inst.paidAmount) + parseFloat(amount ?? inst.amount);
    const newStatus = newPaid >= parseFloat(inst.amount) ? "paid" : "partial";

    const [txn] = await db.insert(financialTransactionsTable).values({
      companyId: req.companyId!,
      safeId: safeId ?? null,
      type: "out",
      category: "purchase_payment",
      amount: String(amount ?? inst.amount),
      description: `دفعة قسط - أمر شراء #${inst.purchaseOrderId}`,
      purchaseOrderId: inst.purchaseOrderId,
      transactionDate: new Date().toISOString().slice(0, 10),
      notes,
      createdByUserId: req.userId,
    }).returning();

    const updated = await db.update(paymentInstallmentsTable)
      .set({ paidAmount: String(newPaid), status: newStatus, transactionId: txn.id })
      .where(eq(paymentInstallmentsTable.id, id))
      .returning();

    const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, inst.purchaseOrderId));
    if (po) {
      const newPOPaid = (parseFloat(po.paidAmount ?? "0") + parseFloat(amount ?? inst.amount)).toFixed(2);
      await db.update(purchaseOrdersTable).set({ paidAmount: newPOPaid }).where(eq(purchaseOrdersTable.id, inst.purchaseOrderId));
    }

    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Pay installment error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
