/**
 * PROTEÇÃO DE ROTAS UNIFICADA
 * @version 3.0.0
 *
 * - Não redireciona durante loading
 * - Timeout generoso para permitir resolução de role
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireMaster?: boolean;
  requireClient?: boolean;
  requireValidAccess?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requireAdmin = false,
  requireMaster = false,
  requireClient = false,
  requireValidAccess = false
}: ProtectedRouteProps) => {
  const { 
    isAuthenticated, 
    isAdmin, 
    isMaster, 
    isClient, 
    loading, 
    user, 
    session,
    hasValidAccess,
    isExpired 
  } = useAuth();
  const location = useLocation();

  // SEMPRE mostrar loading enquanto auth não resolver - NUNCA redirecionar durante loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Não autenticado
  if (!isAuthenticated && !session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificações de role (só após loading=false)
  if (requireMaster && !isMaster) {
    console.warn('[ProtectedRoute] Access denied (master required)', { email: user?.email, roles: user?.roles });
    return <Navigate to="/403" state={{ required: 'master', has: user?.roles?.[0] ?? 'none' }} replace />;
  }

  if (requireAdmin && !isAdmin && !isMaster) {
    console.warn('[ProtectedRoute] Access denied (admin required)', { email: user?.email, roles: user?.roles });
    return <Navigate to="/403" state={{ required: 'admin', has: user?.roles?.[0] ?? 'none' }} replace />;
  }

  if (requireClient && !isClient && !isAdmin) {
    console.warn('[ProtectedRoute] Access denied (client required)', { email: user?.email, roles: user?.roles });
    return <Navigate to="/403" state={{ required: 'client', has: user?.roles?.[0] ?? 'none' }} replace />;
  }

  // Verificar acesso válido (não vencido)
  if (requireValidAccess) {
    if (isAdmin || isMaster) {
      return <>{children}</>;
    }
    
    const allowedExpiredPaths = ['/profile', '/checkout'];
    const isAllowedPath = allowedExpiredPaths.some(p => location.pathname.startsWith(p));
    
    if (isExpired && !isAllowedPath) {
      return <Navigate to="/profile" state={{ from: location, expired: true }} replace />;
    }
  }

  return <>{children}</>;
};
