import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAutoNotifications } from "@/hooks/useAutoNotifications";
import { useNotificationAlerts } from "@/hooks/useNotificationAlerts";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const AppHome = lazy(() => import("./pages/AppHome"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCustomize = lazy(() => import("./pages/AdminCustomize"));
const AdminClientes = lazy(() => import("./pages/AdminClientes"));
const AdminClienteForm = lazy(() => import("./pages/AdminClienteForm"));
const AdminNotificacoes = lazy(() => import("./pages/AdminNotificacoes"));
const AdminPerfil = lazy(() => import("./pages/AdminPerfil"));
const AdminTemplates = lazy(() => import("./pages/AdminTemplates"));
const AdminPlans = lazy(() => import("./pages/AdminPlans"));
const AdminActivationKeys = lazy(() => import("./pages/AdminActivationKeys"));
const AdminAppUsers = lazy(() => import("./pages/AdminAppUsers"));
const AdminM3ULists = lazy(() => import("./pages/AdminM3ULists"));
const AppActivation = lazy(() => import("./pages/AppActivation"));
const AdminVariables = lazy(() => import("./pages/AdminVariables"));
const AdminNotificationSettings = lazy(() => import("./pages/AdminNotificationSettings"));
const AdminNotificationRetry = lazy(() => import("./pages/AdminNotificationRetry"));
const AdminNotificationStats = lazy(() => import("./pages/AdminNotificationStats"));
const AdminNotificationAlerts = lazy(() => import("./pages/AdminNotificationAlerts"));
const AdminNotificationLive = lazy(() => import("./pages/AdminNotificationLive"));
const AdminSmartOneConfig = lazy(() => import("./pages/AdminSmartOneConfig"));
const TutorialSmartOne = lazy(() => import("./pages/TutorialSmartOne"));

const AutoNotificationProvider = () => {
  useAutoNotifications();
  useNotificationAlerts();
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
          <Route path="/tutorial" element={<TutorialSmartOne />} />
          <Route path="/activate" element={<AppActivation />} />
            <Route path="/app" element={<AppHome />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/customize" element={<AdminCustomize />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/clientes" element={<AdminClientes />} />
          <Route path="/admin/clientes/novo" element={<AdminClienteForm />} />
          <Route path="/admin/clientes/editar/:id" element={<AdminClienteForm />} />
          <Route path="/admin/notificacoes" element={<AdminNotificacoes />} />
          <Route path="/admin/perfil" element={<AdminPerfil />} />
          <Route path="/admin/templates" element={<AdminTemplates />} />
          <Route path="/admin/plans" element={<AdminPlans />} />
          <Route path="/admin/activation-keys" element={<AdminActivationKeys />} />
          <Route path="/admin/app-users" element={<AdminAppUsers />} />
          <Route path="/admin/m3u-lists" element={<AdminM3ULists />} />
          <Route path="/admin/variables" element={<AdminVariables />} />
          <Route path="/admin/notification-settings" element={<AdminNotificationSettings />} />
          <Route path="/admin/notification-retry" element={<AdminNotificationRetry />} />
          <Route path="/admin/notification-stats" element={<AdminNotificationStats />} />
          <Route path="/admin/notification-alerts" element={<AdminNotificationAlerts />} />
          <Route path="/admin/notification-live" element={<AdminNotificationLive />} />
          <Route path="/admin/smartone-config" element={<AdminSmartOneConfig />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
