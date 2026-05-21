import { useState, useMemo } from "react"
import {
  useListSalesInvoices, useCreateSalesInvoice, useGetSalesInvoice,
  useUpdateSalesInvoice, useListCustomers, useListProducts,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus, Search, FileText, Eye, Trash2, Check, X,
  ChevronLeft, User, Calendar, ShoppingBag, DollarSign,
  Receipt, AlertCircle, Package, Hash, TrendingUp, Printer,
} from "lucide-react"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

type Invoice = {
  id: number
  invoiceNumber: string
  customerId: number
  customerName: string
  status: "draft" | "confirmed" | "cancelled"
  totalAmount: number
  taxPercent: number
  discountPercent: number
  netAmount: number
  notes?: string
  createdAt: string
}

type LineItem = {
  productId: number
  quantity: number
  unitPrice: number
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-amber-100 text-amber-700 border-amber-200" },
  confirmed: { label: "مؤكدة", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelled: { label: "ملغاة", color: "bg-slate-100 text-slate-600 border-slate-200" },
}

export function SalesInvoices() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [viewingId, setViewingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [taxPercent, setTaxPercent] = useState(14)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<LineItem[]>([])
  const [paymentType, setPaymentType] = useState<"cash" | "deferred">("deferred")

  const { data: invoices = [], isLoading } = useListSalesInvoices()
  const { data: customers = [] } = useListCustomers()
  const { data: products = [] } = useListProducts()
  const { data: viewInvoice } = useGetSalesInvoice(viewingId ?? 0, { query: { enabled: !!viewingId } as any })
  const createMut = useCreateSalesInvoice()
  const updateMut = useUpdateSalesInvoice()

  const filtered = (invoices as Invoice[]).filter(i => {
    const matchSearch =
      i.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (i.customerName ?? "").toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "all" || i.status === statusFilter
    return matchSearch && matchStatus
  })

  // Stats
  const stats = useMemo(() => {
    const inv = invoices as Invoice[]
    return {
      total: inv.length,
      draft: inv.filter(i => i.status === "draft").length,
      confirmed: inv.filter(i => i.status === "confirmed").length,
      revenue: inv.filter(i => i.status === "confirmed").reduce((s, i) => s + i.netAmount, 0),
    }
  }, [invoices])

  const openAdd = () => {
    setCustomerId(null); setTaxPercent(14); setDiscountPercent(0)
    setNotes(""); setItems([{ productId: 0, quantity: 1, unitPrice: 0 }])
    setPaymentType("deferred")
    setShowForm(true)
  }

  const addItem = () => setItems([...items, { productId: 0, quantity: 1, unitPrice: 0 }])
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))
  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    // Auto-fill unit price from product
    if (patch.productId) {
      const p: any = products.find((x: any) => x.id === patch.productId)
      if (p) next[idx].unitPrice = parseFloat(p.salePrice ?? 0)
    }
    setItems(next)
  }

  // Live calculations
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0)
  const discountAmount = subtotal * (discountPercent / 100)
  const afterDiscount = subtotal - discountAmount
  const taxAmount = afterDiscount * (taxPercent / 100)
  const netTotal = afterDiscount + taxAmount

  const handleSave = async () => {
    if (!customerId) { toast({ title: "خطأ", description: "اختر العميل", variant: "destructive" }); return }
    const valid = items.filter(i => i.productId && i.quantity > 0 && i.unitPrice > 0)
    if (!valid.length) { toast({ title: "خطأ", description: "أضف صنفاً واحداً على الأقل", variant: "destructive" }); return }
    setSaving(true)
    const isCash = paymentType === "cash"
    try {
      await createMut.mutateAsync({
        data: {
          customerId, taxPercent, discountPercent,
          notes: notes || undefined, items: valid,
          paymentType,
          ...(isCash ? { status: "confirmed", paidAmount: netTotal } : {}),
        } as any,
      })
      toast({
        title: "تم الإنشاء",
        description: isCash ? "تم إنشاء الفاتورة وتأكيدها تلقائياً (كاش)" : "تم إنشاء الفاتورة كمسودة",
      })
      qc.invalidateQueries({ queryKey: ["/api/sales"] })
      if (isCash) qc.invalidateQueries({ queryKey: ["/api/products"] })
      setShowForm(false)
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.message ?? "فشل الإنشاء", variant: "destructive" })
    } finally { setSaving(false) }
  }

  const handleConfirm = async (id: number) => {
    setSaving(true)
    try {
      await updateMut.mutateAsync({ id, data: { status: "confirmed" } as any })
      toast({ title: "تم التأكيد", description: "تم خصم الكمية من المخزن" })
      qc.invalidateQueries({ queryKey: ["/api/sales"] })
      qc.invalidateQueries({ queryKey: ["/api/products"] })
      qc.invalidateQueries({ queryKey: ["/api/customers"] })
    } catch (err: any) {
      toast({ title: "خطأ", description: err?.response?.data?.message ?? "فشل التأكيد", variant: "destructive" })
    } finally { setSaving(false) }
  }

  const handleCancel = async (id: number) => {
    setSaving(true)
    try {
      await updateMut.mutateAsync({ id, data: { status: "cancelled" } as any })
      toast({ title: "تم الإلغاء" })
      qc.invalidateQueries({ queryKey: ["/api/sales"] })
    } catch { toast({ title: "خطأ", variant: "destructive" }) }
    finally { setSaving(false) }
  }

  // ─── Detail View ─────────────────────────────────────────
  if (viewingId && viewInvoice) {
    const inv: any = viewInvoice
    const st = statusConfig[inv.status] ?? statusConfig.draft

    return (
      <div className="space-y-5 print:space-y-3">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" size="sm" onClick={() => setViewingId(null)} className="gap-2">
            <ChevronLeft className="w-4 h-4" />العودة للفواتير
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="w-4 h-4" />طباعة
            </Button>
            {inv.status === "draft" && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleCancel(inv.id)} disabled={saving}>
                  <X className="w-4 h-4" />إلغاء الفاتورة
                </Button>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleConfirm(inv.id)} disabled={saving}>
                  <Check className="w-4 h-4" />تأكيد وخصم المخزن
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-8">
            {/* Header */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-border">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Receipt className="w-6 h-6 text-primary" />
                  <h1 className="text-2xl font-bold">فاتورة مبيعات</h1>
                </div>
                <p className="text-sm text-muted-foreground">رقم الفاتورة: <span className="font-mono font-bold text-foreground">#{inv.invoiceNumber}</span></p>
              </div>
              <div className="text-left">
                <Badge className={`${st.color} border text-sm px-3 py-1`}>{st.label}</Badge>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 justify-end">
                  <Calendar className="w-3 h-3" />{formatDate(inv.createdAt)}
                </p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-1">صادرة إلى</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {(inv.customerName ?? "؟").charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-lg">{inv.customerName}</p>
                  <p className="text-xs text-muted-foreground">عميل #{inv.customerId}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="rounded-xl border border-border overflow-hidden mb-6">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-right">
                    <th className="px-4 py-3 font-semibold text-muted-foreground">الصنف</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">الكود</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-center">الكمية</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-left">سعر الوحدة</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(inv.items ?? []).map((item: any) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{item.productName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.productCode}</td>
                      <td className="px-4 py-3 text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-3 text-left">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-left font-bold">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2 text-sm">
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">الإجمالي قبل الخصم</span>
                  <span className="font-semibold">{formatCurrency(inv.totalAmount)}</span>
                </div>
                {inv.discountPercent > 0 && (
                  <div className="flex justify-between py-1.5 text-amber-600">
                    <span>خصم ({inv.discountPercent}%)</span>
                    <span className="font-semibold">- {formatCurrency(inv.totalAmount * inv.discountPercent / 100)}</span>
                  </div>
                )}
                {inv.taxPercent > 0 && (
                  <div className="flex justify-between py-1.5 text-blue-600">
                    <span>ضريبة ({inv.taxPercent}%)</span>
                    <span className="font-semibold">+ {formatCurrency(inv.netAmount - (inv.totalAmount * (1 - inv.discountPercent/100)))}</span>
                  </div>
                )}
                <div className="flex justify-between py-3 border-t-2 border-primary/20 text-lg font-bold text-primary">
                  <span>الصافي المستحق</span>
                  <span>{formatCurrency(inv.netAmount)}</span>
                </div>
              </div>
            </div>

            {inv.notes && (
              <div className="mt-6 p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-sm">{inv.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Main List ───────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">فواتير البيع</h1>
          <p className="text-muted-foreground mt-1">إصدار الفواتير وتأكيدها لخصم المخزن تلقائياً</p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={openAdd}>
          <Plus className="w-5 h-5" />فاتورة جديدة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">إجمالي الفواتير</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200/60 cursor-pointer" onClick={() => setStatusFilter("draft")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{stats.draft}</p>
              <p className="text-xs text-muted-foreground">مسودات</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-emerald-50 border-emerald-200/60 cursor-pointer" onClick={() => setStatusFilter("confirmed")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-700 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{stats.confirmed}</p>
              <p className="text-xs text-muted-foreground">مؤكدة</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-primary">{formatCurrency(stats.revenue)}</p>
              <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="بحث برقم الفاتورة أو اسم العميل..." className="pr-10 bg-white" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-white"><SelectValue placeholder="كل الحالات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="draft">مسودات</SelectItem>
            <SelectItem value="confirmed">مؤكدة</SelectItem>
            <SelectItem value="cancelled">ملغاة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="font-semibold text-muted-foreground">لا توجد فواتير</p>
            <p className="text-sm text-muted-foreground mt-1">قم بإصدار أول فاتورة الآن</p>
            <Button className="mt-4 gap-2" onClick={openAdd}><Plus className="w-4 h-4" />فاتورة جديدة</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr className="text-right">
                  <th className="px-5 py-3.5 font-semibold">رقم الفاتورة</th>
                  <th className="px-5 py-3.5 font-semibold">العميل</th>
                  <th className="px-5 py-3.5 font-semibold">التاريخ</th>
                  <th className="px-5 py-3.5 font-semibold">الإجمالي</th>
                  <th className="px-5 py-3.5 font-semibold">الصافي</th>
                  <th className="px-5 py-3.5 font-semibold">الحالة</th>
                  <th className="px-5 py-3.5 font-semibold text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(inv => {
                  const st = statusConfig[inv.status] ?? statusConfig.draft
                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors group cursor-pointer" onClick={() => setViewingId(inv.id)}>
                      <td className="px-5 py-4 font-mono font-bold text-primary">#{inv.invoiceNumber}</td>
                      <td className="px-5 py-4 font-medium">{inv.customerName}</td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">{formatDate(inv.createdAt)}</td>
                      <td className="px-5 py-4">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-5 py-4 font-bold text-foreground">{formatCurrency(inv.netAmount)}</td>
                      <td className="px-5 py-4"><Badge className={`${st.color} border text-xs`}>{st.label}</Badge></td>
                      <td className="px-5 py-4 text-left" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1 opacity-70 group-hover:opacity-100">
                          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setViewingId(inv.id)}>
                            <Eye className="w-3.5 h-3.5" />عرض
                          </Button>
                          {inv.status === "draft" && (
                            <Button size="sm" variant="ghost" className="h-8 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleConfirm(inv.id)} disabled={saving}>
                              <Check className="w-3.5 h-3.5" />تأكيد
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Receipt className="w-5 h-5 text-primary" />فاتورة بيع جديدة
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer */}
            <div>
              <label className="text-sm font-semibold mb-1.5 block flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />العميل <span className="text-destructive">*</span>
              </label>
              <Select value={customerId?.toString() ?? ""} onValueChange={v => setCustomerId(parseInt(v))}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="اختر العميل..." /></SelectTrigger>
                <SelectContent>
                  {(customers as any[]).map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name} {c.classification === "vip" && "⭐"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />الأصناف
                </label>
                <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1 h-7">
                  <Plus className="w-3.5 h-3.5" />صنف
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const product: any = products.find((p: any) => p.id === item.productId)
                  const lineTotal = item.quantity * item.unitPrice
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-muted/30 p-3 rounded-xl border border-border/50">
                      <div className="col-span-5">
                        <label className="text-xs text-muted-foreground mb-1 block">المنتج</label>
                        <Select value={item.productId?.toString() ?? ""} onValueChange={v => updateItem(idx, { productId: parseInt(v) })}>
                          <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="اختر..." /></SelectTrigger>
                          <SelectContent>
                            {(products as any[]).map(p => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.name} ({p.currentQuantity})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground mb-1 block">الكمية</label>
                        <Input type="number" min="0" step="0.01" className="h-9 text-xs bg-white" value={item.quantity} onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground mb-1 block">السعر</label>
                        <Input type="number" min="0" step="0.01" className="h-9 text-xs bg-white" value={item.unitPrice} onChange={e => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground mb-1 block">الإجمالي</label>
                        <div className="h-9 px-2 flex items-center justify-center bg-primary/5 rounded-md text-xs font-bold text-primary">
                          {lineTotal.toFixed(2)}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {product && item.quantity > parseFloat(product.currentQuantity ?? 0) && (
                        <div className="col-span-12 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          الكمية المطلوبة أكبر من المتاح في المخزن ({product.currentQuantity})
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Discount + Tax */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">نسبة الخصم %</label>
                <Input type="number" min="0" max="100" step="0.5" className="bg-white" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">نسبة الضريبة %</label>
                <Input type="number" min="0" max="100" step="0.5" className="bg-white" value={taxPercent} onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            {/* Live Totals */}
            <div className="bg-gradient-to-l from-primary/5 to-blue-50 border border-primary/20 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">إجمالي قبل الخصم</span><span className="font-semibold">{formatCurrency(subtotal)}</span></div>
              {discountPercent > 0 && <div className="flex justify-between text-amber-600"><span>الخصم ({discountPercent}%)</span><span>- {formatCurrency(discountAmount)}</span></div>}
              {taxPercent > 0 && <div className="flex justify-between text-blue-600"><span>الضريبة ({taxPercent}%)</span><span>+ {formatCurrency(taxAmount)}</span></div>}
              <div className="flex justify-between pt-2 border-t border-primary/20 font-bold text-primary text-base"><span>الصافي</span><span>{formatCurrency(netTotal)}</span></div>
            </div>

            {/* Payment Type */}
            <div>
              <label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />نوع الدفع
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentType("cash")}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all",
                    paymentType === "cash"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-border bg-white text-muted-foreground hover:border-emerald-300"
                  )}
                >
                  <Check className={cn("w-4 h-4", paymentType === "cash" ? "opacity-100" : "opacity-0")} />
                  كاش — يُؤكَّد فوراً
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType("deferred")}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all",
                    paymentType === "deferred"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-border bg-white text-muted-foreground hover:border-amber-300"
                  )}
                >
                  <Check className={cn("w-4 h-4", paymentType === "deferred" ? "opacity-100" : "opacity-0")} />
                  آجل — مسودة
                </button>
              </div>
              {paymentType === "cash" && (
                <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  ستُحفظ الفاتورة مؤكدة تلقائياً ويُخصم المخزون فوراً
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-semibold mb-1.5 block">ملاحظات (اختياري)</label>
              <Textarea rows={2} className="bg-white resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="مثال: استلام بمعرفة المهندس..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn("gap-2 min-w-[160px]", paymentType === "cash" ? "bg-emerald-600 hover:bg-emerald-700" : "")}
            >
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري الحفظ...</>
                : paymentType === "cash"
                  ? <><Check className="w-4 h-4" />تأكيد وحفظ (كاش)</>
                  : <><FileText className="w-4 h-4" />حفظ كمسودة (آجل)</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
