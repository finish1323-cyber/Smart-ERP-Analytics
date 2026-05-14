import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const safesTable = pgTable("safes", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  name: text("name").notNull(),
  initialBalance: numeric("initial_balance", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSafeSchema = createInsertSchema(safesTable).omit({ id: true, createdAt: true });
export type InsertSafe = z.infer<typeof insertSafeSchema>;
export type Safe = typeof safesTable.$inferSelect;
