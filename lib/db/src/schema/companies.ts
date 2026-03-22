import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default("شركتي"),
  businessType: text("business_type"),
  address: text("address"),
  phone: text("phone"),
  commercialRegister: text("commercial_register"),
  taxCard: text("tax_card"),
  currency: text("currency").notNull().default("EGP"),
  logoUrl: text("logo_url"),
  defaultSafetyStock: integer("default_safety_stock").notNull().default(10),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companiesTable).omit({ id: true, createdAt: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companiesTable.$inferSelect;
