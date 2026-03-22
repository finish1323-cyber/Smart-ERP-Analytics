import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, priceHistoryTable, stockMovementsTable, suppliersTable } from "@workspace/db";
import { eq, and, ilike, or, lt, lte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logActivity, logAudit } from "../lib/audit";

const router = Router();

function getStockStatus(qty: number, safety: number): "available" | "low" | "out" {
  if (qty <= 0) return "out";
  if (qty <= safety) return "low";
  return "available";
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { search, supplierId, category } = req.query;
    const rows = await db.select({
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

    let filtered = rows;
    if (search) {
      const s = (search as string).toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(s) ||
        r.code.toLowerCase().includes(s) ||
        (r.supplierName && r.supplierName.toLowerCase().includes(s))
      );
    }
    if (supplierId) {
      filtered = filtered.filter(r => r.supplierId === parseInt(supplierId as string));
    }
    if (category) {
      filtered = filtered.filter(r => r.category === category);
    }

    const result = filtered.map(r => ({
      ...r,
      currentQuantity: parseFloat(r.currentQuantity as any),
      costPrice: parseFloat(r.costPrice as any),
      salePrice: parseFloat(r.salePrice as any),
      stockStatus: getStockStatus(parseFloat(r.currentQuantity as any), r.safetyStock),
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "List products error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, requireRole("admin", "procurement", "inventory"), async (req, res) => {
  try {
    const { code, name, category, unit, safetyStock, costPrice, salePrice, supplierId } = req.body;
    if (!code || !name) { res.status(400).json({ error: "Bad Request", message: "الكود والاسم مطلوبان" }); return; }
    const inserted = await db.insert(productsTable).values({
      companyId: req.companyId!,
      code, name, category, unit,
      safetyStock: safetyStock ?? 10,
      costPrice: costPrice ?? 0,
      salePrice: salePrice ?? 0,
      supplierId: supplierId || null,
      currentQuantity: "0",
    }).returning();
    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم إضافة منتج جديد: ${name}` });
    const p = inserted[0];
    res.status(201).json({ ...p, currentQuantity: 0, costPrice: parseFloat(p.costPrice as any), salePrice: parseFloat(p.salePrice as any), stockStatus: "out" });
  } catch (err) {
    req.log.error({ err }, "Create product error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const rows = await db.select({
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
      .where(and(eq(productsTable.id, id), eq(productsTable.companyId, req.companyId!)))
      .limit(1);

    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    const p = rows[0];

    const priceHistory = await db.select({
      id: priceHistoryTable.id,
      productId: priceHistoryTable.productId,
      supplierId: priceHistoryTable.supplierId,
      supplierName: suppliersTable.name,
      oldPrice: priceHistoryTable.oldPrice,
      newPrice: priceHistoryTable.newPrice,
      changePercent: priceHistoryTable.changePercent,
      recordedAt: priceHistoryTable.recordedAt,
    }).from(priceHistoryTable)
      .leftJoin(suppliersTable, eq(priceHistoryTable.supplierId, suppliersTable.id))
      .where(eq(priceHistoryTable.productId, id))
      .limit(50);

    const movements = await db.select().from(stockMovementsTable)
      .where(eq(stockMovementsTable.productId, id))
      .limit(50);

    res.json({
      ...p,
      currentQuantity: parseFloat(p.currentQuantity as any),
      costPrice: parseFloat(p.costPrice as any),
      salePrice: parseFloat(p.salePrice as any),
      stockStatus: getStockStatus(parseFloat(p.currentQuantity as any), p.safetyStock),
      priceHistory: priceHistory.map(h => ({
        ...h,
        oldPrice: parseFloat(h.oldPrice as any),
        newPrice: parseFloat(h.newPrice as any),
        changePercent: parseFloat(h.changePercent as any),
      })),
      movements: movements.map(m => ({ ...m, quantity: parseFloat(m.quantity as any) })),
    });
  } catch (err) {
    req.log.error({ err }, "Get product error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", requireAuth, requireRole("admin", "procurement", "inventory"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { code, name, category, unit, safetyStock, costPrice, salePrice, supplierId } = req.body;

    const existing = await db.select().from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.companyId, req.companyId!))).limit(1);
    if (!existing.length) { res.status(404).json({ error: "Not found" }); return; }
    const old = existing[0];

    if (costPrice && parseFloat(costPrice) !== parseFloat(old.costPrice as any)) {
      const oldPrice = parseFloat(old.costPrice as any);
      const newPrice = parseFloat(costPrice);
      const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;
      await db.insert(priceHistoryTable).values({
        productId: id,
        supplierId: supplierId || old.supplierId,
        oldPrice: oldPrice.toString(),
        newPrice: newPrice.toString(),
        changePercent: changePercent.toFixed(2),
      });
    }

    const updated = await db.update(productsTable)
      .set({ code, name, category, unit, safetyStock, costPrice, salePrice, supplierId: supplierId || null })
      .where(and(eq(productsTable.id, id), eq(productsTable.companyId, req.companyId!)))
      .returning();

    await logAudit({ companyId: req.companyId, userId: req.userId, action: "update", entity: "product", entityId: id, details: `تم تعديل المنتج ${name}` });
    const p = updated[0];
    res.json({ ...p, currentQuantity: parseFloat(p.currentQuantity as any), costPrice: parseFloat(p.costPrice as any), salePrice: parseFloat(p.salePrice as any), stockStatus: getStockStatus(parseFloat(p.currentQuantity as any), p.safetyStock), supplierName: null });
  } catch (err) {
    req.log.error({ err }, "Update product error");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.companyId, req.companyId!)));
    res.json({ success: true, message: "تم حذف المنتج" });
  } catch (err) {
    req.log.error({ err }, "Delete product error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id/movements", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const movements = await db.select().from(stockMovementsTable)
      .where(eq(stockMovementsTable.productId, id));
    res.json(movements.map(m => ({ ...m, quantity: parseFloat(m.quantity as any) })));
  } catch (err) {
    req.log.error({ err }, "Get movements error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/adjust", requireAuth, requireRole("admin", "inventory"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { quantity, type, notes } = req.body;
    if (!quantity || !type) { res.status(400).json({ error: "Bad Request", message: "الكمية والنوع مطلوبان" }); return; }
    if (parseFloat(quantity) <= 0) { res.status(400).json({ error: "Bad Request", message: "يجب أن تكون الكمية أكبر من صفر" }); return; }

    const products = await db.select().from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.companyId, req.companyId!))).limit(1);
    if (!products.length) { res.status(404).json({ error: "Not found" }); return; }
    const product = products[0];

    const currentQty = parseFloat(product.currentQuantity as any);
    const adjustQty = parseFloat(quantity);
    let newQty = type === "in" ? currentQty + adjustQty : currentQty - adjustQty;
    if (newQty < 0) { res.status(400).json({ error: "Bad Request", message: "لا يمكن أن تكون الكمية سالبة" }); return; }

    await db.update(productsTable).set({ currentQuantity: newQty.toString() }).where(eq(productsTable.id, id));
    await db.insert(stockMovementsTable).values({ productId: id, type: "adjustment", quantity: adjustQty.toString(), userId: req.userId, notes, reference: `تسوية يدوية` });
    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم تسوية مخزون ${product.name} بمقدار ${adjustQty} (${type === "in" ? "إدخال" : "صرف"})` });

    const p = { ...product, currentQuantity: newQty, costPrice: parseFloat(product.costPrice as any), salePrice: parseFloat(product.salePrice as any), stockStatus: getStockStatus(newQty, product.safetyStock), supplierName: null };
    res.json(p);
  } catch (err) {
    req.log.error({ err }, "Adjust stock error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
