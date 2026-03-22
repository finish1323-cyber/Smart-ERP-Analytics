import { Router } from "express";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, req.companyId!)).limit(1);
    const company = companies[0];
    if (!company) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(company);
  } catch (err) {
    req.log.error({ err }, "Get company error");
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/", requireAuth, async (req, res) => {
  try {
    const { name, businessType, address, phone, commercialRegister, taxCard, currency, logoUrl, defaultSafetyStock } = req.body;
    const updated = await db.update(companiesTable)
      .set({ name, businessType, address, phone, commercialRegister, taxCard, currency, logoUrl, defaultSafetyStock })
      .where(eq(companiesTable.id, req.companyId!))
      .returning();
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Update company error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
