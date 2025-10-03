import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, Palette, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, loading } = useAdminAuth();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/admin/login');
    }
  }, [isAdmin, loading, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gradient-primary">Painel Administrativo</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        <div className="mb-8">
          {/* Site Customization */}
          <Card className="bg-gradient-card border-border cursor-pointer hover:shadow-lg transition-smooth w-full"
                onClick={() => navigate('/admin/customize')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              <div className="md:col-span-1">
                <div className="flex items-center gap-3 mb-3">
                  <Palette className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-bold">Personalizar Site</h3>
                </div>
                <p className="text-muted-foreground">
                  Edite cores, fontes, logotipos, textos e todos os elementos visuais da página inicial
                </p>
              </div>
              
              <div className="md:col-span-1 flex items-center justify-center">
                <div className="flex items-center gap-4">
                  <Edit3 className="h-12 w-12 text-primary/60" />
                  <div>
                    <p className="font-semibold text-lg">Customização Completa</p>
                    <p className="text-sm text-muted-foreground">
                      Interface intuitiva e fácil
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="md:col-span-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-primary/10 p-2 rounded">Header</div>
                    <div className="bg-accent/10 p-2 rounded">Hero</div>
                    <div className="bg-secondary/30 p-2 rounded">Planos</div>
                    <div className="bg-muted/30 p-2 rounded">Contatos</div>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    Configure todas as seções
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="mt-8">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle>Resumo do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-card rounded-lg border">
                  <p className="text-2xl font-bold text-primary">100%</p>
                  <p className="text-sm text-muted-foreground">Sistema Online</p>
                </div>
                <div className="text-center p-4 bg-card rounded-lg border">
                  <p className="text-2xl font-bold text-primary">24h</p>
                  <p className="text-sm text-muted-foreground">Uptime</p>
                </div>
                <div className="text-center p-4 bg-card rounded-lg border">
                  <p className="text-2xl font-bold text-primary">Ativo</p>
                  <p className="text-sm text-muted-foreground">Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;