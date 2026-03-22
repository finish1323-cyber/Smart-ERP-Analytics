import { db } from "@workspace/db";
import { companiesTable, usersTable, suppliersTable, productsTable, customersTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 بدء إضافة البيانات الأولية...");

  const existingCompanies = await db.select().from(companiesTable).limit(1);
  if (existingCompanies.length) {
    console.log("✅ البيانات موجودة بالفعل - تخطي");
    process.exit(0);
  }

  const [company] = await db.insert(companiesTable).values({
    name: "شركة النور للتجارة",
    businessType: "تجارة وتوزيع",
    address: "القاهرة، مصر",
    phone: "01000000000",
    commercialRegister: "12345",
    taxCard: "987654321",
    currency: "EGP",
    defaultSafetyStock: 10,
  }).returning();

  console.log("✅ تم إنشاء الشركة:", company.name);

  const passwordHash = await bcrypt.hash("admin123", 10);
  const [adminUser] = await db.insert(usersTable).values({
    companyId: company.id,
    name: "المدير العام",
    email: "admin@company.com",
    passwordHash,
    role: "admin",
    isActive: true,
  }).returning();

  await db.insert(usersTable).values([
    { companyId: company.id, name: "أحمد المشتريات", email: "procurement@company.com", passwordHash: await bcrypt.hash("123456", 10), role: "procurement", isActive: true },
    { companyId: company.id, name: "سارة المبيعات", email: "sales@company.com", passwordHash: await bcrypt.hash("123456", 10), role: "sales", isActive: true },
    { companyId: company.id, name: "محمد المخازن", email: "inventory@company.com", passwordHash: await bcrypt.hash("123456", 10), role: "inventory", isActive: true },
  ]);

  console.log("✅ تم إنشاء المستخدمين");

  const [sup1] = await db.insert(suppliersTable).values({
    companyId: company.id,
    name: "شركة الفجر للتوريدات",
    contactPerson: "خالد إبراهيم",
    phone: "01100000001",
    email: "alfajr@supplier.com",
    discountPercent: "5",
    notes: "مورد رئيسي",
  }).returning();

  const [sup2] = await db.insert(suppliersTable).values({
    companyId: company.id,
    name: "مؤسسة النهضة التجارية",
    contactPerson: "عمر سالم",
    phone: "01200000002",
    discountPercent: "3",
  }).returning();

  console.log("✅ تم إنشاء الموردين");

  await db.insert(productsTable).values([
    { companyId: company.id, code: "P001", name: "لاب توب ديل 15", category: "إلكترونيات", unit: "قطعة", currentQuantity: "25", safetyStock: 5, costPrice: "12000", salePrice: "15000", supplierId: sup1.id },
    { companyId: company.id, code: "P002", name: "طابعة HP LaserJet", category: "إلكترونيات", unit: "قطعة", currentQuantity: "8", safetyStock: 5, costPrice: "3500", salePrice: "4500", supplierId: sup1.id },
    { companyId: company.id, code: "P003", name: "كرسي مكتبي فاخر", category: "أثاث مكتبي", unit: "قطعة", currentQuantity: "3", safetyStock: 5, costPrice: "1200", salePrice: "1800", supplierId: sup2.id },
    { companyId: company.id, code: "P004", name: "شاشة سامسونج 24 بوصة", category: "إلكترونيات", unit: "قطعة", currentQuantity: "15", safetyStock: 5, costPrice: "2800", salePrice: "3500", supplierId: sup1.id },
    { companyId: company.id, code: "P005", name: "ورق A4 (رزمة 500)", category: "مستلزمات مكتبية", unit: "رزمة", currentQuantity: "0", safetyStock: 20, costPrice: "45", salePrice: "65", supplierId: sup2.id },
    { companyId: company.id, code: "P006", name: "ماوس لاسلكي", category: "إلكترونيات", unit: "قطعة", currentQuantity: "20", safetyStock: 10, costPrice: "150", salePrice: "220", supplierId: sup1.id },
  ]);

  console.log("✅ تم إنشاء المنتجات");

  await db.insert(customersTable).values([
    { companyId: company.id, name: "مؤسسة الأمل للتجارة", businessType: "شركة توزيع", phone: "01300000001", address: "الإسكندرية", classification: "vip", totalPurchases: "85000" },
    { companyId: company.id, name: "شركة المستقبل للتقنية", businessType: "شركة تقنية", phone: "01400000002", address: "القاهرة", classification: "new", totalPurchases: "12000" },
    { companyId: company.id, name: "مكتب الوفاء", businessType: "مكتب خدمات", phone: "01500000003", address: "الجيزة", classification: "inactive", totalPurchases: "5500" },
  ]);

  console.log("✅ تم إنشاء العملاء");
  console.log("🎉 اكتمل إعداد البيانات الأولية بنجاح!");
  console.log("📧 بيانات الدخول: admin@company.com / admin123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ خطأ في إضافة البيانات:", err);
  process.exit(1);
});
