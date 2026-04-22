import { useState } from "react"
import {
  useGetBestPriceReport, useGetLowStockReport, useGetTopSellingReport,
  useGetPriceFluctuationReport, useGetSalesTargetsReport,
} from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  TrendingDown, TrendingUp, Package, AlertTriangle, DollarSign,
  Target, Award, BarChart3, ArrowUp, ArrowDown, Minus,
  ShoppingBag, Calendar, Sparkles, Crown,
} from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

export function Reports() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month")

  const { data: bestPrices = [], isLoading: lp1 } = useGetBestPriceReport()
  const { data: lowStock = [], isLoading: lp2 } = useGetLowStockReport()
  const { data: topSelling = [], isLoading: lp3 } = useGetTopSellingReport({ period })
  const { data: priceFluctuation = [], isLoading: lp4 } = useGetPriceFluctuationReport()
  const { data: salesTargets = [], isLoading: lp5 } = useGetSalesTargetsReport()

  // Summary
  const summary = {
    bestPrices: (bestPrices as any[]).length,
    lowStock: (lowStock as any[]).length,
    outOfStock: (lowStock as any[]).filter((p: any) => p.stockStatus === "out").length,
    topSeller: (topSelling as any[])[0]?.productName ?? "—",
    targetsHit: (salesTargets as any[]).filter((t: any) => t.progressPercent >= 100).length,
    totalTargets: (salesTargets as any[]).length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">التقارير الذكية</h1>
          <p className="text-muted-foreground mt-1">رؤى تحليلية للمشتريات والمخزن والمبيعات</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-200 text-emerald-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{summary.bestPrices}</p>
              <p className="text-xs text-muted-foreground">منتجات بأفضل أسعار</p>
            </div>
          </div>
        </Card>
        <Card className={cn("p-4", summary.outOfStock > 0 ? "bg-red-50 border-red-200/60" : "bg-amber-50 border-amber-200/60")}>
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", summary.outOfStock > 0 ? "bg-red-200 text-red-700" : "bg-amber-200 text-amber-700")}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", summary.outOfStock > 0 ? "text-red-700" : "text-amber-700")}>{summary.lowStock}</p>
              <p className="text-xs text-muted-foreground">تحت حد الأمان</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-primary/5 to-blue-100/30 border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Crown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary truncate">{summary.topSeller}</p>
              <p className="text-xs text-muted-foreground">الأكثر مبيعاً</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.targetsHit}/{summary.totalTargets}</p>
              <p className="text-xs text-muted-foreground">أهداف محققة</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="top-selling">
        <TabsList className="w-full overflow-x-auto flex-nowrap">
          <TabsTrigger value="top-selling" className="gap-1.5"><Award className="w-4 h-4" />الأكثر مبيعاً</TabsTrigger>
          <TabsTrigger value="low-stock" className="gap-1.5"><AlertTriangle className="w-4 h-4" />تحت حد الأمان</TabsTrigger>
          <TabsTrigger value="best-prices" className="gap-1.5"><DollarSign className="w-4 h-4" />أفضل الأسعار</TabsTrigger>
          <TabsTrigger value="price-fluctuation" className="gap-1.5"><BarChart3 className="w-4 h-4" />تغيرات الأسعار</TabsTrigger>
          <TabsTrigger value="targets" className="gap-1.5"><Target className="w-4 h-4" />أهداف المبيعات</TabsTrigger>
        </TabsList>

        {/* Top Selling */}
        <TabsContent value="top-selling" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">المنتجات الأكثر مبيعاً</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">حسب إجمالي الإيرادات</p>
              </div>
              <Select value={period} onValueChange={v => setPeriod(v as any)}>
                <SelectTrigger className="w-32 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">آخر أسبوع</SelectItem>
                  <SelectItem value="month">آخر شهر</SelectItem>
                  <SelectItem value="year">آخر سنة</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {lp3 ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : (topSelling as any[]).length === 0 ? (
                <EmptyState icon={Award} text="لا توجد بيانات مبيعات في هذه الفترة" />
              ) : (
                <>
                  <div className="h-64 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(topSelling as any[]).slice(0, 7)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="productName" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                        <Bar dataKey="totalRevenue" name="الإيرادات" radius={[8, 8, 0, 0]}>
                          {(topSelling as any[]).slice(0, 7).map((_, i) => (
                            <Cell key={i} fill={i === 0 ? "hsl(var(--primary))" : `hsl(var(--primary) / ${0.85 - i * 0.1})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {(topSelling as any[]).map((p: any, idx: number) => (
                      <div key={p.productId} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0",
                          idx === 0 ? "bg-amber-200 text-amber-700" :
                          idx === 1 ? "bg-slate-200 text-slate-700" :
                          idx === 2 ? "bg-orange-200 text-orange-700" : "bg-primary/10 text-primary"
                        )}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{p.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.productCode}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-primary">{formatCurrency(p.totalRevenue)}</p>
                          <p className="text-xs text-muted-foreground">{p.totalQuantity} وحدة • {p.orderCount} طلب</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Low Stock */}
        <TabsContent value="low-stock" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">المنتجات تحت حد الأمان</CardTitle>
              <p className="text-xs text-muted-foreground">منتجات تحتاج إلى إعادة طلب من الموردين</p>
            </CardHeader>
            <CardContent>
              {lp2 ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : (lowStock as any[]).length === 0 ? (
                <EmptyState icon={Package} text="جميع المنتجات في المستوى الآمن ✓" color="text-emerald-600" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr className="text-right">
                        <th className="px-4 py-2.5 font-semibold">الكود</th>
                        <th className="px-4 py-2.5 font-semibold">المنتج</th>
                        <th className="px-4 py-2.5 font-semibold text-center">المتاح</th>
                        <th className="px-4 py-2.5 font-semibold text-center">حد الأمان</th>
                        <th className="px-4 py-2.5 font-semibold">المورد</th>
                        <th className="px-4 py-2.5 font-semibold text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(lowStock as any[]).map((p: any) => (
                        <tr key={p.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.code}</td>
                          <td className="px-4 py-3 font-medium">{p.name}</td>
                          <td className={cn("px-4 py-3 text-center font-bold", p.stockStatus === "out" ? "text-red-600" : "text-amber-600")}>{p.currentQuantity}</td>
                          <td className="px-4 py-3 text-center text-muted-foreground">{p.safetyStock}</td>
                          <td className="px-4 py-3 text-xs">{p.supplierName ?? "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={cn("border text-xs",
                              p.stockStatus === "out" ? "bg-red-100 text-red-700 border-red-200" : "bg-amber-100 text-amber-700 border-amber-200"
                            )}>
                              {p.stockStatus === "out" ? "نفد" : "منخفض"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Best Prices */}
        <TabsContent value="best-prices" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">أفضل الأسعار من الموردين</CardTitle>
              <p className="text-xs text-muted-foreground">قارن السعر الحالي بأفضل سعر تاريخي لكل منتج</p>
            </CardHeader>
            <CardContent>
              {lp1 ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : (bestPrices as any[]).length === 0 ? (
                <EmptyState icon={DollarSign} text="لا توجد بيانات أسعار بعد" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr className="text-right">
                        <th className="px-4 py-2.5 font-semibold">الكود</th>
                        <th className="px-4 py-2.5 font-semibold">المنتج</th>
                        <th className="px-4 py-2.5 font-semibold text-left">السعر الحالي</th>
                        <th className="px-4 py-2.5 font-semibold text-left">أفضل سعر</th>
                        <th className="px-4 py-2.5 font-semibold">أفضل مورد</th>
                        <th className="px-4 py-2.5 font-semibold text-center">الفارق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(bestPrices as any[]).map((p: any) => {
                        const diff = p.currentPrice - p.bestPrice
                        const pct = p.currentPrice > 0 ? (diff / p.currentPrice * 100) : 0
                        return (
                          <tr key={p.productId} className="hover:bg-muted/20">
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.productCode}</td>
                            <td className="px-4 py-3 font-medium">{p.productName}</td>
                            <td className="px-4 py-3 text-left">{formatCurrency(p.currentPrice)}</td>
                            <td className="px-4 py-3 text-left font-bold text-emerald-700">{formatCurrency(p.bestPrice)}</td>
                            <td className="px-4 py-3 text-xs">{p.bestSupplierName ?? "—"}</td>
                            <td className="px-4 py-3 text-center">
                              {diff > 0 ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-xs gap-1">
                                  <TrendingDown className="w-3 h-3" />وفر {pct.toFixed(1)}%
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-slate-600 border-slate-200 border text-xs">—</Badge>
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

        {/* Price Fluctuation */}
        <TabsContent value="price-fluctuation" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تذبذب أسعار التكلفة</CardTitle>
              <p className="text-xs text-muted-foreground">المنتجات الأكثر تغيراً في السعر مع الوقت</p>
            </CardHeader>
            <CardContent>
              {lp4 ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : (priceFluctuation as any[]).length === 0 ? (
                <EmptyState icon={BarChart3} text="لا توجد تغيرات سعرية مسجّلة" />
              ) : (
                <div className="space-y-2">
                  {(priceFluctuation as any[]).sort((a: any, b: any) => Math.abs(b.totalChangePercent) - Math.abs(a.totalChangePercent)).map((p: any) => {
                    const up = p.totalChangePercent > 0
                    const flat = p.totalChangePercent === 0
                    return (
                      <div key={p.productId} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border border-border/40">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                          flat ? "bg-slate-100 text-slate-500" : up ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"
                        )}>
                          {flat ? <Minus className="w-4 h-4" /> : up ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{p.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.productCode} • {p.priceChangeCount} تغيير سعري</p>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{formatCurrency(p.firstPrice)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-bold">{formatCurrency(p.latestPrice)}</span>
                          </div>
                          <p className={cn("text-sm font-bold mt-0.5", flat ? "text-slate-500" : up ? "text-red-600" : "text-emerald-600")}>
                            {up ? "+" : ""}{p.totalChangePercent}%
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sales Targets */}
        <TabsContent value="targets" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تقدم أهداف البيع</CardTitle>
              <p className="text-xs text-muted-foreground">متابعة تحقيق الأهداف المحددة</p>
            </CardHeader>
            <CardContent>
              {lp5 ? (
                <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
              ) : (salesTargets as any[]).length === 0 ? (
                <EmptyState icon={Target} text="لم يتم تحديد أهداف بعد" />
              ) : (
                <div className="space-y-3">
                  {(salesTargets as any[]).map((t: any) => {
                    const done = t.progressPercent >= 100
                    const close = t.progressPercent >= 70 && !done
                    return (
                      <div key={t.id} className={cn("p-4 rounded-xl border",
                        done ? "bg-emerald-50 border-emerald-200" : close ? "bg-amber-50 border-amber-200" : "bg-muted/30 border-border/40"
                      )}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold truncate">{t.productName}</p>
                              {done && <Badge className="bg-emerald-200 text-emerald-800 border-emerald-300 border text-xs gap-1">
                                <Award className="w-3 h-3" />مكتمل
                              </Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{t.startDate} → {t.endDate} • {t.period === "weekly" ? "أسبوعي" : t.period === "monthly" ? "شهري" : "سنوي"}
                            </p>
                          </div>
                          <div className="text-left shrink-0">
                            <p className={cn("text-2xl font-bold", done ? "text-emerald-600" : close ? "text-amber-600" : "text-primary")}>
                              {t.progressPercent.toFixed(0)}%
                            </p>
                            <p className="text-xs text-muted-foreground">{t.soldQuantity} / {t.targetQuantity}</p>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-border/40">
                          <div className={cn("h-full transition-all duration-500", done ? "bg-emerald-500" : close ? "bg-amber-500" : "bg-primary")} style={{ width: `${Math.min(100, t.progressPercent)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyState({ icon: Icon, text, color = "text-muted-foreground" }: { icon: any; text: string; color?: string }) {
  return (
    <div className={`text-center py-10 ${color}`}>
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-40" />
      <p className="font-medium">{text}</p>
    </div>
  )
}
