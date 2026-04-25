import { useState, useEffect, useMemo } from "react"
import {
  useListPurchaseOrders,
  useCreatePurchaseOrder,
  useGetPurchaseOrder,
  useReceivePurchaseOrder,
  useDeletePurchaseOrder,
  useListSuppliers,
  useListProducts,
  useListProductsBySupplier,
} from "@workspace/api-client-react"
import { downloadCSV } from "@/lib/csv"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  Plus, Search, FileText, CheckCircle2, Clock, XCircle, Eye,
  Truck, Package, Calculator, AlertTriangle, Minus, Trash2,
  TrendingDown, ChevronLeft, Percent, ShoppingCart, ReceiptText,
  Building2, X, Check, Download, Printer, Sparkles, History
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

type PO = {
  id: number
  orderNumber: string
  supplierId: number
  supplierName?: string
  status: string
  totalAmount: number
  discountPercent: number
  taxPercent: number
  netAmount: number
  notes?: string
  createdAt: string
}

type POItem = {
  id: number
  productId: number
  productName: string
  productCode: string
  orderedQuantity: number
  receivedQuantity: number
  unitPrice: number
  totalPrice: number
}

type CartItem = {
  productId: number
  productName: string
  productCode: string
  unitPrice: number
  costPrice: number
  orderedQuantity: number
}

const statusConfig: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  pending: { label: "معلق", color: "text-amber-700", bg: "bg-amber-100", icon: Clock },
  partial: { label: "استلام جزئي", color: "text-blue-700", bg: "bg-blue-100", icon: Truck },
  received: { label: "تم الاستلام", color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle2 },
  cancelled: { label: "ملغي", color: "text-red-700", bg: "bg-red-100", icon: XCircle },
}

