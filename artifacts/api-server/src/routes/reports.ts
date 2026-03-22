import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, priceHistoryTable, suppliersTable, salesInvoiceItemsTable, salesInvoicesTable, salesTargetsTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/best-prices", requireAuth, async (req, res) => {
  try {
    const products = await db.select().from(productsTable).where(eq(productsTable.companyId, req.companyId!));
    const result = await Promise.all(products.map(async (p) => {
      const history = await db.select({
        newPrice: priceHistoryTable.newPrice,
        supplierName: suppliersTable.name,
      }).from(priceHistoryTable)
        .leftJoin(suppliersTable, eq(priceHistoryTable.supplierId, suppliersTable.id))
        .where(eq(priceHistoryTable.productId, p.id))
        .orderBy(asc(priceHistoryTable.newPrice))
        .limit(1);

      return {
        productId: p.id,
        productName: p.name,
        productCode: p.code,
        bestPrice: history.length ? parseFloat(history[0].newPrice as any) : parseFloat(p.costPrice as any),
        bestSupplierName: history.length ? history[0].supplierName : null,
        currentPrice: parseFloat(p.costPrice as any),
      };
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Best prices report error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/low-stock", requireAuth, async (req, res) => {
  try {
    const products = await db.select({
      id: productsTable.id,
      companyId: productsTable.companyId,
      code: productsTable.code,
      name: productsTable.name,
      category: productsTable.category,
      unit: productsTable.unit,
      currentQuantity: productsTable.currentQuantity,
      safetyStock: productsTable.safetyStock,
      costPrice: productsTable.costPrice,
      salePrice: productsTable.salePrice,
      supplierId: productsTable.supplierId,
      supplierName: suppliersTable.name,
      createdAt: productsTable.createdAt,
    }).from(productsTable)
      .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
      .where(eq(productsTable.companyId, req.companyId!));

    const lowStock = products.filter(p => parseFloat(p.currentQuantity as any) <= p.safetyStock);

    res.json(lowStock.map(p => ({
      ...p,
      currentQuantity: parseFloat(p.currentQuantity as any),
      costPrice: parseFloat(p.costPrice as any),
      salePrice: parseFloat(p.salePrice as any),
      stockStatus: parseFloat(p.currentQuantity as any) <= 0 ? "out" : "low" as "out" | "low",
    })));
  } catch (err) {
    req.log.error({ err }, "Low stock report error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/top-selling", requireAuth, async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const startDate = new Date();
    if (period === "week") startDate.setDate(startDate.getDate() - 7);
    else if (period === "year") startDate.setFullYear(startDate.getFullYear() - 1);
    else startDate.setMonth(startDate.getMonth() - 1);

    const result = await db.select({
      productId: salesInvoiceItemsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      totalQuantity: sql<number>`SUM(${salesInvoiceItemsTable.quantity}::numeric)`,
      totalRevenue: sql<number>`SUM(${salesInvoiceItemsTable.totalPrice}::numeric)`,
      orderCount: sql<number>`COUNT(DISTINCT ${salesInvoiceItemsTable.invoiceId})`,
    }).from(salesInvoiceItemsTable)
      .leftJoin(salesInvoicesTable, eq(salesInvoiceItemsTable.invoiceId, salesInvoicesTable.id))
      .leftJoin(productsTable, eq(salesInvoiceItemsTable.productId, productsTable.id))
      .where(and(eq(salesInvoicesTable.companyId, req.companyId!), eq(salesInvoicesTable.status, "confirmed"), gte(salesInvoicesTable.createdAt, startDate)))
      .groupBy(salesInvoiceItemsTable.productId, productsTable.name, productsTable.code)
      .orderBy(desc(sql`SUM(${salesInvoiceItemsTable.totalPrice}::numeric)`))
      .limit(10);

    res.json(result.map(r => ({
      productId: r.productId ?? 0,
      productName: r.productName ?? "غير معروف",
      productCode: r.productCode ?? "",
      totalQuantity: parseFloat(String(r.totalQuantity)),
      totalRevenue: parseFloat(String(r.totalRevenue)),
      orderCount: parseInt(String(r.orderCount)),
    })));
  } catch (err) {
    req.log.error({ err }, "Top selling report error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/price-fluctuation", requireAuth, async (req, res) => {
  try {
    const products = await db.select().from(productsTable).where(eq(productsTable.companyId, req.companyId!));
    const result = await Promise.all(products.map(async (p) => {
      const history = await db.select().from(priceHistoryTable)
        .where(eq(priceHistoryTable.productId, p.id))
        .orderBy(asc(priceHistoryTable.recordedAt));

      if (!history.length) return null;

      const firstPrice = parseFloat(history[0].newPrice as any);
      const latestPrice = parseFloat(history[history.length - 1].newPrice as any);
      const totalChangePercent = firstPrice > 0 ? ((latestPrice - firstPrice) / firstPrice) * 100 : 0;

      return {
        productId: p.id,
        productName: p.name,
        productCode: p.code,
        priceChangeCount: history.length,
        firstPrice,
        latestPrice,
        totalChangePercent: Math.round(totalChangePercent * 100) / 100,
      };
    }));

    res.json(result.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "Price fluctuation report error");
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
      const [soldResult] = await db.select({
        totalSold: sql<number>`COALESCE(SUM(sii.quantity::numeric), 0)`,
      }).from(salesInvoiceItemsTable)
        .leftJoin(salesInvoicesTable, eq(salesInvoiceItemsTable.invoiceId, salesInvoicesTable.id))
        .where(and(eq(salesInvoiceItemsTable.productId, t.productId), eq(salesInvoicesTable.status, "confirmed"), gte(salesInvoicesTable.createdAt, new Date(t.startDate)), lte(salesInvoicesTable.createdAt, new Date(t.endDate + "T23:59:59"))));

      const soldQty = parseFloat(String(soldResult?.totalSold ?? 0));
      const targetQty = parseFloat(t.targetQuantity as any);
      const progress = targetQty > 0 ? Math.min(100, (soldQty / targetQty) * 100) : 0;

      return {
        id: t.id, companyId: t.companyId, productId: t.productId,
        productName: t.productName ?? "غير معروف", productCode: t.productCode ?? "",
        currentStock: parseFloat(String(t.currentStock ?? 0)),
        targetQuantity: targetQty, soldQuantity: soldQty,
        progressPercent: Math.round(progress * 100) / 100,
        period: t.period, startDate: t.startDate, endDate: t.endDate, createdAt: t.createdAt,
      };
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Sales targets report error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
