import { useListCustomers } from "@workspace/api-client-react"
import { Card, Badge, Button, Input } from "@/components/ui/shared"
import { Search, Plus, Star, User, Phone, MapPin } from "lucide-react"

export function Customers() {
  const { data: customers, isLoading } = useListCustomers();

  const getClassBadge = (cls: string) => {
    switch(cls) {
      case 'vip': return <Badge className="bg-amber-400 hover:bg-amber-500 text-amber-950 border-amber-300 shadow-sm shadow-amber-400/20"><Star className="w-3 h-3 ml-1 fill-current"/> VIP</Badge>;
      case 'new': return <Badge variant="secondary" className="bg-blue-100 text-blue-700">جديد</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground">متوقف</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">العملاء (CRM)</h1>
          <p className="text-muted-foreground mt-1">إدارة بيانات العملاء وتحليل المبيعات</p>
        </div>
        <Button className="gap-2 shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-transform">
          <Plus className="w-5 h-5" /> عميل جديد
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input placeholder="البحث بالاسم أو التليفون..." className="pl-4 pr-12 h-12 rounded-xl shadow-sm text-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {isLoading ? (
          [1,2,3,4].map(i => <Card key={i} className="h-48 animate-pulse bg-muted/50" />)
        ) : customers?.map(customer => (
          <Card key={customer.id} className="group hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
                  {customer.name.charAt(0)}
                </div>
                {getClassBadge(customer.classification)}
              </div>
              <h3 className="font-bold text-lg text-foreground mb-1">{customer.name}</h3>
              <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1.5"><User className="w-4 h-4"/> {customer.businessType || 'أفراد'}</p>
              
              <div className="space-y-2 text-sm text-slate-600 mb-6 border-t border-border pt-4">
                {customer.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400"/> {customer.phone}</p>}
                {customer.address && <p className="flex items-center gap-2 truncate"><MapPin className="w-4 h-4 text-slate-400 shrink-0"/> <span className="truncate">{customer.address}</span></p>}
              </div>

              <Button variant="secondary" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                عرض الملف
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
