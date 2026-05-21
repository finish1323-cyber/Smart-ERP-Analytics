import { Switch, Route, Router as WouterRouter, useLocation } from "wouter"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useEffect } from "react"

import { AppLayout } from "@/components/layout/AppLayout"
import { Login } from "@/pages/Login"
import { Dashboard } from "@/pages/Dashboard"
import { Products } from "@/pages/inventory/Products"
import { ProductDetail } from "@/pages/inventory/ProductDetail"
import { Customers } from "@/pages/crm/Customers"
import { TaskBoard } from "@/pages/tasks/TaskBoard"
import { PurchaseOrders } from "@/pages/purchases/PurchaseOrders"
import { Suppliers } from "@/pages/purchases/Suppliers"
import { BestPrices } from "@/pages/purchases/BestPrices"
import { PrintPO } from "@/pages/purchases/PrintPO"
import { SalesInvoices } from "@/pages/sales/SalesInvoices"
import { Reports } from "@/pages/reports/Reports"
import { Settings } from "@/pages/settings/Settings"
import Payments from "@/pages/purchases/Payments"
import { Chat } from "@/pages/chat/Chat"
import { Notifications } from "@/pages/notifications/Notifications"
import { AIPage } from "@/pages/ai/AIPage"

import { useGetCurrentUser } from "@workspace/api-client-react"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 1000 * 30,
    },
  },
})

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useGetCurrentUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold text-slate-800">404</h1>
      <p className="text-slate-500 mt-2">الصفحة غير موجودة</p>
    </div>
  )
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/purchases" component={() => <ProtectedRoute component={PurchaseOrders} />} />
      <Route path="/suppliers" component={() => <ProtectedRoute component={Suppliers} />} />
      <Route path="/best-prices" component={() => <ProtectedRoute component={BestPrices} />} />
      <Route path="/payments" component={() => <ProtectedRoute component={Payments} />} />
      <Route path="/print/po/:id" component={PrintPO} />
      <Route path="/inventory" component={() => <ProtectedRoute component={Products} />} />
      <Route path="/inventory/products/:id" component={() => <ProtectedRoute component={ProductDetail} />} />
      <Route path="/crm" component={() => <ProtectedRoute component={Customers} />} />
      <Route path="/sales" component={() => <ProtectedRoute component={SalesInvoices} />} />
      <Route path="/tasks" component={() => <ProtectedRoute component={TaskBoard} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
      <Route path="/notifications" component={() => <ProtectedRoute component={Notifications} />} />
      <Route path="/ai" component={() => <ProtectedRoute component={AIPage} />} />
      <Route component={NotFound} />
    </Switch>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App;
