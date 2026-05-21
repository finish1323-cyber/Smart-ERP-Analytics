import { useState, useEffect } from "react"
import {
  useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer,
  useGetCustomer, useGetCustomerCalls, useAddCustomerCall, useGetTodayFollowups,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useQuery } from "@tanstack/react-query"
import {
  Plus, Search, Phone, Mail, MapPin, User, Star, Pencil, Trash2,
  ChevronLeft, Building2, PhoneCall, FileText, Package, Calendar,
  CheckCircle2, Clock, XCircle, AlertCircle, TrendingUp, ShoppingBag,
  MessageSquare, CalendarDays, Bell, X, Check, Eye, Receipt, ArrowUpDown
} from "lucide-react"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

type Customer = {
  id: number
  name: string
  businessType?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  classification: "new" | "vip" | "inactive"
  status?: string
  nextFollowupDate?: string | null
  totalPurchases?: number
  lastOrderDate?: string | null
  notes?: string | null
  createdAt?: string
}

type CallLog = {
  id: number
  customerId: number
  userId?: number
  userName?: string | null
  summary: string
  outcome: string
  nextFollowupDate?: string | null
  calledAt?: string
}

const classificationConfig = {
  vip: { label: "VIP", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Star },
  new: { label: "جديد", color: "bg-blue-100 text-blue-700 border-blue-200", icon: User },
  inactive: { label: "متوقف", color: "bg-slate-100 text-slate-600 border-slate-200", icon: XCircle },
}

const outcomeConfig: Record<string, { label: string; color: string; icon: any }> = {
  interested: { label: "مهتم", color: "text-emerald-700", icon: CheckCircle2 },
  not_interested: { label: "غير مهتم", color: "text-red-600", icon: XCircle },
  callback: { label: "يرجى المتابعة", color: "text-amber-600", icon: Clock },
  no_answer: { label: "لا يرد", color: "text-slate-500", icon: Phone },
  purchased: { label: "اشترى", color: "text-primary", icon: ShoppingBag },
}

const emptyCustomerForm = {
  name: "", businessType: "", phone: "", email: "", address: "",
  classification: "new" as "new" | "vip" | "inactive",
  nextFollowupDate: "", notes: "",
}

// ── Statement Tab ─────────────────────────────────────────────────────────────
type StatementEntry = {
  id: number; invoiceNumber: string; status: string
  amount: number; isPaid: boolean; createdAt: string; runningBalance: number
}
type StatementData = {
  customerName: string; totalPurchases: number; totalPaid: number; balance: number
  entries: StatementEntry[]
}

