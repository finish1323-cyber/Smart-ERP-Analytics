import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, callLogsTable, salesInvoicesTable, salesInvoiceItemsTable, productsTable, usersTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logActivity } from "../lib/audit";

const router = Router();

router.get("/followups/today", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const customers = await db.select().from(customersTable)
      .where(and(eq(customersTable.companyId, req.companyId!), eq(customersTable.nextFollowupDate, today)));
    res.json(customers.map(c => ({
      ...c,
      totalPurchases: parseFloat(c.totalPurchases as any),
    })));
  } catch (err) {
    req.log.error({ err }, "Followups error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const { search, classification } = req.query;
    const customers = await db.select().from(customersTable)
      .where(eq(customersTable.companyId, req.companyId!));

    let filtered = customers;
    if (search) {
      const s = (search as string).toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(s) ||
        (c.phone && c.phone.includes(s)) ||
        (c.businessType && c.businessType.toLowerCase().includes(s))
      );
    }
    if (classification) {
      filtered = filtered.filter(c => c.classification === classification);
    }

    res.json(filtered.map(c => ({ ...c, totalPurchases: parseFloat(c.totalPurchases as any) })));
  } catch (err) {
    req.log.error({ err }, "List customers error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, businessType, phone, address, classification, nextFollowupDate } = req.body;
    if (!name) { res.status(400).json({ error: "Bad Request", message: "اسم العميل مطلوب" }); return; }
    const inserted = await db.insert(customersTable).values({
      companyId: req.companyId!,
      name, businessType, phone, address,
      classification: classification ?? "new",
      nextFollowupDate: nextFollowupDate || null,
      totalPurchases: "0",
    }).returning();
    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم إضافة عميل جديد: ${name}` });
    const c = inserted[0];
    res.status(201).json({ ...c, totalPurchases: 0 });
  } catch (err) {
    req.log.error({ err }, "Create customer error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const customers = await db.select().from(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.companyId, req.companyId!))).limit(1);
    if (!customers.length) { res.status(404).json({ error: "Not found" }); return; }
    const customer = customers[0];

    const invoices = await db.select().from(salesInvoicesTable)
      .where(and(eq(salesInvoicesTable.customerId, id), eq(salesInvoicesTable.companyId, req.companyId!)))
      .limit(10);

    const topProductsQuery = await db.select({
      productId: salesInvoiceItemsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      totalQuantity: sql<number>`SUM(${salesInvoiceItemsTable.quantity}::numeric)`,
      totalRevenue: sql<number>`SUM(${salesInvoiceItemsTable.totalPrice}::numeric)`,
      orderCount: sql<number>`COUNT(*)`,
    }).from(salesInvoiceItemsTable)
      .leftJoin(salesInvoicesTable, eq(salesInvoiceItemsTable.invoiceId, salesInvoicesTable.id))
      .leftJoin(productsTable, eq(salesInvoiceItemsTable.productId, productsTable.id))
      .where(eq(salesInvoicesTable.customerId, id))
      .groupBy(salesInvoiceItemsTable.productId, productsTable.name, productsTable.code)
      .limit(5);

    res.json({
      ...customer,
      totalPurchases: parseFloat(customer.totalPurchases as any),
      topProducts: topProductsQuery.map(p => ({
        productId: p.productId ?? 0,
        productName: p.productName ?? "غير معروف",
        productCode: p.productCode ?? "",
        totalQuantity: parseFloat(String(p.totalQuantity)),
        totalRevenue: parseFloat(String(p.totalRevenue)),
        orderCount: parseInt(String(p.orderCount)),
      })),
      recentInvoices: invoices.map(i => ({
        ...i,
        customerName: customer.name,
        totalAmount: parseFloat(i.totalAmount as any),
        taxPercent: parseFloat(i.taxPercent as any),
        discountPercent: parseFloat(i.discountPercent as any),
        netAmount: parseFloat(i.netAmount as any),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get customer error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, businessType, phone, address, classification, nextFollowupDate } = req.body;
    const updated = await db.update(customersTable)
      .set({ name, businessType, phone, address, classification, nextFollowupDate: nextFollowupDate || null })
      .where(and(eq(customersTable.id, id), eq(customersTable.companyId, req.companyId!)))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    const c = updated[0];
    res.json({ ...c, totalPurchases: parseFloat(c.totalPurchases as any) });
  } catch (err) {
    req.log.error({ err }, "Update customer error");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.companyId, req.companyId!)));
    res.json({ success: true, message: "تم حذف العميل" });
  } catch (err) {
    req.log.error({ err }, "Delete customer error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id/calls", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const calls = await db.select({
      id: callLogsTable.id,
      customerId: callLogsTable.customerId,
      userId: callLogsTable.userId,
      userName: usersTable.name,
      summary: callLogsTable.summary,
      outcome: callLogsTable.outcome,
      nextFollowupDate: callLogsTable.nextFollowupDate,
      calledAt: callLogsTable.calledAt,
    }).from(callLogsTable)
      .leftJoin(usersTable, eq(callLogsTable.userId, usersTable.id))
      .where(eq(callLogsTable.customerId, id));
    res.json(calls);
  } catch (err) {
    req.log.error({ err }, "Get calls error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/calls", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { summary, outcome, nextFollowupDate } = req.body;
    if (!summary || !outcome) { res.status(400).json({ error: "Bad Request", message: "الملخص والنتيجة مطلوبان" }); return; }

    const inserted = await db.insert(callLogsTable).values({
      customerId: id,
      userId: req.userId,
      summary,
      outcome,
      nextFollowupDate: nextFollowupDate || null,
    }).returning();

    if (nextFollowupDate) {
      await db.update(customersTable).set({ nextFollowupDate }).where(eq(customersTable.id, id));
    }

    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Add call error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
