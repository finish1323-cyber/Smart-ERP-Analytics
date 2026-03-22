import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { customersTable } from "./customers";
import { productsTable } from "./products";

export const salesInvoicesTable = pgTable("sales_invoices", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  status: text("status", { enum: ["draft", "confirmed", "cancelled"] }).notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const salesInvoiceItemsTable = pgTable("sales_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => salesInvoicesTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
});

export const insertSalesInvoiceSchema = createInsertSchema(salesInvoicesTable).omit({ id: true, createdAt: true });
export type InsertSalesInvoice = z.infer<typeof insertSalesInvoiceSchema>;
export type SalesInvoice = typeof salesInvoicesTable.$inferSelect;
export type SalesInvoiceItem = typeof salesInvoiceItemsTable.$inferSelect;
