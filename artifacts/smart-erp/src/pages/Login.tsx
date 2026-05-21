import { useState } from "react"
import { useLocation } from "wouter"
import { useLogin } from "@workspace/api-client-react"
import { Card, Button, Input, Label } from "@/components/ui/shared"
import { BarChart, Lock, Mail, Globe } from "lucide-react"
import { useTranslation } from "react-i18next"
import i18n from "@/i18n"

export function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [email, setEmail] = useState("admin@company.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const { t, i18n: i18nInst } = useTranslation()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate({ data: { email, password } }, {
      onSuccess: () => setLocation("/"),
      onError: () => setError(t("login.error"))
    });
  };

  const toggleLang = () => {
    const next = i18nInst.language === "ar" ? "en" : "ar"
    i18n.changeLanguage(next)
    localStorage.setItem("erp-lang", next)
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr"
    document.documentElement.lang = next
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden" dir={i18nInst.language === "ar" ? "rtl" : "ltr"}>
      {/* Background decoration */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px]" />

      {/* Lang toggle */}
      <button
        onClick={toggleLang}
        className="absolute top-4 left-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200 shadow-sm transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        {t("lang.toggle")}
      </button>

      <Card className="w-full max-w-md p-8 relative z-10 border-white/50 shadow-2xl bg-white/80 backdrop-blur-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-lg shadow-primary/25 mb-6">
            <BarChart className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Smart ERP</h1>
          <p className="text-slate-500 mt-2 font-medium">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl border border-destructive/20 font-semibold text-center animate-in shake">
              {error}
            </div>
          )}

          <div className="space-y-2 relative">
            <Label>{t("login.email")}</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-4 pr-10 bg-white"
                required
              />
            </div>
          </div>

          <div className="space-y-2 relative">
            <div className="flex justify-between items-center mb-2">
              <Label className="mb-0">{t("login.password")}</Label>
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-4 pr-10 bg-white"
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 text-lg mt-4" isLoading={login.isPending}>
            {t("login.submit")}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500">
          <p>{t("login.demo")}</p>
        </div>
      </Card>
    </div>
  );
}
