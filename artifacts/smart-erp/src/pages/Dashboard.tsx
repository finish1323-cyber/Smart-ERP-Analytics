import { useGetDashboardStats, useGetSalesChart, useGetRecentActivity } from "@workspace/api-client-react"
import { Card, Badge } from "@/components/ui/shared"
import { formatCurrency, formatDate } from "@/lib/utils"
import { TrendingUp, ShoppingBag, Users, AlertTriangle, ArrowUpRight } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function Dashboard() {
  const { data: stats } = useGetDashboardStats();
  const { data: chartData } = useGetSalesChart();
  const { data: activities } = useGetRecentActivity();

  const StatCard = ({ title, value, icon: Icon, color, alert }: any) => (
    <Card className="p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 duration-500 ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-muted-foreground mb-1">{title}</p>
          <h3 className={`text-3xl font-extrabold ${alert ? 'text-destructive' : 'text-foreground'}`}>
            {value}
          </h3>
        </div>
        <div className={`p-3 rounded-2xl ${color} bg-opacity-15 text-opacity-100`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">نظرة عامة</h1>
          <p className="text-muted-foreground mt-1">مرحباً بك، إليك ملخص لأداء العمل اليوم.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="مبيعات اليوم" 
          value={formatCurrency(stats?.totalSalesToday || 0)} 
          icon={TrendingUp} 
          color="bg-emerald-500 text-emerald-600 dark:text-emerald-400" 
        />
        <StatCard 
          title="مبيعات الشهر" 
          value={formatCurrency(stats?.totalSalesMonth || 0)} 
          icon={TrendingUp} 
          color="bg-primary text-primary" 
        />
        <StatCard 
          title="أوامر شراء معلقة" 
          value={stats?.pendingPurchaseOrders || 0} 
          icon={ShoppingBag} 
          color="bg-amber-500 text-amber-600 dark:text-amber-400" 
        />
        <StatCard 
          title="أصناف تحت حد الأمان" 
          value={stats?.lowStockCount || 0} 
          icon={AlertTriangle} 
          color="bg-destructive text-destructive" 
          alert={!!(stats?.lowStockCount && stats.lowStockCount > 0)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2 shadow-sm border-border/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">المبيعات خلال الأسبوع</h3>
            <Badge variant="secondary">آخر 7 أيام</Badge>
          </div>
          <div className="h-[300px] w-full">
            {chartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="amount" name="المبيعات" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">جاري التحميل...</div>
            )}
          </div>
        </Card>

        <Card className="p-0 overflow-hidden shadow-sm border-border/50 flex flex-col">
          <div className="p-6 border-b border-border/50 bg-slate-50/50">
            <h3 className="text-lg font-bold flex items-center gap-2">
              سجل الحركات الأخيرة
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </h3>
          </div>
          <div className="p-0 flex-1 overflow-y-auto">
            {activities?.map((activity, i) => (
              <div key={activity.id} className={`p-4 flex gap-4 hover:bg-muted/50 transition-colors ${i !== activities.length - 1 ? 'border-b border-border/30' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{activity.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-semibold">{activity.userName}</span>
                    <span>•</span>
                    <span>{formatDate(activity.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
