import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useGetCurrentUser } from "@workspace/api-client-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  MessageSquare, Send, Hash, Plus, User2, Users,
  Loader2, X, Search
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog"

const api = (path: string) => `/api${path}`

const apiFetch = async (path: string, opts?: RequestInit) => {
  const r = await fetch(api(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

type Channel = { id: number; name: string; description?: string; type: string; unreadCount: number }
type Message = { id: number; content: string; fromUserId: number; fromUserName: string; createdAt: string; isRead: boolean }
type CompanyUser = { id: number; name: string; email: string; role: string }

type ActiveChat =
  | { kind: "channel"; id: number; name: string }
  | { kind: "dm"; userId: number; name: string }

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
}

function formatDay(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return "اليوم"
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return "أمس"
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })
}

export function Chat() {
  const { data: currentUser } = useGetCurrentUser()
  const queryClient = useQueryClient()

  const [active, setActive] = useState<ActiveChat | null>(null)
  const [input, setInput] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelDesc, setNewChannelDesc] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: channels = [], refetch: refetchChannels } = useQuery<Channel[]>({
    queryKey: ["chat-channels"],
    queryFn: () => apiFetch("/chat/channels"),
    refetchInterval: 5000,
  })

  const { data: companyUsers = [] } = useQuery<CompanyUser[]>({
    queryKey: ["company-users"],
    queryFn: () => apiFetch("/users"),
  })

  const { data: unreadCounts } = useQuery<{ dmUnread: number; channelUnread: Record<number, number> }>({
    queryKey: ["chat-unread"],
    queryFn: () => apiFetch("/chat/unread-counts"),
    refetchInterval: 5000,
  })

  const messagesQueryKey = active
    ? active.kind === "channel"
      ? ["chat-messages-channel", active.id]
      : ["chat-messages-dm", active.userId]
    : null

  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: messagesQueryKey ?? ["chat-messages-none"],
    queryFn: () => {
      if (!active) return Promise.resolve([])
      if (active.kind === "channel") return apiFetch(`/chat/channels/${active.id}/messages`)
      return apiFetch(`/chat/dm/${active.userId}`)
    },
    enabled: !!active,
    refetchInterval: 3000,
  })

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!active) return
      if (active.kind === "channel") {
        return apiFetch(`/chat/channels/${active.id}/messages`, { method: "POST", body: JSON.stringify({ content }) })
      }
      return apiFetch(`/chat/dm/${active.userId}`, { method: "POST", body: JSON.stringify({ content }) })
    },
    onSuccess: () => {
      if (messagesQueryKey) queryClient.invalidateQueries({ queryKey: messagesQueryKey })
      queryClient.invalidateQueries({ queryKey: ["chat-channels"] })
      queryClient.invalidateQueries({ queryKey: ["chat-unread"] })
    },
  })

  const createChannelMutation = useMutation({
    mutationFn: () => apiFetch("/chat/channels", { method: "POST", body: JSON.stringify({ name: newChannelName, description: newChannelDesc }) }),
    onSuccess: (ch: Channel) => {
      refetchChannels()
      setShowNewChannel(false)
      setNewChannelName("")
      setNewChannelDesc("")
      setActive({ kind: "channel", id: ch.id, name: ch.name })
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (active && messagesQueryKey) {
      queryClient.invalidateQueries({ queryKey: ["chat-channels"] })
      queryClient.invalidateQueries({ queryKey: ["chat-unread"] })
    }
  }, [active])

  const handleSend = () => {
    const content = input.trim()
    if (!content) return
    setInput("")
    sendMutation.mutate(content)
  }

  const otherUsers = companyUsers.filter((u: CompanyUser) => u.id !== currentUser?.id)
  const filteredUsers = otherUsers.filter((u: CompanyUser) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  )

  // Group messages by day
  const groupedMessages: { day: string; msgs: Message[] }[] = []
  for (const msg of messages) {
    const day = formatDay(msg.createdAt)
    const last = groupedMessages[groupedMessages.length - 1]
    if (last && last.day === day) last.msgs.push(msg)
    else groupedMessages.push({ day, msgs: [msg] })
  }

  const totalDmUnread = unreadCounts?.dmUnread ?? 0

  return (
    <div className="flex h-[calc(100vh-8rem)] -m-2 rounded-2xl overflow-hidden border border-border shadow-sm bg-white">
      {/* ===== SIDEBAR ===== */}
      <aside className="w-72 bg-slate-50 border-l border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-base flex items-center gap-2">
              <MessageSquare className="w-4.5 h-4.5 text-primary" /> الشات الداخلي
            </h2>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Channels */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">القنوات</span>
              <button
                onClick={() => setShowNewChannel(true)}
                className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                title="قناة جديدة"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {channels.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                  لا توجد قنوات — أنشئ واحدة!
                </p>
              )}
              {channels.map((ch) => {
                const chUnread = unreadCounts?.channelUnread?.[ch.id] ?? ch.unreadCount
                const isActive = active?.kind === "channel" && active.id === ch.id
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActive({ kind: "channel", id: ch.id, name: ch.name })}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors text-right",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                    )}
                  >
                    <Hash className="w-3.5 h-3.5 shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{ch.name}</span>
                    {chUnread > 0 && (
                      <Badge className="bg-destructive text-white text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center border-none">
                        {chUnread}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* DMs */}
          <div className="p-3 pt-1">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                رسائل مباشرة
                {totalDmUnread > 0 && (
                  <Badge className="bg-destructive text-white text-xs px-1.5 py-0 h-4 border-none">
                    {totalDmUnread}
                  </Badge>
                )}
              </span>
            </div>
            <div className="mb-2">
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="ابحث عن موظف..."
                  className="h-7 text-xs pr-7 bg-white"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              {filteredUsers.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-2 text-center">لا يوجد مستخدمون آخرون</p>
              )}
              {filteredUsers.map((u: CompanyUser) => {
                const isActive = active?.kind === "dm" && active.userId === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setActive({ kind: "dm", userId: u.id, name: u.name })}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                    )}>
                      {u.name.charAt(0)}
                    </div>
                    <span className="flex-1 truncate text-right">{u.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </ScrollArea>
      </aside>

      {/* ===== MAIN CHAT AREA ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-10 h-10 text-primary/40" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">مرحباً في الشات الداخلي</h3>
            <p className="text-sm max-w-xs">اختر قناة من القائمة أو ابدأ محادثة مباشرة مع أحد الموظفين</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-white">
              {active.kind === "channel" ? (
                <Hash className="w-4.5 h-4.5 text-primary shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User2 className="w-4 h-4 text-primary" />
                </div>
              )}
              <div>
                <p className="font-bold text-sm leading-none">{active.name}</p>
                {active.kind === "channel" && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {channels.find(c => c.id === active.id)?.description || "قناة عامة"}
                  </p>
                )}
                {active.kind === "dm" && (
                  <p className="text-xs text-muted-foreground mt-0.5">رسالة مباشرة</p>
                )}
              </div>
              <button
                onClick={() => setActive(null)}
                className="mr-auto p-1.5 hover:bg-muted rounded-lg text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-slate-50/40">
              {loadingMessages && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              )}
              {!loadingMessages && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">لا توجد رسائل بعد — ابدأ المحادثة!</p>
                </div>
              )}
              {groupedMessages.map(({ day, msgs }) => (
                <div key={day}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 bg-white rounded-full border border-border">
                      {day}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {msgs.map((msg, i) => {
                    const isOwn = msg.fromUserId === currentUser?.id
                    const prevMsg = i > 0 ? msgs[i - 1] : null
                    const showSender = !prevMsg || prevMsg.fromUserId !== msg.fromUserId
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex gap-2 mb-1", isOwn ? "flex-row-reverse" : "flex-row")}
                      >
                        {showSender && !isOwn && (
                          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                            {msg.fromUserName?.charAt(0) || "؟"}
                          </div>
                        )}
                        {!showSender && !isOwn && <div className="w-7 shrink-0" />}
                        <div className={cn("max-w-[70%]", isOwn && "items-end flex flex-col")}>
                          {showSender && (
                            <p className={cn("text-xs text-muted-foreground mb-0.5 font-semibold", isOwn && "text-right")}>
                              {isOwn ? "أنت" : msg.fromUserName}
                            </p>
                          )}
                          <div className={cn(
                            "px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-xs",
                            isOwn
                              ? "bg-primary text-primary-foreground rounded-tl-md"
                              : "bg-white border border-border rounded-tr-md"
                          )}>
                            {msg.content}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-white shrink-0">
              <div className="flex gap-2 items-center">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={active.kind === "channel" ? `رسالة في #${active.name}` : `رسالة لـ ${active.name}`}
                  className="flex-1 bg-slate-50 border-slate-200"
                  disabled={sendMutation.isPending}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || sendMutation.isPending}
                  size="icon"
                  className="shrink-0 h-10 w-10"
                >
                  {sendMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Channel Dialog */}
      <Dialog open={showNewChannel} onOpenChange={setShowNewChannel}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" /> إنشاء قناة جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">اسم القناة <span className="text-destructive">*</span></label>
              <Input
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                placeholder="مثال: عام، مشتريات، إعلانات"
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">وصف (اختياري)</label>
              <Input
                value={newChannelDesc}
                onChange={e => setNewChannelDesc(e.target.value)}
                placeholder="وصف مختصر لموضوع القناة"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNewChannel(false)}>إلغاء</Button>
            <Button
              onClick={() => createChannelMutation.mutate()}
              disabled={!newChannelName.trim() || createChannelMutation.isPending}
            >
              {createChannelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              إنشاء القناة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
