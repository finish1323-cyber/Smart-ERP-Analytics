import { pgTable, serial, text, integer, numeric, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  name: text("name").notNull(),
  businessType: text("business_type"),
  phone: text("phone"),
  address: text("address"),
  classification: text("classification", { enum: ["new", "vip", "inactive"] }).notNull().default("new"),
  totalPurchases: numeric("total_purchases", { precision: 14, scale: 2 }).notNull().default("0"),
  lastOrderDate: timestamp("last_order_date"),
  nextFollowupDate: date("next_followup_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const callLogsTable = pgTable("call_logs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  userId: integer("user_id"),
  summary: text("summary").notNull(),
  outcome: text("outcome", { enum: ["interested", "not_interested", "quote_requested", "other"] }).notNull(),
  nextFollowupDate: date("next_followup_date"),
  calledAt: timestamp("called_at").notNull().defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, totalPurchases: true, lastOrderDate: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
export type CallLog = typeof callLogsTable.$inferSelect;