function StatementTab({ customerId }: { customerId: number }) {
  const { data, isLoading, error } = useQuery<StatementData>({
    queryKey: ["customer-statement", customerId],
    queryFn: () =>
      fetch(`/api/customers/${customerId}/statement`, { credentials: "include" })
        .then(r => r.json()),
    enabled: !!customerId,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      جاري التحميل...
    </div>
  )

  if (error || !data) return (
    <div className="py-10 text-center text-muted-foreground">
      <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p>تعذر تحميل كشف الحساب</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">إجمالي المشتريات</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(data.totalPurchases)}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">المدفوع (مؤكد)</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(data.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className={cn("border", data.balance > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50")}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">الرصيد المتبقي</p>
            <p className={cn("text-lg font-bold", data.balance > 0 ? "text-amber-700" : "text-emerald-700")}>
              {formatCurrency(data.balance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            سجل الحركات ({data.entries.length} فاتورة)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.entries.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>لا توجد فواتير لهذا العميل</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-right">
                    <th className="p-3 font-semibold">رقم الفاتورة</th>
                    <th className="p-3 font-semibold">التاريخ</th>
                    <th className="p-3 font-semibold">الحالة</th>
                    <th className="p-3 font-semibold text-left">المبلغ</th>
                    <th className="p-3 font-semibold text-left">الرصيد التراكمي</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map(e => (
                    <tr key={e.id} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs text-primary">#{e.invoiceNumber}</td>
                      <td className="p-3 text-muted-foreground">{formatDate(e.createdAt)}</td>
                      <td className="p-3">
                        <span className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full",
                          e.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}>
                          {e.status === "confirmed" ? "مؤكدة" : "مسودة"}
                        </span>
                      </td>
                      <td className="p-3 text-left font-semibold">{formatCurrency(e.amount)}</td>
                      <td className="p-3 text-left font-bold text-primary">{formatCurrency(e.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/20">
                  <tr>
                    <td colSpan={3} className="p-3 font-bold">الإجمالي</td>
                    <td className="p-3 text-left font-bold">{formatCurrency(data.totalPurchases)}</td>
                    <td className="p-3 text-left font-bold text-primary">{formatCurrency(data.totalPurchases)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function Customers() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const [viewingId, setViewingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showCallForm, setShowCallForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyCustomerForm)
  const [callForm, setCallForm] = useState({ summary: "", outcome: "callback", nextFollowupDate: "" })

  const { data: customers = [], isLoading } = useListCustomers()
  const { data: todayFollowups = [] } = useGetTodayFollowups()
  const { data: viewCustomer } = useGetCustomer(viewingId ?? 0, { query: { enabled: !!viewingId } as any })
  const { data: callLogs = [] } = useGetCustomerCalls(viewingId ?? 0, { query: { enabled: !!viewingId } as any })
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()
  const deleteMutation = useDeleteCustomer()
  const addCallMutation = useAddCustomerCall()

  // Filter
  const filtered = customers.filter((c: Customer) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search) ||
      (c.businessType ?? "").toLowerCase().includes(search.toLowerCase())
    const matchClass = classFilter === "all" || c.classification === classFilter
    return matchSearch && matchClass
  })

  const openAdd = () => { setEditingCustomer(null); setForm(emptyCustomerForm); setShowForm(true) }
  const openEdit = (c: Customer) => {
    setEditingCustomer(c)
    setForm({
      name: c.name, businessType: c.businessType ?? "", phone: c.phone ?? "",
      email: (c as any).email ?? "", address: c.address ?? "",
      classification: c.classification, nextFollowupDate: c.nextFollowupDate ?? "",
      notes: (c as any).notes ?? "",
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "خطأ", description: "اسم العميل مطلوب", variant: "destructive" }); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name, businessType: form.businessType || undefined, phone: form.phone || undefined,
        address: form.address || undefined, classification: form.classification,
        nextFollowupDate: form.nextFollowupDate || undefined,
      }
      if (editingCustomer) {
        await updateMutation.mutateAsync({ id: editingCustomer.id, data: payload as any })
        toast({ title: "تم التحديث", description: "تم تحديث بيانات العميل" })
      } else {
        await createMutation.mutateAsync({ data: payload as any })
        toast({ title: "تمت الإضافة", description: "تم إضافة العميل بنجاح" })
      }
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] })
      setShowForm(false)
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" })
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteMutation.mutateAsync({ id: deletingId })
      toast({ title: "تم الحذف" })
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] })
      if (viewingId === deletingId) setViewingId(null)
    } catch { toast({ title: "خطأ", description: "لا يمكن الحذف", variant: "destructive" }) }
    finally { setDeletingId(null) }
  }

  const handleAddCall = async () => {
    if (!callForm.summary.trim()) { toast({ title: "خطأ", description: "ملخص المكالمة مطلوب", variant: "destructive" }); return }
    if (!viewingId) return
    setSaving(true)
    try {
      await addCallMutation.mutateAsync({
        id: viewingId,
        data: { summary: callForm.summary, outcome: callForm.outcome, nextFollowupDate: callForm.nextFollowupDate || undefined } as any,
      })
      toast({ title: "تم التسجيل", description: "تم تسجيل المكالمة بنجاح" })
      queryClient.invalidateQueries({ queryKey: ["/api/customers", viewingId, "calls"] })
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] })
      setShowCallForm(false)
      setCallForm({ summary: "", outcome: "callback", nextFollowupDate: "" })
    } catch { toast({ title: "خطأ", description: "حدث خطأ", variant: "destructive" }) }
    finally { setSaving(false) }
  }

  // Stats
  const vipCount = customers.filter((c: Customer) => c.classification === "vip").length
  const newCount = customers.filter((c: Customer) => c.classification === "new").length
  const totalRevenue = customers.reduce((s: number, c: Customer) => s + (c.totalPurchases ?? 0), 0)

  // ─── Profile View ───────────────────────────────────────────
  if (viewingId && viewCustomer) {
    const cls = classificationConfig[viewCustomer.classification] ?? classificationConfig.new
    const ClsIcon = cls.icon
    const calls = callLogs as CallLog[]

    return (
      <div className="space-y-5">
        {/* Back */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setViewingId(null)} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> العودة للعملاء
          </Button>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm text-muted-foreground">ملف العميل</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Profile Card */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                  {viewCustomer.name.charAt(0)}
                </div>
                <h2 className="text-xl font-bold">{viewCustomer.name}</h2>
                {viewCustomer.businessType && (
                  <p className="text-muted-foreground text-sm mt-1 flex items-center justify-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />{viewCustomer.businessType}
                  </p>
                )}
                <div className="mt-3">
                  <Badge className={`${cls.color} border`}>
                    <ClsIcon className="w-3 h-3 ml-1" />{cls.label}
                  </Badge>
                </div>
                {viewCustomer.nextFollowupDate && (
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                    <Bell className="w-3.5 h-3.5" />
                    متابعة: {viewCustomer.nextFollowupDate}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm text-muted-foreground">بيانات التواصل</CardTitle></CardHeader>
              <CardContent className="space-y-2.5">
                {viewCustomer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span dir="ltr">{viewCustomer.phone}</span>
                  </div>
                )}
                {(viewCustomer as any).email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{(viewCustomer as any).email}</span>
                  </div>
                )}
                {viewCustomer.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{viewCustomer.address}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xl font-bold text-primary">{formatCurrency(viewCustomer.totalPurchases ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">إجمالي المشتريات</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-xl font-bold">{calls.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">مكالمة مسجّلة</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" size="sm" onClick={() => openEdit(viewCustomer as Customer)}>
                <Pencil className="w-3.5 h-3.5" />تعديل
              </Button>
              <Button variant="outline" className="flex-1 gap-1.5 text-destructive" size="sm" onClick={() => setDeletingId(viewCustomer.id)}>
                <Trash2 className="w-3.5 h-3.5" />حذف
              </Button>
            </div>
          </div>

          {/* Right: Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="calls">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="calls" className="flex-1 gap-1.5">
                  <PhoneCall className="w-4 h-4" />سجل المكالمات ({calls.length})
                </TabsTrigger>
                <TabsTrigger value="invoices" className="flex-1 gap-1.5">
                  <FileText className="w-4 h-4" />الفواتير
                </TabsTrigger>
                <TabsTrigger value="products" className="flex-1 gap-1.5">
                  <Package className="w-4 h-4" />أكثر المشتريات
                </TabsTrigger>
                <TabsTrigger value="statement" className="flex-1 gap-1.5">
                  <Receipt className="w-4 h-4" />كشف الحساب
                </TabsTrigger>
              </TabsList>

              {/* Calls Tab */}
              <TabsContent value="calls">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base">سجل مكالمات التيليسيلز</CardTitle>
                    <Button size="sm" className="gap-1.5" onClick={() => setShowCallForm(true)}>
                      <PhoneCall className="w-4 h-4" />تسجيل مكالمة
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {calls.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <PhoneCall className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-medium">لا توجد مكالمات مسجّلة</p>
                        <p className="text-sm mt-1">سجّل أول مكالمة مع هذا العميل</p>
                        <Button size="sm" className="mt-3 gap-1.5" onClick={() => setShowCallForm(true)}>
                          <PhoneCall className="w-4 h-4" />تسجيل مكالمة
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {calls.map((call) => {
                          const oc = outcomeConfig[call.outcome] ?? outcomeConfig.callback
                          const OcIcon = oc.icon
                          return (
                            <div key={call.id} className="p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${oc.color}`}>
                                    <OcIcon className="w-3.5 h-3.5" />{oc.label}
                                  </div>
                                  {call.userName && (
                                    <span className="text-xs text-muted-foreground">• {call.userName}</span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {call.calledAt ? formatDate(call.calledAt) : "—"}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed">{call.summary}</p>
                              {call.nextFollowupDate && (
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600">
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  موعد المتابعة: <strong>{call.nextFollowupDate}</strong>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Invoices Tab */}
              <TabsContent value="invoices">
                <Card>
                  <CardHeader><CardTitle className="text-base">آخر الفواتير</CardTitle></CardHeader>
                  <CardContent>
                    {!(viewCustomer as any).recentInvoices?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>لا توجد فواتير لهذا العميل</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(viewCustomer as any).recentInvoices.map((inv: any) => (
                          <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
                            <div>
                              <p className="font-semibold text-sm">#{inv.invoiceNumber}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</p>
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-sm text-primary">{formatCurrency(inv.netAmount)}</p>
                              <Badge className={cn("text-xs border-none", inv.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                {inv.status === "confirmed" ? "مؤكدة" : "مسودة"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Top Products Tab */}
              <TabsContent value="products">
                <Card>
                  <CardHeader><CardTitle className="text-base">الأكثر شراءً</CardTitle></CardHeader>
                  <CardContent>
                    {!(viewCustomer as any).topProducts?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p>لا توجد بيانات مشتريات</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(viewCustomer as any).topProducts.map((p: any, idx: number) => (
                          <div key={p.productId} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{p.productName}</p>
                              <p className="text-xs text-muted-foreground">{p.totalQuantity} وحدة • {p.orderCount} طلب</p>
                            </div>
                            <p className="font-bold text-sm text-primary shrink-0">{formatCurrency(p.totalRevenue)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Statement Tab */}
              <TabsContent value="statement">
                <StatementTab customerId={viewingId!} />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Call Log Form Dialog */}
        <Dialog open={showCallForm} onOpenChange={setShowCallForm}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-primary" />تسجيل مكالمة جديدة
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">نتيجة المكالمة</label>
                <Select value={callForm.outcome} onValueChange={v => setCallForm({ ...callForm, outcome: v })}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(outcomeConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        <span className={`flex items-center gap-2 ${v.color}`}>
                          <v.icon className="w-4 h-4" />{v.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">ملخص المكالمة <span className="text-destructive">*</span></label>
                <Textarea
                  placeholder="اكتب ملخصاً لما دار في المكالمة..."
                  value={callForm.summary}
                  onChange={e => setCallForm({ ...callForm, summary: e.target.value })}
                  rows={3}
                  className="bg-white resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-amber-600" />موعد المتابعة التالي
                </label>
                <Input
                  type="date"
                  value={callForm.nextFollowupDate}
                  onChange={e => setCallForm({ ...callForm, nextFollowupDate: e.target.value })}
                  className="bg-white"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowCallForm(false)}>إلغاء</Button>
              <Button onClick={handleAddCall} disabled={saving} className="gap-2 min-w-[120px]">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري الحفظ...</>
                  : <><Check className="w-4 h-4" />حفظ المكالمة</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ─── Main List View ──────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">العملاء والتيليسيلز</h1>
          <p className="text-muted-foreground mt-1">إدارة العملاء وتتبع المكالمات والمتابعات</p>
        </div>
        <Button className="gap-2 shadow-sm" onClick={openAdd}>
          <Plus className="w-5 h-5" />عميل جديد
        </Button>
      </div>

      {/* Today's Followups Alert */}
      {(todayFollowups as Customer[]).length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-800">متابعات اليوم ({(todayFollowups as Customer[]).length})</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {(todayFollowups as Customer[]).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setViewingId(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 text-sm font-medium hover:bg-amber-200 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />{c.name}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setClassFilter("all")}>
          <p className="text-2xl font-bold">{customers.length}</p>
          <p className="text-xs text-muted-foreground mt-1">إجمالي العملاء</p>
        </Card>
        <Card className="p-4 bg-amber-50 border-amber-200/60 cursor-pointer" onClick={() => setClassFilter("vip")}>
          <p className="text-2xl font-bold text-amber-600">{vipCount}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Star className="w-3 h-3 text-amber-500" />VIP</p>
        </Card>
        <Card className="p-4 bg-blue-50 border-blue-200/60 cursor-pointer" onClick={() => setClassFilter("new")}>
          <p className="text-2xl font-bold text-blue-600">{newCount}</p>
          <p className="text-xs text-muted-foreground mt-1">عملاء جدد</p>
        </Card>
        <Card className="p-4 bg-primary/5 border-primary/20">
          <p className="text-lg font-bold text-primary">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">إجمالي المبيعات</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الهاتف أو نوع النشاط..."
            className="pr-10 bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-white">
            <SelectValue placeholder="كل التصنيفات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التصنيفات</SelectItem>
            <SelectItem value="vip">⭐ VIP</SelectItem>
            <SelectItem value="new">جديد</SelectItem>
            <SelectItem value="inactive">متوقف</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customers Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="flex gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">لا يوجد عملاء</p>
          <p className="text-sm text-muted-foreground mt-1">قم بإضافة أول عميل الآن</p>
          <Button className="mt-4 gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" />إضافة عميل
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((customer: Customer) => {
            const cls = classificationConfig[customer.classification] ?? classificationConfig.new
            const ClsIcon = cls.icon
            const hasFollowup = customer.nextFollowupDate === new Date().toISOString().split("T")[0]
            return (
              <Card
                key={customer.id}
                className="p-5 hover:shadow-md transition-all duration-200 border-border/60 group cursor-pointer"
                onClick={() => setViewingId(customer.id)}
              >
                {/* Top Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0 group-hover:scale-105 transition-transform">
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold leading-tight group-hover:text-primary transition-colors">{customer.name}</h3>
                      {customer.businessType && (
                        <p className="text-xs text-muted-foreground mt-0.5">{customer.businessType}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={`${cls.color} border text-xs shrink-0`}>
                    <ClsIcon className="w-3 h-3 ml-1" />{cls.label}
                  </Badge>
                </div>

                {/* Contact */}
                <div className="space-y-1.5 mb-4">
                  {customer.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0" /><span dir="ltr">{customer.phone}</span>
                    </p>
                  )}
                  {customer.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{customer.address}</span>
                    </p>
                  )}
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="text-xs">
                    {(customer.totalPurchases ?? 0) > 0 ? (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />{formatCurrency(customer.totalPurchases ?? 0)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">لا توجد مبيعات</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasFollowup && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">
                        <Bell className="w-3 h-3" />اليوم
                      </span>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(customer)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(customer.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Customer Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <User className="w-5 h-5 text-primary" />
              {editingCustomer ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">اسم العميل <span className="text-destructive">*</span></label>
              <Input placeholder="مثال: شركة الأمل للمقاولات" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">نوع النشاط</label>
                <Input placeholder="تجارة، مقاولات، أفراد..." value={form.businessType} onChange={e => setForm({ ...form, businessType: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">التصنيف</label>
                <Select value={form.classification} onValueChange={v => setForm({ ...form, classification: v as any })}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">جديد</SelectItem>
                    <SelectItem value="vip">⭐ VIP</SelectItem>
                    <SelectItem value="inactive">متوقف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">رقم الهاتف</label>
                <Input placeholder="01xxxxxxxxx" dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">البريد الإلكتروني</label>
                <Input type="email" placeholder="example@mail.com" dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">العنوان</label>
              <Input placeholder="المدينة، المنطقة..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-amber-600" />موعد المتابعة القادمة
              </label>
              <Input type="date" value={form.nextFollowupDate} onChange={e => setForm({ ...form, nextFollowupDate: e.target.value })} className="bg-white" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[120px]">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />جاري الحفظ...</>
                : editingCustomer ? "حفظ التعديلات" : "إضافة العميل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا العميل؟ سيتم حذف جميع بياناته ومكالماته.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
