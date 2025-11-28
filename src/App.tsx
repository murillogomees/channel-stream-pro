import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Forbidden = lazy(() => import("./pages/Forbidden"));
const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminClientes = lazy(() => import("./pages/AdminClientes"));
const AdminClienteForm = lazy(() => import("./pages/AdminClienteForm"));
const AdminClientM3U = lazy(() => import("./pages/AdminClientM3U"));
// Consolidated admin pages
const AdminM3UManagement = lazy(() => import("./pages/AdminM3UManagement"));
const AdminM3UCustomBuilder = lazy(() => import("./pages/AdminM3UCustomBuilder"));
const AdminM3UImportHistory = lazy(() => import("./pages/AdminM3UImportHistory"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminNotificationQueue = lazy(() => import("./pages/AdminNotificationQueue"));
const AdminSecurity = lazy(() => import("./pages/AdminSecurity"));
const AdminAnalyticsHub = lazy(() => import("./pages/AdminAnalyticsHub"));
const AdminSystemSettings = lazy(() => import("./pages/AdminSystemSettings"));
const AdminIntegrations = lazy(() => import("./pages/AdminIntegrations"));
const AdminUsersPermissions = lazy(() => import("./pages/AdminUsersPermissions"));
const AdminCreateUser = lazy(() => import("./pages/AdminCreateUser"));
const AdminWhatsAppConfig = lazy(() => import("./pages/AdminWhatsAppConfig"));
const AdminPlansManager = lazy(() => import("./pages/AdminPlansManager"));
const AdminHomepageEditor = lazy(() => import("./pages/AdminHomepageEditor"));

// Standalone pages
const AdminPerfil = lazy(() => import("./pages/AdminPerfil"));
const TutorialSmartOne = lazy(() => import("./pages/TutorialSmartOne"));
const CadastroSucesso = lazy(() => import("./pages/CadastroSucesso"));
const ClienteAccount = lazy(() => import("./pages/ClienteAccount"));

// IPTV App pages
const AppEntry = lazy(() => import("./pages/AppEntry"));
const AppPlayer = lazy(() => import("./pages/AppPlayer"));
const AppInstall = lazy(() => import("./pages/AppInstall"));
const AdminIPTVTest = lazy(() => import("./pages/AdminIPTVTest"));
const TVPlayer = lazy(() => import("./pages/TVPlayer"));

const App = () => (
  <AuthProvider>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        }>
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/tutorial" element={<TutorialSmartOne />} />
          <Route path="/cadastro-sucesso" element={<CadastroSucesso />} />
          <Route path="/login" element={<Login />} />
          <Route path="/install" element={<AppInstall />} />
          
          <Route path="/conta" element={<ProtectedRoute><ClienteAccount /></ProtectedRoute>} />
          <Route path="/cliente/account" element={<ProtectedRoute><ClienteAccount /></ProtectedRoute>} />
          
          {/* IPTV App Routes */}
          <Route path="/app" element={<AppEntry />} />
          <Route path="/app/player" element={<ProtectedRoute><AppPlayer /></ProtectedRoute>} />
          <Route path="/tv-player" element={<TVPlayer />} />
          <Route path="/admin/iptv-test" element={<ProtectedRoute requireAdmin><AdminIPTVTest /></ProtectedRoute>} />
          
          <Route path="/dashboard" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={<Navigate to="/dashboard" replace />} />
          <Route path="/admin/clientes" element={<ProtectedRoute requireAdmin><AdminClientes /></ProtectedRoute>} />
          <Route path="/admin/clientes/novo" element={<ProtectedRoute requireAdmin><AdminClienteForm /></ProtectedRoute>} />
          <Route path="/admin/clientes/editar/:id" element={<ProtectedRoute requireAdmin><AdminClienteForm /></ProtectedRoute>} />
          <Route path="/admin/clientes/:id/m3u" element={<ProtectedRoute requireAdmin><AdminClientM3U /></ProtectedRoute>} />
          <Route path="/admin/perfil" element={<ProtectedRoute requireAdmin><AdminPerfil /></ProtectedRoute>} />
          
          {/* Consolidated Admin Pages */}
          <Route path="/admin/m3u" element={<ProtectedRoute requireAdmin><AdminM3UManagement /></ProtectedRoute>} />
          <Route path="/admin/m3u-builder" element={<ProtectedRoute requireAdmin><AdminM3UCustomBuilder /></ProtectedRoute>} />
          <Route path="/admin/m3u-import-history" element={<ProtectedRoute requireAdmin><AdminM3UImportHistory /></ProtectedRoute>} />
          <Route path="/admin/notifications" element={<ProtectedRoute requireAdmin><AdminNotifications /></ProtectedRoute>} />
          <Route path="/admin/notification-queue" element={<ProtectedRoute requireAdmin><AdminNotificationQueue /></ProtectedRoute>} />
          <Route path="/admin/security" element={<ProtectedRoute requireAdmin><AdminSecurity /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><AdminAnalyticsHub /></ProtectedRoute>} />
          <Route path="/admin/system" element={<ProtectedRoute requireAdmin><AdminSystemSettings /></ProtectedRoute>} />
          <Route path="/admin/integrations" element={<ProtectedRoute requireAdmin><AdminIntegrations /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsersPermissions /></ProtectedRoute>} />
          <Route path="/admin/create-user" element={<ProtectedRoute requireSuperAdmin><AdminCreateUser /></ProtectedRoute>} />
          <Route path="/admin/whatsapp-config" element={<ProtectedRoute requireAdmin><AdminWhatsAppConfig /></ProtectedRoute>} />
          <Route path="/dashboard/plans" element={<ProtectedRoute requireAdmin><AdminPlansManager /></ProtectedRoute>} />
          <Route path="/dashboard/homepage" element={<ProtectedRoute requireAdmin><AdminHomepageEditor /></ProtectedRoute>} />
          
          {/* Legacy routes - redirect to consolidated pages */}
          <Route path="/admin/m3u-lists" element={<Navigate to="/admin/m3u" replace />} />
          <Route path="/admin/m3u-stats" element={<Navigate to="/admin/m3u" replace />} />
          <Route path="/admin/m3u-custom-dashboard" element={<Navigate to="/admin/m3u" replace />} />
          <Route path="/admin/m3u/custom" element={<Navigate to="/admin/m3u" replace />} />
          <Route path="/admin/m3u-usage-report" element={<Navigate to="/admin/m3u" replace />} />
          <Route path="/admin/notificacoes" element={<Navigate to="/admin/notifications" replace />} />
          <Route path="/admin/notification-settings" element={<Navigate to="/admin/notifications" replace />} />
          <Route path="/admin/auto-notifications" element={<Navigate to="/admin/notifications" replace />} />
          <Route path="/admin/templates" element={<Navigate to="/admin/notifications" replace />} />
          <Route path="/admin/conversion-dashboard" element={<Navigate to="/admin/analytics" replace />} />
          <Route path="/admin/coupons" element={<Navigate to="/admin/analytics" replace />} />
          <Route path="/admin/security-alerts" element={<Navigate to="/admin/security" replace />} />
          <Route path="/admin/security-monitor" element={<Navigate to="/admin/security" replace />} />
          <Route path="/admin/security-analytics" element={<Navigate to="/admin/security" replace />} />
          <Route path="/admin/security-escalation" element={<Navigate to="/admin/security" replace />} />
          <Route path="/admin/suspicious-logins" element={<Navigate to="/admin/security" replace />} />
          <Route path="/admin/ip-blocking" element={<Navigate to="/admin/security" replace />} />
          <Route path="/admin/ip-whitelist" element={<Navigate to="/admin/security" replace />} />
          <Route path="/admin/2fa-settings" element={<Navigate to="/admin/security" replace />} />
          <Route path="/admin/system-health" element={<Navigate to="/admin/system" replace />} />
          <Route path="/admin/playlist-health" element={<Navigate to="/admin/system" replace />} />
          <Route path="/admin/backup-system" element={<Navigate to="/admin/system" replace />} />
          <Route path="/admin/customize" element={<Navigate to="/admin/system" replace />} />
          <Route path="/admin/variables" element={<Navigate to="/admin/system" replace />} />
          <Route path="/admin/status-history" element={<Navigate to="/admin/system" replace />} />
          <Route path="/admin/custom-status-badges" element={<Navigate to="/admin/system" replace />} />
          <Route path="/admin/user-roles" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/role-audit" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/permission-test" element={<Navigate to="/admin/users" replace />} />
          
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
    </ThemeProvider>
  </AuthProvider>
);

export default App;
