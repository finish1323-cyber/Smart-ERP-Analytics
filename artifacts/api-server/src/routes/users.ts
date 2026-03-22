import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logAudit, logActivity } from "../lib/audit";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const users = await db.select({
      id: usersTable.id,
      companyId: usersTable.companyId,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(eq(usersTable.companyId, req.companyId!));
    res.json(users);
  } catch (err) {
    req.log.error({ err }, "List users error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      res.status(400).json({ error: "Bad Request", message: "جميع الحقول مطلوبة" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await db.insert(usersTable).values({
      companyId: req.companyId!,
      name,
      email,
      passwordHash,
      role,
    }).returning();
    const { passwordHash: _, ...safeUser } = inserted[0];
    await logActivity({ companyId: req.companyId, userId: req.userId, description: `تم إضافة موظف جديد: ${name}` });
    res.status(201).json(safeUser);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(400).json({ error: "Conflict", message: "البريد الإلكتروني مسجل بالفعل" });
      return;
    }
    req.log.error({ err }, "Create user error");
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const users = await db.select({
      id: usersTable.id,
      companyId: usersTable.companyId,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    }).from(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.companyId, req.companyId!))).limit(1);
    const user = users[0];
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "Get user error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, role, isActive, password } = req.body;
    const updateData: any = { name, email, role, isActive };
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    const updated = await db.update(usersTable)
      .set(updateData)
      .where(and(eq(usersTable.id, id), eq(usersTable.companyId, req.companyId!)))
      .returning();
    if (!updated.length) { res.status(404).json({ error: "Not found" }); return; }
    const { passwordHash: _, ...safeUser } = updated[0];
    await logAudit({ companyId: req.companyId, userId: req.userId, action: "update", entity: "user", entityId: id });
    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Update user error");
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(usersTable)
      .set({ isActive: false })
      .where(and(eq(usersTable.id, id), eq(usersTable.companyId, req.companyId!)));
    res.json({ success: true, message: "تم تعطيل المستخدم" });
  } catch (err) {
    req.log.error({ err }, "Delete user error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
