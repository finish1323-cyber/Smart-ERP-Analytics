import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logActivity } from "../lib/audit";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const suppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.companyId, req.companyId!));
    res.json(suppliers);
  } catch (err) {
    req.log.error({ err }, "List suppliers error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address, discountPercent, notes } = req.body;
    if (!name) { res.status(400).json({ error: "Bad Request", message: "اسم المورد مطلوب" }); return; }
    const inserted = await db.insert(suppliersTable).values({
      companyId: req.companyId!,
      name,
      contactPerson,
      phone,
      email,
      address,
      discountPercent: discountPercent ?? 0,
      notes,
    }).returning();
    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم إضافة مورد جديد: ${name}` });
    res.status(201).json(inserted[0]);
  } catch (err) {
    req.log.error({ err }, "Create supplier error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const suppliers = await db.select().from(suppliersTable).where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, req.companyId!))).limit(1);
    if (!suppliers.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(suppliers[0]);
  } catch (err) {
    req.log.error({ err }, "Get supplier error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, contactPerson, phone, email, address, discountPercent, notes } = req.body;
    const updated = await db.update(suppliersTable)
      .set({ name, contactPerson, phone, email, address, discountPercent, notes })
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, req.companyId!)))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update supplier error");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin", "procurement"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(suppliersTable).where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, req.companyId!)));
    res.json({ success: true, message: "تم حذف المورد" });
  } catch (err) {
    req.log.error({ err }, "Delete supplier error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
