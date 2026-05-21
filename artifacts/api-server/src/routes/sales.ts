import { Router } from "express";
import { db } from "@workspace/db";
import { salesInvoicesTable, salesInvoiceItemsTable, customersTable, productsTable, stockMovementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logActivity } from "../lib/audit";

const router = Router();
let invoiceCounter = 2000;

router.get("/", requireAuth, async (req, res) => {
  try {
    const { customerId, status } = req.query;
    const invoices = await db.select({
      id: salesInvoicesTable.id,
      companyId: salesInvoicesTable.companyId,
      invoiceNumber: salesInvoicesTable.invoiceNumber,
      customerId: salesInvoicesTable.customerId,
      customerName: customersTable.name,
      status: salesInvoicesTable.status,
      totalAmount: salesInvoicesTable.totalAmount,
      taxPercent: salesInvoicesTable.taxPercent,
      discountPercent: salesInvoicesTable.discountPercent,
      netAmount: salesInvoicesTable.netAmount,
      notes: salesInvoicesTable.notes,
      createdByUserId: salesInvoicesTable.createdByUserId,
      createdAt: salesInvoicesTable.createdAt,
    }).from(salesInvoicesTable)
      .leftJoin(customersTable, eq(salesInvoicesTable.customerId, customersTable.id))
      .where(eq(salesInvoicesTable.companyId, req.companyId!));

    let filtered = invoices;
    if (customerId) filtered = filtered.filter(i => i.customerId === parseInt(customerId as string));
    if (status) filtered = filtered.filter(i => i.status === status);

    res.json(filtered.map(i => ({
      ...i,
      customerName: i.customerName ?? "غير معروف",
      totalAmount: parseFloat(i.totalAmount as any),
      taxPercent: parseFloat(i.taxPercent as any),
      discountPercent: parseFloat(i.discountPercent as any),
      netAmount: parseFloat(i.netAmount as any),
    })));
  } catch (err) {
    req.log.error({ err }, "List sales error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { customerId, taxPercent, discountPercent, notes, items, status: reqStatus, paymentType } = req.body;
    if (!customerId || !items?.length) {
      res.status(400).json({ error: "Bad Request", message: "العميل والأصناف مطلوبان" });
      return;
    }
    const customer = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    if (!customer.length) { res.status(404).json({ error: "Customer not found" }); return; }

    let total = 0;
    const itemValues: any[] = [];
    for (const item of items) {
      const lineTotal = parseFloat(item.quantity) * parseFloat(item.unitPrice);
      total += lineTotal;
      itemValues.push({ productId: item.productId, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString(), totalPrice: lineTotal.toString() });
    }

    const disc = parseFloat(discountPercent ?? 0);
    const tax = parseFloat(taxPercent ?? 0);
    const afterDiscount = total * (1 - disc / 100);
    const net = afterDiscount * (1 + tax / 100);
    const invoiceNumber = `INV-${++invoiceCounter}`;

    const isCash = reqStatus === "confirmed";

    // If cash, validate stock before inserting
    if (isCash) {
      for (const item of items) {
        const product = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
        if (product.length) {
          const avail = parseFloat(product[0].currentQuantity as any);
          if (avail < parseFloat(item.quantity)) {
            res.status(400).json({ error: "Bad Request", message: `كمية ${product[0].name} غير كافية في المخزن` });
            return;
          }
        }
      }
    }

    const inserted = await db.insert(salesInvoicesTable).values({
      companyId: req.companyId!,
      invoiceNumber,
      customerId,
      status: isCash ? "confirmed" : "draft",
      totalAmount: total.toFixed(2),
      taxPercent: tax.toString(),
      discountPercent: disc.toString(),
      netAmount: net.toFixed(2),
      notes,
      createdByUserId: req.userId,
    }).returning();

    const invoice = inserted[0];
    await db.insert(salesInvoiceItemsTable).values(
      itemValues.map(v => ({ ...v, invoiceId: invoice.id }))
    );

    // If cash → deduct stock and update customer totals
    if (isCash) {
      for (const item of items) {
        const product = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
        if (product.length) {
          const p = product[0];
          const newQty = parseFloat(p.currentQuantity as any) - parseFloat(item.quantity);
          await db.update(productsTable).set({ currentQuantity: newQty.toString() }).where(eq(productsTable.id, p.id));
          await db.insert(stockMovementsTable).values({ productId: p.id, type: "out", quantity: item.quantity.toString(), reference: invoiceNumber, userId: req.userId, notes: `مبيعات كاش - فاتورة ${invoiceNumber}` });
        }
      }
      const c = customer[0];
      const newTotal = parseFloat(c.totalPurchases as any) + net;
      await db.update(customersTable).set({ totalPurchases: newTotal.toString(), lastOrderDate: new Date() }).where(eq(customersTable.id, c.id));
    }

    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم إنشاء فاتورة مبيعات رقم ${invoiceNumber} للعميل ${customer[0].name}${isCash ? " (كاش - مؤكدة)" : ""}` });
    res.status(201).json({ ...invoice, customerName: customer[0].name, totalAmount: parseFloat(invoice.totalAmount as any), taxPercent: parseFloat(invoice.taxPercent as any), discountPercent: parseFloat(invoice.discountPercent as any), netAmount: parseFloat(invoice.netAmount as any) });
  } catch (err) {
    req.log.error({ err }, "Create sales invoice error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const invoices = await db.select({
      id: salesInvoicesTable.id,
      companyId: salesInvoicesTable.companyId,
      invoiceNumber: salesInvoicesTable.invoiceNumber,
      customerId: salesInvoicesTable.customerId,
      customerName: customersTable.name,
      status: salesInvoicesTable.status,
      totalAmount: salesInvoicesTable.totalAmount,
      taxPercent: salesInvoicesTable.taxPercent,
      discountPercent: salesInvoicesTable.discountPercent,
      netAmount: salesInvoicesTable.netAmount,
      notes: salesInvoicesTable.notes,
      createdByUserId: salesInvoicesTable.createdByUserId,
      createdAt: salesInvoicesTable.createdAt,
    }).from(salesInvoicesTable)
      .leftJoin(customersTable, eq(salesInvoicesTable.customerId, customersTable.id))
      .where(and(eq(salesInvoicesTable.id, id), eq(salesInvoicesTable.companyId, req.companyId!))).limit(1);

    if (!invoices.length) { res.status(404).json({ error: "Not found" }); return; }

    const items = await db.select({
      id: salesInvoiceItemsTable.id,
      invoiceId: salesInvoiceItemsTable.invoiceId,
      productId: salesInvoiceItemsTable.productId,
      productName: productsTable.name,
      productCode: productsTable.code,
      quantity: salesInvoiceItemsTable.quantity,
      unitPrice: salesInvoiceItemsTable.unitPrice,
      totalPrice: salesInvoiceItemsTable.totalPrice,
    }).from(salesInvoiceItemsTable)
      .leftJoin(productsTable, eq(salesInvoiceItemsTable.productId, productsTable.id))
      .where(eq(salesInvoiceItemsTable.invoiceId, id));

    const inv = invoices[0];
    res.json({
      ...inv,
      customerName: inv.customerName ?? "غير معروف",
      totalAmount: parseFloat(inv.totalAmount as any),
      taxPercent: parseFloat(inv.taxPercent as any),
      discountPercent: parseFloat(inv.discountPercent as any),
      netAmount: parseFloat(inv.netAmount as any),
      items: items.map(i => ({
        ...i,
        productName: i.productName ?? "غير معروف",
        productCode: i.productCode ?? "",
        quantity: parseFloat(i.quantity as any),
        unitPrice: parseFloat(i.unitPrice as any),
        totalPrice: parseFloat(i.totalPrice as any),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Get sales invoice error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    const invoices = await db.select().from(salesInvoicesTable).where(and(eq(salesInvoicesTable.id, id), eq(salesInvoicesTable.companyId, req.companyId!))).limit(1);
    if (!invoices.length) { res.status(404).json({ error: "Not found" }); return; }
    const inv = invoices[0];

    if (status === "confirmed" && inv.status !== "confirmed") {
      const items = await db.select().from(salesInvoiceItemsTable).where(eq(salesInvoiceItemsTable.invoiceId, id));
      for (const item of items) {
        const product = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
        if (product.length) {
          const p = product[0];
          const newQty = parseFloat(p.currentQuantity as any) - parseFloat(item.quantity as any);
          if (newQty < 0) {
            res.status(400).json({ error: "Bad Request", message: `كمية ${p.name} غير كافية في المخزن` });
            return;
          }
          await db.update(productsTable).set({ currentQuantity: newQty.toString() }).where(eq(productsTable.id, p.id));
          await db.insert(stockMovementsTable).values({ productId: p.id, type: "out", quantity: item.quantity, reference: inv.invoiceNumber, userId: req.userId, notes: `مبيعات - فاتورة ${inv.invoiceNumber}` });
        }
      }
      const customer = await db.select().from(customersTable).where(eq(customersTable.id, inv.customerId)).limit(1);
      if (customer.length) {
        const c = customer[0];
        const newTotal = parseFloat(c.totalPurchases as any) + parseFloat(inv.netAmount as any);
        await db.update(customersTable).set({ totalPurchases: newTotal.toString(), lastOrderDate: new Date() }).where(eq(customersTable.id, c.id));
      }
    }

    const updated = await db.update(salesInvoicesTable).set({ status }).where(eq(salesInvoicesTable.id, id)).returning();
    const u = updated[0];
    res.json({ ...u, customerName: "", totalAmount: parseFloat(u.totalAmount as any), taxPercent: parseFloat(u.taxPercent as any), discountPercent: parseFloat(u.discountPercent as any), netAmount: parseFloat(u.netAmount as any) });
  } catch (err) {
    req.log.error({ err }, "Update invoice error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
