import { useListPurchaseOrders } from "@workspace/api-client-react"
import { Card, Badge, Button, Input } from "@/components/ui/shared"
import { Plus, Search, FileText, CheckCircle2, Clock, XCircle } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

export function PurchaseOrders() {
  const { data: pos } = useListPurchaseOrders();

  const getStatusProps = (status: string) => {
    switch(status) {
      case 'received': return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100", text: "تم الاستلام" };
      case 'partial': return { icon: Clock, color: "text-blue-600", bg: "bg-blue-100", text: "استلام جزئي" };
      case 'cancelled': return { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", text: "ملغي" };
      default: return { icon: Clock, color: "text-amber-600", bg: "bg-amber-100", text: "معلق" };
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">أوامر الشراء</h1>
          <p className="text-muted-foreground mt-1">إدارة طلبات التوريد والاستلامات الفعيلة</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-5 h-5" /> أمر شراء ذكي
        </Button>
      </div>

      <Card className="p-4 flex gap-4 bg-white/50 border-dashed">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="بحث برقم الأمر أو المورد..." className="pl-4 pr-10" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {pos?.map(po => {
          const status = getStatusProps(po.status);
          const StatusIcon = status.icon;
          return (
            <Card key={po.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${status.bg} ${status.color}`}>
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">#{po.orderNumber}</h3>
                    <Badge variant="outline" className={`${status.bg} border-none ${status.color}`}>
                      <StatusIcon className="w-3 h-3 ml-1" /> {status.text}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground font-medium">{po.supplierName}</p>
                </div>
              </div>
              
              <div className="flex flex-col md:items-end gap-2 md:w-48 shrink-0 border-t md:border-t-0 md:border-r border-border pt-4 md:pt-0 md:pr-6 w-full">
                <span className="text-xs text-muted-foreground">الإجمالي الصافي</span>
                <span className="font-extrabold text-xl text-foreground">{formatCurrency(po.netAmount)}</span>
                <span className="text-xs text-muted-foreground">{formatDate(po.createdAt)}</span>
              </div>

              <div className="w-full md:w-auto flex gap-2">
                <Button variant="secondary" className="flex-1 md:flex-none">عرض</Button>
                {po.status === 'pending' && <Button className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700">استلام فعلي</Button>}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
