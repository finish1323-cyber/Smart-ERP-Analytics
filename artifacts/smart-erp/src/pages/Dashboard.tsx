import { useQuery } from "@tanstack/react-query"
import { useGetCurrentUser, useGetSalesChart } from "@workspace/api-client-react"
import { Card, Badge } from "@/components/ui/shared"
import { formatCurrency, formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Link } from "wouter"
import {
  TrendingUp, AlertTriangle, CheckSquare, Clock, Package,
  Phone, ShoppingCart, FileText, ArrowLeft, CheckCircle2,
  Loader2, CalendarClock, Banknote
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

// ─── types ───────────────────────────────────────────────────────────────────
type OverdueTask   = { id: number; title: string; dueDate: string; priority: string; assigneeName?: string }
type LowStock      = { id: number; name: string; code: string; currentQuantity: string; safetyStock: number; unit: string }
type PendingPO     = { id: number; orderNumber: string; supplierName: string; status: string; netAmount: string; createdAt: string; paymentDueDate?: string }
type OverduePay    = { id: number; orderNumber: string; supplierName: string; netAmount: string; paymentDueDate: string }
type DraftInvoice  = { id: number; invoiceNumber: string; customerName: string; netAmount: string; createdAt: string }
type FollowupCust  = { id: number; name: string; phone?: string; nextFollowupDate: string; classification: string }

type PersonalData = {
  role: string
  todaySales?: number
  monthSales?: number
  mySales?: { today: number; month: number }
  overdueTasks: OverdueTask[]
  upcomingTasks: OverdueTask[]
  lowStockProducts?: LowStock[]
  pendingPOs?: PendingPO[]
  overduePOPayments?: OverduePay[]
  overdueSalesInvoices?: DraftInvoice[]
  customersForFollowup?: FollowupCust[]
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const roleLabel: Record<string, string> = {
  admin: "مدير عام",
  sales: "مبيعات",
  procurement: "مشتريات",
  inventory: "مخازن",
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "صباح الخير"
  if (h < 17) return "مساء الخير"
  return "مساء النور"
}

function priorityBadge(p: string) {
  if (p === "urgent") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">عاجل</span>
  if (p === "medium") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">متوسط</span>
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">منخفض</span>
}

function classifBadge(c: string) {
  if (c === "vip") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">VIP</span>
  if (c === "inactive") return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">خامل</span>
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">جديد</span>
}

function poStatusLabel(s: string) {
  if (s === "partial") return "استلام جزئي"
  return "معلق"
}

function daysOverdue(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff <= 0) return "اليوم"
  if (diff === 1) return "بالأمس"
  return `منذ ${diff} أيام`
}

function daysUntil(dateStr: string) {
  const diff = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000) + 1
  if (diff <= 0) return "اليوم"
  if (diff === 1) return "غداً"
  return `خلال ${diff} أيام`
}

// ─── sub-components ──────────────────────────────────────────────────────────
function SectionHeader({ color, icon: Icon, title, count }: {
  color: "red" | "amber" | "green"; icon: React.ComponentType<{ className?: string }>; title: string; count?: number
}) {
  const cls = {
    red:   { dot: "bg-destructive", text: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
    amber: { dot: "bg-amber-500",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
    green: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  }[color]

  return (
    <div className={cn("flex items-center gap-2.5 px-4 py-2.5 rounded-xl border font-bold text-sm", cls.bg, cls.text)}>
      <span className={cn("w-2 h-2 rounded-full shrink-0", cls.dot)} />
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{title}</span>
      {count !== undefined && count > 0 && (
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", color === "red" ? "bg-destructive text-white" : color === "amber" ? "bg-amber-500 text-white" : "bg-emerald-500 text-white")}>
          {count}
        </span>
      )}
    </div>
  )
}

function ItemRow({ icon: Icon, iconCls, title, sub, right, linkTo }: {
  icon: React.ComponentType<{ className?: string }>; iconCls: string; title: React.ReactNode; sub?: string; right?: React.ReactNode; linkTo?: string
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group cursor-default">
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconCls)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate text-foreground">{title}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
      {right && <div className="shrink-0 text-left">{right}</div>}
      {linkTo && <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 group-hover:text-primary transition-colors" />}
    </div>
  )
  if (linkTo) return <Link href={linkTo}>{inner}</Link>
  return inner
}

function SalesCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <Card className="p-5 relative overflow-hidden group hover:shadow-md transition-all">
      <div className={cn("absolute -right-3 -top-3 w-20 h-20 rounded-full opacity-10 group-hover:scale-150 transition-transform duration-500", color)} />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-0.5">{title}</p>
          <p className="text-2xl font-extrabold tracking-tight">{formatCurrency(value)}</p>
        </div>
        <div className={cn("p-2.5 rounded-xl", color, "bg-opacity-15")}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  )
}

