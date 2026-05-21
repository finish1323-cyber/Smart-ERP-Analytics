import { Router } from "express";
import { db } from "@workspace/db";
import {
  salesInvoicesTable, purchaseOrdersTable, customersTable,
  productsTable, tasksTable, suppliersTable, usersTable,
} from "@workspace/db";
import { eq, and, gte, sql, desc, asc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ── helper: fetch ERP context from DB ──────────────────────────────────────
async function fetchContext(companyId: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todaySalesRow] = await db.select({
    total: sql<number>`COALESCE(SUM(net_amount::numeric), 0)`,
  }).from(salesInvoicesTable)
    .where(and(
      eq(salesInvoicesTable.companyId, companyId),
      eq(salesInvoicesTable.status, "confirmed"),
      gte(salesInvoicesTable.createdAt, today)
    ));

  const [monthSalesRow] = await db.select({
    total: sql<number>`COALESCE(SUM(net_amount::numeric), 0)`,
  }).from(salesInvoicesTable)
    .where(and(
      eq(salesInvoicesTable.companyId, companyId),
      eq(salesInvoicesTable.status, "confirmed"),
      gte(salesInvoicesTable.createdAt, monthStart)
    ));

  const lowStock = await db.select({
    name: productsTable.name,
    code: productsTable.code,
    currentQuantity: productsTable.currentQuantity,
    safetyStock: productsTable.safetyStock,
    unit: productsTable.unit,
  }).from(productsTable)
    .where(and(
      eq(productsTable.companyId, companyId),
      sql`${productsTable.currentQuantity}::numeric <= ${productsTable.safetyStock}::numeric`
    ))
    .orderBy(asc(productsTable.currentQuantity))
    .limit(10);

  const overdueTasks = await db.select({
    title: tasksTable.title,
    dueDate: tasksTable.dueDate,
    priority: tasksTable.priority,
    assigneeName: usersTable.name,
  }).from(tasksTable)
    .leftJoin(usersTable, eq(tasksTable.assignedToId, usersTable.id))
    .where(and(
      eq(tasksTable.companyId, companyId),
      sql`${tasksTable.status} NOT IN ('completed','cancelled')`,
      sql`${tasksTable.dueDate} IS NOT NULL`,
      sql`${tasksTable.dueDate} < ${todayStr}`
    ))
    .limit(10);

  const pendingPOs = await db.select({
    orderNumber: purchaseOrdersTable.orderNumber,
    supplierName: suppliersTable.name,
    netAmount: purchaseOrdersTable.netAmount,
    createdAt: purchaseOrdersTable.createdAt,
  }).from(purchaseOrdersTable)
    .leftJoin(suppliersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .where(and(eq(purchaseOrdersTable.companyId, companyId), eq(purchaseOrdersTable.status, "pending")))
    .orderBy(desc(purchaseOrdersTable.createdAt))
    .limit(10);

  const [totalCustomers] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(customersTable).where(eq(customersTable.companyId, companyId));

  return {
    todaySales: parseFloat(String(todaySalesRow.total)),
    monthSales: parseFloat(String(monthSalesRow.total)),
    lowStockProducts: lowStock.map(p => ({
      name: p.name, code: p.code,
      current: parseFloat(p.currentQuantity as any),
      safety: p.safetyStock,
      unit: p.unit,
    })),
    overdueTasks: overdueTasks.map(t => ({
      title: t.title, dueDate: t.dueDate,
      priority: t.priority, assignee: t.assigneeName,
    })),
    pendingPOs: pendingPOs.map(po => ({
      number: po.orderNumber,
      supplier: po.supplierName,
      amount: parseFloat(po.netAmount as any),
    })),
    totalCustomers: parseInt(String(totalCustomers.count)),
  };
}

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof fetchContext>>) {
  const lines = [
    "أنت مساعد ذكي متخصص في تحليل بيانات نظام ERP. أجب باللغة العربية بشكل موجز ومفيد.",
    "",
    "## البيانات الحالية للشركة:",
    `- مبيعات اليوم: ${ctx.todaySales.toFixed(2)} جنيه`,
    `- مبيعات الشهر: ${ctx.monthSales.toFixed(2)} جنيه`,
    `- إجمالي العملاء: ${ctx.totalCustomers}`,
    "",
    `## منتجات تحت حد الأمان (${ctx.lowStockProducts.length} منتج):`,
  ];

  if (ctx.lowStockProducts.length === 0) {
    lines.push("- لا يوجد منتجات تحت حد الأمان");
  } else {
    ctx.lowStockProducts.forEach(p =>
      lines.push(`- ${p.name} (${p.code}): متاح ${p.current} ${p.unit} / حد الأمان ${p.safety}`)
    );
  }

  lines.push("", `## مهام متأخرة (${ctx.overdueTasks.length}):`)
  if (ctx.overdueTasks.length === 0) {
    lines.push("- لا توجد مهام متأخرة");
  } else {
    ctx.overdueTasks.forEach(t =>
      lines.push(`- "${t.title}" — ${t.dueDate} — ${t.assignee ?? "غير محدد"} — أولوية: ${t.priority}`)
    );
  }

  lines.push("", `## أوامر شراء معلقة (${ctx.pendingPOs.length}):`)
  if (ctx.pendingPOs.length === 0) {
    lines.push("- لا توجد أوامر معلقة");
  } else {
    ctx.pendingPOs.forEach(po =>
      lines.push(`- ${po.number} — ${po.supplier ?? "؟"} — ${po.amount.toFixed(2)} جنيه`)
    );
  }

  lines.push("", "أجب على أسئلة المستخدم بناءً على هذه البيانات الحقيقية. إذا سأل عن شيء غير موجود في البيانات أخبره بذلك بوضوح.");

  return lines.join("\n");
}

