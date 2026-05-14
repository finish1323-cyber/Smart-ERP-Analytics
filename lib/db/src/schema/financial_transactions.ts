import { pgTable, serial, text, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { safesTable } from "./safes";
import { suppliersTable } from "./suppliers";
import { customersTable } from "./customers";

export const financialTransactionsTable = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  safeId: integer("safe_id").references(() => safesTable.id),
  type: text("type", { enum: ["in", "out"] }).notNull(),
  category: text("category", {
    enum: ["purchase_payment", "sale_receipt", "expense", "income", "other"],
  }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  customerId: integer("customer_id").references(() => customersTable.id),
  purchaseOrderId: integer("purchase_order_id"),
  saleInvoiceId: integer("sale_invoice_id"),
  transactionDate: date("transaction_date").notNull(),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactionsTable).omit({ id: true, createdAt: true });
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export type FinancialTransaction = typeof financialTransactionsTable.$inferSelect;
