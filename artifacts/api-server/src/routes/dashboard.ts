import { Router } from "express";
import { db } from "@workspace/db";
import { salesInvoicesTable, purchaseOrdersTable, customersTable, productsTable, priceHistoryTable, suppliersTable, salesInvoiceItemsTable, activityLogsTable } from "@workspace/db";
import { eq, and, gte, sql, desc, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);

    const [todaySales] = await db.select({
      total: sql<number>`COALESCE(SUM(net_amount::numeric), 0)`,
    }).from(salesInvoicesTable)
      .where(and(eq(salesInvoicesTable.companyId, req.companyId!), eq(salesInvoicesTable.status, "confirmed"), gte(salesInvoicesTable.createdAt, today)));

    const [monthSales] = await db.select({
      total: sql<number>`COALESCE(SUM(net_amount::numeric), 0)`,
    }).from(salesInvoicesTable)
      .where(and(eq(salesInvoicesTable.companyId, req.companyId!), eq(salesInvoicesTable.status, "confirmed"), gte(salesInvoicesTable.createdAt, monthStart)));

    const [pendingPOs] = await db.select({ count: sql<number>`COUNT(*)` }).from(purchaseOrdersTable)
      .where(and(eq(purchaseOrdersTable.companyId, req.companyId!), eq(purchaseOrdersTable.status, "pending")));

    const [newCustomers] = await db.select({ count: sql<number>`COUNT(*)` }).from(customersTable)
      .where(and(eq(customersTable.companyId, req.companyId!), gte(customersTable.createdAt, weekStart)));

    const products = await db.select().from(productsTable).where(eq(productsTable.companyId, req.companyId!));
    const lowStock = products.filter(p => parseFloat(p.currentQuantity as any) <= p.safetyStock).length;

    const company = await db.execute(sql`SELECT currency FROM companies WHERE id = ${req.companyId} LIMIT 1`);
    const currency = (company.rows[0] as any)?.currency ?? "EGP";

    res.json({
      totalSalesToday: parseFloat(String(todaySales.total)),
      totalSalesMonth: parseFloat(String(monthSales.total)),
      pendingPurchaseOrders: parseInt(String(pendingPOs.count)),
      newCustomersCount: parseInt(String(newCustomers.count)),
      lowStockCount: lowStock,
      currency,
    });
  } catch (err) {
    req.log.error({ err }, "Dashboard stats error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/recent-activity", requireAuth, async (req, res) => {
  try {
    const logs = await db.select().from(activityLogsTable)
      .where(eq(activityLogsTable.companyId!, req.companyId!))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(5);

    res.json(logs.map(l => ({
      id: l.id,
      description: l.description,
      userName: null,
      createdAt: l.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Recent activity error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/top-products", requireAuth, async (req, res) => {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const result = await db.select({
      productId: salesInvoiceItemsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      totalQuantity: sql<number>`SUM(${salesInvoiceItemsTable.quantity}::numeric)`,
      totalRevenue: sql<number>`SUM(${salesInvoiceItemsTable.totalPrice}::numeric)`,
      orderCount: sql<number>`COUNT(*)`,
    }).from(salesInvoiceItemsTable)
      .leftJoin(salesInvoicesTable, eq(salesInvoiceItemsTable.invoiceId, salesInvoicesTable.id))
      .leftJoin(productsTable, eq(salesInvoiceItemsTable.productId, productsTable.id))
      .where(and(eq(salesInvoicesTable.companyId, req.companyId!), eq(salesInvoicesTable.status, "confirmed"), gte(salesInvoicesTable.createdAt, monthStart)))
      .groupBy(salesInvoiceItemsTable.productId, productsTable.name, productsTable.code)
      .orderBy(desc(sql`SUM(${salesInvoiceItemsTable.totalPrice}::numeric)`))
      .limit(5);

    res.json(result.map(r => ({
      productId: r.productId ?? 0,
      productName: r.productName ?? "غير معروف",
      productCode: r.productCode ?? "",
      totalQuantity: parseFloat(String(r.totalQuantity)),
      totalRevenue: parseFloat(String(r.totalRevenue)),
      orderCount: parseInt(String(r.orderCount)),
    })));
  } catch (err) {
    req.log.error({ err }, "Top products error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/sales-chart", requireAuth, async (req, res) => {
  try {
    const days = 7;
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const [row] = await db.select({
        total: sql<number>`COALESCE(SUM(net_amount::numeric), 0)`,
      }).from(salesInvoicesTable)
        .where(and(eq(salesInvoicesTable.companyId, req.companyId!), eq(salesInvoicesTable.status, "confirmed"), gte(salesInvoicesTable.createdAt, d), lte(salesInvoicesTable.createdAt, nextD)));

      const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      result.push({
        date: d.toISOString().split("T")[0],
        amount: parseFloat(String(row.total)),
        label: dayNames[d.getDay()],
      });
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Sales chart error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/price-alerts", requireAuth, async (req, res) => {
  try {
    const alerts = await db.select({
      productId: priceHistoryTable.productId,
      productName: productsTable.name,
      supplierName: suppliersTable.name,
      oldPrice: priceHistoryTable.oldPrice,
      newPrice: priceHistoryTable.newPrice,
      changePercent: priceHistoryTable.changePercent,
      changedAt: priceHistoryTable.recordedAt,
    }).from(priceHistoryTable)
      .leftJoin(productsTable, eq(priceHistoryTable.productId, productsTable.id))
      .leftJoin(suppliersTable, eq(priceHistoryTable.supplierId, suppliersTable.id))
      .where(eq(productsTable.companyId, req.companyId!))
      .orderBy(desc(priceHistoryTable.recordedAt))
      .limit(3);

    res.json(alerts.map(a => ({
      productId: a.productId ?? 0,
      productName: a.productName ?? "غير معروف",
      supplierName: a.supplierName ?? null,
      oldPrice: parseFloat(a.oldPrice as any),
      newPrice: parseFloat(a.newPrice as any),
      changePercent: parseFloat(a.changePercent as any),
      changedAt: a.changedAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Price alerts error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
