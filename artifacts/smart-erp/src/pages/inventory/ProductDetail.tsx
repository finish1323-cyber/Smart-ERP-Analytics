import { useRoute } from "wouter"
import { useGetProduct } from "@workspace/api-client-react"
import { Card, Badge, Button } from "@/components/ui/shared"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ArrowRight, Package, TrendingUp, History, Activity } from "lucide-react"
import { Link } from "wouter"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function ProductDetail() {
  const [, params] = useRoute("/inventory/products/:id");
  const productId = parseInt(params?.id || "0");
  const { data: product, isLoading } = useGetProduct(productId);

  if (isLoading) return <div className="flex h-64 items-center justify-center">جاري التحميل...</div>;
  if (!product) return <div>منتج غير موجود</div>;

  const chartData = product.priceHistory.map(h => ({
    date: formatDate(h.recordedAt),
    price: h.newPrice
  })).reverse(); // oldest first for chart

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/inventory" className="p-2 bg-card rounded-xl hover:bg-muted transition-colors border shadow-sm">
          <ArrowRight className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">{product.name}</h1>
            <Badge variant={product.stockStatus === 'available' ? 'success' : 'destructive'} className="text-sm">
              {product.currentQuantity} متوفر
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-mono">الكود: {product.code}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" /> مؤشر السعر
          </h3>
          <div className="h-[250px] w-full">
            {chartData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                 <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} domain={['auto', 'auto']} />
                 <Tooltip />
                 <Area type="step" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
               </AreaChart>
             </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-muted-foreground bg-slate-50 rounded-xl">لا توجد بيانات سابقة كافية</div>}
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-6 text-white/90">
            <Package className="w-5 h-5 text-primary" /> بطاقة الصنف
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-white/60">سعر التكلفة الحالي</span>
              <span className="font-bold text-lg">{formatCurrency(product.costPrice)}</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-white/60">سعر البيع</span>
              <span className="font-bold text-lg text-emerald-400">{formatCurrency(product.salePrice)}</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span className="text-white/60">التصنيف</span>
              <span className="font-semibold">{product.category || '-'}</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-white/60">حد الأمان</span>
              <span className="font-semibold text-amber-400">{product.safetyStock} قطع</span>
            </div>
          </div>
          <Button className="w-full mt-6 bg-white/10 hover:bg-white/20 text-white border-none shadow-none">تعديل البيانات</Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="p-4 bg-muted/50 border-b flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h3 className="font-bold">سجل تغيرات السعر</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold">التاريخ</th>
                  <th className="px-4 py-3 font-semibold">المورد</th>
                  <th className="px-4 py-3 font-semibold">السعر القديم</th>
                  <th className="px-4 py-3 font-semibold">السعر الجديد</th>
                  <th className="px-4 py-3 font-semibold">النسبة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {product.priceHistory.map(h => (
                  <tr key={h.id}>
                    <td className="px-4 py-3">{formatDate(h.recordedAt)}</td>
                    <td className="px-4 py-3">{h.supplierName || 'نظام'}</td>
                    <td className="px-4 py-3 text-muted-foreground line-through">{formatCurrency(h.oldPrice)}</td>
                    <td className="px-4 py-3 font-bold text-primary">{formatCurrency(h.newPrice)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${h.changePercent > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                        {h.changePercent > 0 ? '+' : ''}{h.changePercent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 bg-muted/50 border-b flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="font-bold">حركات المخزن (آخر 10)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold">التاريخ</th>
                  <th className="px-4 py-3 font-semibold">النوع</th>
                  <th className="px-4 py-3 font-semibold">الكمية</th>
                  <th className="px-4 py-3 font-semibold">المرجع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {product.movements.slice(0,10).map(m => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">{formatDate(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={m.type === 'in' ? 'success' : m.type === 'out' ? 'destructive' : 'secondary'}>
                        {m.type === 'in' ? 'وارد' : m.type === 'out' ? 'منصرف' : 'تسوية'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-bold" dir="ltr">
                      {m.type === 'in' ? '+' : '-'}{m.quantity}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