export function PurchaseOrders() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showOnlySupplierProducts, setShowOnlySupplierProducts] = useState(true)

  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [viewId, setViewId] = useState<number | null>(null)
  const [receiveId, setReceiveId] = useState<number | null>(null)
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // Create PO state
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [addProductId, setAddProductId] = useState<string>("")
  const [addQty, setAddQty] = useState("1")
  const [addPrice, setAddPrice] = useState("")
  const [discountPercent, setDiscountPercent] = useState("0")
  const [taxPercent, setTaxPercent] = useState("0")
  const [poNotes, setPoNotes] = useState("")

  // Receipt state
  const [receiveAmounts, setReceiveAmounts] = useState<Record<number, string>>({})

  const { data: pos = [], isLoading } = useListPurchaseOrders()
  const { data: suppliers = [] } = useListSuppliers()
  const { data: products = [] } = useListProducts()
  const { data: supplierProductsData = [] } = useListProductsBySupplier(
    selectedSupplierId ?? 0,
    { query: { enabled: !!selectedSupplierId } }
  )
  const { data: viewPO } = useGetPurchaseOrder(viewId ?? 0, { query: { enabled: !!viewId } })
  const { data: receivePO } = useGetPurchaseOrder(receiveId ?? 0, { query: { enabled: !!receiveId } })
  const createMutation = useCreatePurchaseOrder()
  const receiveMutation = useReceivePurchaseOrder()
  const cancelMutation = useDeletePurchaseOrder()

  const selectedSupplier = useMemo(
    () => suppliers.find((s: any) => s.id === selectedSupplierId) as any,
    [suppliers, selectedSupplierId]
  )

  const discountValue = Math.max(0, Math.min(100, parseFloat(discountPercent) || 0))

  const addToCart = () => {
    const pid = parseInt(addProductId)
    if (!pid || !addPrice || parseFloat(addPrice) <= 0 || parseFloat(addQty) <= 0) {
      toast({ title: "خطأ", description: "يجب اختيار منتج وتحديد السعر والكمية", variant: "destructive" })
      return
    }
    const product = products.find((p: any) => p.id === pid) as any
    if (!product) return
    const existing = cart.find(c => c.productId === pid)
    if (existing) {
      setCart(cart.map(c => c.productId === pid
        ? { ...c, orderedQuantity: c.orderedQuantity + parseFloat(addQty), unitPrice: parseFloat(addPrice) }
        : c
      ))
    } else {
      setCart([...cart, {
        productId: pid,
        productName: product.name,
        productCode: product.code,
        unitPrice: parseFloat(addPrice),
        costPrice: parseFloat(product.costPrice || 0),
        orderedQuantity: parseFloat(addQty),
      }])
    }
    setAddProductId("")
    setAddQty("1")
    setAddPrice("")
  }

  // Map of last supply price per product for selected supplier
  const lastPriceMap = useMemo(() => {
    const m = new Map<number, { price: number; date: string | null | undefined }>()
    for (const sp of supplierProductsData as any[]) {
      m.set(sp.productId, { price: Number(sp.lastSupplyPrice) || 0, date: sp.lastSupplyDate })
    }
    return m
  }, [supplierProductsData])

  // Auto-fill price when product selected: prefer lastSupplyPrice from this supplier, fallback to product cost
  useEffect(() => {
    if (addProductId) {
      const pid = parseInt(addProductId)
      const last = lastPriceMap.get(pid)
      if (last && last.price > 0) {
        setAddPrice(String(last.price))
        return
      }
      const product = products.find((p: any) => p.id === pid) as any
      if (product) setAddPrice(String(product.costPrice || ""))
    }
  }, [addProductId, products, lastPriceMap])

  const removeFromCart = (pid: number) => setCart(cart.filter(c => c.productId !== pid))
  const updateCartQty = (pid: number, qty: string) =>
    setCart(cart.map(c => c.productId === pid ? { ...c, orderedQuantity: parseFloat(qty) || 0 } : c))
  const updateCartPrice = (pid: number, price: string) =>
    setCart(cart.map(c => c.productId === pid ? { ...c, unitPrice: parseFloat(price) || 0 } : c))

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.orderedQuantity, 0)
  const discountAmount = subtotal * (discountValue / 100)
  const afterDiscount = subtotal - discountAmount
  const taxAmount = afterDiscount * (parseFloat(taxPercent) / 100)
  const netTotal = afterDiscount + taxAmount

  const handleCreatePO = async () => {
    if (!selectedSupplierId || cart.length === 0) {
      toast({ title: "خطأ", description: "اختر المورد وأضف أصنافاً على الأقل", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await createMutation.mutateAsync({
        data: {
          supplierId: selectedSupplierId,
          discountPercent: discountValue,
          taxPercent: parseFloat(taxPercent),
          notes: poNotes || undefined,
          items: cart.map(c => ({
            productId: c.productId,
            orderedQuantity: c.orderedQuantity,
            unitPrice: c.unitPrice,
          })),
        } as any,
      })
      toast({ title: "تم الإنشاء", description: "تم إنشاء أمر الشراء بنجاح" })
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setShowCreate(false)
      resetCreateForm()
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الإنشاء", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const resetCreateForm = () => {
    setSelectedSupplierId(null)
    setCart([])
    setAddProductId("")
    setAddQty("1")
    setAddPrice("")
    setDiscountPercent("0")
    setTaxPercent("0")
    setPoNotes("")
  }

  const openReceive = (id: number) => {
    setReceiveId(id)
    setReceiveAmounts({})
  }

  const handleReceive = async () => {
    if (!receiveId || !receivePO) return
    const items = (receivePO.items ?? []) as POItem[]
    const receiveItems = items
      .filter(item => {
        const qty = parseFloat(receiveAmounts[item.id] ?? "0")
        return qty > 0
      })
      .map(item => ({
        itemId: item.id,
        receivedQuantity: parseFloat(receiveAmounts[item.id] ?? "0"),
      }))

    if (receiveItems.length === 0) {
      toast({ title: "خطأ", description: "أدخل الكميات المستلمة", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      await receiveMutation.mutateAsync({ id: receiveId, data: { items: receiveItems } as any })
      toast({ title: "تم الاستلام", description: "تم تحديث المخزون بنجاح" })
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setReceiveId(null)
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الاستلام", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelId) return
    try {
      await cancelMutation.mutateAsync({ id: cancelId })
      toast({ title: "تم الإلغاء", description: "تم إلغاء أمر الشراء" })
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] })
      setCancelId(null)
    } catch {
      toast({ title: "خطأ", description: "لا يمكن إلغاء هذا الأمر", variant: "destructive" })
    }
  }

  const filtered = pos.filter((p: PO) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter
    const matchSupplier = supplierFilter === "all" || p.supplierId === parseInt(supplierFilter)
    const q = search.toLowerCase()
    const matchSearch = !q ||
      p.orderNumber.toLowerCase().includes(q) ||
      (p.supplierName ?? "").toLowerCase().includes(q)
    const created = new Date(p.createdAt).getTime()
    const fromOk = !dateFrom || created >= new Date(dateFrom).getTime()
    const toOk = !dateTo || created <= new Date(dateTo).getTime() + 24 * 3600 * 1000
    return matchStatus && matchSupplier && matchSearch && fromOk && toOk
  })

  const exportCSV = () => {
    downloadCSV(
      `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ["رقم الأمر", "المورد", "الحالة", "التاريخ", "المجموع", "الخصم %", "الضريبة %", "الصافي", "ملاحظات"],
      filtered.map((p: PO) => [
        p.orderNumber,
        p.supplierName ?? "",
        statusConfig[p.status]?.label ?? p.status,
        new Date(p.createdAt).toLocaleDateString("ar-EG"),
        p.totalAmount,
        p.discountPercent,
        p.taxPercent,
        p.netAmount,
        p.notes ?? "",
      ])
    )
  }

  const openPrint = (id: number) => {
    const base = (import.meta as any).env?.BASE_URL ?? "/"
    const url = `${base}print/po/${id}`.replace(/\/+/g, "/")
    window.open(url, "_blank")
  }

  const pendingCount = pos.filter((p: PO) => p.status === "pending").length
  const totalValue = pos.reduce((s: number, p: PO) => s + (p.netAmount || 0), 0)

  // Available products not in cart - filtered by supplier if toggle on
  const availableProducts = useMemo(() => {
    const inCart = (id: number) => cart.some(c => c.productId === id)
    if (showOnlySupplierProducts && selectedSupplierId && supplierProductsData.length > 0) {
      const supplierProductIds = new Set((supplierProductsData as any[]).map(sp => sp.productId))
      return products.filter((p: any) => supplierProductIds.has(p.id) && !inCart(p.id))
    }
    return products.filter((p: any) => !inCart(p.id))
  }, [products, cart, supplierProductsData, showOnlySupplierProducts, selectedSupplierId])

  const supplierHasHistory = (supplierProductsData as any[]).length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">أوامر الشراء</h1>
          <p className="text-muted-foreground mt-1">إدارة طلبات التوريد والاستلامات الفعلية</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="w-4 h-4" /> تصدير CSV
          </Button>
          <Button className="gap-2 shadow-sm" onClick={() => { resetCreateForm(); setShowCreate(true) }}>
            <Plus className="w-5 h-5" /> أمر شراء جديد
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-border/60">
          <p className="text-2xl font-bold">{pos.length}</p>
          <p className="text-xs text-muted-foreground mt-1">إجمالي الأوامر</p>
        </Card>
        <Card className="p-4 border-amber-200/60 bg-amber-50/50">
          <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
          <p className="text-xs text-muted-foreground mt-1">معلقة</p>
        </Card>
        <Card className="p-4 border-emerald-200/60 bg-emerald-50/50">
          <p className="text-2xl font-bold text-emerald-700">{pos.filter((p: PO) => p.status === "received").length}</p>
          <p className="text-xs text-muted-foreground mt-1">مستلمة</p>
        </Card>
        <Card className="p-4 border-primary/20 bg-primary/5">
          <p className="text-lg font-bold text-primary">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">إجمالي القيمة</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="relative md:col-span-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="بحث برقم الأمر أو اسم المورد..."
            className="pr-10 bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:col-span-2 bg-white">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">معلق</SelectItem>
            <SelectItem value="partial">استلام جزئي</SelectItem>
            <SelectItem value="received">مستلم</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="md:col-span-2 bg-white">
            <SelectValue placeholder="كل الموردين" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الموردين</SelectItem>
            {suppliers.map((s: any) => (
              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="md:col-span-2 bg-white" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="من تاريخ" />
        <Input type="date" className="md:col-span-2 bg-white" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="إلى تاريخ" />
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-1/3 mb-3" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ReceiptText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">لا توجد أوامر شراء</p>
          <p className="text-sm text-muted-foreground mt-1">قم بإنشاء أول أمر شراء</p>
          <Button className="mt-4 gap-2" onClick={() => { resetCreateForm(); setShowCreate(true) }}>
            <Plus className="w-4 h-4" /> أمر شراء جديد
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((po: PO) => {
            const st = statusConfig[po.status] ?? statusConfig.pending
            const StatusIcon = st.icon
            return (
              <Card key={po.id} className="border-border/60 hover:shadow-md transition-all duration-200">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Left: Status Icon + Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${st.bg} ${st.color}`}>
                        <StatusIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">#{po.orderNumber}</h3>
                          <Badge className={`${st.bg} ${st.color} border-none text-xs`}>
                            {st.label}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground font-medium flex items-center gap-1.5 text-sm">
                          <Building2 className="w-3.5 h-3.5" />{po.supplierName ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(po.createdAt)}</p>

                        {/* Financial Breakdown */}
                        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/40">
                          <span className="text-xs text-muted-foreground">
                            المجموع: <strong className="text-foreground">{formatCurrency(po.totalAmount)}</strong>
                          </span>
                          {po.discountPercent > 0 && (
                            <span className="text-xs text-emerald-600">
                              خصم {po.discountPercent}%: <strong>-{formatCurrency(po.totalAmount * po.discountPercent / 100)}</strong>
                            </span>
                          )}
                          {po.taxPercent > 0 && (
                            <span className="text-xs text-amber-600">
                              ضريبة {po.taxPercent}%
                            </span>
                          )}
                          <span className="text-sm font-extrabold text-primary">
                            الصافي: {formatCurrency(po.netAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-row md:flex-col gap-2 md:w-36 shrink-0 md:justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 md:flex-none gap-1.5 text-sm"
                        onClick={() => setViewId(po.id)}
                      >
                        <Eye className="w-4 h-4" /> التفاصيل
                      </Button>

                      {(po.status === "pending" || po.status === "partial") && (
                        <Button
                          size="sm"
                          className="flex-1 md:flex-none gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => openReceive(po.id)}
                        >
                          <Truck className="w-4 h-4" /> استلام
                        </Button>
                      )}

                      {po.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 md:flex-none gap-1.5 text-sm text-destructive border-destructive/30 hover:bg-destructive/5"
                          onClick={() => setCancelId(po.id)}
                        >
                          <XCircle className="w-4 h-4" /> إلغاء
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ===== CREATE PO DIALOG ===== */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) resetCreateForm(); setShowCreate(open) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              إنشاء أمر شراء ذكي
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Step 1: Select Supplier */}
            <div>
              <label className="text-sm font-bold mb-2 block flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">1</span>
                اختيار المورد
              </label>
              <Select
                value={selectedSupplierId?.toString() ?? ""}
                onValueChange={v => { setSelectedSupplierId(parseInt(v)); setCart([]) }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="اختر المورد..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Add Products */}
            {selectedSupplierId && (
              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <label className="text-sm font-bold flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">2</span>
                    إضافة الأصناف
                  </label>
                  {supplierHasHistory && (
                    <div className="flex items-center gap-2 text-xs">
                      <Switch
                        id="onlySupplierProducts"
                        checked={showOnlySupplierProducts}
                        onCheckedChange={setShowOnlySupplierProducts}
                      />
                      <Label htmlFor="onlySupplierProducts" className="text-muted-foreground cursor-pointer flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        أصناف هذا المورد فقط
                      </Label>
                    </div>
                  )}
                </div>
                {addProductId && lastPriceMap.has(parseInt(addProductId)) && (
                  <div className="mb-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                    <History className="w-3.5 h-3.5" />
                    آخر سعر توريد من هذا المورد: <strong>{formatCurrency(lastPriceMap.get(parseInt(addProductId))!.price)}</strong>
                    {lastPriceMap.get(parseInt(addProductId))!.date && (
                      <span className="text-emerald-600">— {formatDate(lastPriceMap.get(parseInt(addProductId))!.date as string)}</span>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Select value={addProductId} onValueChange={setAddProductId}>
                    <SelectTrigger className="flex-1 bg-white">
                      <SelectValue placeholder={
                        showOnlySupplierProducts && supplierHasHistory
                          ? `اختر من أصناف المورد (${availableProducts.length})...`
                          : `اختر الصنف (${availableProducts.length})...`
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.length === 0 && (
                        <div className="p-3 text-xs text-muted-foreground text-center">
                          {showOnlySupplierProducts ? "لا توجد أصناف مرتبطة بهذا المورد" : "لا توجد أصناف"}
                        </div>
                      )}
                      {availableProducts.map((p: any) => {
                        const last = lastPriceMap.get(p.id)
                        return (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground font-mono">{p.code}</span>
                              {p.name}
                              <span className="text-xs mr-auto">
                                {last ? (
                                  <span className="text-emerald-600 font-semibold">{formatCurrency(last.price)}</span>
                                ) : (
                                  <span className="text-muted-foreground">{formatCurrency(p.costPrice)}</span>
                                )}
                              </span>
                            </span>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="الكمية"
                    className="w-24 bg-white"
                    value={addQty}
                    min="1"
                    onChange={e => setAddQty(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="السعر"
                    className="w-32 bg-white"
                    value={addPrice}
                    min="0"
                    step="0.01"
                    onChange={e => setAddPrice(e.target.value)}
                  />
                  <Button onClick={addToCart} className="shrink-0 gap-1">
                    <Plus className="w-4 h-4" /> إضافة
                  </Button>
                </div>
              </div>
            )}

            {/* Cart Table */}
            {cart.length > 0 && (
              <div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-right p-3 font-semibold text-muted-foreground">الصنف</th>
                        <th className="text-center p-3 font-semibold text-muted-foreground w-28">الكمية</th>
                        <th className="text-center p-3 font-semibold text-muted-foreground w-32">السعر</th>
                        <th className="text-left p-3 font-semibold text-muted-foreground w-28">الإجمالي</th>
                        <th className="w-10 p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, idx) => (
                        <tr key={item.productId} className={idx % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                          <td className="p-3">
                            <p className="font-semibold">{item.productName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{item.productCode}</p>
                          </td>
                          <td className="p-3 text-center">
                            <Input
                              type="number"
                              min="1"
                              value={item.orderedQuantity}
                              onChange={e => updateCartQty(item.productId, e.target.value)}
                              className="w-20 text-center mx-auto h-8 text-sm"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={e => updateCartPrice(item.productId, e.target.value)}
                              className="w-28 text-center mx-auto h-8 text-sm"
                            />
                          </td>
                          <td className="p-3 font-bold text-sm text-right">
                            {formatCurrency(item.unitPrice * item.orderedQuantity)}
                          </td>
                          <td className="p-3">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.productId)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 3: Financials */}
            {cart.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold mb-2 block flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">3</span>
                    الخصم والضريبة
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                        <Percent className="w-3 h-3 text-emerald-600" /> نسبة الخصم على هذا الأمر %
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={discountPercent}
                        onChange={e => setDiscountPercent(e.target.value)}
                        placeholder="0"
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">نسبة الضريبة %</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={taxPercent}
                        onChange={e => setTaxPercent(e.target.value)}
                        placeholder="0"
                        className="bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">ملاحظات</label>
                      <Input
                        value={poNotes}
                        onChange={e => setPoNotes(e.target.value)}
                        placeholder="أي ملاحظات على الأمر..."
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
                  <h4 className="font-bold text-sm flex items-center gap-2 mb-3">
                    <Calculator className="w-4 h-4 text-primary" />
                    ملخص الأمر
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">المجموع الفرعي</span>
                    <span className="font-semibold">{formatCurrency(subtotal)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>خصم ({discountValue}%)</span>
                      <span className="font-semibold">-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  {parseFloat(taxPercent) > 0 && (
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>الضريبة ({taxPercent}%)</span>
                      <span className="font-semibold">+{formatCurrency(taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-base pt-2 border-t border-border">
                    <span>الإجمالي الصافي</span>
                    <span className="text-primary">{formatCurrency(netTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetCreateForm() }}>
              إلغاء
            </Button>
            <Button
              onClick={handleCreatePO}
              disabled={saving || !selectedSupplierId || cart.length === 0}
              className="gap-2 min-w-[140px]"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جاري الحفظ...</>
              ) : (
                <><Check className="w-4 h-4" /> إصدار أمر الشراء</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== VIEW PO DIALOG ===== */}
      <Dialog open={!!viewId} onOpenChange={open => !open && setViewId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              تفاصيل أمر الشراء
              {viewPO && <span className="font-mono text-muted-foreground">#{viewPO.orderNumber}</span>}
            </DialogTitle>
          </DialogHeader>

          {viewPO ? (
            <div className="space-y-5">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground">المورد</p>
                  <p className="font-bold mt-0.5">{viewPO.supplierName}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground">الحالة</p>
                  <p className={`font-bold mt-0.5 ${statusConfig[viewPO.status]?.color}`}>
                    {statusConfig[viewPO.status]?.label ?? viewPO.status}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground">التاريخ</p>
                  <p className="font-bold mt-0.5">{formatDate(viewPO.createdAt)}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-xs text-muted-foreground">الإجمالي الصافي</p>
                  <p className="font-extrabold text-primary text-lg mt-0.5">{formatCurrency(viewPO.netAmount)}</p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-sm mb-2">الأصناف المطلوبة</h4>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-right p-3 font-semibold text-muted-foreground">الصنف</th>
                        <th className="text-center p-3 font-semibold text-muted-foreground">مطلوب</th>
                        <th className="text-center p-3 font-semibold text-muted-foreground">مستلم</th>
                        <th className="text-center p-3 font-semibold text-muted-foreground">السعر</th>
                        <th className="text-left p-3 font-semibold text-muted-foreground">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewPO.items ?? []).map((item: POItem) => {
                        const remaining = item.orderedQuantity - item.receivedQuantity
                        const isFullyReceived = item.receivedQuantity >= item.orderedQuantity
                        return (
                          <tr key={item.id} className="border-t border-border/30">
                            <td className="p-3">
                              <p className="font-semibold">{item.productName}</p>
                              <p className="text-xs text-muted-foreground font-mono">{item.productCode}</p>
                            </td>
                            <td className="p-3 text-center font-mono">{item.orderedQuantity}</td>
                            <td className="p-3 text-center">
                              <span className={`font-mono font-bold ${isFullyReceived ? "text-emerald-600" : item.receivedQuantity > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                                {item.receivedQuantity}
                              </span>
                              {!isFullyReceived && item.receivedQuantity > 0 && (
                                <p className="text-xs text-muted-foreground">متبقي: {remaining}</p>
                              )}
                            </td>
                            <td className="p-3 text-center">{formatCurrency(item.unitPrice)}</td>
                            <td className="p-3 font-bold">{formatCurrency(item.totalPrice)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financials Summary */}
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الإجمالي قبل الخصم</span>
                  <span>{formatCurrency(viewPO.totalAmount)}</span>
                </div>
                {viewPO.discountPercent > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>خصم ({viewPO.discountPercent}%)</span>
                    <span>-{formatCurrency(viewPO.totalAmount * viewPO.discountPercent / 100)}</span>
                  </div>
                )}
                {viewPO.taxPercent > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>ضريبة ({viewPO.taxPercent}%)</span>
                    <span>+{formatCurrency(viewPO.netAmount - (viewPO.totalAmount * (1 - viewPO.discountPercent / 100)))}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-base pt-2 border-t border-border">
                  <span>الإجمالي الصافي</span>
                  <span className="text-primary">{formatCurrency(viewPO.netAmount)}</span>
                </div>
              </div>

              {viewPO.notes && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                  <p className="text-sm">{viewPO.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <DialogFooter className="gap-2">
            {viewPO && (
              <Button variant="outline" className="gap-2" onClick={() => openPrint(viewPO.id)}>
                <Printer className="w-4 h-4" /> طباعة / PDF
              </Button>
            )}
            {viewPO && (viewPO.status === "pending" || viewPO.status === "partial") && (
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => { setViewId(null); openReceive(viewPO.id) }}
              >
                <Truck className="w-4 h-4" /> تسجيل استلام
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewId(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== RECEIVE PO DIALOG ===== */}
      <Dialog open={!!receiveId} onOpenChange={open => !open && setReceiveId(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              تسجيل الاستلام الفعلي
            </DialogTitle>
          </DialogHeader>

          {receivePO ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                أدخل الكمية المستلمة فعلياً لكل صنف. يسمح النظام بالاستلام الجزئي.
              </div>

              <div className="space-y-3">
                {(receivePO.items ?? []).map((item: POItem) => {
                  const remaining = item.orderedQuantity - item.receivedQuantity
                  const isFullyReceived = remaining <= 0
                  return (
                    <div key={item.id} className={`p-4 rounded-xl border ${isFullyReceived ? "bg-muted/30 border-border/30 opacity-60" : "bg-white border-border"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-bold">{item.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.productCode}</p>
                          <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span>مطلوب: <strong className="text-foreground">{item.orderedQuantity}</strong></span>
                            <span>مستلم سابقاً: <strong className="text-blue-600">{item.receivedQuantity}</strong></span>
                            <span>متبقي: <strong className={remaining > 0 ? "text-amber-600" : "text-emerald-600"}>{Math.max(0, remaining)}</strong></span>
                          </div>
                        </div>
                        <div className="w-32 shrink-0">
                          <label className="text-xs text-muted-foreground block mb-1">الكمية المستلمة</label>
                          <Input
                            type="number"
                            min="0"
                            max={remaining}
                            value={receiveAmounts[item.id] ?? ""}
                            onChange={e => setReceiveAmounts({ ...receiveAmounts, [item.id]: e.target.value })}
                            placeholder={`0 - ${Math.max(0, remaining)}`}
                            className="text-center h-9"
                            disabled={isFullyReceived}
                          />
                        </div>
                      </div>
                      {isFullyReceived && (
                        <div className="flex items-center gap-1.5 mt-2 text-emerald-600 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" /> تم استلام الكمية الكاملة
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="py-8 flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReceiveId(null)}>إلغاء</Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 min-w-[130px]"
              onClick={handleReceive}
              disabled={saving}
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جاري الحفظ...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> تأكيد الاستلام</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm */}
      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء أمر الشراء</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إلغاء هذا الأمر؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive hover:bg-destructive/90">
              تأكيد الإلغاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
