/**
 * PROTEÇÃO DE ROTAS UNIFICADA
 * 
 * Usa o contexto de autenticação centralizado para:
 * - Verificar autenticação
 * - Verificar permissões (admin, super_admin, client)
 * - Redirecionar usuários não autorizados
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { authLoggingService } from '@/services/authLoggingService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
  requireClient?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requireAdmin = false,
  requireSuperAdmin = false,
  requireClient = false 
}: ProtectedRouteProps) => {
  const { isAuthenticated, isAdmin, isSuperAdmin, isClient, loading, user } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] Verificando acesso:', {
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    isClient,
    loading,
    userEmail: user?.email,
    userRoles: user?.roles,
    requireAdmin,
    requireSuperAdmin,
    requireClient,
    path: location.pathname
  });

  if (loading) {
    console.log('[ProtectedRoute] Ainda carregando...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] Usuário não autenticado, redirecionando para /login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super admin requer permissão específica
  if (requireSuperAdmin && !isSuperAdmin) {
    console.log('[ProtectedRoute] Super admin requerido mas usuário não tem permissão');
    
    // Registrar tentativa de acesso negado
    if (user) {
      setTimeout(() => {
        authLoggingService.logAccessDenied(
          user.id,
          user.email || '',
          'super_admin required',
          location.pathname
        );
      }, 0);
    }
    
    return <Navigate to="/403" state={{ required: 'super_admin' }} replace />;
  }

  // Admin pode ser admin ou super_admin
  if (requireAdmin && !isAdmin) {
    console.log('[ProtectedRoute] Admin requerido mas usuário não tem permissão', {
      isAdmin,
      userRoles: user?.roles
    });
    
    // Registrar tentativa de acesso negado
    if (user) {
      setTimeout(() => {
        authLoggingService.logAccessDenied(
          user.id,
          user.email || '',
          'admin required',
          location.pathname
        );
      }, 0);
    }
    
    return <Navigate to="/403" state={{ required: 'admin' }} replace />;
  }

  // Cliente precisa ter role client
  if (requireClient && !isClient) {
    console.log('[ProtectedRoute] Client requerido mas usuário não tem permissão');
    
    // Registrar tentativa de acesso negado
    if (user) {
      setTimeout(() => {
        authLoggingService.logAccessDenied(
          user.id,
          user.email || '',
          'client required',
          location.pathname
        );
      }, 0);
    }
    
    return <Navigate to="/403" state={{ required: 'client' }} replace />;
  }

  console.log('[ProtectedRoute] Acesso permitido');
  return <>{children}</>;
};
