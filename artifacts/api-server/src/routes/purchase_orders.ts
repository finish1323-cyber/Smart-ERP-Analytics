import { Router } from "express";
import { db } from "@workspace/db";
import { purchaseOrdersTable, purchaseOrderItemsTable, productsTable, suppliersTable, stockMovementsTable, priceHistoryTable, tasksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/audit";

const router = Router();

let orderCounter = 1000;

router.get("/", requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const rows = await db.select({
      id: purchaseOrdersTable.id,
      companyId: purchaseOrdersTable.companyId,
      orderNumber: purchaseOrdersTable.orderNumber,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      status: purchaseOrdersTable.status,
      totalAmount: purchaseOrdersTable.totalAmount,
      discountPercent: purchaseOrdersTable.discountPercent,
      taxPercent: purchaseOrdersTable.taxPercent,
      netAmount: purchaseOrdersTable.netAmount,
      notes: purchaseOrdersTable.notes,
      createdByUserId: purchaseOrdersTable.createdByUserId,
      createdAt: purchaseOrdersTable.createdAt,
    }).from(purchaseOrdersTable)
      .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
      .where(eq(purchaseOrdersTable.companyId, req.companyId!));

    let filtered = rows;
    if (status) filtered = filtered.filter(r => r.status === status);

    res.json(filtered.map(r => ({
      ...r,
      totalAmount: parseFloat(r.totalAmount as any),
      discountPercent: parseFloat(r.discountPercent as any),
      taxPercent: parseFloat(r.taxPercent as any),
      netAmount: parseFloat(r.netAmount as any),
    })));
  } catch (err) {
    req.log.error({ err }, "List POs error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const { supplierId, discountPercent, taxPercent, notes, items } = req.body;
    if (!supplierId || !items?.length) {
      res.status(400).json({ error: "Bad Request", message: "المورد والأصناف مطلوبان" });
      return;
    }

    const supplier = await db.select().from(suppliersTable).where(eq(suppliersTable.id, supplierId)).limit(1);
    if (!supplier.length) { res.status(404).json({ error: "Supplier not found" }); return; }
    const disc = Math.max(0, Math.min(100, parseFloat(discountPercent ?? 0) || 0));

    let total = 0;
    const itemValues: any[] = [];
    for (const item of items) {
      const lineTotal = parseFloat(item.orderedQuantity) * parseFloat(item.unitPrice);
      total += lineTotal;
      itemValues.push({
        productId: item.productId,
        orderedQuantity: item.orderedQuantity.toString(),
        receivedQuantity: "0",
        unitPrice: item.unitPrice.toString(),
        totalPrice: lineTotal.toString(),
      });
    }

    const tax = taxPercent ?? 0;
    const afterDiscount = total * (1 - disc / 100);
    const net = afterDiscount * (1 + parseFloat(tax) / 100);
    const orderNumber = `PO-${++orderCounter}`;

    const inserted = await db.insert(purchaseOrdersTable).values({
      companyId: req.companyId!,
      orderNumber,
      supplierId,
      status: "pending",
      totalAmount: total.toFixed(2),
      discountPercent: disc.toString(),
      taxPercent: tax.toString(),
      netAmount: net.toFixed(2),
      notes,
      createdByUserId: req.userId,
    }).returning();

    const po = inserted[0];
    const poItems = await db.insert(purchaseOrderItemsTable).values(
      itemValues.map(v => ({ ...v, purchaseOrderId: po.id }))
    ).returning();

    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم إنشاء أمر شراء رقم ${orderNumber}` });
    res.status(201).json({
      ...po,
      supplierName: supplier[0].name,
      totalAmount: parseFloat(po.totalAmount as any),
      discountPercent: parseFloat(po.discountPercent as any),
      taxPercent: parseFloat(po.taxPercent as any),
      netAmount: parseFloat(po.netAmount as any),
    });
  } catch (err) {
    req.log.error({ err }, "Create PO error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const pos = await db.select({
      id: purchaseOrdersTable.id,
      companyId: purchaseOrdersTable.companyId,
      orderNumber: purchaseOrdersTable.orderNumber,
      supplierId: purchaseOrdersTable.supplierId,
      supplierName: suppliersTable.name,
      status: purchaseOrdersTable.status,
      totalAmount: purchaseOrdersTable.totalAmount,
      discountPercent: purchaseOrdersTable.discountPercent,
      taxPercent: purchaseOrdersTable.taxPercent,
      netAmount: purchaseOrdersTable.netAmount,
      notes: purchaseOrdersTable.notes,
      createdByUserId: purchaseOrdersTable.createdByUserId,
      createdAt: purchaseOrdersTable.createdAt,
    }).from(purchaseOrdersTable)
      .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
      .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.companyId, req.companyId!))).limit(1);
    if (!pos.length) { res.status(404).json({ error: "Not found" }); return; }

    const items = await db.select({
      id: purchaseOrderItemsTable.id,
      purchaseOrderId: purchaseOrderItemsTable.purchaseOrderId,
      productId: purchaseOrderItemsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      orderedQuantity: purchaseOrderItemsTable.orderedQuantity,
      receivedQuantity: purchaseOrderItemsTable.receivedQuantity,
      unitPrice: purchaseOrderItemsTable.unitPrice,
      totalPrice: purchaseOrderItemsTable.totalPrice,
    }).from(purchaseOrderItemsTable)
      .leftJoin(productsTable, eq(purchaseOrderItemsTable.productId, productsTable.id))
      .where(eq(purchaseOrderItemsTable.purchaseOrderId, id));

    const po = pos[0];
    res.json({
      ...po,
      totalAmount: parseFloat(po.totalAmount as any),
      discountPercent: parseFloat(po.discountPercent as any),
      taxPercent: parseFloat(po.taxPercent as any),
      netAmount: parseFloat(po.netAmount as any),
      items: items.map(i => ({
        ...i,
        productName: i.productName ?? "غير معروف",
        productCode: i.productCode ?? "",
        orderedQuantity: parseFloat(i.orderedQuantity as any),
        receivedQuantity: parseFloat(i.receivedQuantity as any),
        unitPrice: parseFloat(i.unitPrice as any),
        totalPrice: parseFloat(i.totalPrice as any),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get PO error");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(purchaseOrdersTable).set({ status: "cancelled" }).where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.companyId, req.companyId!)));
    res.json({ success: true, message: "تم إلغاء أمر الشراء" });
  } catch (err) {
    req.log.error({ err }, "Cancel PO error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/receive", requireAuth, requireRole("admin", "procurement", "inventory"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { items } = req.body;
    if (!items?.length) { res.status(400).json({ error: "Bad Request", message: "تفاصيل الاستلام مطلوبة" }); return; }

    const po = await db.select().from(purchaseOrdersTable).where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.companyId, req.companyId!))).limit(1);
    if (!po.length) { res.status(404).json({ error: "Not found" }); return; }
    if (po[0].status === "cancelled") { res.status(400).json({ error: "Bad Request", message: "أمر الشراء ملغى" }); return; }

    for (const receiveItem of items) {
      const { itemId, receivedQuantity } = receiveItem;
      if (parseFloat(receivedQuantity) <= 0) continue;

      const poItem = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.id, itemId)).limit(1);
      if (!poItem.length) continue;
      const item = poItem[0];

      const newReceived = parseFloat(item.receivedQuantity as any) + parseFloat(receivedQuantity);
      await db.update(purchaseOrderItemsTable).set({ receivedQuantity: newReceived.toString() }).where(eq(purchaseOrderItemsTable.id, itemId));

      const product = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
      if (product.length) {
        const p = product[0];
        const newQty = parseFloat(p.currentQuantity as any) + parseFloat(receivedQuantity);
        await db.update(productsTable).set({ currentQuantity: newQty.toString() }).where(eq(productsTable.id, p.id));

        const itemUnitPrice = parseFloat(item.unitPrice as any);
        const oldCostPrice = parseFloat(p.costPrice as any);
        if (itemUnitPrice > 0 && Math.abs(itemUnitPrice - oldCostPrice) > 0.001) {
          const changePercent = ((itemUnitPrice - oldCostPrice) / (oldCostPrice || 1)) * 100;
          await db.insert(priceHistoryTable).values({
            productId: p.id,
            supplierId: po[0].supplierId,
            oldPrice: oldCostPrice.toString(),
            newPrice: itemUnitPrice.toString(),
            changePercent: changePercent.toFixed(2),
          });
          await db.update(productsTable).set({ costPrice: itemUnitPrice.toString() }).where(eq(productsTable.id, p.id));
        }

        await db.insert(stockMovementsTable).values({
          productId: p.id,
          type: "in",
          quantity: receivedQuantity.toString(),
          reference: po[0].orderNumber,
          userId: req.userId,
          notes: `استلام من أمر شراء ${po[0].orderNumber}`,
        });
      }
    }

    const allItems = await db.select().from(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.purchaseOrderId, id));
    let newStatus: "pending" | "partial" | "received" = "partial";
    const allReceived = allItems.every(i => parseFloat(i.receivedQuantity as any) >= parseFloat(i.orderedQuantity as any));
    const noneReceived = allItems.every(i => parseFloat(i.receivedQuantity as any) === 0);
    if (allReceived) newStatus = "received";
    if (noneReceived) newStatus = "pending";

    const updated = await db.update(purchaseOrdersTable).set({ status: newStatus }).where(eq(purchaseOrdersTable.id, id)).returning();
    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم استلام أمر الشراء ${po[0].orderNumber}` });

    const u = updated[0];
    res.json({ ...u, totalAmount: parseFloat(u.totalAmount as any), discountPercent: parseFloat(u.discountPercent as any), taxPercent: parseFloat(u.taxPercent as any), netAmount: parseFloat(u.netAmount as any), supplierName: "" });
  } catch (err) {
    req.log.error({ err }, "Receive PO error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
