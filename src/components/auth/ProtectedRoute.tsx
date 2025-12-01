/**
 * PROTEÇÃO DE ROTAS UNIFICADA
 * @version 2.0.0
 * 
 * Controle de acesso:
 * - /app/* → Apenas clientes autenticados com acesso válido
 * - /admin/* → Apenas administradores
 * - Clientes vencidos → Redireciona para checkout
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
  requireValidAccess?: boolean; // Requer acesso não vencido
}

export const ProtectedRoute = ({ 
  children, 
  requireAdmin = false,
  requireSuperAdmin = false,
  requireClient = false,
  requireValidAccess = false
}: ProtectedRouteProps) => {
  const { 
    isAuthenticated, 
    isAdmin, 
    isSuperAdmin, 
    isClient, 
    loading, 
    user, 
    session,
    hasValidAccess,
    isExpired 
  } = useAuth();
  const location = useLocation();
  
  const [showTimeout, setShowTimeout] = useState(false);
  
  // Detectar se é rota /app/*
  const isAppRoute = location.pathname.startsWith('/app');
  
  // Timeout de segurança - máximo 3 segundos
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

  // Timeout - redirecionar para login
  if (showTimeout && loading) {
    console.warn('[ProtectedRoute] Timeout - redirecionando para login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Não autenticado
  if (!isAuthenticated && !session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const rolesNotLoadedYet = user && user.roles.length === 0;
  
  // ========================================
  // VERIFICAÇÕES PARA ROTAS ADMIN
  // ========================================
  
  if (requireSuperAdmin && !isSuperAdmin && !rolesNotLoadedYet) {
    if (user) {
      setTimeout(() => {
        authLoggingService.logAccessDenied(user.id, user.email || '', 'super_admin required', location.pathname);
      }, 0);
    }
    return <Navigate to="/403" state={{ required: 'super_admin' }} replace />;
  }

  if (requireAdmin && !isAdmin && !rolesNotLoadedYet) {
    if (user) {
      setTimeout(() => {
        authLoggingService.logAccessDenied(user.id, user.email || '', 'admin required', location.pathname);
      }, 0);
    }
    // Se é cliente, redireciona para /app/player
    if (isClient) {
      return <Navigate to="/app/player" replace />;
    }
    return <Navigate to="/403" state={{ required: 'admin' }} replace />;
  }

  // ========================================
  // VERIFICAÇÕES PARA ROTAS /app/*
  // ========================================
  
  if (requireClient && !isClient && !isAdmin && !rolesNotLoadedYet) {
    if (user) {
      setTimeout(() => {
        authLoggingService.logAccessDenied(user.id, user.email || '', 'client required', location.pathname);
      }, 0);
    }
    return <Navigate to="/403" state={{ required: 'client' }} replace />;
  }

  // Verificar acesso válido (não vencido) para rotas /app/*
  if (isAppRoute || requireValidAccess) {
    // Admin sempre tem acesso
    if (isAdmin) {
      return <>{children}</>;
    }
    
    // Cliente com acesso vencido → checkout
    if (isExpired && !rolesNotLoadedYet) {
      console.log('[ProtectedRoute] Acesso vencido, redirecionando para checkout');
      return <Navigate to="/checkout" state={{ from: location, expired: true }} replace />;
    }
  }

  return <>{children}</>;
};
