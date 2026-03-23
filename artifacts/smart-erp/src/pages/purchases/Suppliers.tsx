import { useState } from "react"
import {
  useListSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useListPurchaseOrders,
  useListProducts,
} from "@workspace/api-client-react"
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
  TrendingDown, Package, ChevronLeft, FileText
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
  discountPercent: string
  notes: string
}

const emptyForm: SupplierFormData = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  discountPercent: "0",
  notes: "",
}

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

  const { data: suppliers = [], isLoading } = useListSuppliers()
  const { data: purchaseOrders = [] } = useListPurchaseOrders()
  const { data: products = [] } = useListProducts()
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const deleteMutation = useDeleteSupplier()

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
      discountPercent: String(s.discountPercent ?? 0),
      notes: s.notes ?? "",
    })
    setShowForm(true)
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
        discountPercent: parseFloat(form.discountPercent) || 0,
        notes: form.notes || undefined,
      }
      if (editingSupplier) {
        await updateMutation.mutateAsync({ id: editingSupplier.id, data: payload as any })
        toast({ title: "تم التحديث", description: "تم تحديث بيانات المورد بنجاح" })
      } else {
        await createMutation.mutateAsync({ data: payload as any })
        toast({ title: "تمت الإضافة", description: "تم إضافة المورد بنجاح" })
      }
      queryClient.invalidateQueries({ queryKey: ["suppliers"] })
      setShowForm(false)
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
      queryClient.invalidateQueries({ queryKey: ["suppliers"] })
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
                {(viewingSupplier.discountPercent && parseFloat(String(viewingSupplier.discountPercent)) > 0) ? (
                  <Badge className="mt-3 bg-emerald-100 text-emerald-700 border-emerald-200">
                    <Percent className="w-3 h-3 ml-1" />
                    خصم {viewingSupplier.discountPercent}%
                  </Badge>
                ) : null}
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

          {/* Orders History */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  سجل أوامر الشراء
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </div>
        </div>
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
        <Button className="gap-2 shadow-sm" onClick={openAdd}>
          <Plus className="w-5 h-5" /> إضافة مورد
        </Button>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-700 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{suppliers.filter((s: Supplier) => parseFloat(String(s.discountPercent ?? 0)) > 0).length}</p>
              <p className="text-xs text-muted-foreground">موردون بخصم</p>
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
            const disc = parseFloat(String(s.discountPercent ?? 0))
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
                  {disc > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs shrink-0">
                      <Percent className="w-3 h-3 ml-1" />{disc}%
                    </Badge>
                  )}
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
      <Dialog open={showForm} onOpenChange={setShowForm}>
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

            <div className="grid grid-cols-2 gap-3">
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
                <label className="text-sm font-semibold mb-1.5 block flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-emerald-600" /> نسبة الخصم الثابتة %
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="0"
                  value={form.discountPercent}
                  onChange={e => setForm({ ...form, discountPercent: e.target.value })}
                />
              </div>
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

            {parseFloat(form.discountPercent) > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                <Percent className="w-4 h-4 shrink-0" />
                سيتم تطبيق خصم <strong>{form.discountPercent}%</strong> تلقائياً على جميع أوامر الشراء من هذا المورد
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
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
