import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare module "express-serve-static-core" {
  interface Request {
    userId?: number;
    userRole?: string;
    companyId?: number;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized", message: "يجب تسجيل الدخول أولاً" });
    return;
  }

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const user = users[0];
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Unauthorized", message: "الحساب غير نشط" });
      return;
    }
    req.userId = user.id;
    req.userRole = user.role;
    req.companyId = user.companyId;
    next();
  } catch (err) {
    req.log.error({ err }, "Auth middleware error");
    res.status(500).json({ error: "Server error" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: "Forbidden", message: "ليس لديك صلاحية للقيام بهذه العملية" });
      return;
    }
    next();
  };
}
