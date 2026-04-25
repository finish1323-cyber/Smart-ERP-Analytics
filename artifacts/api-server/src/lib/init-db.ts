import { db } from "@workspace/db";
import { companiesTable, usersTable, suppliersTable, productsTable, customersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

export async function initializeDatabase() {
  try {
    // Ensure session table exists (used by connect-pg-simple)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire")`);

    // Ensure supplier_products junction table exists (links suppliers to products with last supply price)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "supplier_products" (
        "id" serial PRIMARY KEY,
        "company_id" integer NOT NULL REFERENCES "companies"("id"),
        "supplier_id" integer NOT NULL REFERENCES "suppliers"("id") ON DELETE CASCADE,
        "product_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "last_supply_price" numeric(12,2) NOT NULL DEFAULT '0',
        "last_supply_date" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        UNIQUE("supplier_id", "product_id")
      )
    `);

    const existing = await db.select({ count: sql<number>`COUNT(*)` }).from(companiesTable);
    const count = parseInt(String(existing[0]?.count ?? 0));

    if (count > 0) {
      logger.info("Database already initialized, skipping seed.");
      return;
    }

    logger.info("Database is empty — seeding initial data...");

    // Company
    const [company] = await db.insert(companiesTable).values({
      name: "شركة النور للتجارة",
      address: "القاهرة، مصر",
      phone: "01000000000",
      email: "info@alnoor.com",
      currency: "EGP",
    }).returning();

    // Admin user
    const adminHash = await bcrypt.hash("admin123", 10);
    const procHash = await bcrypt.hash("proc123", 10);
    const salesHash = await bcrypt.hash("sales123", 10);
    const invHash = await bcrypt.hash("inv123", 10);

    await db.insert(usersTable).values([
      { companyId: company.id, name: "المدير العام", email: "admin@company.com", passwordHash: adminHash, role: "admin", isActive: true },
      { companyId: company.id, name: "أحمد المشتريات", email: "procurement@company.com", passwordHash: procHash, role: "procurement", isActive: true },
      { companyId: company.id, name: "سارة المبيعات", email: "sales@company.com", passwordHash: salesHash, role: "sales", isActive: true },
      { companyId: company.id, name: "محمد المخازن", email: "inventory@company.com", passwordHash: invHash, role: "inventory", isActive: true },
    ]);

    // Suppliers
    const [s1, s2] = await db.insert(suppliersTable).values([
      { companyId: company.id, name: "شركة الفجر للتوريدات", contactPerson: "محمد علي", phone: "01111111111", email: "fajr@example.com", discountPercent: "5.00", address: "القاهرة" },
      { companyId: company.id, name: "مؤسسة النهضة التجارية", contactPerson: "أحمد حسن", phone: "01222222222", email: "nahda@example.com", discountPercent: "3.00", address: "الجيزة" },
    ]).returning();

    // Products
    await db.insert(productsTable).values([
      { companyId: company.id, code: "P001", name: "لاب توب ديل 15", category: "إلكترونيات", unit: "قطعة", costPrice: "12000", salePrice: "15000", currentQuantity: "25", safetyStock: 5, supplierId: s1.id },
      { companyId: company.id, code: "P002", name: "طابعة HP LaserJet", category: "إلكترونيات", unit: "قطعة", costPrice: "3500", salePrice: "4500", currentQuantity: "8", safetyStock: 3, supplierId: s1.id },
      { companyId: company.id, code: "P003", name: "كرسي مكتبي فاخر", category: "أثاث", unit: "قطعة", costPrice: "1200", salePrice: "1800", currentQuantity: "3", safetyStock: 5, supplierId: s2.id },
      { companyId: company.id, code: "P004", name: "مكيف سبليت 1.5 حصان", category: "أجهزة", unit: "قطعة", costPrice: "8000", salePrice: "10500", currentQuantity: "12", safetyStock: 3, supplierId: s1.id },
      { companyId: company.id, code: "P005", name: "شاشة Samsung 27 بوصة", category: "إلكترونيات", unit: "قطعة", costPrice: "4500", salePrice: "5800", currentQuantity: "15", safetyStock: 5, supplierId: s2.id },
      { companyId: company.id, code: "P006", name: "ماوس Logitech لاسلكي", category: "إكسسوارات", unit: "قطعة", costPrice: "350", salePrice: "550", currentQuantity: "40", safetyStock: 10, supplierId: s1.id },
      { companyId: company.id, code: "P007", name: "كيبورد ميكانيكي", category: "إكسسوارات", unit: "قطعة", costPrice: "800", salePrice: "1200", currentQuantity: "20", safetyStock: 8, supplierId: s2.id },
    ]);

    // Customers
    await db.insert(customersTable).values([
      { companyId: company.id, name: "شركة الأمل للمقاولات", phone: "01333333333", email: "amal@example.com", address: "القاهرة", status: "active" },
      { companyId: company.id, name: "مصنع النصر للصناعات", phone: "01444444444", email: "nasr@example.com", address: "الإسكندرية", status: "active" },
      { companyId: company.id, name: "مؤسسة التقدم التجارية", phone: "01555555555", email: "taqadum@example.com", address: "الجيزة", status: "active" },
    ]);

    logger.info("✅ Database seeded successfully! Login: admin@company.com / admin123");
  } catch (err) {
    logger.error({ err }, "❌ Failed to initialize database");
  }
}
