import { useEffect } from "react"
import { useRoute } from "wouter"
import { useGetPurchaseOrder, useGetCompany } from "@workspace/api-client-react"
import { formatCurrency, formatDate } from "@/lib/utils"

export function PrintPO() {
  const [, params] = useRoute("/print/po/:id")
  const id = params?.id ? parseInt(params.id) : 0
  const { data: po } = useGetPurchaseOrder(id, { query: { enabled: !!id } }) as any
  const { data: company } = useGetCompany() as any

  useEffect(() => {
    if (po && company) {
      const t = setTimeout(() => window.print(), 600)
      return () => clearTimeout(t)
    }
    return undefined
  }, [po, company])

  if (!po) {
    return <div className="p-10 text-center text-muted-foreground">جاري التحميل...</div>
  }

  const items = po.items ?? []

  return (
    <div className="min-h-screen bg-white text-slate-900 print:bg-white" dir="rtl" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="max-w-[210mm] mx-auto p-8 print:p-0">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-4">
            {company?.logoUrl && (
              <img src={company.logoUrl} alt="logo" className="w-20 h-20 object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{company?.name ?? "اسم الشركة"}</h1>
              {company?.businessType && <p className="text-sm text-slate-600 mt-0.5">{company.businessType}</p>}
              {company?.address && <p className="text-xs text-slate-500 mt-1">{company.address}</p>}
              {company?.phone && <p className="text-xs text-slate-500" dir="ltr">📞 {company.phone}</p>}
            </div>
          </div>
          <div className="text-left">
            <h2 className="text-3xl font-extrabold text-blue-700">أمر شراء</h2>
            <p className="text-sm text-slate-600 mt-1">رقم: <span className="font-bold">{po.orderNumber}</span></p>
            <p className="text-sm text-slate-600">التاريخ: {formatDate(po.createdAt)}</p>
            <p className="text-sm mt-1">
              الحالة: <span className="font-semibold">
                {po.status === "pending" ? "معلق" : po.status === "partial" ? "استلام جزئي" : po.status === "received" ? "تم الاستلام" : "ملغي"}
              </span>
            </p>
          </div>
        </div>

        {/* Supplier */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
          <p className="text-xs font-bold text-slate-500 mb-2">بيانات المورد</p>
          <p className="text-lg font-bold">{po.supplierName ?? "—"}</p>
        </div>

        {/* Items table */}
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="bg-blue-700 text-white">
              <th className="border border-blue-800 p-2 text-right w-10">م</th>
              <th className="border border-blue-800 p-2 text-right">كود الصنف</th>
              <th className="border border-blue-800 p-2 text-right">اسم الصنف</th>
              <th className="border border-blue-800 p-2 text-center w-20">الكمية</th>
              <th className="border border-blue-800 p-2 text-center w-24">سعر الوحدة</th>
              <th className="border border-blue-800 p-2 text-center w-28">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={it.id} className="even:bg-slate-50">
                <td className="border border-slate-300 p-2 text-center">{i + 1}</td>
                <td className="border border-slate-300 p-2">{it.productCode}</td>
                <td className="border border-slate-300 p-2">{it.productName}</td>
                <td className="border border-slate-300 p-2 text-center">{it.orderedQuantity}</td>
                <td className="border border-slate-300 p-2 text-center">{formatCurrency(it.unitPrice)}</td>
                <td className="border border-slate-300 p-2 text-center font-semibold">{formatCurrency(it.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-72 space-y-1.5 text-sm">
            <div className="flex justify-between py-1.5 border-b border-slate-200">
              <span className="text-slate-600">المجموع الفرعي</span>
              <span className="font-semibold">{formatCurrency(po.totalAmount)}</span>
            </div>
            {po.discountPercent > 0 && (
              <div className="flex justify-between py-1.5 border-b border-slate-200 text-emerald-700">
                <span>الخصم ({po.discountPercent}%)</span>
                <span className="font-semibold">-{formatCurrency(po.totalAmount * po.discountPercent / 100)}</span>
              </div>
            )}
            {po.taxPercent > 0 && (
              <div className="flex justify-between py-1.5 border-b border-slate-200 text-amber-700">
                <span>الضريبة ({po.taxPercent}%)</span>
                <span className="font-semibold">+{formatCurrency(po.netAmount - po.totalAmount * (1 - po.discountPercent / 100))}</span>
              </div>
            )}
            <div className="flex justify-between py-2 mt-2 bg-blue-700 text-white px-3 rounded">
              <span className="font-bold">الإجمالي النهائي</span>
              <span className="font-extrabold text-lg">{formatCurrency(po.netAmount)}</span>
            </div>
          </div>
        </div>

        {po.notes && (
          <div className="border-t border-slate-200 pt-4 mb-6">
            <p className="text-xs font-bold text-slate-500 mb-1">ملاحظات</p>
            <p className="text-sm">{po.notes}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-4 mt-12 pt-8">
          <div className="text-center">
            <div className="border-t border-slate-400 pt-2">
              <p className="text-xs font-semibold">المسؤول عن المشتريات</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-400 pt-2">
              <p className="text-xs font-semibold">المدير المالي</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-400 pt-2">
              <p className="text-xs font-semibold">المورد</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 mt-12 border-t border-slate-200 pt-3">
          {company?.commercialRegister && <span>س.ت: {company.commercialRegister} </span>}
          {company?.taxCard && <span>| ب.ض: {company.taxCard}</span>}
        </div>

        {/* Print button (hidden when printing) */}
        <div className="no-print fixed bottom-6 left-6 flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-5 py-2.5 bg-blue-700 text-white rounded-lg font-semibold shadow-lg hover:bg-blue-800"
          >
            طباعة / حفظ PDF
          </button>
          <button
            onClick={() => window.close()}
            className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}
