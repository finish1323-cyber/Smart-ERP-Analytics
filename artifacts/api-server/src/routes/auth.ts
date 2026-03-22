import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Bad Request", message: "البريد الإلكتروني وكلمة المرور مطلوبان" });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    const user = users[0];

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Unauthorized", message: "بيانات الدخول غير صحيحة" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "بيانات الدخول غير صحيحة" });
      return;
    }

    (req.session as any).userId = user.id;

    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser, message: "تم تسجيل الدخول بنجاح" });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: "تم تسجيل الخروج" });
  });
});

router.get("/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { passwordHash: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Get current user error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
