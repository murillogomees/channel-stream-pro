/**
 * Main App Component
 * @version 3.0.0 - Consolidated Admin Routes
 */
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { webVitalsService } from "@/services/webVitalsService";

// Core pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Forbidden = lazy(() => import("./pages/Forbidden"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));

// ========================================
// ADMIN PAGES - Consolidated Hub Structure
// ========================================
// Admin Hub Pages
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminClientesPage = lazy(() => import("./pages/admin/AdminClientesPage"));
const AdminM3UPage = lazy(() => import("./pages/admin/AdminM3UPage"));
const AdminRolesManagement = lazy(() => import("./pages/AdminRolesManagement"));
const AdminNotificacoesPage = lazy(() => import("./pages/admin/AdminNotificacoesPage"));
const AdminSegurancaPage = lazy(() => import("./pages/admin/AdminSegurancaPage"));
const AdminSistemaPage = lazy(() => import("./pages/admin/AdminSistemaPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminUsuariosPage = lazy(() => import("./pages/admin/AdminUsuariosPage"));
const AdminIntegracaoPage = lazy(() => import("./pages/admin/AdminIntegracaoPage"));
const AdminMigrations = lazy(() => import("./pages/AdminMigrations"));

// Public standalone pages
const CadastroSucesso = lazy(() => import("./pages/CadastroSucesso"));

// Checkout pages
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const CheckoutFailure = lazy(() => import("./pages/CheckoutFailure"));
const CheckoutPending = lazy(() => import("./pages/CheckoutPending"));

// Affiliate pages
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const AdminAffiliates = lazy(() => import("./pages/AdminAffiliates"));

// IPTV App pages - Standalone Mobile/TV App
const AppEntry = lazy(() => import("./pages/AppEntry"));
const AppPlayer = lazy(() => import("./pages/AppPlayer"));
const UnifiedProfile = lazy(() => import("./pages/UnifiedProfile"));
const AppInstall = lazy(() => import("./pages/AppInstall"));
const TVPlayer = lazy(() => import("./pages/TVPlayer"));
const MyList = lazy(() => import("./pages/MyList"));

// Initialize Web Vitals for Lighthouse optimization
if (typeof window !== 'undefined') {
  webVitalsService.init((report) => {
    console.log('[WebVitals] Report:', {
      score: report.score,
      lcp: report.metrics.LCP?.value,
      fid: report.metrics.FID?.value,
      cls: report.metrics.CLS?.value,
    });
  });
}

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
            {/* ========================================
                PUBLIC ROUTES
            ======================================== */}
            <Route path="/" element={<Index />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/cadastro" element={<SignUp />} />
            <Route path="/cadastro-sucesso" element={<CadastroSucesso />} />
            <Route path="/login" element={<Login />} />
            <Route path="/install" element={<Navigate to="/app/install" replace />} />
            
            {/* Checkout pages */}
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/failure" element={<CheckoutFailure />} />
            <Route path="/checkout/pending" element={<CheckoutPending />} />
            
            {/* Affiliate Dashboard */}
            <Route path="/afiliado" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
            
            {/* ========================================
                IPTV APP ROUTES - Mobile/TV App
                Requer autenticação + acesso válido (não vencido)
            ======================================== */}
            <Route path="/app" element={<AppEntry />} />
            <Route path="/app/install" element={<AppInstall />} />
            <Route path="/app/login" element={<Navigate to="/login" replace />} />
            <Route path="/app/signup" element={<Navigate to="/signup" replace />} />
            <Route path="/app/player" element={<ProtectedRoute requireValidAccess><AppPlayer /></ProtectedRoute>} />
            <Route path="/app/profile" element={<ProtectedRoute><UnifiedProfile /></ProtectedRoute>} />
            <Route path="/app/mylist" element={<ProtectedRoute requireValidAccess><MyList /></ProtectedRoute>} />
            <Route path="/app/home" element={<Navigate to="/app/player" replace />} />
            <Route path="/app/favorites" element={<Navigate to="/app/mylist" replace />} />
            <Route path="/app/account" element={<Navigate to="/app/profile" replace />} />
            <Route path="/tv-player" element={<TVPlayer />} />
            
            {/* Legacy account routes - redirect to app profile */}
            <Route path="/conta" element={<Navigate to="/app/profile" replace />} />
            <Route path="/cliente/account" element={<Navigate to="/app/profile" replace />} />
            
            {/* ========================================
                ADMIN ROUTES - Consolidated Hub Structure
                
                Main Routes (Hub Pages with Tabs):
                - /admin/dashboard → Dashboard principal
                - /admin/clientes → Gestão de clientes
                - /admin/m3u → Gestão M3U & Playlists
                - /admin/notificacoes → Notificações
                - /admin/seguranca → Segurança
                - /admin/sistema → Sistema
                - /admin/analytics → Analytics
                - /admin/usuarios → Usuários & Permissões
                - /admin/integracao → Integrações
            ======================================== */}
            
            {/* Main Admin Entry - Redirects to Dashboard */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            
            {/* Admin Hub Pages */}
            <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="/admin/clientes" element={<ProtectedRoute requireAdmin><AdminClientesPage /></ProtectedRoute>} />
            <Route path="/admin/m3u" element={<ProtectedRoute requireAdmin><AdminM3UPage /></ProtectedRoute>} />
            <Route path="/admin/notificacoes" element={<ProtectedRoute requireAdmin><AdminNotificacoesPage /></ProtectedRoute>} />
            <Route path="/admin/seguranca" element={<ProtectedRoute requireAdmin><AdminSegurancaPage /></ProtectedRoute>} />
            <Route path="/admin/sistema" element={<ProtectedRoute requireAdmin><AdminSistemaPage /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><AdminAnalyticsPage /></ProtectedRoute>} />
            <Route path="/admin/usuarios" element={<ProtectedRoute requireAdmin><AdminUsuariosPage /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<ProtectedRoute requireAdmin><AdminRolesManagement /></ProtectedRoute>} />
            <Route path="/admin/integracao" element={<ProtectedRoute requireAdmin><AdminIntegracaoPage /></ProtectedRoute>} />
            <Route path="/admin/migrations" element={<ProtectedRoute requireAdmin><AdminMigrations /></ProtectedRoute>} />
            <Route path="/admin/perfil" element={<ProtectedRoute requireAdmin><UnifiedProfile /></ProtectedRoute>} />
            <Route path="/admin/afiliados" element={<ProtectedRoute requireAdmin><AdminAffiliates /></ProtectedRoute>} />
            
            {/* ========================================
                LEGACY REDIRECTS - All old routes redirect to consolidated hubs
            ======================================== */}
            
            {/* Old dashboard routes */}
            <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/dashboard/*" element={<Navigate to="/admin/dashboard" replace />} />
            
            {/* Cliente routes - redirect to hub */}
            <Route path="/admin/clientes/novo" element={<Navigate to="/admin/clientes?action=novo" replace />} />
            <Route path="/admin/clientes/editar/:id" element={<Navigate to="/admin/clientes?action=editar" replace />} />
            <Route path="/admin/clientes/:id/m3u" element={<Navigate to="/admin/clientes" replace />} />
            
            {/* M3U routes - redirect to hub */}
            <Route path="/admin/m3u-builder" element={<Navigate to="/admin/m3u" replace />} />
            <Route path="/admin/m3u-import-history" element={<Navigate to="/admin/m3u" replace />} />
            <Route path="/admin/m3u-sync" element={<Navigate to="/admin/m3u" replace />} />
            <Route path="/admin/m3u-lists" element={<Navigate to="/admin/m3u" replace />} />
            <Route path="/admin/m3u-stats" element={<Navigate to="/admin/m3u" replace />} />
            <Route path="/admin/m3u-custom-dashboard" element={<Navigate to="/admin/m3u" replace />} />
            <Route path="/admin/m3u/custom" element={<Navigate to="/admin/m3u" replace />} />
            <Route path="/admin/m3u-usage-report" element={<Navigate to="/admin/m3u" replace />} />
            
            {/* Notification routes - redirect to hub */}
            <Route path="/admin/notifications" element={<Navigate to="/admin/notificacoes" replace />} />
            <Route path="/admin/notification-queue" element={<Navigate to="/admin/notificacoes" replace />} />
            <Route path="/admin/notification-settings" element={<Navigate to="/admin/notificacoes" replace />} />
            <Route path="/admin/auto-notifications" element={<Navigate to="/admin/notificacoes" replace />} />
            <Route path="/admin/templates" element={<Navigate to="/admin/notificacoes" replace />} />
            
            {/* Security routes - redirect to hub */}
            <Route path="/admin/security" element={<Navigate to="/admin/seguranca" replace />} />
            <Route path="/admin/security-alerts" element={<Navigate to="/admin/seguranca" replace />} />
            <Route path="/admin/security-monitor" element={<Navigate to="/admin/seguranca" replace />} />
            <Route path="/admin/security-analytics" element={<Navigate to="/admin/seguranca" replace />} />
            <Route path="/admin/security-escalation" element={<Navigate to="/admin/seguranca" replace />} />
            <Route path="/admin/suspicious-logins" element={<Navigate to="/admin/seguranca" replace />} />
            <Route path="/admin/ip-blocking" element={<Navigate to="/admin/seguranca" replace />} />
            <Route path="/admin/ip-whitelist" element={<Navigate to="/admin/seguranca" replace />} />
            <Route path="/admin/2fa-settings" element={<Navigate to="/admin/seguranca" replace />} />
            
            {/* System routes - redirect to hub */}
            <Route path="/admin/system" element={<Navigate to="/admin/sistema" replace />} />
            <Route path="/admin/system-health" element={<Navigate to="/admin/sistema" replace />} />
            <Route path="/admin/playlist-health" element={<Navigate to="/admin/sistema" replace />} />
            <Route path="/admin/backup-system" element={<Navigate to="/admin/sistema" replace />} />
            <Route path="/admin/customize" element={<Navigate to="/admin/sistema" replace />} />
            <Route path="/admin/variables" element={<Navigate to="/admin/sistema" replace />} />
            <Route path="/admin/status-history" element={<Navigate to="/admin/sistema" replace />} />
            <Route path="/admin/custom-status-badges" element={<Navigate to="/admin/sistema" replace />} />
            <Route path="/dashboard/homepage" element={<Navigate to="/admin/sistema" replace />} />
            <Route path="/dashboard/plans" element={<Navigate to="/admin/sistema" replace />} />
            
            {/* Analytics routes - redirect to hub */}
            <Route path="/admin/conversion-dashboard" element={<Navigate to="/admin/analytics" replace />} />
            <Route path="/admin/coupons" element={<Navigate to="/admin/analytics" replace />} />
            
            {/* User routes - redirect to hub */}
            <Route path="/admin/users" element={<Navigate to="/admin/usuarios" replace />} />
            <Route path="/admin/create-user" element={<Navigate to="/admin/usuarios" replace />} />
            <Route path="/admin/user-roles" element={<Navigate to="/admin/usuarios" replace />} />
            <Route path="/admin/role-audit" element={<Navigate to="/admin/usuarios" replace />} />
            <Route path="/admin/permission-test" element={<Navigate to="/admin/usuarios" replace />} />
            
            {/* Integration routes - redirect to hub */}
            <Route path="/admin/integrations" element={<Navigate to="/admin/integracao" replace />} />
            <Route path="/admin/whatsapp-config" element={<Navigate to="/admin/integracao" replace />} />
            <Route path="/admin/cdn" element={<Navigate to="/admin/integracao" replace />} />
            <Route path="/admin/transcode-queue" element={<Navigate to="/admin/integracao" replace />} />
            <Route path="/admin/iptv-test" element={<Navigate to="/app/player" replace />} />
            <Route path="/admin/smart-cache" element={<Navigate to="/admin/integracao" replace />} />
            <Route path="/admin/rls-coverage" element={<Navigate to="/admin/integracao" replace />} />
            <Route path="/admin/qa" element={<Navigate to="/admin/integracao" replace />} />
            
            {/* Other legacy routes */}
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />
            <Route path="/auth" element={<Navigate to="/login" replace />} />
            <Route path="/settings" element={<Navigate to="/app/profile" replace />} />
            <Route path="/subscription" element={<Navigate to="/app/profile" replace />} />
            
            {/* Access denied */}
            <Route path="/403" element={<Forbidden />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </AuthProvider>
);

export default App;
