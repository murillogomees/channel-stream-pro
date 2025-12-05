/**
 * Main App Component
 * @version 4.0.0 - Legacy Redirects Removed (Phase 2 Complete)
 */
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ViewerProfileProvider } from "@/contexts/ViewerProfileContext";
import { webVitalsService } from "@/services/webVitalsService";
import { useGlobalOrientationLock } from "@/hooks/useGlobalOrientationLock";

// Core pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Forbidden = lazy(() => import("./pages/Forbidden"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));

// ========================================
// ADMIN PAGES - Consolidated Hub Structure
// ========================================
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminM3UPage = lazy(() => import("./pages/admin/AdminM3UPage"));
const AdminNotificacoesPage = lazy(() => import("./pages/admin/AdminNotificacoesPage"));
const AdminSegurancaPage = lazy(() => import("./pages/admin/AdminSegurancaPage"));
const AdminSistemaPage = lazy(() => import("./pages/admin/AdminSistemaPage"));
const AdminAnalyticsPage = lazy(() => import("./pages/admin/AdminAnalyticsPage"));
const AdminUsuariosPage = lazy(() => import("./pages/admin/AdminUsuariosPage"));
const AdminIntegracaoPage = lazy(() => import("./pages/admin/AdminIntegracaoPage"));
const AdminMigrations = lazy(() => import("./pages/AdminMigracoes"));
const AdminRLSCoverage = lazy(() => import("./pages/AdminRLSCoverage"));
const AdminCdn = lazy(() => import("./pages/AdminCdn"));
const AdminBuildsDeploysPage = lazy(() => import("./pages/admin/AdminBuildsDeploysPage"));

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

// IPTV App pages
const AppEntry = lazy(() => import("./pages/AppEntry"));
const AppPlayer = lazy(() => import("./pages/AppPlayer"));
const UnifiedProfile = lazy(() => import("./pages/UnifiedProfile"));
const AppInstall = lazy(() => import("./pages/AppInstall"));
const TVPlayer = lazy(() => import("./pages/TVPlayer"));
const MyList = lazy(() => import("./pages/MyList"));

// Initialize Web Vitals
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
            
            {/* Checkout */}
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/failure" element={<CheckoutFailure />} />
            <Route path="/checkout/pending" element={<CheckoutPending />} />
            
            {/* Affiliate */}
            <Route path="/afiliado" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
            
            {/* ========================================
                IPTV APP ROUTES
            ======================================== */}
            <Route path="/app" element={<AppEntry />} />
            <Route path="/app/install" element={<AppInstall />} />
            <Route path="/app/player" element={<ProtectedRoute requireValidAccess><AppPlayer /></ProtectedRoute>} />
            <Route path="/app/profile" element={<ProtectedRoute><UnifiedProfile /></ProtectedRoute>} />
            <Route path="/app/mylist" element={<ProtectedRoute requireValidAccess><MyList /></ProtectedRoute>} />
            <Route path="/tv-player" element={<TVPlayer />} />
            
            {/* ========================================
                ADMIN ROUTES - Consolidated Hubs
            ======================================== */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<ProtectedRoute requireAdmin><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="/admin/m3u" element={<ProtectedRoute requireAdmin><AdminM3UPage /></ProtectedRoute>} />
            <Route path="/admin/notificacoes" element={<ProtectedRoute requireAdmin><AdminNotificacoesPage /></ProtectedRoute>} />
            <Route path="/admin/seguranca" element={<ProtectedRoute requireAdmin><AdminSegurancaPage /></ProtectedRoute>} />
            <Route path="/admin/sistema" element={<ProtectedRoute requireAdmin><AdminSistemaPage /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute requireAdmin><AdminAnalyticsPage /></ProtectedRoute>} />
            <Route path="/admin/usuarios" element={<ProtectedRoute requireAdmin><AdminUsuariosPage /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<Navigate to="/admin/usuarios?tab=roles" replace />} />
            <Route path="/admin/integracao" element={<ProtectedRoute requireAdmin><AdminIntegracaoPage /></ProtectedRoute>} />
            <Route path="/admin/migrations" element={<ProtectedRoute requireAdmin><AdminMigrations /></ProtectedRoute>} />
            <Route path="/admin/rls-coverage" element={<ProtectedRoute requireAdmin><AdminRLSCoverage /></ProtectedRoute>} />
            <Route path="/admin/cdn" element={<ProtectedRoute requireAdmin><AdminCdn /></ProtectedRoute>} />
            <Route path="/admin/perfil" element={<ProtectedRoute requireAdmin><UnifiedProfile /></ProtectedRoute>} />
            <Route path="/admin/afiliados" element={<ProtectedRoute requireAdmin><AdminAffiliates /></ProtectedRoute>} />
            <Route path="/admin/builds" element={<ProtectedRoute requireAdmin><AdminBuildsDeploysPage /></ProtectedRoute>} />
            
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
        <ViewerProfileProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </ViewerProfileProvider>
      </TooltipProvider>
    </ThemeProvider>
  </AuthProvider>
);

export default App;
