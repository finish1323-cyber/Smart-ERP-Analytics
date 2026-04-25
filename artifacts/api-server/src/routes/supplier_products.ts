import { Router } from "express";
import { db } from "@workspace/db";
import { supplierProductsTable, productsTable, suppliersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// List all products supplied by a specific supplier (with last supply price)
router.get("/by-supplier/:supplierId", requireAuth, async (req, res) => {
  try {
    const supplierId = parseInt(req.params.supplierId);
    const rows = await db
      .select({
        id: supplierProductsTable.id,
        supplierId: supplierProductsTable.supplierId,
        productId: supplierProductsTable.productId,
        productCode: productsTable.code,
        productName: productsTable.name,
        productUnit: productsTable.unit,
        productCategory: productsTable.category,
        currentQuantity: productsTable.currentQuantity,
        lastSupplyPrice: supplierProductsTable.lastSupplyPrice,
        lastSupplyDate: supplierProductsTable.lastSupplyDate,
      })
      .from(supplierProductsTable)
      .leftJoin(productsTable, eq(supplierProductsTable.productId, productsTable.id))
      .where(and(eq(supplierProductsTable.supplierId, supplierId), eq(supplierProductsTable.companyId, req.companyId!)));

    res.json(rows.map(r => ({
      ...r,
      lastSupplyPrice: parseFloat(r.lastSupplyPrice as any),
      currentQuantity: parseFloat(r.currentQuantity as any),
    })));
  } catch (err) {
    req.log.error({ err }, "List supplier products error");
    res.status(500).json({ error: "Server error" });
  }
});

// Add a product to a supplier (manual link)
router.post("/", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const { supplierId, productId, lastSupplyPrice } = req.body;
    if (!supplierId || !productId) {
      res.status(400).json({ error: "Bad Request", message: "المورد والصنف مطلوبان" });
      return;
    }
    const inserted = await db
      .insert(supplierProductsTable)
      .values({
        companyId: req.companyId!,
        supplierId: parseInt(supplierId),
        productId: parseInt(productId),
        lastSupplyPrice: (parseFloat(lastSupplyPrice) || 0).toString(),
        lastSupplyDate: lastSupplyPrice ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [supplierProductsTable.supplierId, supplierProductsTable.productId],
        set: {
          lastSupplyPrice: (parseFloat(lastSupplyPrice) || 0).toString(),
          ...(lastSupplyPrice ? { lastSupplyDate: new Date() } : {}),
        },
      })
      .returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Create supplier-product error");
    res.status(500).json({ error: "Server error" });
  }
});

// Remove a product from a supplier
router.delete("/:id", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .delete(supplierProductsTable)
      .where(and(eq(supplierProductsTable.id, id), eq(supplierProductsTable.companyId, req.companyId!)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete supplier-product error");
    res.status(500).json({ error: "Server error" });
  }
});

// Best price tracker: for every product, return the lowest last_supply_price across all suppliers
router.get("/best-prices", requireAuth, async (req, res) => {
  try {
    // Get all products for this company with their min supplier price + which supplier
    const rows = await db.execute(sql`
      WITH ranked AS (
        SELECT
          sp.product_id,
          sp.supplier_id,
          sp.last_supply_price,
          sp.last_supply_date,
          ROW_NUMBER() OVER (PARTITION BY sp.product_id ORDER BY sp.last_supply_price ASC, sp.last_supply_date DESC NULLS LAST) AS rn
        FROM supplier_products sp
        WHERE sp.company_id = ${req.companyId} AND sp.last_supply_price > 0
      ),
      supplier_counts AS (
        SELECT product_id, COUNT(*)::int AS supplier_count
        FROM supplier_products
        WHERE company_id = ${req.companyId} AND last_supply_price > 0
        GROUP BY product_id
      )
      SELECT
        p.id AS product_id,
        p.code AS product_code,
        p.name AS product_name,
        p.category AS product_category,
        p.unit AS product_unit,
        p.current_quantity,
        p.cost_price,
        r.supplier_id AS best_supplier_id,
        s.name AS best_supplier_name,
        r.last_supply_price AS best_price,
        r.last_supply_date AS best_price_date,
        COALESCE(sc.supplier_count, 0) AS supplier_count
      FROM products p
      LEFT JOIN ranked r ON r.product_id = p.id AND r.rn = 1
      LEFT JOIN suppliers s ON s.id = r.supplier_id
      LEFT JOIN supplier_counts sc ON sc.product_id = p.id
      WHERE p.company_id = ${req.companyId}
      ORDER BY p.name ASC
    `);

    res.json(
      (rows.rows as any[]).map(r => ({
        productId: r.product_id,
        productCode: r.product_code,
        productName: r.product_name,
        productCategory: r.product_category,
        productUnit: r.product_unit,
        currentQuantity: parseFloat(r.current_quantity ?? 0),
        costPrice: parseFloat(r.cost_price ?? 0),
        bestSupplierId: r.best_supplier_id,
        bestSupplierName: r.best_supplier_name,
        bestPrice: r.best_price !== null ? parseFloat(r.best_price) : null,
        bestPriceDate: r.best_price_date,
        supplierCount: r.supplier_count,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Best prices error");
    res.status(500).json({ error: "Server error" });
  }
});

// Get all supplier offers for a single product (price comparison)
router.get("/by-product/:productId", requireAuth, async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const rows = await db
      .select({
        id: supplierProductsTable.id,
        supplierId: supplierProductsTable.supplierId,
        supplierName: suppliersTable.name,
        lastSupplyPrice: supplierProductsTable.lastSupplyPrice,
        lastSupplyDate: supplierProductsTable.lastSupplyDate,
      })
      .from(supplierProductsTable)
      .leftJoin(suppliersTable, eq(supplierProductsTable.supplierId, suppliersTable.id))
      .where(and(eq(supplierProductsTable.productId, productId), eq(supplierProductsTable.companyId, req.companyId!)));

    const sorted = rows
      .map(r => ({ ...r, lastSupplyPrice: parseFloat(r.lastSupplyPrice as any) }))
      .sort((a, b) => a.lastSupplyPrice - b.lastSupplyPrice);
    res.json(sorted);
  } catch (err) {
    req.log.error({ err }, "Supplier offers error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
