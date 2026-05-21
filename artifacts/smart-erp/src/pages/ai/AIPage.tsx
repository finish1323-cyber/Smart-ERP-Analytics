import { useState, useRef, useEffect } from "react"
import { useMutation } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Bot, Send, Loader2, Sparkles, FileText, User, RotateCcw, Copy, Check
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type Message = { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "ما هي المنتجات التي تحتاج إعادة طلب الآن؟",
  "كيف أداء المبيعات هذا الشهر مقارنة بالمتوقع؟",
  "ما هي أهم المهام المتأخرة التي تحتاج تدخلاً؟",
  "هل هناك موردون لديهم أوامر شراء معلقة منذ فترة؟",
]

function apiFetch(path: string, body: unknown) {
  return fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async r => {
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      throw new Error((e as any).error ?? "خطأ من الخادم")
    }
    return r.json()
  })
}

function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false)
  const isUser = msg.role === "user"

  const copy = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const lines = msg.content.split("\n")

  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
        isUser ? "bg-primary text-primary-foreground" : "bg-violet-100 text-violet-600"
      )}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={cn("flex-1 max-w-[80%]", isUser ? "items-end" : "items-start", "flex flex-col gap-1")}>
        <div className={cn(
          "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-white border border-border/60 text-foreground rounded-tl-sm shadow-sm"
        )}>
          {lines.map((line, i) => {
            if (line.startsWith("## ")) return <p key={i} className="font-bold text-base mt-2 mb-1">{line.slice(3)}</p>
            if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-bold">{line.slice(2, -2)}</p>
            if (/^\*\*(.+)\*\*/.test(line)) {
              return <p key={i}>{line.replace(/\*\*(.+?)\*\*/g, (_, t) => t)}</p>
            }
            if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="flex gap-1.5"><span>•</span><span>{line.slice(2)}</span></p>
            if (/^\d+\./.test(line)) return <p key={i}>{line}</p>
            return <p key={i}>{line}</p>
          })}
        </div>
        {!isUser && (
          <button
            onClick={copy}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1"
          >
            {copied ? <><Check className="w-3 h-3 text-emerald-500" /> نُسخ</> : <><Copy className="w-3 h-3" /> نسخ</>}
          </button>
        )}
      </div>
    </div>
  )
}

export function AIPage() {
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [report, setReport] = useState<{ text: string; generatedAt: string } | null>(null)
  const [showReport, setShowReport] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: (userMsg: string) =>
      apiFetch("/ai/chat", { messages: [...messages, { role: "user", content: userMsg }] }),
    onMutate: (userMsg) => {
      setMessages(prev => [...prev, { role: "user", content: userMsg }])
      setInput("")
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }])
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" })
      setMessages(prev => prev.slice(0, -1))
    },
  })

  const reportMutation = useMutation({
    mutationFn: () => apiFetch("/ai/report", {}),
    onSuccess: (data) => {
      setReport({ text: data.report, generatedAt: data.generatedAt })
      setShowReport(true)
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" })
    },
  })

  const handleSend = () => {
    const msg = input.trim()
    if (!msg || chatMutation.isPending) return
    chatMutation.mutate(msg)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-violet-500" />
            المساعد الذكي
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">اسأله عن بيانات شركتك الحقيقية</p>
        </div>
        <Button
          onClick={() => reportMutation.mutate()}
          disabled={reportMutation.isPending}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          size="sm"
        >
          {reportMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" />جاري التوليد...</>
            : <><Sparkles className="w-4 h-4" />اطلب تقرير شامل</>
          }
        </Button>
      </div>

      {/* Report Panel */}
      {showReport && report && (
        <Card className="p-4 border-violet-200 bg-violet-50/50 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2 text-violet-700">
              <FileText className="w-4 h-4" /> التقرير الشامل
              <span className="text-xs font-normal text-muted-foreground">
                {new Date(report.generatedAt).toLocaleString("ar-EG")}
              </span>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => { navigator.clipboard.writeText(report.text); toast({ title: "تم النسخ" }) }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> نسخ
              </button>
              <button onClick={() => setShowReport(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto text-foreground">
            {report.text.split("\n").map((line, i) => {
              if (line.startsWith("## ") || line.startsWith("# "))
                return <p key={i} className="font-bold text-base mt-3 mb-1 text-violet-800">{line.replace(/^#+ /, "")}</p>
              if (/^\*\*(.+)\*\*/.test(line))
                return <p key={i} className="font-semibold mt-2">{line.replace(/\*\*(.+?)\*\*/g, (_, t) => t)}</p>
              if (line.startsWith("- ") || line.startsWith("• "))
                return <p key={i} className="flex gap-1.5 mr-2"><span>•</span><span>{line.slice(2)}</span></p>
              return <p key={i}>{line}</p>
            })}
          </div>
        </Card>
      )}

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden p-0 border-border/60">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-10">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Bot className="w-8 h-8 text-violet-500" />
              </div>
              <div>
                <p className="font-bold text-lg">كيف يمكنني مساعدتك؟</p>
                <p className="text-sm text-muted-foreground mt-1">أسألني عن المخزون أو المبيعات أو المهام أو الموردين</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(s); }}
                    className="text-right text-sm px-3 py-2.5 rounded-xl border border-border/70 hover:border-violet-300 hover:bg-violet-50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
          )}
          {chatMutation.isPending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-border/60 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border/50 p-3 bg-slate-50/50 shrink-0">
          <div className="flex gap-2 items-end">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0"
                title="بداية محادثة جديدة"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="اسأل عن المخزون، المبيعات، المهام... (Enter للإرسال)"
              className="resize-none min-h-[44px] max-h-32 bg-white text-sm"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              size="icon"
              className="shrink-0 bg-violet-600 hover:bg-violet-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            المساعد يستخدم بيانات شركتك الحقيقية للإجابة
          </p>
        </div>
      </Card>
    </div>
  )
}
