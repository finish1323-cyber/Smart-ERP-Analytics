import { Router } from "express";
import { db } from "@workspace/db";
import {
  salesInvoicesTable, purchaseOrdersTable, customersTable, productsTable,
  priceHistoryTable, suppliersTable, salesInvoiceItemsTable, activityLogsTable,
  tasksTable, usersTable,
} from "@workspace/db";
import { eq, and, gte, sql, desc, lte, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─── GET /dashboard/personal ────────────────────────────────────────────────
router.get("/personal", requireAuth, async (req, res) => {
  try {
    const role = req.userRole!;
    const companyId = req.companyId!;
    const userId = req.userId!;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toISOString().split("T")[0];
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);
    const in3DaysStr = in3Days.toISOString().split("T")[0];
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const result: Record<string, any> = { role };

    // ── TASKS (all roles) ───────────────────────────────────────────────────
    const activeTasksWhere = and(
      eq(tasksTable.companyId, companyId),
      sql`${tasksTable.status} NOT IN ('completed', 'cancelled')`,
      sql`${tasksTable.dueDate} IS NOT NULL`
    );
    const myTasksWhere = role === "admin"
      ? activeTasksWhere
      : and(activeTasksWhere, eq(tasksTable.assignedToId, userId));

    const overdueTasks = await db.select({
      id: tasksTable.id,
      title: tasksTable.title,
      dueDate: tasksTable.dueDate,
      priority: tasksTable.priority,
      assigneeName: usersTable.name,
    }).from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assignedToId, usersTable.id))
      .where(and(myTasksWhere, sql`${tasksTable.dueDate} < ${todayStr}`))
      .orderBy(asc(tasksTable.dueDate))
      .limit(10);

    const upcomingTasks = await db.select({
      id: tasksTable.id,
      title: tasksTable.title,
      dueDate: tasksTable.dueDate,
      priority: tasksTable.priority,
      assigneeName: usersTable.name,
    }).from(tasksTable)
      .leftJoin(usersTable, eq(tasksTable.assignedToId, usersTable.id))
      .where(and(
        myTasksWhere,
        sql`${tasksTable.dueDate} >= ${todayStr}`,
        sql`${tasksTable.dueDate} <= ${in3DaysStr}`
      ))
      .orderBy(asc(tasksTable.dueDate))
      .limit(10);

    result.overdueTasks = overdueTasks;
    result.upcomingTasks = upcomingTasks;

    // ── ADMIN ────────────────────────────────────────────────────────────────
    if (role === "admin") {
      const [todaySalesRow] = await db.select({
        total: sql<number>`COALESCE(SUM(net_amount::numeric), 0)`,
      }).from(salesInvoicesTable)
        .where(and(
          eq(salesInvoicesTable.companyId, companyId),
          eq(salesInvoicesTable.status, "confirmed"),
          gte(salesInvoicesTable.createdAt, today)
        ));

      const [monthSalesRow] = await db.select({
        total: sql<number>`COALESCE(SUM(net_amount::numeric), 0)`,
      }).from(salesInvoicesTable)
        .where(and(
          eq(salesInvoicesTable.companyId, companyId),
          eq(salesInvoicesTable.status, "confirmed"),
          gte(salesInvoicesTable.createdAt, monthStart)
        ));

      result.todaySales = parseFloat(String(todaySalesRow.total));
      result.monthSales = parseFloat(String(monthSalesRow.total));

      // Low stock
      result.lowStockProducts = await db.select({
        id: productsTable.id,
        name: productsTable.name,
        code: productsTable.code,
        currentQuantity: productsTable.currentQuantity,
        safetyStock: productsTable.safetyStock,
        unit: productsTable.unit,
      }).from(productsTable)
        .where(and(
          eq(productsTable.companyId, companyId),
          sql`${productsTable.currentQuantity}::numeric <= ${productsTable.safetyStock}::numeric`
        ))
        .orderBy(asc(productsTable.currentQuantity))
        .limit(20);

      // Pending POs
      result.pendingPOs = await db.select({
        id: purchaseOrdersTable.id,
        orderNumber: purchaseOrdersTable.orderNumber,
        supplierName: suppliersTable.name,
        status: purchaseOrdersTable.status,
        netAmount: purchaseOrdersTable.netAmount,
        createdAt: purchaseOrdersTable.createdAt,
        paymentDueDate: purchaseOrdersTable.paymentDueDate,
      }).from(purchaseOrdersTable)
        .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
        .where(and(eq(purchaseOrdersTable.companyId, companyId), eq(purchaseOrdersTable.status, "pending")))
        .orderBy(desc(purchaseOrdersTable.createdAt))
        .limit(10);

      // Overdue deferred PO payments
      result.overduePOPayments = await db.select({
        id: purchaseOrdersTable.id,
        orderNumber: purchaseOrdersTable.orderNumber,
        supplierName: suppliersTable.name,
        netAmount: purchaseOrdersTable.netAmount,
        paymentDueDate: purchaseOrdersTable.paymentDueDate,
      }).from(purchaseOrdersTable)
        .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
        .where(and(
          eq(purchaseOrdersTable.companyId, companyId),
          eq(purchaseOrdersTable.paymentType, "deferred"),
          sql`${purchaseOrdersTable.paymentDueDate} IS NOT NULL`,
          sql`${purchaseOrdersTable.paymentDueDate}::date < ${todayStr}::date`,
          sql`${purchaseOrdersTable.status} != 'cancelled'`
        ))
        .orderBy(asc(purchaseOrdersTable.paymentDueDate))
        .limit(10);

      // Draft sales invoices older than 3 days
      result.overdueSalesInvoices = await db.select({
        id: salesInvoicesTable.id,
        invoiceNumber: salesInvoicesTable.invoiceNumber,
        customerName: customersTable.name,
        netAmount: salesInvoicesTable.netAmount,
        createdAt: salesInvoicesTable.createdAt,
      }).from(salesInvoicesTable)
        .leftJoin(customersTable, eq(salesInvoicesTable.customerId, customersTable.id))
        .where(and(
          eq(salesInvoicesTable.companyId, companyId),
          eq(salesInvoicesTable.status, "draft"),
          lte(salesInvoicesTable.createdAt, threeDaysAgo)
        ))
        .orderBy(asc(salesInvoicesTable.createdAt))
        .limit(10);
    }

    // ── SALES ────────────────────────────────────────────────────────────────
    if (role === "sales") {
      const [myTodayRow] = await db.select({
        total: sql<number>`COALESCE(SUM(net_amount::numeric), 0)`,
      }).from(salesInvoicesTable)
        .where(and(
          eq(salesInvoicesTable.companyId, companyId),
          eq(salesInvoicesTable.status, "confirmed"),
          eq(salesInvoicesTable.createdByUserId, userId),
          gte(salesInvoicesTable.createdAt, today)
        ));

      const [myMonthRow] = await db.select({
        total: sql<number>`COALESCE(SUM(net_amount::numeric), 0)`,
      }).from(salesInvoicesTable)
        .where(and(
          eq(salesInvoicesTable.companyId, companyId),
          eq(salesInvoicesTable.status, "confirmed"),
          eq(salesInvoicesTable.createdByUserId, userId),
          gte(salesInvoicesTable.createdAt, monthStart)
        ));

      result.mySales = {
        today: parseFloat(String(myTodayRow.total)),
        month: parseFloat(String(myMonthRow.total)),
      };

      // Customers needing followup today or overdue
      result.customersForFollowup = await db.select({
        id: customersTable.id,
        name: customersTable.name,
        phone: customersTable.phone,
        nextFollowupDate: customersTable.nextFollowupDate,
        classification: customersTable.classification,
      }).from(customersTable)
        .where(and(
          eq(customersTable.companyId, companyId),
          sql`${customersTable.nextFollowupDate} IS NOT NULL`,
          sql`${customersTable.nextFollowupDate}::date <= ${todayStr}::date`
        ))
        .orderBy(asc(customersTable.nextFollowupDate))
        .limit(10);
    }

    // ── PROCUREMENT ─────────────────────────────────────────────────────────
    if (role === "procurement") {
      result.pendingPOs = await db.select({
        id: purchaseOrdersTable.id,
        orderNumber: purchaseOrdersTable.orderNumber,
        supplierName: suppliersTable.name,
        status: purchaseOrdersTable.status,
        netAmount: purchaseOrdersTable.netAmount,
        createdAt: purchaseOrdersTable.createdAt,
        paymentDueDate: purchaseOrdersTable.paymentDueDate,
      }).from(purchaseOrdersTable)
        .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
        .where(and(eq(purchaseOrdersTable.companyId, companyId), eq(purchaseOrdersTable.status, "pending")))
        .orderBy(desc(purchaseOrdersTable.createdAt))
        .limit(15);

      result.lowStockProducts = await db.select({
        id: productsTable.id,
        name: productsTable.name,
        code: productsTable.code,
        currentQuantity: productsTable.currentQuantity,
        safetyStock: productsTable.safetyStock,
        unit: productsTable.unit,
      }).from(productsTable)
        .where(and(
          eq(productsTable.companyId, companyId),
          sql`${productsTable.currentQuantity}::numeric <= ${productsTable.safetyStock}::numeric`
        ))
        .orderBy(asc(productsTable.currentQuantity))
        .limit(15);
    }

    // ── INVENTORY ────────────────────────────────────────────────────────────
    if (role === "inventory") {
      result.lowStockProducts = await db.select({
        id: productsTable.id,
        name: productsTable.name,
        code: productsTable.code,
        currentQuantity: productsTable.currentQuantity,
        safetyStock: productsTable.safetyStock,
        unit: productsTable.unit,
      }).from(productsTable)
        .where(and(
          eq(productsTable.companyId, companyId),
          sql`${productsTable.currentQuantity}::numeric <= ${productsTable.safetyStock}::numeric`
        ))
        .orderBy(asc(productsTable.currentQuantity))
        .limit(30);

      // Pending + partial POs awaiting receipt
      result.pendingPOs = await db.select({
        id: purchaseOrdersTable.id,
        orderNumber: purchaseOrdersTable.orderNumber,
        supplierName: suppliersTable.name,
        status: purchaseOrdersTable.status,
        netAmount: purchaseOrdersTable.netAmount,
        createdAt: purchaseOrdersTable.createdAt,
      }).from(purchaseOrdersTable)
        .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
        .where(and(
          eq(purchaseOrdersTable.companyId, companyId),
          sql`${purchaseOrdersTable.status} IN ('pending', 'partial')`
        ))
        .orderBy(desc(purchaseOrdersTable.createdAt))
        .limit(15);
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Personal dashboard error");
    res.status(500).json({ error: "Server error" });
  }
});

// ─── existing endpoints (unchanged) ─────────────────────────────────────────

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
