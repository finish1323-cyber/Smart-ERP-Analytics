import { useEffect, useRef, useState } from "react"
import { useGetCompany, useUpdateCompany } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Building2, Upload, ImageIcon, Save, Trash2 } from "lucide-react"

export function Settings() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: company } = useGetCompany() as any
  const updateMutation = useUpdateCompany()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: "",
    businessType: "",
    address: "",
    phone: "",
    commercialRegister: "",
    taxCard: "",
    currency: "EGP",
    logoUrl: "",
    defaultSafetyStock: 10,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        businessType: company.businessType ?? "",
        address: company.address ?? "",
        phone: company.phone ?? "",
        commercialRegister: company.commercialRegister ?? "",
        taxCard: company.taxCard ?? "",
        currency: company.currency ?? "EGP",
        logoUrl: company.logoUrl ?? "",
        defaultSafetyStock: company.defaultSafetyStock ?? 10,
      })
    }
  }, [company])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) {
      toast({ title: "حجم اللوجو كبير", description: "أقصى حجم مسموح 500 كيلوبايت", variant: "destructive" })
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      setForm(f => ({ ...f, logoUrl: String(ev.target?.result ?? "") }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "خطأ", description: "اسم الشركة مطلوب", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await updateMutation.mutateAsync({ data: form as any })
      toast({ title: "تم الحفظ", description: "تم تحديث بيانات الشركة بنجاح" })
      queryClient.invalidateQueries({ queryKey: ["company"] })
    } catch {
      toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">إعدادات الشركة</h1>
        <p className="text-muted-foreground mt-1">بيانات الشركة واللوجو اللي بيظهروا في الفواتير والتقارير</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="w-5 h-5 text-primary" /> هوية الشركة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 shrink-0">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <Building2 className="w-12 h-12 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold">لوجو الشركة</p>
              <p className="text-sm text-muted-foreground mt-1 mb-3">صيغ: PNG / JPG / SVG — أقصى حجم 500KB</p>
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleLogoUpload} className="hidden" />
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" /> رفع لوجو
                </Button>
                {form.logoUrl && (
                  <Button variant="outline" className="gap-2 text-destructive" onClick={() => setForm(f => ({ ...f, logoUrl: "" }))}>
                    <Trash2 className="w-4 h-4" /> إزالة
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5 text-primary" /> البيانات الأساسية
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="font-semibold">اسم الشركة *</Label>
            <Input className="mt-1.5" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label className="font-semibold">نشاط الشركة</Label>
            <Input className="mt-1.5" value={form.businessType} onChange={e => setForm({ ...form, businessType: e.target.value })} placeholder="تجارة - صناعة - خدمات..." />
          </div>
          <div>
            <Label className="font-semibold">رقم الهاتف</Label>
            <Input className="mt-1.5" dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label className="font-semibold">العملة</Label>
            <Input className="mt-1.5" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label className="font-semibold">العنوان</Label>
            <Input className="mt-1.5" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label className="font-semibold">السجل التجاري</Label>
            <Input className="mt-1.5" value={form.commercialRegister} onChange={e => setForm({ ...form, commercialRegister: e.target.value })} />
          </div>
          <div>
            <Label className="font-semibold">البطاقة الضريبية</Label>
            <Input className="mt-1.5" value={form.taxCard} onChange={e => setForm({ ...form, taxCard: e.target.value })} />
          </div>
          <div>
            <Label className="font-semibold">الحد الأدنى الافتراضي للمخزون</Label>
            <Input
              className="mt-1.5"
              type="number"
              min="0"
              value={form.defaultSafetyStock}
              onChange={e => setForm({ ...form, defaultSafetyStock: parseInt(e.target.value) || 0 })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" className="gap-2" onClick={handleSave} disabled={saving}>
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          حفظ التغييرات
        </Button>
      </div>
    </div>
  )
}
