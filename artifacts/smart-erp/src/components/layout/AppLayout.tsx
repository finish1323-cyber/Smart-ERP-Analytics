import React from "react"
import { Link, useLocation } from "wouter"
import { 
  LayoutDashboard, ShoppingCart, Package, Users, 
  FileText, CheckSquare, BarChart, Settings, LogOut, Search, Bell,
  Building2, ChevronDown, ChevronLeft
} from "lucide-react"
import { useGetCurrentUser, useLogout } from "@workspace/api-client-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

type NavItem = {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  children?: { icon: React.ComponentType<{ className?: string }>; label: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "لوحة التحكم", href: "/" },
  {
    icon: ShoppingCart, label: "المشتريات",
    children: [
      { icon: FileText, label: "أوامر الشراء", href: "/purchases" },
      { icon: Building2, label: "الموردون", href: "/suppliers" },
      { icon: BarChart, label: "أفضل الأسعار", href: "/best-prices" },
    ]
  },
  { icon: Package, label: "المخزن والمنتجات", href: "/inventory" },
  { icon: Users, label: "العملاء والمبيعات", href: "/crm" },
  { icon: FileText, label: "فواتير البيع", href: "/sales" },
  { icon: CheckSquare, label: "المهام والأهداف", href: "/tasks" },
  { icon: BarChart, label: "التقارير", href: "/reports" },
  { icon: Settings, label: "الإعدادات", href: "/settings" },
]

const roleLabels: Record<string, string> = {
  admin: "مدير عام",
  procurement: "مشتريات",
  sales: "مبيعات",
  inventory: "مخازن",
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useGetCurrentUser();
  const logout = useLogout();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ "المشتريات": true });

  const isActiveHref = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href))

  const isGroupActive = (item: NavItem) =>
    item.children?.some(c => isActiveHref(c.href)) ?? false

  const toggleGroup = (label: string) =>
    setOpenGroups(g => ({ ...g, [label]: !g[label] }))

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-l border-sidebar-border z-20 shadow-xl shrink-0">
        {/* Logo */}
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border/50">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
            <BarChart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-none">Smart ERP</h1>
            <p className="text-xs text-sidebar-foreground/50 font-medium mt-0.5">نظام إداري ذكي</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            if (item.children) {
              const isOpen = openGroups[item.label] ?? false
              const groupActive = isGroupActive(item)
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm",
                      groupActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="w-4.5 h-4.5 shrink-0" />
                    <span className="flex-1 text-right">{item.label}</span>
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" /> : <ChevronLeft className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                  </button>
                  {isOpen && (
                    <div className="mr-4 mt-0.5 space-y-0.5 border-r-2 border-sidebar-border/40 pr-2">
                      {item.children.map(child => {
                        const childActive = isActiveHref(child.href)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all duration-200 text-sm",
                              childActive
                                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                            )}
                          >
                            <child.icon className="w-4 h-4 shrink-0" />
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const isActive = isActiveHref(item.href!)
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 group text-sm",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("w-4.5 h-4.5 shrink-0 transition-transform duration-200", isActive ? "scale-110" : "group-hover:scale-105")} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-sidebar-border/50">
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-sidebar-accent/40 rounded-xl border border-sidebar-border/40">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {user?.name?.charAt(0) || "؟"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate leading-none">{user?.name || "مستخدم"}</p>
              <p className="text-xs text-sidebar-foreground/50 mt-0.5">{roleLabels[user?.role || ""] || user?.role || ""}</p>
            </div>
            <button
              onClick={() => logout.mutate(undefined, { onSuccess: () => window.location.href = '/login' })}
              className="p-1.5 hover:bg-sidebar-accent rounded-lg text-sidebar-foreground/50 hover:text-destructive transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث سريع..."
                className="w-full pl-4 pr-9 py-2 bg-muted/50 border border-transparent rounded-xl text-sm focus:bg-background focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
