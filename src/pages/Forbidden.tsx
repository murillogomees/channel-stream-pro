import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseConfig } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShieldAlert, Home, LogOut, ArrowLeft } from 'lucide-react';

export default function Forbidden() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, refreshUser, user, isAdmin, isClient } = useAuth();

  const state = location.state as { required?: string; has?: string } | undefined;

  const [refreshing, setRefreshing] = useState(false);
  const didRefreshRef = useRef(false);

  // Se o usuário acabou de ter a role alterada, força uma atualização aqui para evitar ficar preso no /403.
  useEffect(() => {
    if (!state?.required) return;
    if (!user) return;
    if (isAdmin) return;
    if (didRefreshRef.current) return;

    didRefreshRef.current = true;
    setRefreshing(true);
    refreshUser().finally(() => setRefreshing(false));
  }, [state?.required, user, isAdmin, refreshUser]);

  // Se, após o refresh, o usuário passou a ser admin/master, manda direto pro dashboard.
  useEffect(() => {
    if (state?.required && isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [state?.required, isAdmin, navigate]);

  const debugInfo = useMemo(() => {
    if (!import.meta.env.DEV) return null;

    return {
      backendUrl: supabaseConfig.url,
      userId: user?.id,
      email: user?.email,
      roles: user?.roles,
      isAdmin,
      isClient,
    };
  }, [user?.id, user?.email, user?.roles, isAdmin, isClient]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleGoHome = () => {
    if (isAdmin) {
      navigate('/admin/dashboard');
      return;
    }

    if (isClient) {
      navigate('/app/home');
      return;
    }

    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 left-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          className="hover:bg-primary/10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <ShieldAlert className="h-12 w-12 text-destructive" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Acesso Negado</h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>

          {state?.required && (
            <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-left">
              <p className="text-muted-foreground">
                Permissão necessária:{' '}
                <span className="font-semibold text-foreground">{state.required}</span>
              </p>
              {state.has && state.has !== 'none' && (
                <p className="text-muted-foreground mt-1">
                  Sua permissão atual:{' '}
                  <span className="font-semibold text-foreground">{state.has}</span>
                </p>
              )}

              {refreshing && (
                <p className="text-muted-foreground mt-2">
                  Atualizando permissões…
                </p>
              )}
            </div>
          )}

          {debugInfo && (
            <div className="mt-4 p-3 bg-muted rounded-lg text-xs text-left space-y-1">
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Diagnóstico (DEV)</span>
              </p>
              <p className="text-muted-foreground">Backend: <span className="font-mono text-foreground">{debugInfo.backendUrl || '—'}</span></p>
              <p className="text-muted-foreground">Usuário: <span className="font-mono text-foreground">{debugInfo.email || '—'}</span></p>
              <p className="text-muted-foreground">User ID: <span className="font-mono text-foreground">{debugInfo.userId || '—'}</span></p>
              <p className="text-muted-foreground">Roles: <span className="font-mono text-foreground">{(debugInfo.roles || []).join(', ') || '—'}</span></p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Button onClick={handleGoHome} className="w-full">
            <Home className="mr-2 h-4 w-4" />
            Voltar ao Início
          </Button>

          <Button onClick={handleSignOut} variant="outline" className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Fazer Logout
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Se você acredita que deveria ter acesso, entre em contato com o administrador.
        </p>
      </Card>
    </div>
  );
}
