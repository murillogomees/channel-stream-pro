import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ShieldAlert, Home, LogOut } from 'lucide-react';

export default function Forbidden() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, isAdmin, isClient } = useAuth();
  
  const state = location.state as { required?: string; has?: string } | undefined;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleGoHome = () => {
    if (isAdmin) {
      navigate('/dashboard');
    } else if (isClient) {
      navigate('/conta');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
            <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
              <p className="text-muted-foreground">
                Permissão necessária: <span className="font-semibold text-foreground">{state.required}</span>
              </p>
              {state.has && state.has !== 'none' && (
                <p className="text-muted-foreground mt-1">
                  Sua permissão atual: <span className="font-semibold text-foreground">{state.has}</span>
                </p>
              )}
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
