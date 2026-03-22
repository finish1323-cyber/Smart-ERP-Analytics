import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { suppliersTable } from "./suppliers";
import { productsTable } from "./products";

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  orderNumber: text("order_number").notNull(),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id),
  status: text("status", { enum: ["pending", "partial", "received", "cancelled"] }).notNull().default("pending"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const purchaseOrderItemsTable = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrdersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  orderedQuantity: numeric("ordered_quantity", { precision: 12, scale: 3 }).notNull(),
  receivedQuantity: numeric("received_quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrdersTable).omit({ id: true, createdAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItemsTable.$inferSelect;
