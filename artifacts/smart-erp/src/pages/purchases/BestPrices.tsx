import { useState, useMemo } from "react"
import { useGetBestPrices, useListSupplierOffersForProduct, useListSuppliers } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, TrendingDown, Award, Package, Crown, Building2, AlertCircle, BarChart3 } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { downloadCSV } from "@/lib/csv"
import { Download } from "lucide-react"

type BestPriceRow = {
  productId: number
  productCode: string
  productName: string
  productCategory?: string | null
  productUnit?: string | null
  currentQuantity: number
  costPrice: number
  bestSupplierId?: number | null
  bestSupplierName?: string | null
  bestPrice?: number | null
  bestPriceDate?: string | null
  supplierCount: number
}

export function BestPrices() {
  const [search, setSearch] = useState("")
  const [openProductId, setOpenProductId] = useState<number | null>(null)
  const { data: rows = [], isLoading } = useGetBestPrices()
  const { data: suppliers = [] } = useListSuppliers()
  const { data: offers = [], isLoading: offersLoading } = useListSupplierOffersForProduct(openProductId ?? 0, {
    query: { enabled: !!openProductId } as any,
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return (rows as BestPriceRow[]).filter(r =>
      r.productName.toLowerCase().includes(q) ||
      r.productCode.toLowerCase().includes(q) ||
      r.bestSupplierName?.toLowerCase().includes(q)
    )
  }, [rows, search])

  const tracked = filtered.filter(r => r.bestPrice !== null && r.bestPrice !== undefined)
  const untracked = filtered.filter(r => r.bestPrice === null || r.bestPrice === undefined)
  const totalSavings = tracked.reduce((sum, r) => {
    const cost = r.costPrice
    const best = r.bestPrice ?? 0
    return cost > best ? sum + (cost - best) : sum
  }, 0)

  const exportCSV = () => {
    downloadCSV(
      `best-prices-${new Date().toISOString().slice(0, 10)}.csv`,
      ["كود الصنف", "اسم الصنف", "الفئة", "الوحدة", "أفضل سعر", "اسم المورد", "تاريخ آخر توريد", "عدد الموردين", "سعر التكلفة الحالي"],
      filtered.map(r => [
        r.productCode,
        r.productName,
        r.productCategory ?? "",
        r.productUnit ?? "",
        r.bestPrice ?? "",
        r.bestSupplierName ?? "",
        r.bestPriceDate ? new Date(r.bestPriceDate).toLocaleDateString("ar-EG") : "",
        r.supplierCount,
        r.costPrice,
      ])
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">أفضل الأسعار</h1>
          <p className="text-muted-foreground mt-1">قارن أسعار التوريد بين الموردين واتخذ قرار شراء ذكي</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV} disabled={filtered.length === 0}>
          <Download className="w-4 h-4" /> تنزيل CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-700 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tracked.length}</p>
              <p className="text-xs text-muted-foreground">أصناف بأسعار مرصودة</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-700 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{untracked.length}</p>
              <p className="text-xs text-muted-foreground">أصناف بدون عروض</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalSavings)}</p>
              <p className="text-xs text-muted-foreground">وفر محتمل من الأسعار الأفضل</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="بحث بالصنف أو الكود أو اسم المورد..."
          className="pr-10 bg-white"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Card className="p-12 text-center"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="font-semibold text-muted-foreground">لا توجد بيانات أسعار بعد</p>
          <p className="text-sm text-muted-foreground mt-1">أنشئ أوامر شراء واستلمها لتسجيل أسعار التوريد تلقائياً</p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-right">
                  <th className="p-3 font-semibold">الصنف</th>
                  <th className="p-3 font-semibold">الفئة</th>
                  <th className="p-3 font-semibold">المخزون</th>
                  <th className="p-3 font-semibold">سعر التكلفة الحالي</th>
                  <th className="p-3 font-semibold">أفضل سعر توريد</th>
                  <th className="p-3 font-semibold">المورد صاحب أفضل سعر</th>
                  <th className="p-3 font-semibold text-center">عروض</th>
                  <th className="p-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const savings = r.bestPrice && r.costPrice > r.bestPrice ? r.costPrice - r.bestPrice : 0
                  return (
                    <tr key={r.productId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <div className="font-semibold">{r.productName}</div>
                        <div className="text-xs text-muted-foreground">{r.productCode}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.productCategory ?? "—"}</td>
                      <td className="p-3 font-medium">{r.currentQuantity} {r.productUnit ?? ""}</td>
                      <td className="p-3 font-semibold">{formatCurrency(r.costPrice)}</td>
                      <td className="p-3">
                        {r.bestPrice !== null && r.bestPrice !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-700">{formatCurrency(r.bestPrice)}</span>
                            {savings > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-700 text-xs border-none">
                                وفر {formatCurrency(savings)}
                              </Badge>
                            )}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">— لا توجد عروض —</span>}
                      </td>
                      <td className="p-3">
                        {r.bestSupplierName ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Crown className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{r.bestSupplierName}</div>
                              {r.bestPriceDate && (
                                <div className="text-xs text-muted-foreground">{formatDate(r.bestPriceDate)}</div>
                              )}
                            </div>
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-xs">{r.supplierCount}</Badge>
                      </td>
                      <td className="p-3 text-left">
                        {r.supplierCount > 0 && (
                          <Button size="sm" variant="ghost" onClick={() => setOpenProductId(r.productId)}>
                            <BarChart3 className="w-4 h-4 ml-1" /> مقارنة
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!openProductId} onOpenChange={() => setOpenProductId(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> مقارنة الأسعار بين الموردين
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {offersLoading ? (
              <div className="text-center py-6 text-muted-foreground">جاري التحميل...</div>
            ) : offers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">لا توجد عروض</div>
            ) : (
              offers.map((o: any, idx: number) => (
                <div key={o.id} className={`flex items-center justify-between p-3 rounded-xl border ${idx === 0 ? "bg-emerald-50 border-emerald-200" : "bg-muted/30 border-border/50"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${idx === 0 ? "bg-emerald-200 text-emerald-700" : "bg-primary/10 text-primary"}`}>
                      {idx === 0 ? <Crown className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-semibold">{o.supplierName}</p>
                      {o.lastSupplyDate && (
                        <p className="text-xs text-muted-foreground">آخر توريد: {formatDate(o.lastSupplyDate)}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${idx === 0 ? "text-emerald-700" : ""}`}>{formatCurrency(o.lastSupplyPrice)}</p>
                    {idx === 0 && <Badge className="bg-emerald-200 text-emerald-800 border-none text-xs mt-1">الأفضل</Badge>}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
