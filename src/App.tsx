import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAutoNotifications } from "@/hooks/useAutoNotifications";
import { useNotificationAlerts } from "@/hooks/useNotificationAlerts";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Forbidden = lazy(() => import("./pages/Forbidden"));
const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCustomize = lazy(() => import("./pages/AdminCustomize"));
const AdminClientes = lazy(() => import("./pages/AdminClientes"));
const AdminClienteForm = lazy(() => import("./pages/AdminClienteForm"));
const AdminNotificacoes = lazy(() => import("./pages/AdminNotificacoes"));
const AdminPerfil = lazy(() => import("./pages/AdminPerfil"));
const AdminTemplates = lazy(() => import("./pages/AdminTemplates"));
const AdminM3ULists = lazy(() => import("./pages/AdminM3ULists"));
const AdminVariables = lazy(() => import("./pages/AdminVariables"));
const AdminNotificationSettings = lazy(() => import("./pages/AdminNotificationSettings"));
const AdminNotificationRetry = lazy(() => import("./pages/AdminNotificationRetry"));
const AdminNotificationStats = lazy(() => import("./pages/AdminNotificationStats"));
const AdminNotificationAlerts = lazy(() => import("./pages/AdminNotificationAlerts"));
const AdminNotificationLive = lazy(() => import("./pages/AdminNotificationLive"));
const AdminSmartOneConfig = lazy(() => import("./pages/AdminSmartOneConfig"));
const TutorialSmartOne = lazy(() => import("./pages/TutorialSmartOne"));
const CadastroSucesso = lazy(() => import("./pages/CadastroSucesso"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));
const AdminSystemHealth = lazy(() => import("./pages/AdminSystemHealth"));
const AdminUserRoles = lazy(() => import("./pages/AdminUserRoles"));
const AdminPermissionTest = lazy(() => import("./pages/AdminPermissionTest"));
const ClienteCadastro = lazy(() => import("./pages/ClienteCadastro"));
const AdminSmartOneSync = lazy(() => import("./pages/AdminSmartOneSync"));
const ClienteAccount = lazy(() => import("./pages/ClienteAccount"));
const AdminSecurityMonitor = lazy(() => import("./pages/AdminSecurityMonitor"));
const AdminSecurityAnalytics = lazy(() => import("./pages/AdminSecurityAnalytics"));
const AdminSecurityAlerts = lazy(() => import("./pages/AdminSecurityAlerts"));
const AdminSecurityEscalation = lazy(() => import("./pages/AdminSecurityEscalation"));
const AdminScheduleConfig = lazy(() => import("./pages/AdminScheduleConfig"));
const AdminIPBlocking = lazy(() => import("./pages/AdminIPBlocking"));
const AdminAlertStats = lazy(() => import("./pages/AdminAlertStats"));
const AdminAlertTimeline = lazy(() => import("./pages/AdminAlertTimeline"));
const AdminLeaderboard = lazy(() => import("./pages/AdminLeaderboard"));
const AdminPlaylistHealth = lazy(() => import("./pages/AdminPlaylistHealth"));
const AdminAutoNotifications = lazy(() => import("./pages/AdminAutoNotifications"));
const AdminAuthStatus = lazy(() => import("./pages/AdminAuthStatus"));
const AdminRoleAudit = lazy(() => import("./pages/AdminRoleAudit"));
const Admin2FASettings = lazy(() => import("./pages/Admin2FASettings"));
const AdminSuspiciousLogins = lazy(() => import("./pages/AdminSuspiciousLogins"));
const AdminIPWhitelist = lazy(() => import("./pages/AdminIPWhitelist"));

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
          <Route path="/cadastro" element={<ClienteCadastro />} />
          <Route path="/cadastro-sucesso" element={<CadastroSucesso />} />
          <Route path="/login" element={<Login />} />
          
          <Route path="/conta" element={<ProtectedRoute><ClienteAccount /></ProtectedRoute>} />
          
          <Route path="/dashboard" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/admin/customize" element={<ProtectedRoute requireAdmin><AdminCustomize /></ProtectedRoute>} />
          <Route path="/admin/clientes" element={<ProtectedRoute requireAdmin><AdminClientes /></ProtectedRoute>} />
          <Route path="/admin/clientes/novo" element={<ProtectedRoute requireAdmin><AdminClienteForm /></ProtectedRoute>} />
          <Route path="/admin/clientes/editar/:id" element={<ProtectedRoute requireAdmin><AdminClienteForm /></ProtectedRoute>} />
          <Route path="/admin/notificacoes" element={<ProtectedRoute requireAdmin><AdminNotificacoes /></ProtectedRoute>} />
          <Route path="/admin/perfil" element={<ProtectedRoute requireAdmin><AdminPerfil /></ProtectedRoute>} />
          <Route path="/admin/templates" element={<ProtectedRoute requireAdmin><AdminTemplates /></ProtectedRoute>} />
          <Route path="/admin/m3u-lists" element={<ProtectedRoute requireAdmin><AdminM3ULists /></ProtectedRoute>} />
          <Route path="/admin/variables" element={<ProtectedRoute requireAdmin><AdminVariables /></ProtectedRoute>} />
          <Route path="/admin/notification-settings" element={<ProtectedRoute requireAdmin><AdminNotificationSettings /></ProtectedRoute>} />
          <Route path="/admin/notification-retry" element={<ProtectedRoute requireAdmin><AdminNotificationRetry /></ProtectedRoute>} />
          <Route path="/admin/notification-stats" element={<ProtectedRoute requireAdmin><AdminNotificationStats /></ProtectedRoute>} />
          <Route path="/admin/notification-alerts" element={<ProtectedRoute requireAdmin><AdminNotificationAlerts /></ProtectedRoute>} />
          <Route path="/admin/notification-live" element={<ProtectedRoute requireAdmin><AdminNotificationLive /></ProtectedRoute>} />
          <Route path="/admin/smartone-config" element={<ProtectedRoute requireAdmin><AdminSmartOneConfig /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><AdminAnalytics /></ProtectedRoute>} />
          <Route path="/admin/system-health" element={<ProtectedRoute requireAdmin><AdminSystemHealth /></ProtectedRoute>} />
          <Route path="/admin/user-roles" element={<ProtectedRoute requireAdmin><AdminUserRoles /></ProtectedRoute>} />
          <Route path="/admin/security-monitor" element={<ProtectedRoute requireAdmin><AdminSecurityMonitor /></ProtectedRoute>} />
          <Route path="/admin/security-analytics" element={<ProtectedRoute requireAdmin><AdminSecurityAnalytics /></ProtectedRoute>} />
          <Route path="/admin/security-alerts" element={<ProtectedRoute requireAdmin><AdminSecurityAlerts /></ProtectedRoute>} />
          <Route path="/admin/security-escalation" element={<ProtectedRoute requireAdmin><AdminSecurityEscalation /></ProtectedRoute>} />
          <Route path="/admin/schedule-config" element={<ProtectedRoute requireAdmin><AdminScheduleConfig /></ProtectedRoute>} />
          <Route path="/admin/alert-stats" element={<ProtectedRoute requireAdmin><AdminAlertStats /></ProtectedRoute>} />
          <Route path="/admin/alert-timeline" element={<ProtectedRoute requireAdmin><AdminAlertTimeline /></ProtectedRoute>} />
          <Route path="/admin/leaderboard" element={<ProtectedRoute requireAdmin><AdminLeaderboard /></ProtectedRoute>} />
          <Route path="/admin/ip-blocking" element={<ProtectedRoute requireAdmin><AdminIPBlocking /></ProtectedRoute>} />
          <Route path="/admin/permission-test" element={<ProtectedRoute requireAdmin><AdminPermissionTest /></ProtectedRoute>} />
          <Route path="/admin/smartone-sync" element={<ProtectedRoute requireAdmin><AdminSmartOneSync /></ProtectedRoute>} />
          <Route path="/admin/playlist-health" element={<ProtectedRoute requireAdmin><AdminPlaylistHealth /></ProtectedRoute>} />
          <Route path="/admin/auto-notifications" element={<ProtectedRoute requireAdmin><AdminAutoNotifications /></ProtectedRoute>} />
          <Route path="/admin/auth-status" element={<ProtectedRoute requireAdmin><AdminAuthStatus /></ProtectedRoute>} />
          <Route path="/admin/role-audit" element={<ProtectedRoute requireAdmin><AdminRoleAudit /></ProtectedRoute>} />
          <Route path="/admin/2fa-settings" element={<ProtectedRoute requireAdmin><Admin2FASettings /></ProtectedRoute>} />
          <Route path="/admin/suspicious-logins" element={<ProtectedRoute requireAdmin><AdminSuspiciousLogins /></ProtectedRoute>} />
          <Route path="/admin/ip-whitelist" element={<ProtectedRoute requireAdmin><AdminIPWhitelist /></ProtectedRoute>} />
          <Route path="/admin/role-audit" element={<ProtectedRoute requireAdmin><AdminRoleAudit /></ProtectedRoute>} />
          <Route path="/admin/2fa-settings" element={<ProtectedRoute requireAdmin><Admin2FASettings /></ProtectedRoute>} />
          <Route path="/admin/suspicious-logins" element={<ProtectedRoute requireAdmin><AdminSuspiciousLogins /></ProtectedRoute>} />
          
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route path="/app/login" element={<Navigate to="/login" replace />} />
          <Route path="/auth" element={<Navigate to="/login" replace />} />
          <Route path="/settings" element={<Navigate to="/conta" replace />} />
          <Route path="/subscription" element={<Navigate to="/conta" replace />} />
          <Route path="/app" element={<Navigate to="/conta" replace />} />
          
          {/* Access denied */}
          <Route path="/403" element={<Forbidden />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
