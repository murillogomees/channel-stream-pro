/**
 * PROTEÇÃO DE ROTAS UNIFICADA
 * 
 * Usa o contexto de autenticação centralizado para:
 * - Verificar autenticação
 * - Verificar permissões (admin, super_admin, client)
 * - Redirecionar usuários não autorizados
 * 
 * OTIMIZADO: Não bloqueia a UI enquanto roles estão sendo carregados
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { authLoggingService } from '@/services/authLoggingService';
import { useEffect, useState } from 'react';

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
  const { isAuthenticated, isAdmin, isSuperAdmin, isClient, loading, user, session } = useAuth();
  const location = useLocation();
  
  // Estado para controlar timeout de segurança
  const [showTimeout, setShowTimeout] = useState(false);
  
  // Timeout de segurança - máximo 3 segundos de loading
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setShowTimeout(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowTimeout(false);
    }
  }, [loading]);

  // Se passou do timeout, considera como não autenticado e redireciona
  if (showTimeout && loading) {
    console.warn('[ProtectedRoute] Timeout de loading - redirecionando para login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Mostrar loading apenas por um tempo curto
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Não autenticado - redireciona para login
  if (!isAuthenticated && !session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se tem session mas roles ainda não carregaram, permite acesso temporário
  // (os roles serão verificados quando carregarem em background)
  const rolesNotLoadedYet = user && user.roles.length === 0;
  
  // Super admin requer permissão específica (mas espera roles carregarem)
  if (requireSuperAdmin && !isSuperAdmin && !rolesNotLoadedYet) {
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

  // Admin pode ser admin ou super_admin (mas espera roles carregarem)
  if (requireAdmin && !isAdmin && !rolesNotLoadedYet) {
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

  // Cliente precisa ter role client (mas espera roles carregarem)
  if (requireClient && !isClient && !rolesNotLoadedYet) {
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

  return <>{children}</>;
};
