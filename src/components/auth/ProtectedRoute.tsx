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
  const { isAuthenticated, isAdmin, isSuperAdmin, isClient, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super admin requer permissão específica
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/403" state={{ required: 'super_admin' }} replace />;
  }

  // Admin pode ser admin ou super_admin
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/403" state={{ required: 'admin' }} replace />;
  }

  // Cliente precisa ter role client
  if (requireClient && !isClient) {
    return <Navigate to="/403" state={{ required: 'client' }} replace />;
  }

  return <>{children}</>;
};
