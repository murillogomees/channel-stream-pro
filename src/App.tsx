/**
 * Main App Component
 * @version 5.0.0 - Cleaned after M3U/Streaming removal
 */
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { webVitalsService } from "@/services/webVitalsService";
import { useGlobalOrientationLock } from "@/hooks/useGlobalOrientationLock";

// Core pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Forbidden = lazy(() => import("./pages/Forbidden"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));

// ========================================
// ADMIN PAGES - Consolidated Hub Structure
// ========================================
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminNotificacoesPage = lazy(() => import("./pages/admin/AdminNotificacoesPage"));
const AdminSegurancaPage = lazy(() => import("./pages/admin/AdminSegurancaPage"));
const AdminSistemaPage = lazy(() => import("./pages/admin/AdminSistemaPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminUsuariosPage = lazy(() => import("./pages/admin/AdminUsuariosPage"));
const AdminIntegracaoPage = lazy(() => import("./pages/admin/AdminIntegracaoPage"));
const AdminMigracoesPage = lazy(() => import("./pages/admin/AdminMigracoesPage"));
const AdminBuildsDeploysPage = lazy(() => import("./pages/admin/AdminBuildsDeploysPage"));
const AdminObservabilityPage = lazy(() => import("./pages/admin/AdminObservabilityPage"));

// System Control Modules
const SystemOverview = lazy(() => import("./pages/admin/system/index"));
const AuthRecovery = lazy(() => import("./pages/admin/system/AuthRecovery"));
const DatabaseRebuild = lazy(() => import("./pages/admin/system/DatabaseRebuild"));
const SchemaPreview = lazy(() => import("./pages/admin/system/SchemaPreview"));
const FunctionsRPCs = lazy(() => import("./pages/admin/system/FunctionsRPCs"));
const RLSControl = lazy(() => import("./pages/admin/system/RLSControl"));
const UsageValidation = lazy(() => import("./pages/admin/system/UsageValidation"));
const ExecutePlan = lazy(() => import("./pages/admin/system/ExecutePlan"));

// IPTV Management Pages
const AdminIPTVPage = lazy(() => import("./pages/admin/AdminIPTVPage"));

// IPTV App Pages
const IPTVHome = lazy(() => import("./pages/iptv/IPTVHome"));
const IPTVPlayer = lazy(() => import("./pages/iptv/IPTVPlayer"));

// Public standalone pages
const CadastroSucesso = lazy(() => import("./pages/CadastroSucesso"));

// Checkout pages
const Checkout = lazy(() => import("./pages/Checkout"));
const CheckoutAuthenticated = lazy(() => import("./pages/CheckoutAuthenticated"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const CheckoutFailure = lazy(() => import("./pages/CheckoutFailure"));
const CheckoutPending = lazy(() => import("./pages/CheckoutPending"));

// Affiliate pages
const AffiliateDashboard = lazy(() => import("./pages/AffiliateDashboard"));
const AdminAffiliates = lazy(() => import("./pages/AdminAffiliates"));

// Profile
const UnifiedProfile = lazy(() => import("./pages/UnifiedProfile"));
const AppInstall = lazy(() => import("./pages/AppInstall"));

// Inner component to use hooks
function AppContent() {
  // Global portrait lock - app always stays vertical
  useGlobalOrientationLock();
  
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/account/settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
            
            {/* Checkout - All routes require authentication */}
            <Route path="/checkout" element={<ProtectedRoute><CheckoutAuthenticated /></ProtectedRoute>} />
            <Route path="/checkout/new" element={<Checkout />} />
            <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
            <Route path="/checkout/failure" element={<ProtectedRoute><CheckoutFailure /></ProtectedRoute>} />
            <Route path="/checkout/pending" element={<ProtectedRoute><CheckoutPending /></ProtectedRoute>} />
            
            {/* Affiliate */}
            <Route path="/afiliado" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
            
            {/* ========================================
                APP ROUTES - IPTV
            ======================================== */}
            <Route path="/app" element={<ProtectedRoute><IPTVHome /></ProtectedRoute>} />
            <Route path="/app/home" element={<ProtectedRoute><IPTVHome /></ProtectedRoute>} />
            <Route path="/app/player/:channelId" element={<ProtectedRoute><IPTVPlayer /></ProtectedRoute>} />
            <Route path="/app/install" element={<AppInstall />} />
            <Route path="/app/profile" element={<ProtectedRoute><UnifiedProfile /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><UnifiedProfile /></ProtectedRoute>} />
            
            {/* ========================================
                ADMIN ROUTES - Consolidated Hubs
            ======================================== */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/" element={<Navigate to="/admin/dashboard" replace />} />
            {/* Normalize trailing segments (/admin/dashboard/, /admin/dashboard/anything) */}
            <Route path="/admin/dashboard/*" element={<Navigate to="/admin/dashboard" replace />} />

            <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="/admin/notificacoes" element={<ProtectedRoute requireAdmin><AdminNotificacoesPage /></ProtectedRoute>} />
            <Route path="/admin/seguranca" element={<ProtectedRoute requireAdmin><AdminSegurancaPage /></ProtectedRoute>} />
            <Route path="/admin/sistema" element={<ProtectedRoute requireAdmin><AdminSistemaPage /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><AdminAnalyticsPage /></ProtectedRoute>} />
            <Route path="/admin/usuarios" element={<ProtectedRoute requireAdmin><AdminUsuariosPage /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<Navigate to="/admin/usuarios?tab=roles" replace />} />
            <Route path="/admin/integracao" element={<ProtectedRoute requireAdmin><AdminIntegracaoPage /></ProtectedRoute>} />
            <Route path="/admin/migrations" element={<ProtectedRoute requireAdmin><AdminMigracoesPage /></ProtectedRoute>} />
            {/* RLS Coverage route removed - table not available */}
            <Route path="/admin/perfil" element={<ProtectedRoute requireAdmin><UnifiedProfile /></ProtectedRoute>} />
            <Route path="/admin/afiliados" element={<ProtectedRoute requireAdmin><AdminAffiliates /></ProtectedRoute>} />
<Route path="/admin/builds" element={<ProtectedRoute requireAdmin><AdminBuildsDeploysPage /></ProtectedRoute>} />
            <Route path="/admin/observability" element={<ProtectedRoute requireAdmin><AdminObservabilityPage /></ProtectedRoute>} />
            
            {/* System Control Panel - Database & Auth */}
            <Route path="/admin/system" element={<ProtectedRoute requireAdmin><SystemOverview /></ProtectedRoute>} />
            <Route path="/admin/system/auth" element={<ProtectedRoute requireAdmin><AuthRecovery /></ProtectedRoute>} />
            <Route path="/admin/system/database" element={<ProtectedRoute requireAdmin><DatabaseRebuild /></ProtectedRoute>} />
            <Route path="/admin/system/schema-preview" element={<ProtectedRoute requireAdmin><SchemaPreview /></ProtectedRoute>} />
            <Route path="/admin/system/functions" element={<ProtectedRoute requireAdmin><FunctionsRPCs /></ProtectedRoute>} />
            <Route path="/admin/system/rls" element={<ProtectedRoute requireAdmin><RLSControl /></ProtectedRoute>} />
            <Route path="/admin/system/usage-validation" element={<ProtectedRoute requireAdmin><UsageValidation /></ProtectedRoute>} />
            <Route path="/admin/system/execute" element={<ProtectedRoute requireAdmin><ExecutePlan /></ProtectedRoute>} />
            
            {/* IPTV Management - Unified */}
            <Route path="/admin/iptv" element={<ProtectedRoute requireAdmin><AdminIPTVPage /></ProtectedRoute>} />
            <Route path="/admin/iptv/channels" element={<Navigate to="/admin/iptv?tab=channels" replace />} />
            <Route path="/admin/iptv/playlists" element={<Navigate to="/admin/iptv?tab=playlists" replace />} />
            <Route path="/admin/iptv/epg" element={<Navigate to="/admin/iptv?tab=epg" replace />} />
            
            {/* Access denied & 404 */}
            <Route path="/403" element={<Forbidden />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

const App = () => (
  <AuthProvider>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </TooltipProvider>
    </ThemeProvider>
  </AuthProvider>
);

export default App;