// ─── main component ──────────────────────────────────────────────────────────
export function Dashboard() {
  const { data: currentUser } = useGetCurrentUser()
  const { data: chartData } = useGetSalesChart()
  const role = currentUser?.role ?? ""
  const isAdmin = role === "admin"
  const firstName = currentUser?.name?.split(" ")[0] ?? "..."

  const { data: personal, isLoading } = useQuery<PersonalData>({
    queryKey: ["dashboard-personal"],
    queryFn: () => fetch("/api/dashboard/personal", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60_000,
    enabled: !!currentUser,
  })

  // ── derived counts ──────────────────────────────────────────────────────────
  const urgentCount =
    (personal?.overdueTasks?.length ?? 0) +
    (personal?.lowStockProducts?.length ?? 0) +
    (personal?.overduePOPayments?.length ?? 0) +
    (personal?.overdueSalesInvoices?.length ?? 0)

  const watchCount =
    (personal?.upcomingTasks?.length ?? 0) +
    (personal?.customersForFollowup?.length ?? 0) +
    (personal?.pendingPOs?.length ?? 0)

  // ── green summary items: things that are fine ───────────────────────────────
  const greenItems: string[] = []
  if (personal) {
    if ((personal.overdueTasks?.length ?? 0) === 0) greenItems.push("لا توجد مهام متأخرة")
    if ((personal.lowStockProducts?.length ?? 0) === 0) greenItems.push("المخزون في الوضع الآمن")
    if (role === "admin" && (personal.overduePOPayments?.length ?? 0) === 0) greenItems.push("لا توجد مدفوعات متأخرة")
    if (role === "admin" && (personal.overdueSalesInvoices?.length ?? 0) === 0) greenItems.push("لا توجد فواتير مفتوحة")
    if (role === "sales" && (personal.customersForFollowup?.length ?? 0) === 0) greenItems.push("لا يوجد عملاء بحاجة متابعة اليوم")
    if ((role === "procurement" || role === "inventory") && (personal.pendingPOs?.length ?? 0) === 0) greenItems.push("لا توجد أوامر شراء معلقة")
  }

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Greeting ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            {getGreeting()}، {firstName} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="font-bold text-xs px-3 py-1">
            {roleLabel[role] ?? role}
          </Badge>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* ── Sales numbers (admin) ── */}
      {isAdmin && personal && (
        <div className="grid grid-cols-2 gap-4">
          <SalesCard title="مبيعات اليوم" value={personal.todaySales ?? 0} icon={TrendingUp} color="bg-emerald-500 text-emerald-600" />
          <SalesCard title="مبيعات الشهر" value={personal.monthSales ?? 0} icon={TrendingUp} color="bg-primary text-primary" />
        </div>
      )}

      {/* ── My sales (sales role) ── */}
      {role === "sales" && personal?.mySales && (
        <div className="grid grid-cols-2 gap-4">
          <SalesCard title="مبيعاتي اليوم" value={personal.mySales.today} icon={TrendingUp} color="bg-emerald-500 text-emerald-600" />
          <SalesCard title="مبيعاتي هذا الشهر" value={personal.mySales.month} icon={TrendingUp} color="bg-primary text-primary" />
        </div>
      )}

      {/* ══ 🔴 URGENT ════════════════════════════════════════════════════════ */}
      <Card className="overflow-hidden p-0 border-destructive/20">
        <SectionHeader color="red" icon={AlertTriangle} title="محتاج تتصرف الآن" count={urgentCount} />

        {urgentCount === 0 && !isLoading && (
          <div className="px-4 py-6 flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <p className="text-sm font-semibold">كل شيء تمام! لا توجد بنود عاجلة.</p>
          </div>
        )}

        {/* Overdue tasks */}
        {(personal?.overdueTasks?.length ?? 0) > 0 && (
          <div className="border-t border-border/50">
            <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">مهام متأخرة</p>
            {personal!.overdueTasks.map(t => (
              <ItemRow
                key={t.id}
                icon={CheckSquare}
                iconCls="bg-destructive/10 text-destructive"
                title={<span className="flex items-center gap-2">{t.title} {priorityBadge(t.priority)}</span>}
                sub={t.assigneeName ? `${t.assigneeName} · ${daysOverdue(t.dueDate)}` : daysOverdue(t.dueDate)}
                linkTo="/tasks"
              />
            ))}
          </div>
        )}

        {/* Low stock */}
        {(personal?.lowStockProducts?.length ?? 0) > 0 && (
          <div className="border-t border-border/50">
            <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">مخزون تحت حد الأمان</p>
            {personal!.lowStockProducts!.slice(0, 6).map(p => (
              <ItemRow
                key={p.id}
                icon={Package}
                iconCls="bg-orange-100 text-orange-600"
                title={p.name}
                sub={`${p.code} · المتاح: ${parseFloat(p.currentQuantity).toFixed(1)} ${p.unit} / الحد: ${p.safetyStock}`}
                right={<span className="text-xs text-destructive font-bold">{parseFloat(p.currentQuantity).toFixed(1)} {p.unit}</span>}
                linkTo="/inventory"
              />
            ))}
            {personal!.lowStockProducts!.length > 6 && (
              <p className="px-4 py-2 text-xs text-muted-foreground text-center">
                +{personal!.lowStockProducts!.length - 6} منتج آخر
              </p>
            )}
          </div>
        )}

        {/* Overdue PO payments (admin) */}
        {(personal?.overduePOPayments?.length ?? 0) > 0 && (
          <div className="border-t border-border/50">
            <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">مدفوعات أوامر شراء متأخرة</p>
            {personal!.overduePOPayments!.map(p => (
              <ItemRow
                key={p.id}
                icon={Banknote}
                iconCls="bg-red-100 text-red-600"
                title={`${p.orderNumber} — ${p.supplierName ?? "؟"}`}
                sub={`استحقاق: ${p.paymentDueDate} · ${daysOverdue(p.paymentDueDate)}`}
                right={<span className="text-xs font-bold text-destructive">{formatCurrency(parseFloat(p.netAmount))}</span>}
                linkTo="/purchases"
              />
            ))}
          </div>
        )}

        {/* Draft/overdue sales invoices (admin) */}
        {(personal?.overdueSalesInvoices?.length ?? 0) > 0 && (
          <div className="border-t border-border/50">
            <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">فواتير مسودة لم تُؤكد</p>
            {personal!.overdueSalesInvoices!.map(inv => (
              <ItemRow
                key={inv.id}
                icon={FileText}
                iconCls="bg-rose-100 text-rose-600"
                title={`${inv.invoiceNumber} — ${inv.customerName ?? "؟"}`}
                sub={`تاريخ الإنشاء: ${formatDate(inv.createdAt)}`}
                right={<span className="text-xs font-bold text-muted-foreground">{formatCurrency(parseFloat(inv.netAmount))}</span>}
                linkTo="/sales"
              />
            ))}
          </div>
        )}
      </Card>

      {/* ══ 🟡 WATCH ════════════════════════════════════════════════════════ */}
      <Card className="overflow-hidden p-0 border-amber-200">
        <SectionHeader color="amber" icon={Clock} title="يحتاج متابعة" count={watchCount} />

        {watchCount === 0 && !isLoading && (
          <div className="px-4 py-6 flex items-center gap-3 text-slate-500">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <p className="text-sm font-semibold">لا يوجد شيء يحتاج متابعة الآن.</p>
          </div>
        )}

        {/* Upcoming tasks */}
        {(personal?.upcomingTasks?.length ?? 0) > 0 && (
          <div className="border-t border-border/50">
            <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">مهام قريبة الموعد (خلال 3 أيام)</p>
            {personal!.upcomingTasks.map(t => (
              <ItemRow
                key={t.id}
                icon={CalendarClock}
                iconCls="bg-amber-100 text-amber-600"
                title={<span className="flex items-center gap-2">{t.title} {priorityBadge(t.priority)}</span>}
                sub={t.assigneeName ? `${t.assigneeName} · ${daysUntil(t.dueDate)}` : daysUntil(t.dueDate)}
                linkTo="/tasks"
              />
            ))}
          </div>
        )}

        {/* Customers for followup (sales) */}
        {(personal?.customersForFollowup?.length ?? 0) > 0 && (
          <div className="border-t border-border/50">
            <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">عملاء محتاجين متابعة اليوم</p>
            {personal!.customersForFollowup!.map(c => (
              <ItemRow
                key={c.id}
                icon={Phone}
                iconCls="bg-sky-100 text-sky-600"
                title={<span className="flex items-center gap-2">{c.name} {classifBadge(c.classification)}</span>}
                sub={c.phone ?? `موعد المتابعة: ${c.nextFollowupDate}`}
                right={<span className="text-xs text-muted-foreground">{daysOverdue(c.nextFollowupDate)}</span>}
                linkTo="/crm"
              />
            ))}
          </div>
        )}

        {/* Pending POs (procurement + inventory) */}
        {(personal?.pendingPOs?.length ?? 0) > 0 && (
          <div className="border-t border-border/50">
            <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {role === "inventory" ? "أوامر شراء بانتظار الاستلام" : "أوامر الشراء المعلقة"}
            </p>
            {personal!.pendingPOs!.slice(0, 8).map(po => (
              <ItemRow
                key={po.id}
                icon={ShoppingCart}
                iconCls="bg-amber-100 text-amber-600"
                title={`${po.orderNumber} — ${po.supplierName ?? "؟"}`}
                sub={`${poStatusLabel(po.status)} · ${formatDate(po.createdAt)}`}
                right={<span className="text-xs font-bold text-muted-foreground">{formatCurrency(parseFloat(po.netAmount))}</span>}
                linkTo="/purchases"
              />
            ))}
            {personal!.pendingPOs!.length > 8 && (
              <p className="px-4 py-2 text-xs text-muted-foreground text-center">
                +{personal!.pendingPOs!.length - 8} أوامر أخرى
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ══ 🟢 ALL GOOD ═════════════════════════════════════════════════════ */}
      {greenItems.length > 0 && (
        <Card className="overflow-hidden p-0 border-emerald-200">
          <SectionHeader color="green" icon={CheckCircle2} title="الوضع كويس" count={greenItems.length} />
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-x-0 divide-y sm:divide-y-0 sm:divide-x divide-border/50 rtl:divide-x-reverse border-t border-border/50">
            {greenItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-sm font-semibold text-emerald-800">{item}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ══ Sales chart (admin only) ═════════════════════════════════════════ */}
      {isAdmin && (
        <Card className="p-5 border-border/50">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold">المبيعات خلال الأسبوع</h3>
            <Badge variant="secondary" className="text-xs">آخر 7 أيام</Badge>
          </div>
          <div className="h-[240px] w-full">
            {chartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} dx={-4} />
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}
                    itemStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                  />
                  <Area type="monotone" dataKey="amount" name="المبيعات" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#cSales)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin ml-2" /> جاري التحميل...
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
