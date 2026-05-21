import { useState, useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  useListFinancialTransactions,
  useCreateFinancialTransaction,
  useDeleteFinancialTransaction,
  useGetFinancialSummary,
  useListSafes,
  useCreateSafe,
  useListSuppliers,
  useListInstallments,
  usePayInstallment,
} from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Download,
  Search,
  Vault,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { downloadCSV } from "@/lib/csv"

const CATEGORIES: Record<string, { label: string; type: "in" | "out" }> = {
  purchase_payment: { label: "دفعة لمورد", type: "out" },
  sale_receipt: { label: "تحصيل من عميل", type: "in" },
  expense: { label: "مصروف", type: "out" },
  income: { label: "إيراد", type: "in" },
  other: { label: "أخرى", type: "in" },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "معلقة", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  partial: { label: "جزئية", color: "bg-blue-100 text-blue-700", icon: Clock },
  paid: { label: "مدفوعة", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  overdue: { label: "متأخرة", color: "bg-red-100 text-red-700", icon: AlertCircle },
}

function formatCurrency(v: number | string) {
  return Number(v).toLocaleString("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ar-EG")
}

interface TxnForm {
  type: "in" | "out"
  category: string
  amount: string
  description: string
  safeId: string
  supplierId: string
  customerId: string
  purchaseOrderId: string
  transactionDate: string
  notes: string
}

const emptyTxnForm: TxnForm = {
  type: "out",
  category: "purchase_payment",
  amount: "",
  description: "",
  safeId: "",
  supplierId: "",
  customerId: "",
  purchaseOrderId: "",
  transactionDate: new Date().toISOString().slice(0, 10),
  notes: "",
}

interface SafeForm { name: string; initialBalance: string; notes: string }
const emptySafeForm: SafeForm = { name: "", initialBalance: "0", notes: "" }

export default function Payments() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Filters
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [filterSafe, setFilterSafe] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Dialogs
  const [txnOpen, setTxnOpen] = useState(false)
  const [safeOpen, setSafeOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [payInstallmentOpen, setPayInstallmentOpen] = useState<number | null>(null)
  const [payInstallmentSafe, setPayInstallmentSafe] = useState("")
  const [payInstallmentAmount, setPayInstallmentAmount] = useState("")

  // Forms
  const [txnForm, setTxnForm] = useState<TxnForm>(emptyTxnForm)
  const [safeForm, setSafeForm] = useState<SafeForm>(emptySafeForm)
  const [saving, setSaving] = useState(false)

  // Data
  const { data: transactions = [] } = useListFinancialTransactions({ type: undefined, category: undefined, safeId: undefined, supplierId: undefined, customerId: undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } as any)
  const { data: summary } = useGetFinancialSummary({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined } as any)
  const { data: safes = [] } = useListSafes()
  const { data: suppliers = [] } = useListSuppliers()
  const { data: installments = [] } = useListInstallments({ status: undefined } as any)

  const createTxn = useCreateFinancialTransaction()
  const deleteTxn = useDeleteFinancialTransaction()
  const createSafe = useCreateSafe()
  const payInstallmentMutation = usePayInstallment()

  const filtered = useMemo(() => (transactions as any[]).filter(t => {
    if (filterType !== "all" && t.type !== filterType) return false
    if (filterCategory !== "all" && t.category !== filterCategory) return false
    if (filterSafe !== "all" && String(t.safeId) !== filterSafe) return false
    if (search) {
      const s = search.toLowerCase()
      if (!t.description?.toLowerCase().includes(s) && !t.supplierName?.toLowerCase().includes(s) && !t.notes?.toLowerCase().includes(s)) return false
    }
    return true
  }), [transactions, filterType, filterCategory, filterSafe, search])

  const handleSaveTxn = async () => {
    if (!txnForm.amount || !txnForm.description || !txnForm.transactionDate) {
      toast({ title: "خطأ", description: "المبلغ والوصف والتاريخ مطلوبة", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await createTxn.mutateAsync({
        data: {
          type: txnForm.type,
          category: txnForm.category as any,
          amount: parseFloat(txnForm.amount),
          description: txnForm.description,
          safeId: (txnForm.safeId && txnForm.safeId !== "none") ? parseInt(txnForm.safeId) : undefined,
          supplierId: (txnForm.supplierId && txnForm.supplierId !== "none") ? parseInt(txnForm.supplierId) : undefined,
          purchaseOrderId: txnForm.purchaseOrderId ? parseInt(txnForm.purchaseOrderId) : undefined,
          transactionDate: txnForm.transactionDate,
          notes: txnForm.notes || undefined,
        } as any,
      })
      toast({ title: "تمت الإضافة", description: "تمت إضافة المعاملة بنجاح" })
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] })
      queryClient.invalidateQueries({ queryKey: ["safes"] })
      setTxnOpen(false)
      setTxnForm(emptyTxnForm)
    } catch {
      toast({ title: "خطأ", description: "فشل حفظ المعاملة", variant: "destructive" })
    } finally { setSaving(false) }
  }

  const handleDeleteTxn = async () => {
    if (!deletingId) return
    try {
      await deleteTxn.mutateAsync({ id: deletingId })
      toast({ title: "تم الحذف" })
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] })
      queryClient.invalidateQueries({ queryKey: ["safes"] })
    } catch {
      toast({ title: "خطأ", description: "فشل الحذف", variant: "destructive" })
    } finally { setDeletingId(null) }
  }

  const handleSaveSafe = async () => {
    if (!safeForm.name) {
      toast({ title: "خطأ", description: "اسم الخزينة مطلوب", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await createSafe.mutateAsync({ data: { name: safeForm.name, initialBalance: parseFloat(safeForm.initialBalance) || 0, notes: safeForm.notes || undefined } as any })
      toast({ title: "تمت الإضافة", description: "تمت إضافة الخزينة بنجاح" })
      queryClient.invalidateQueries({ queryKey: ["safes"] })
      setSafeOpen(false)
      setSafeForm(emptySafeForm)
    } catch {
      toast({ title: "خطأ", description: "فشل إضافة الخزينة", variant: "destructive" })
    } finally { setSaving(false) }
  }

  const handlePayInstallment = async () => {
    if (!payInstallmentOpen) return
    try {
      await payInstallmentMutation.mutateAsync({
        id: payInstallmentOpen,
        data: {
          safeId: payInstallmentSafe ? parseInt(payInstallmentSafe) : undefined,
          amount: payInstallmentAmount ? parseFloat(payInstallmentAmount) : undefined,
        } as any,
      })
      toast({ title: "تم السداد", description: "تم تسجيل الدفعة بنجاح" })
      queryClient.invalidateQueries({ queryKey: ["installments"] })
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] })
      queryClient.invalidateQueries({ queryKey: ["safes"] })
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] })
      setPayInstallmentOpen(null)
    } catch {
      toast({ title: "خطأ", description: "فشل السداد", variant: "destructive" })
    }
  }

  const handleExportCSV = () => {
    downloadCSV(
      filtered.map(t => [
        t.transactionDate,
        t.type === "in" ? "وارد" : "صادر",
        CATEGORIES[t.category]?.label ?? t.category,
        t.description,
        t.amount,
        t.supplierName ?? "",
        t.safeName ?? "",
        t.notes ?? "",
      ]),
      ["التاريخ", "النوع", "الفئة", "الوصف", "المبلغ", "المورد", "الخزينة", "ملاحظات"],
      "financial_transactions"
    )
  }

  const handleCategoryChange = (cat: string) => {
    const info = CATEGORIES[cat]
    setTxnForm(f => ({ ...f, category: cat, type: info?.type ?? f.type }))
  }

  const pendingInstallments = (installments as any[]).filter(i => i.status !== "paid")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المدفوعات والمصاريف</h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة المعاملات المالية والخزينة</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setSafeOpen(true)}>
            <Vault className="w-4 h-4" /> خزينة جديدة
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setTxnForm(emptyTxnForm); setTxnOpen(true) }}>
            <Plus className="w-4 h-4" /> معاملة جديدة
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-emerald-700 font-medium">إجمالي الوارد</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(summary?.totalIn ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-100"><TrendingDown className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-red-700 font-medium">إجمالي الصادر</p>
              <p className="text-lg font-bold text-red-700">{formatCurrency(summary?.totalOut ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100"><Wallet className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-blue-700 font-medium">صافي الحركة</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(summary?.net ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-muted"><Vault className="w-5 h-5 text-muted-foreground" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">عدد الخزائن</p>
              <p className="text-lg font-bold">{(safes as any[]).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Safes Row */}
      {(safes as any[]).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(safes as any[]).map((s: any) => (
            <Card key={s.id} className="border-dashed">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Vault className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">{s.name}</span>
                </div>
                <p className="text-lg font-bold text-primary">{formatCurrency(s.currentBalance)}</p>
                <p className="text-xs text-muted-foreground">رصيد افتتاحي: {formatCurrency(s.initialBalance)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="transactions">
        <TabsList className="mb-4">
          <TabsTrigger value="transactions" className="gap-2">
            <Wallet className="w-4 h-4" /> المعاملات المالية
          </TabsTrigger>
          <TabsTrigger value="installments" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            الأقساط
            {pendingInstallments.length > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs rounded-full px-1.5 py-0.5 mr-1">
                {pendingInstallments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pr-9" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32"><SelectValue placeholder="النوع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="in">وارد</SelectItem>
                <SelectItem value="out">صادر</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40"><SelectValue placeholder="الفئة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفئات</SelectItem>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(safes as any[]).length > 0 && (
              <Select value={filterSafe} onValueChange={setFilterSafe}>
                <SelectTrigger className="w-36"><SelectValue placeholder="الخزينة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الخزائن</SelectItem>
                  {(safes as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Input type="date" className="w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="من تاريخ" />
            <Input type="date" className="w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="إلى تاريخ" />
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
              <Download className="w-4 h-4" /> تصدير
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>لا توجد معاملات مالية</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-right">
                        <th className="p-3 font-semibold">التاريخ</th>
                        <th className="p-3 font-semibold">النوع</th>
                        <th className="p-3 font-semibold">الفئة</th>
                        <th className="p-3 font-semibold">الوصف</th>
                        <th className="p-3 font-semibold">المورد</th>
                        <th className="p-3 font-semibold">الخزينة</th>
                        <th className="p-3 font-semibold text-left">المبلغ</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t: any) => (
                        <tr key={t.id} className="border-t border-border/50 hover:bg-muted/20">
                          <td className="p-3 text-muted-foreground">{formatDate(t.transactionDate)}</td>
                          <td className="p-3">
                            <Badge className={t.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                              {t.type === "in" ? "وارد" : "صادر"}
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{CATEGORIES[t.category]?.label ?? t.category}</td>
                          <td className="p-3 font-medium">{t.description}</td>
                          <td className="p-3 text-muted-foreground">{t.supplierName ?? "-"}</td>
                          <td className="p-3 text-muted-foreground">{t.safeName ?? "-"}</td>
                          <td className="p-3 text-left font-bold" style={{ color: t.type === "in" ? "#16a34a" : "#dc2626" }}>
                            {t.type === "out" ? "-" : "+"}{formatCurrency(t.amount)}
                          </td>
                          <td className="p-3">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(t.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/20 border-t font-bold">
                      <tr>
                        <td colSpan={6} className="p-3">الإجمالي</td>
                        <td className="p-3 text-left">
                          {formatCurrency(filtered.reduce((s: number, t: any) => s + (t.type === "in" ? 1 : -1) * parseFloat(t.amount), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="installments">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">جدول الأقساط المستحقة</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(installments as any[]).length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>لا توجد أقساط مسجلة</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-right">
                        <th className="p-3 font-semibold">رقم أمر الشراء</th>
                        <th className="p-3 font-semibold">تاريخ الاستحقاق</th>
                        <th className="p-3 font-semibold">المبلغ</th>
                        <th className="p-3 font-semibold">المدفوع</th>
                        <th className="p-3 font-semibold">الحالة</th>
                        <th className="p-3 font-semibold">ملاحظات</th>
                        <th className="p-3 w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(installments as any[]).map((inst: any) => {
                        const cfg = STATUS_CONFIG[inst.status] ?? STATUS_CONFIG.pending
                        const Icon = cfg.icon
                        return (
                          <tr key={inst.id} className="border-t border-border/50 hover:bg-muted/20">
                            <td className="p-3 font-mono">#{inst.purchaseOrderId}</td>
                            <td className="p-3">{formatDate(inst.dueDate)}</td>
                            <td className="p-3 font-bold">{formatCurrency(inst.amount)}</td>
                            <td className="p-3 text-emerald-600">{formatCurrency(inst.paidAmount)}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                                <Icon className="w-3 h-3" /> {cfg.label}
                              </span>
                            </td>
                            <td className="p-3 text-muted-foreground">{inst.notes ?? "-"}</td>
                            <td className="p-3">
                              {inst.status !== "paid" && (
                                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => {
                                  setPayInstallmentOpen(inst.id)
                                  setPayInstallmentAmount(String(parseFloat(inst.amount) - parseFloat(inst.paidAmount)))
                                  setPayInstallmentSafe("")
                                }}>
                                  سداد
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Transaction Dialog */}
      <Dialog open={txnOpen} onOpenChange={setTxnOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" /> إضافة معاملة مالية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">الفئة</label>
              <Select value={txnForm.category} onValueChange={handleCategoryChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">المبلغ <span className="text-destructive">*</span></label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">التاريخ <span className="text-destructive">*</span></label>
                <Input type="date" value={txnForm.transactionDate} onChange={e => setTxnForm(f => ({ ...f, transactionDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">الوصف <span className="text-destructive">*</span></label>
              <Input placeholder="وصف المعاملة..." value={txnForm.description} onChange={e => setTxnForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            {(safes as any[]).length > 0 && (
              <div>
                <label className="text-sm font-semibold mb-1.5 block">الخزينة</label>
                <Select value={txnForm.safeId} onValueChange={v => setTxnForm(f => ({ ...f, safeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر خزينة..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون خزينة</SelectItem>
                    {(safes as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(txnForm.category === "purchase_payment") && (
              <div>
                <label className="text-sm font-semibold mb-1.5 block">المورد</label>
                <Select value={txnForm.supplierId} onValueChange={v => setTxnForm(f => ({ ...f, supplierId: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر مورد..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مورد</SelectItem>
                    {(suppliers as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-semibold mb-1.5 block">ملاحظات</label>
              <Input placeholder="أي ملاحظات..." value={txnForm.notes} onChange={e => setTxnForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTxnOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveTxn} disabled={saving} className="min-w-[100px]">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Safe Dialog */}
      <Dialog open={safeOpen} onOpenChange={setSafeOpen}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Vault className="w-5 h-5 text-primary" /> إضافة خزينة جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">اسم الخزينة <span className="text-destructive">*</span></label>
              <Input placeholder="مثال: الخزينة الرئيسية" value={safeForm.name} onChange={e => setSafeForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">الرصيد الافتتاحي</label>
              <Input type="number" min="0" step="0.01" dir="ltr" value={safeForm.initialBalance} onChange={e => setSafeForm(f => ({ ...f, initialBalance: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">ملاحظات</label>
              <Input placeholder="أي ملاحظات..." value={safeForm.notes} onChange={e => setSafeForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSafeOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveSafe} disabled={saving} className="min-w-[100px]">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Installment Dialog */}
      <Dialog open={!!payInstallmentOpen} onOpenChange={() => setPayInstallmentOpen(null)}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>سداد القسط</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">المبلغ</label>
              <Input type="number" min="0" step="0.01" dir="ltr" value={payInstallmentAmount} onChange={e => setPayInstallmentAmount(e.target.value)} />
            </div>
            {(safes as any[]).length > 0 && (
              <div>
                <label className="text-sm font-semibold mb-1.5 block">الخزينة</label>
                <Select value={payInstallmentSafe} onValueChange={setPayInstallmentSafe}>
                  <SelectTrigger><SelectValue placeholder="اختر خزينة..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون خزينة</SelectItem>
                    {(safes as any[]).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayInstallmentOpen(null)}>إلغاء</Button>
            <Button onClick={handlePayInstallment} className="min-w-[100px]">تأكيد السداد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل تريد حذف هذه المعاملة؟ لا يمكن التراجع.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTxn} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
