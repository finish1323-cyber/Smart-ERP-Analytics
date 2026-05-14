import { pgTable, serial, text, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { financialTransactionsTable } from "./financial_transactions";

export const paymentInstallmentsTable = pgTable("payment_installments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  purchaseOrderId: integer("purchase_order_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status", { enum: ["pending", "partial", "paid", "overdue"] }).notNull().default("pending"),
  notes: text("notes"),
  transactionId: integer("transaction_id").references(() => financialTransactionsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentInstallmentSchema = createInsertSchema(paymentInstallmentsTable).omit({ id: true, createdAt: true });
export type InsertPaymentInstallment = z.infer<typeof insertPaymentInstallmentSchema>;
export type PaymentInstallment = typeof paymentInstallmentsTable.$inferSelect;
