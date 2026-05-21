import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Bell, CheckCheck, Info, AlertTriangle, ShoppingCart,
  TrendingUp, CheckSquare, Settings2, Loader2
} from "lucide-react"

const apiFetch = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

type Notif = {
  id: number
  title: string
  body?: string
  type: string
  isRead: boolean
  relatedType?: string
  createdAt: string
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return "الآن"
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`
  return `منذ ${Math.floor(diff / 86400)} يوم`
}

const typeIcon: Record<string, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-blue-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  purchase: <ShoppingCart className="w-4 h-4 text-emerald-500" />,
  sales: <TrendingUp className="w-4 h-4 text-primary" />,
  task: <CheckSquare className="w-4 h-4 text-purple-500" />,
  system: <Settings2 className="w-4 h-4 text-slate-500" />,
}

const typeBg: Record<string, string> = {
  info: "bg-blue-50",
  warning: "bg-amber-50",
  purchase: "bg-emerald-50",
  sales: "bg-primary/10",
  task: "bg-purple-50",
  system: "bg-slate-100",
}

export function Notifications() {
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery<Notif[]>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/notifications"),
    refetchInterval: 15000,
  })

  const readAllMutation = useMutation({
    mutationFn: () => apiFetch("/notifications/read-all", { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] })
    },
  })

  const readOneMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] })
    },
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            الإشعارات
            {unreadCount > 0 && (
              <Badge className="bg-destructive text-white border-none text-sm px-2">
                {unreadCount} جديد
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">متابعة آخر الأحداث والتنبيهات في النظام</p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
          >
            {readAllMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCheck className="w-4 h-4" />
            }
            تمييز الكل كمقروء
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-4">
            <Bell className="w-10 h-10 text-primary/20" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">لا توجد إشعارات</h3>
          <p className="text-sm">ستظهر هنا الأحداث المهمة في النظام</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Unread section */}
          {notifications.some(n => !n.isRead) && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">غير مقروء</p>
              <div className="space-y-1.5">
                {notifications.filter(n => !n.isRead).map(notif => (
                  <NotifCard
                    key={notif.id}
                    notif={notif}
                    onRead={() => readOneMutation.mutate(notif.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Read section */}
          {notifications.some(n => n.isRead) && (
            <div className="mt-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">مقروء</p>
              <div className="space-y-1.5">
                {notifications.filter(n => n.isRead).map(notif => (
                  <NotifCard key={notif.id} notif={notif} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotifCard({ notif, onRead }: { notif: Notif; onRead?: () => void }) {
  const icon = typeIcon[notif.type] ?? typeIcon.info
  const bg = typeBg[notif.type] ?? typeBg.info

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border transition-all",
        notif.isRead
          ? "bg-white border-border/50 opacity-75"
          : "bg-white border-primary/20 shadow-xs ring-1 ring-primary/10"
      )}
      onClick={() => { if (!notif.isRead && onRead) onRead() }}
      style={{ cursor: !notif.isRead && onRead ? "pointer" : "default" }}
    >
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", bg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-semibold leading-snug", !notif.isRead && "text-foreground")}>
            {notif.title}
          </p>
          {!notif.isRead && (
            <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
          )}
        </div>
        {notif.body && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
        )}
        <p className="text-xs text-muted-foreground/60 mt-1.5">{timeAgo(notif.createdAt)}</p>
      </div>
    </div>
  )
}
