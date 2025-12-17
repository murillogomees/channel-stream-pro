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
  
  if (requireMaster && !isMaster && !rolesNotLoadedYet) {
    if (user) {
      setTimeout(() => {
        authLoggingService.logAccessDenied(user.id, user.email || '', 'master required', location.pathname);
      }, 0);
    }
    return <Navigate to="/403" state={{ required: 'master' }} replace />;
  }

  if (requireAdmin && !isAdmin && !rolesNotLoadedYet) {
    if (user) {
      setTimeout(() => {
        authLoggingService.logAccessDenied(user.id, user.email || '', 'admin required', location.pathname);
      }, 0);
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
  // Rotas permitidas mesmo com acesso expirado (fluxo de assinatura)
  const allowedExpiredPaths = [
    '/app/profile',
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
      return <Navigate to="/app/profile" state={{ from: location, expired: true }} replace />;
    }
  }

  return <>{children}</>;
};
