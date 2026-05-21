import React, { useEffect } from "react"
import { Link, useLocation } from "wouter"
import {
  LayoutDashboard, ShoppingCart, Package, Users,
  FileText, CheckSquare, BarChart, Settings, LogOut, Search, Bell,
  Building2, ChevronDown, ChevronLeft, Wallet, MessageSquare, Globe, Bot
} from "lucide-react"
import { useGetCurrentUser, useLogout } from "@workspace/api-client-react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import i18n from "@/i18n"
import { cn } from "@/lib/utils"
import { useState } from "react"

type NavChild = { icon: React.ComponentType<{ className?: string }>; labelKey: string; href: string }
type NavItem = {
  icon: React.ComponentType<{ className?: string }>
  labelKey: string
  href?: string
  children?: NavChild[]
}

const NAV_SCHEMA: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "nav.dashboard", href: "/" },
  {
    icon: ShoppingCart, labelKey: "nav.purchases",
    children: [
      { icon: FileText, labelKey: "nav.purchaseOrders", href: "/purchases" },
      { icon: Building2, labelKey: "nav.suppliers", href: "/suppliers" },
      { icon: BarChart, labelKey: "nav.bestPrices", href: "/best-prices" },
      { icon: Wallet, labelKey: "nav.payments", href: "/payments" },
    ]
  },
  { icon: Package, labelKey: "nav.inventory", href: "/inventory" },
  { icon: Users, labelKey: "nav.crm", href: "/crm" },
  { icon: FileText, labelKey: "nav.sales", href: "/sales" },
  { icon: CheckSquare, labelKey: "nav.tasks", href: "/tasks" },
  { icon: BarChart, labelKey: "nav.reports", href: "/reports" },
  { icon: MessageSquare, labelKey: "nav.chat", href: "/chat" },
  { icon: Bot, labelKey: "nav.ai", href: "/ai" },
  { icon: Settings, labelKey: "nav.settings", href: "/settings" },
]

const roleLabels: Record<string, string> = {
  admin: "مدير عام",
  procurement: "مشتريات",
  sales: "مبيعات",
  inventory: "مخازن",
}

const apiFetch = (path: string) =>
  fetch(`/api${path}`, { credentials: "include" }).then(r => r.ok ? r.json() : null)

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { data: user } = useGetCurrentUser()
  const logout = useLogout()
  const { t, i18n: i18nInst } = useTranslation()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ "nav.purchases": true })

  const isRtl = i18nInst.language === "ar"

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr"
    document.documentElement.lang = i18nInst.language
  }, [isRtl, i18nInst.language])

  const toggleLang = () => {
    const next = i18nInst.language === "ar" ? "en" : "ar"
    i18n.changeLanguage(next)
    localStorage.setItem("erp-lang", next)
  }

  const { data: notifData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: () => apiFetch("/notifications/unread-count"),
    refetchInterval: 30000,
  })
  const notifCount: number = notifData?.count ?? 0

  const { data: chatUnread } = useQuery({
    queryKey: ["chat-unread"],
    queryFn: () => apiFetch("/chat/unread-counts"),
    refetchInterval: 5000,
  })
  const totalChatUnread: number =
    (chatUnread?.dmUnread ?? 0) +
    Object.values((chatUnread?.channelUnread ?? {}) as Record<string, number>).reduce((a: number, b: number) => a + b, 0)

  const isActiveHref = (href: string) =>
    location === href || (href !== "/" && location.startsWith(href))

  const isGroupActive = (item: NavItem) =>
    item.children?.some(c => isActiveHref(c.href)) ?? false

  const toggleGroup = (key: string) =>
    setOpenGroups(g => ({ ...g, [key]: !g[key] }))

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
      {/* Sidebar */}
      <aside className={cn(
        "w-64 bg-sidebar text-sidebar-foreground flex flex-col z-20 shadow-xl shrink-0",
        isRtl ? "border-l border-sidebar-border" : "border-r border-sidebar-border"
      )}>
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
          {NAV_SCHEMA.map((item) => {
            if (item.children) {
              const isOpen = openGroups[item.labelKey] ?? false
              const groupActive = isGroupActive(item)
              return (
                <div key={item.labelKey}>
                  <button
                    onClick={() => toggleGroup(item.labelKey)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all duration-200 text-sm",
                      groupActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="w-4.5 h-4.5 shrink-0" />
                    <span className="flex-1 text-right">{t(item.labelKey)}</span>
                    {isOpen
                      ? <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      : <ChevronLeft className="w-3.5 h-3.5 shrink-0 opacity-60" />}
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
                            {t(child.labelKey)}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            const isActive = isActiveHref(item.href!)
            const isChatItem = item.href === "/chat"
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
                <span className="flex-1">{t(item.labelKey)}</span>
                {isChatItem && totalChatUnread > 0 && (
                  <span className="bg-destructive text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {totalChatUnread > 99 ? "99+" : totalChatUnread}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-sidebar-border/50 space-y-2">
          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-right">{t("lang.toggle")}</span>
            <span className="text-[10px] bg-sidebar-accent/60 rounded px-1.5 py-0.5">{t("lang.current")}</span>
          </button>

          {/* User Info */}
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
              <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRtl ? "right-3" : "left-3")} />
              <input
                type="text"
                placeholder="بحث سريع..."
                className={cn(
                  "w-full py-2 bg-muted/50 border border-transparent rounded-xl text-sm focus:bg-background focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all outline-none",
                  isRtl ? "pl-4 pr-9" : "pr-4 pl-9"
                )}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications">
              <button className="relative p-2 text-muted-foreground hover:bg-muted rounded-xl transition-colors">
                <Bell className="w-5 h-5" />
                {notifCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-card">
                    {notifCount > 99 ? "99+" : notifCount}
                  </span>
                )}
              </button>
            </Link>
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
