/**
 * PROTEÇÃO DE ROTAS UNIFICADA
 * @version 2.0.1
 *
 * Controle de acesso:
 * - /admin/* → Apenas administradores
 * - Clientes vencidos → Redireciona para checkout
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { authLoggingService } from '@/services/authLoggingService';
import { useEffect, useState } from 'react';
import { supabaseConfig } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireMaster?: boolean;
  requireClient?: boolean;
  requireValidAccess?: boolean; // Requer acesso não vencido
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
  
  const [showTimeout, setShowTimeout] = useState(false);
  
  // Detectar se é rota que requer acesso válido
  const isAppRoute = false; // /app/* routes removed
  
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
  
  if (requireMaster && !isMaster && !rolesNotLoadedYet) {
    if (user) {
      console.warn('[ProtectedRoute] Access denied (master required)', {
        path: location.pathname,
        userId: user.id,
        email: user.email,
        roles: user.roles,
        isAdmin,
        isMaster,
        backend: supabaseConfig.url,
      });

      setTimeout(() => {
        authLoggingService.logAccessDenied(user.id, user.email || '', 'master required', location.pathname);
      }, 0);
    }
    return <Navigate to="/403" state={{ required: 'master', has: user?.roles?.[0] ?? 'none' }} replace />;
  }

  if (requireAdmin && !isAdmin && !isMaster && !rolesNotLoadedYet) {
    if (user) {
      console.warn('[ProtectedRoute] Access denied (admin required)', {
        path: location.pathname,
        userId: user.id,
        email: user.email,
        roles: user.roles,
        isAdmin,
        isMaster,
        backend: supabaseConfig.url,
      });

      setTimeout(() => {
        authLoggingService.logAccessDenied(user.id, user.email || '', 'admin required', location.pathname);
      }, 0);
    }
    return <Navigate to="/403" state={{ required: 'admin', has: user?.roles?.[0] ?? 'none' }} replace />;
  }

  // ========================================
  // VERIFICAÇÕES PARA ROTAS /app/*
  // ========================================
  
  if (requireClient && !isClient && !isAdmin && !rolesNotLoadedYet) {
    if (user) {
      console.warn('[ProtectedRoute] Access denied (client required)', {
        path: location.pathname,
        userId: user.id,
        email: user.email,
        roles: user.roles,
        isAdmin,
        isMaster,
        backend: supabaseConfig.url,
      });

      setTimeout(() => {
        authLoggingService.logAccessDenied(user.id, user.email || '', 'client required', location.pathname);
      }, 0);
    }
    return <Navigate to="/403" state={{ required: 'client', has: user?.roles?.[0] ?? 'none' }} replace />;
  }

  // Verificar acesso válido (não vencido)
  const allowedExpiredPaths = [
    '/profile',
    '/checkout',
    '/checkout/success',
    '/checkout/failure',
    '/checkout/pending',
  ];
  
  const isAllowedPath = allowedExpiredPaths.some(p => location.pathname.startsWith(p));
  
  if (isAppRoute || requireValidAccess) {
    // Admin/Master sempre tem acesso
    if (isAdmin || isMaster) {
      return <>{children}</>;
    }
    
    // Aguardar roles carregarem antes de redirecionar
    if (rolesNotLoadedYet) {
      return <>{children}</>;
    }
    
    // Cliente com acesso vencido → perfil (exceto se já está em rota permitida)
    if (isExpired && !isAllowedPath) {
      return <Navigate to="/profile" state={{ from: location, expired: true }} replace />;
    }
  }

  return <>{children}</>;
};
