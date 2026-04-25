import { pgTable, serial, integer, numeric, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { suppliersTable } from "./suppliers";
import { productsTable } from "./products";

export const supplierProductsTable = pgTable("supplier_products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  lastSupplyPrice: numeric("last_supply_price", { precision: 12, scale: 2 }).notNull().default("0"),
  lastSupplyDate: timestamp("last_supply_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  uniqSupplierProduct: unique().on(t.supplierId, t.productId),
}));

export const insertSupplierProductSchema = createInsertSchema(supplierProductsTable).omit({ id: true, createdAt: true });
export type InsertSupplierProduct = z.infer<typeof insertSupplierProductSchema>;
export type SupplierProduct = typeof supplierProductsTable.$inferSelect;
