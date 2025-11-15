import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireClient?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  requireClient = false 
}: ProtectedRouteProps) => {
  const { isAuthenticated, isAdmin, isClient, loading } = useAuth();
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

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/403" state={{ required: 'admin', has: isClient ? 'client' : 'none' }} replace />;
  }

  if (requireClient && !isClient) {
    return <Navigate to="/403" state={{ required: 'client', has: isAdmin ? 'admin' : 'none' }} replace />;
  }

  return <>{children}</>;
};
