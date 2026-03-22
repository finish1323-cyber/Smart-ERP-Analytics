import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { suppliersTable } from "./suppliers";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category"),
  unit: text("unit"),
  currentQuantity: numeric("current_quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  safetyStock: integer("safety_stock").notNull().default(10),
  costPrice: numeric("cost_price", { precision: 12, scale: 2 }).notNull().default("0"),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }).notNull().default("0"),
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const priceHistoryTable = pgTable("price_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  supplierId: integer("supplier_id").references(() => suppliersTable.id),
  oldPrice: numeric("old_price", { precision: 12, scale: 2 }).notNull(),
  newPrice: numeric("new_price", { precision: 12, scale: 2 }).notNull(),
  changePercent: numeric("change_percent", { precision: 8, scale: 2 }).notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  type: text("type", { enum: ["in", "out", "adjustment"] }).notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  reference: text("reference"),
  userId: integer("user_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type PriceHistory = typeof priceHistoryTable.$inferSelect;
export type StockMovement = typeof stockMovementsTable.$inferSelect;
