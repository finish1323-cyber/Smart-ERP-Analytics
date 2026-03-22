import { pgTable, serial, text, integer, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";
import { productsTable } from "./products";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  title: text("title").notNull(),
  description: text("description"),
  assignedToId: integer("assigned_to_id"),
  createdById: integer("created_by_id"),
  priority: text("priority", { enum: ["low", "medium", "urgent"] }).notNull().default("medium"),
  status: text("status", { enum: ["new", "in_progress", "completed", "cancelled"] }).notNull().default("new"),
  dueDate: date("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const taskCommentsTable = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id),
  userId: integer("user_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const salesTargetsTable = pgTable("sales_targets", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  targetQuantity: numeric("target_quantity", { precision: 12, scale: 3 }).notNull(),
  period: text("period", { enum: ["week", "month"] }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
export type TaskComment = typeof taskCommentsTable.$inferSelect;
export type SalesTarget = typeof salesTargetsTable.$inferSelect;
