import { useState } from "react"
import { useListProducts, useCreateProduct } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, Button, Input, Badge, Dialog, Label } from "@/components/ui/shared"
import { formatCurrency } from "@/lib/utils"
import { Plus, Search, Filter, AlertCircle, PackageCheck, PackageX, Eye } from "lucide-react"
import { Link } from "wouter"

export function Products() {
  const { data: products } = useListProducts();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const getStockBadge = (status: string) => {
    switch(status) {
      case 'available': return <Badge variant="success"><PackageCheck className="w-3 h-3 ml-1"/> متوفر</Badge>;
      case 'low': return <Badge variant="warning"><AlertCircle className="w-3 h-3 ml-1"/> قارب على النفاذ</Badge>;
      case 'out': return <Badge variant="destructive"><PackageX className="w-3 h-3 ml-1"/> نفذت الكمية</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  }

  const filtered = products?.filter(p => p.name.includes(search) || p.code.includes(search)) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">المخزن والمنتجات</h1>
          <p className="text-muted-foreground mt-1">إدارة الأرصدة وتسعير المنتجات</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-5 h-5" /> إضافة منتج جديد
        </Button>
      </div>

      <Card className="p-4 flex gap-4 bg-white/50 border-dashed">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="بحث بالاسم أو الكود..." 
            className="pl-4 pr-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2 shrink-0">
          <Filter className="w-4 h-4" /> تصفية
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">الكود</th>
                <th className="px-6 py-4 font-semibold">المنتج</th>
                <th className="px-6 py-4 font-semibold">التصنيف</th>
                <th className="px-6 py-4 font-semibold">الكمية</th>
                <th className="px-6 py-4 font-semibold">الحالة</th>
                <th className="px-6 py-4 font-semibold">سعر التكلفة</th>
                <th className="px-6 py-4 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((product) => (
                <tr key={product.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4 font-mono font-medium text-slate-500">{product.code}</td>
                  <td className="px-6 py-4 font-bold text-foreground">{product.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{product.category || '-'}</td>
                  <td className="px-6 py-4 font-semibold text-lg">{product.currentQuantity}</td>
                  <td className="px-6 py-4">{getStockBadge(product.stockStatus)}</td>
                  <td className="px-6 py-4 font-medium">{formatCurrency(product.costPrice)}</td>
                  <td className="px-6 py-4">
                    <Link href={`/inventory/products/${product.id}`} className="text-primary hover:text-primary/80 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-4 h-4" /> التفاصيل
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    لا توجد منتجات تطابق البحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <CreateProductDialog isOpen={isCreateOpen} onClose={() => {
        setIsCreateOpen(false)
        queryClient.invalidateQueries({ queryKey: ["/api/products"] })
      }} />
    </div>
  )
}

function CreateProductDialog({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const create = useCreateProduct();
  const [formData, setFormData] = useState({ code: '', name: '', category: '', costPrice: 0, salePrice: 0, safetyStock: 10 });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate({ data: formData }, {
      onSuccess: () => {
        onClose();
        // Reset form ideally
      }
    });
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="إضافة منتج جديد">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>الكود</Label><Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} required /></div>
          <div><Label>اسم المنتج</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
          <div><Label>التصنيف</Label><Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} /></div>
          <div><Label>حد الأمان</Label><Input type="number" value={formData.safetyStock} onChange={e => setFormData({...formData, safetyStock: Number(e.target.value)})} required /></div>
          <div><Label>سعر التكلفة</Label><Input type="number" step="0.01" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: Number(e.target.value)})} required /></div>
          <div><Label>سعر البيع</Label><Input type="number" step="0.01" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: Number(e.target.value)})} required /></div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" isLoading={create.isPending}>حفظ المنتج</Button>
        </div>
      </form>
    </Dialog>
  )
}
