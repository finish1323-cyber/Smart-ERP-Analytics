import { useState, useRef, useMemo } from "react"
import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useListPurchaseOrders,
  useListProducts,
  useBulkImportSuppliers,
  useListProductsBySupplier,
  useLinkSupplierProduct,
  useUnlinkSupplierProduct,
  useGetSupplierStatement,
  getListSuppliersQueryKey,
  getGetSupplierStatementQueryKey,
} from "@workspace/api-client-react"
import { downloadCSV, parseCSV } from "@/lib/csv"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Plus, Search, Phone, Mail, MapPin, Percent, User,
  Pencil, Trash2, Eye, Building2, ShoppingCart, Star,
  TrendingDown, Package, ChevronLeft, FileText,
  Upload, Download, FileDown, X, Link2, History
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

type Supplier = {
  id: number
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
  discountPercent?: number | string
  notes?: string
}

type SupplierFormData = {
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  notes: string
}

const emptyForm: SupplierFormData = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
}

const CSV_HEADERS = ["اسم المورد", "الشخص المسؤول", "الهاتف", "البريد", "العنوان", "ملاحظات"]
const CSV_KEYS = ["name", "contactPerson", "phone", "email", "address", "notes"] as const

export function Suppliers() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierFormData>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: suppliers = [], isLoading } = useListSuppliers()
  const { data: purchaseOrders = [] } = useListPurchaseOrders()
  const { data: products = [] } = useListProducts()
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const deleteMutation = useDeleteSupplier()
  const bulkImportMutation = useBulkImportSuppliers()
  const linkMutation = useLinkSupplierProduct()
  const unlinkMutation = useUnlinkSupplierProduct()

  const { data: supplierProducts = [], isLoading: loadingSupProducts } = useListProductsBySupplier(
    viewingSupplier?.id ?? 0,
    { query: { enabled: !!viewingSupplier } }
  )
  const { data: statement } = useGetSupplierStatement(
    viewingSupplier?.id ?? 0,
    { query: { enabled: !!viewingSupplier } }
  ) as any

  // Add product to supplier dialog state
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [addProductId, setAddProductId] = useState("")
  const [addProductPrice, setAddProductPrice] = useState("")

  const filtered = suppliers.filter((s: Supplier) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditingSupplier(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s)
    setForm({
      name: s.name,
      contactPerson: s.contactPerson ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingSupplier(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "خطأ", description: "اسم المورد مطلوب", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
      }
      if (editingSupplier) {
        const updated = await updateMutation.mutateAsync({ id: editingSupplier.id, data: payload as any })
        toast({ title: "تم التحديث", description: "تم تحديث بيانات المورد بنجاح" })
        // تحديث بيانات المورد المفتوح في لوحة التفاصيل بدون إغلاقها
        if (viewingSupplier?.id === editingSupplier.id) setViewingSupplier(updated as any)
        // تحديث كشف الحساب المرتبط بهذا المورد
        queryClient.invalidateQueries({ queryKey: getGetSupplierStatementQueryKey(editingSupplier.id) })
      } else {
        await createMutation.mutateAsync({ data: payload as any })
        toast({ title: "تمت الإضافة", description: "تم إضافة المورد بنجاح" })
      }
      // تحديث قائمة الموردين بالمفتاح الصحيح من Orval
      queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() })
      closeForm()
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteMutation.mutateAsync({ id: deletingId })
      toast({ title: "تم الحذف", description: "تم حذف المورد بنجاح" })
      queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() })
      if (viewingSupplier?.id === deletingId) setViewingSupplier(null)
    } catch {
      toast({ title: "خطأ", description: "لا يمكن حذف المورد", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const getSupplierStats = (supplierId: number) => {
    const pos = purchaseOrders.filter((p: any) => p.supplierId === supplierId)
    const total = pos.reduce((sum: number, p: any) => sum + (parseFloat(p.netAmount) || 0), 0)
    return { ordersCount: pos.length, totalValue: total }
  }

  const getSupplierProducts = (supplierId: number) => {
    const pos = purchaseOrders.filter((p: any) => p.supplierId === supplierId)
    return pos.slice(0, 5)
  }

  // ===== Bulk Import / Export =====
  const exportSuppliersCSV = () => {
    downloadCSV(
      `suppliers-${new Date().toISOString().slice(0, 10)}.csv`,
      CSV_HEADERS,
      filtered.map((s: Supplier) =>
        CSV_KEYS.map(k => (s as any)[k] ?? "")
      )
    )
  }

  const downloadCSVTemplate = () => {
    downloadCSV(
      "suppliers-template.csv",
      CSV_HEADERS,
      [
        ["شركة الأمل للتوريدات", "أحمد محمد", "01012345678", "info@example.com", "القاهرة", "مورد رئيسي"],
        ["مؤسسة النور", "محمود علي", "01198765432", "", "الإسكندرية", ""],
      ]
    )
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (rows.length < 2) {
        toast({ title: "ملف فارغ", description: "تأكد من وجود رؤوس وصف بيانات على الأقل", variant: "destructive" })
        return
      }
      // Map header positions
      const headers = rows[0].map(h => h.trim())
      const idx = (key: string) => {
        // accept either Arabic header or english key
        const alias: Record<string, string[]> = {
          name: ["اسم المورد", "name"],
          contactPerson: ["الشخص المسؤول", "المسؤول", "contactPerson"],
          phone: ["الهاتف", "phone"],
          email: ["البريد", "البريد الإلكتروني", "email"],
          address: ["العنوان", "address"],
          notes: ["ملاحظات", "notes"],
        }
        for (const a of alias[key] ?? []) {
          const i = headers.indexOf(a)
          if (i !== -1) return i
        }
        return -1
      }
      const colIdx = Object.fromEntries(CSV_KEYS.map(k => [k, idx(k)])) as Record<string, number>
      if (colIdx.name === -1) {
        toast({ title: "تنسيق خاطئ", description: "العمود 'اسم المورد' مطلوب", variant: "destructive" })
        return
      }
      const items = rows.slice(1)
        .map(r => ({
          name: (r[colIdx.name] ?? "").trim(),
          contactPerson: colIdx.contactPerson >= 0 ? (r[colIdx.contactPerson] ?? "").trim() || undefined : undefined,
          phone: colIdx.phone >= 0 ? (r[colIdx.phone] ?? "").trim() || undefined : undefined,
          email: colIdx.email >= 0 ? (r[colIdx.email] ?? "").trim() || undefined : undefined,
          address: colIdx.address >= 0 ? (r[colIdx.address] ?? "").trim() || undefined : undefined,
          notes: colIdx.notes >= 0 ? (r[colIdx.notes] ?? "").trim() || undefined : undefined,
        }))
        .filter(s => s.name)
      if (items.length === 0) {
        toast({ title: "لا يوجد موردون صالحون", description: "تأكد من تعبئة عمود الاسم", variant: "destructive" })
        return
      }
      const res: any = await bulkImportMutation.mutateAsync({ data: { suppliers: items as any } })
      toast({
        title: "تم الاستيراد",
        description: `تم إضافة ${res.inserted} مورد${res.skipped ? ` — تخطي ${res.skipped} (مكرر أو خطأ)` : ""}`,
      })
      queryClient.invalidateQueries({ queryKey: ["suppliers"] })
    } catch (err) {
      toast({ title: "خطأ في الاستيراد", description: "تأكد من ملف CSV صحيح", variant: "destructive" })
    }
  }

  // ===== Supplier Products Linking =====
  const handleLinkProduct = async () => {
    if (!viewingSupplier || !addProductId) return
    const pid = parseInt(addProductId)
    const price = parseFloat(addProductPrice) || 0
    try {
      await linkMutation.mutateAsync({
        data: { supplierId: viewingSupplier.id, productId: pid, lastSupplyPrice: price },
      })
      toast({ title: "تم الربط", description: "تم إضافة الصنف لقائمة هذا المورد" })
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] })
      setAddProductOpen(false)
      setAddProductId("")
      setAddProductPrice("")
    } catch {
      toast({ title: "خطأ", description: "فشل ربط الصنف", variant: "destructive" })
    }
  }

  const handleUnlinkProduct = async (linkId: number) => {
    try {
      await unlinkMutation.mutateAsync({ id: linkId })
      toast({ title: "تم الفصل", description: "تم حذف الصنف من قائمة المورد" })
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] })
    } catch {
      toast({ title: "خطأ", description: "فشل الحذف", variant: "destructive" })
    }
  }

  const linkableProducts = useMemo(() => {
    if (!viewingSupplier) return []
    const linked = new Set((supplierProducts as any[]).map(sp => sp.productId))
    return (products as any[]).filter(p => !linked.has(p.id))
  }, [products, supplierProducts, viewingSupplier])

  if (viewingSupplier) {
    const stats = getSupplierStats(viewingSupplier.id)
    const recentOrders = purchaseOrders
      .filter((p: any) => p.supplierId === viewingSupplier.id)
      .slice(0, 5)

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setViewingSupplier(null)} className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            العودة للموردين
          </Button>
          <div className="h-5 w-px bg-border" />
          <span className="text-muted-foreground text-sm">ملف المورد</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier Card */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold">{viewingSupplier.name}</h2>
                {viewingSupplier.contactPerson && (
                  <p className="text-muted-foreground text-sm mt-1">{viewingSupplier.contactPerson}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground">بيانات التواصل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {viewingSupplier.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span dir="ltr">{viewingSupplier.phone}</span>
                  </div>
                )}
                {viewingSupplier.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{viewingSupplier.email}</span>
                  </div>
                )}
                {viewingSupplier.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{viewingSupplier.address}</span>
                  </div>
                )}
                {viewingSupplier.notes && (
                  <div className="flex items-start gap-3 text-sm pt-2 border-t border-border">
                    <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">{viewingSupplier.notes}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{stats.ordersCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">أوامر شراء</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalValue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">إجمالي التعاملات</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2" variant="outline" onClick={() => openEdit(viewingSupplier)}>
                <Pencil className="w-4 h-4" /> تعديل
              </Button>
              <Button className="flex-1 gap-2 text-destructive" variant="outline" onClick={() => setDeletingId(viewingSupplier.id)}>
                <Trash2 className="w-4 h-4" /> حذف
              </Button>
            </div>
          </div>

          {/* Tabs: Orders + Products */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-0">
                <Tabs defaultValue="products" className="w-full">
                  <TabsList className="w-full justify-start border-b rounded-none rounded-t-xl bg-muted/30 p-1 h-auto">
                    <TabsTrigger value="products" className="gap-2 data-[state=active]:bg-white">
                      <Package className="w-4 h-4" /> أصناف يوردها ({(supplierProducts as any[]).length})
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="gap-2 data-[state=active]:bg-white">
                      <ShoppingCart className="w-4 h-4" /> سجل الأوامر ({recentOrders.length})
                    </TabsTrigger>
                    <TabsTrigger value="statement" className="gap-2 data-[state=active]:bg-white">
                      <History className="w-4 h-4" /> كشف الحساب
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="products" className="p-5 m-0">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">
                        الأصناف اللي بيوردها هذا المورد مع آخر سعر توريد
                      </p>
                      <Button size="sm" className="gap-2" onClick={() => { setAddProductId(""); setAddProductPrice(""); setAddProductOpen(true) }}>
                        <Link2 className="w-4 h-4" /> ربط صنف
                      </Button>
                    </div>
                    {loadingSupProducts ? (
                      <div className="text-center py-6 text-muted-foreground">جاري التحميل...</div>
                    ) : (supplierProducts as any[]).length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>لا توجد أصناف مرتبطة</p>
                        <p className="text-xs mt-1">اربط الأصناف يدوياً أو سيتم إضافتها تلقائياً عند استلام أمر شراء</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40">
                            <tr className="text-right">
                              <th className="p-3 font-semibold">الصنف</th>
                              <th className="p-3 font-semibold">آخر سعر توريد</th>
                              <th className="p-3 font-semibold">آخر توريد</th>
                              <th className="p-3 w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(supplierProducts as any[]).map(sp => (
                              <tr key={sp.id} className="border-t border-border/50">
                                <td className="p-3">
                                  <p className="font-semibold">{sp.productName}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{sp.productCode}</p>
                                </td>
                                <td className="p-3 font-bold text-emerald-700">{formatCurrency(sp.lastSupplyPrice)}</td>
                                <td className="p-3 text-xs text-muted-foreground">
                                  {sp.lastSupplyDate ? (
                                    <span className="flex items-center gap-1">
                                      <History className="w-3 h-3" />
                                      {formatDate(sp.lastSupplyDate)}
                                    </span>
                                  ) : "—"}
                                </td>
                                <td className="p-3">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => handleUnlinkProduct(sp.id)}
                                    title="فصل الصنف"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="orders" className="p-5 m-0">
                    {recentOrders.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>لا توجد أوامر شراء بعد</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentOrders.map((po: any) => {
                          const statusMap: Record<string, { label: string; color: string }> = {
                            pending: { label: "معلق", color: "bg-amber-100 text-amber-700" },
                            partial: { label: "استلام جزئي", color: "bg-blue-100 text-blue-700" },
                            received: { label: "تم الاستلام", color: "bg-emerald-100 text-emerald-700" },
                            cancelled: { label: "ملغي", color: "bg-red-100 text-red-700" },
                          }
                          const st = statusMap[po.status] ?? statusMap.pending
                          return (
                            <div key={po.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                              <div>
                                <p className="font-semibold text-sm">#{po.orderNumber}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(po.createdAt)}</p>
                              </div>
                              <Badge className={`${st.color} border-none text-xs`}>{st.label}</Badge>
                              <p className="font-bold text-sm">{formatCurrency(po.netAmount)}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="statement" className="p-5 m-0">
                    {!statement ? (
                      <div className="text-center py-10 text-muted-foreground">جاري التحميل...</div>
                    ) : (
                      <div className="space-y-4">
                        {/* Summary Row */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-center">
                            <p className="text-xs text-red-600 font-medium">إجمالي المشتريات</p>
                            <p className="text-base font-bold text-red-700">{formatCurrency(statement.totalPurchases)}</p>
                          </div>
                          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                            <p className="text-xs text-emerald-600 font-medium">إجمالي المدفوع</p>
                            <p className="text-base font-bold text-emerald-700">{formatCurrency(statement.totalPaid)}</p>
                          </div>
                          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                            <p className="text-xs text-amber-600 font-medium">الرصيد المستحق</p>
                            <p className="text-base font-bold text-amber-700">{formatCurrency(statement.balance)}</p>
                          </div>
                        </div>

                        {/* Statement Table */}
                        {(statement.entries ?? []).length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p>لا توجد تعاملات بعد</p>
                          </div>
                        ) : (
                          <div className="rounded-xl border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/40">
                                <tr className="text-right">
                                  <th className="p-2.5 font-semibold">التاريخ</th>
                                  <th className="p-2.5 font-semibold">البيان</th>
                                  <th className="p-2.5 font-semibold text-red-600">مدين</th>
                                  <th className="p-2.5 font-semibold text-emerald-600">دائن</th>
                                  <th className="p-2.5 font-semibold">الرصيد</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(statement.entries as any[]).map((e: any, i: number) => (
                                  <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                                    <td className="p-2.5 text-muted-foreground text-xs">{e.date}</td>
                                    <td className="p-2.5 font-medium">{e.description}</td>
                                    <td className="p-2.5 text-red-600 font-semibold">{e.debit > 0 ? formatCurrency(e.debit) : "-"}</td>
                                    <td className="p-2.5 text-emerald-600 font-semibold">{e.credit > 0 ? formatCurrency(e.credit) : "-"}</td>
                                    <td className="p-2.5 font-bold" style={{ color: e.balance > 0 ? "#d97706" : "#16a34a" }}>
                                      {formatCurrency(Math.abs(e.balance))}
                                      <span className="text-xs mr-1">{e.balance > 0 ? "مدين" : e.balance < 0 ? "دائن" : ""}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Link Product Dialog */}
        <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-primary" /> ربط صنف بالمورد
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">الصنف</label>
                <Select value={addProductId} onValueChange={setAddProductId}>
                  <SelectTrigger><SelectValue placeholder="اختر صنف..." /></SelectTrigger>
                  <SelectContent>
                    {linkableProducts.length === 0 && (
                      <div className="p-3 text-xs text-muted-foreground text-center">كل الأصناف مرتبطة بالفعل</div>
                    )}
                    {linkableProducts.map((p: any) => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">{p.code}</span>
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">آخر سعر توريد (اختياري)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={addProductPrice}
                  onChange={e => setAddProductPrice(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  هيتم تحديثه تلقائياً مع كل استلام أمر شراء
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddProductOpen(false)}>إلغاء</Button>
              <Button onClick={handleLinkProduct} disabled={!addProductId || linkMutation.isPending}>
                ربط الصنف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">الموردون</h1>
          <p className="text-muted-foreground mt-1">إدارة الموردين وسجل التعاملات</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button variant="outline" size="sm" className="gap-2" onClick={downloadCSVTemplate}>
            <FileDown className="w-4 h-4" /> قالب CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleImportClick} disabled={bulkImportMutation.isPending}>
            <Upload className="w-4 h-4" /> استيراد CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportSuppliersCSV} disabled={filtered.length === 0}>
            <Download className="w-4 h-4" /> تصدير CSV
          </Button>
          <Button className="gap-2 shadow-sm" onClick={openAdd}>
            <Plus className="w-5 h-5" /> إضافة مورد
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو رقم الهاتف أو البريد..."
          className="pr-10 bg-white"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{suppliers.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي الموردين</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-700 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{purchaseOrders.length}</p>
              <p className="text-xs text-muted-foreground">أوامر شراء كلية</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Suppliers Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-2/3 mb-3" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-1/3" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">لا يوجد موردون</p>
          <p className="text-sm text-muted-foreground mt-1">قم بإضافة أول مورد الآن</p>
          <Button className="mt-4 gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" /> إضافة مورد
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s: Supplier) => {
            const stats = getSupplierStats(s.id)
            return (
              <Card
                key={s.id}
                className="p-5 hover:shadow-md transition-all duration-200 border-border/60 group cursor-pointer"
                onClick={() => setViewingSupplier(s)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{s.name}</h3>
                      {s.contactPerson && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" /> {s.contactPerson}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {s.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span dir="ltr">{s.phone}</span>
                    </p>
                  )}
                  {s.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </p>
                  )}
                  {s.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{s.address}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="w-3.5 h-3.5" />{stats.ordersCount} طلب
                    </span>
                    <span className="text-emerald-600 font-semibold">{formatCurrency(stats.totalValue)}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(s.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) closeForm() }}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {editingSupplier ? "تعديل بيانات المورد" : "إضافة مورد جديد"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">اسم المورد <span className="text-destructive">*</span></label>
              <Input
                placeholder="مثال: شركة الوفاء للمواد الغذائية"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold mb-1.5 block">المسؤول</label>
                <Input
                  placeholder="اسم المسؤول"
                  value={form.contactPerson}
                  onChange={e => setForm({ ...form, contactPerson: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1.5 block">رقم الهاتف</label>
                <Input
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold mb-1.5 block">البريد الإلكتروني</label>
              <Input
                type="email"
                placeholder="example@email.com"
                dir="ltr"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-semibold mb-1.5 block">العنوان</label>
              <Input
                placeholder="المدينة، الحي، الشارع"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-semibold mb-1.5 block">ملاحظات</label>
              <Input
                placeholder="أي ملاحظات إضافية..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs">
              <Percent className="w-4 h-4 shrink-0" />
              ملاحظة: الخصومات تُحدَّد لكل أمر شراء على حدة (وليس لكل مورد) لتوفير مرونة أعلى.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeForm}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-[100px]">
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جاري الحفظ...</>
              ) : (
                editingSupplier ? "حفظ التعديلات" : "إضافة المورد"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا المورد؟ لن يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
