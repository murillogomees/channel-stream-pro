import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAutoNotifications } from "@/hooks/useAutoNotifications";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCustomize = lazy(() => import("./pages/AdminCustomize"));
const AdminClientes = lazy(() => import("./pages/AdminClientes"));
const AdminClienteForm = lazy(() => import("./pages/AdminClienteForm"));
const AdminNotificacoes = lazy(() => import("./pages/AdminNotificacoes"));

const AutoNotificationProvider = () => {
  useAutoNotifications();
  return null;
};

const App = () => (
  <TooltipProvider>
    <AutoNotificationProvider />
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/customize" element={<AdminCustomize />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/clientes" element={<AdminClientes />} />
          <Route path="/admin/clientes/novo" element={<AdminClienteForm />} />
          <Route path="/admin/clientes/editar/:id" element={<AdminClienteForm />} />
          <Route path="/admin/notificacoes" element={<AdminNotificacoes />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