// ── POST /ai/chat ───────────────────────────────────────────────────────────
router.post("/chat", requireAuth, async (req, res) => {
  const { messages } = req.body as { messages: { role: string; content: string }[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages مطلوبة" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (!apiKey) {
    res.status(503).json({ error: "OpenAI API key غير مضبوط" });
    return;
  }

  try {
    const ctx = await fetchContext(req.companyId!);
    const systemPrompt = buildSystemPrompt(ctx);

    const url = baseUrl ? `${baseUrl}/chat/completions` : "https://api.openai.com/v1/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      req.log.error({ err }, "OpenAI chat error");
      res.status(502).json({ error: "خطأ من OpenAI", detail: err });
      return;
    }

    const data = await response.json() as any;
    const reply = data.choices?.[0]?.message?.content ?? "";
    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "AI chat error");
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /ai/report ─────────────────────────────────────────────────────────
router.post("/report", requireAuth, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (!apiKey) {
    res.status(503).json({ error: "OpenAI API key غير مضبوط" });
    return;
  }

  try {
    const ctx = await fetchContext(req.companyId!);
    const systemPrompt = buildSystemPrompt(ctx);

    const reportPrompt = `بناءً على البيانات الحالية للشركة، اكتب تقريراً شاملاً يتضمن:

١. **ملخص الوضع العام** — نظرة سريعة على أداء الشركة اليوم وهذا الشهر
٢. **أهم 3 أمور تحتاج تدخلاً فورياً** — مرتبة حسب الأولوية مع توضيح الخطوة المقترحة لكل منها
٣. **توصيات للأسبوع القادم** — 3-5 توصيات عملية بناءً على البيانات

اكتب التقرير بأسلوب احترافي ومختصر. استخدم الأرقام الحقيقية من البيانات.`;

    const url = baseUrl ? `${baseUrl}/chat/completions` : "https://api.openai.com/v1/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 2048,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: reportPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      req.log.error({ err }, "OpenAI report error");
      res.status(502).json({ error: "خطأ من OpenAI", detail: err });
      return;
    }

    const data = await response.json() as any;
    const report = data.choices?.[0]?.message?.content ?? "";
    res.json({ report, generatedAt: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "AI report error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
