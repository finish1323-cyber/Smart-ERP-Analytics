import React from "react"
import { Link, useLocation } from "wouter"
import { 
  LayoutDashboard, ShoppingCart, Package, Users, 
  FileText, CheckSquare, Target, BarChart, Settings, LogOut, Search, Bell
} from "lucide-react"
import { useGetCurrentUser, useLogout } from "@workspace/api-client-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "لوحة التحكم", href: "/" },
  { icon: ShoppingCart, label: "المشتريات والموردين", href: "/purchases" },
  { icon: Package, label: "المخزن والمنتجات", href: "/inventory" },
  { icon: Users, label: "العملاء والمبيعات", href: "/crm" },
  { icon: FileText, label: "فواتير البيع", href: "/sales" },
  { icon: CheckSquare, label: "المهام", href: "/tasks" },
  { icon: Target, label: "أهداف البيع", href: "/targets" },
  { icon: BarChart, label: "التقارير", href: "/reports" },
  { icon: Settings, label: "الإعدادات", href: "/settings" },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useGetCurrentUser();
  const logout = useLogout();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <aside className="w-72 bg-sidebar text-sidebar-foreground flex flex-col border-l border-sidebar-border transition-all duration-300 z-20 shadow-xl">
        <div className="p-6 flex items-center gap-4 border-b border-sidebar-border/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <BarChart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">Smart ERP</h1>
            <p className="text-xs text-sidebar-foreground/60 font-medium">Enterprise Edition</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
                <item.icon className={cn("w-5 h-5 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-110")} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 px-4 py-3 bg-sidebar-accent/50 rounded-xl border border-sidebar-border">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user?.name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{user?.role || "Role"}</p>
            </div>
            <button 
              onClick={() => logout.mutate(undefined, { onSuccess: () => window.location.href = '/login' })}
              className="p-2 hover:bg-sidebar-accent rounded-lg text-sidebar-foreground/60 hover:text-destructive transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-card border-b border-border flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="بحث سريع (رقم فاتورة، اسم عميل، كود منتج)..." 
                className="w-full pl-4 pr-10 py-2.5 bg-muted/50 border-transparent rounded-xl text-sm focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2.5 text-muted-foreground hover:bg-muted rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
