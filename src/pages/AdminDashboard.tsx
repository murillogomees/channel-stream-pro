import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, Palette, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      navigate('/admin/login');
      return;
    }

    // Check if user is admin by email or id
    const { data: adminData } = await supabase
      .from('admins')
      .select('*')
      .or(`id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!adminData) {
      navigate('/admin/login');
      return;
    }

    // If admin exists but no auth id, update it
    if (adminData && !adminData.id) {
      await supabase
        .from('admins')
        .update({ id: user.id })
        .eq('email', user.email);
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
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

        <div className="grid gap-6 md:grid-cols-2">
          {/* Site Customization */}
          <Card className="bg-gradient-card border-border cursor-pointer hover:shadow-lg transition-smooth"
                onClick={() => navigate('/admin/customize')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Personalizar Site
              </CardTitle>
              <CardDescription>
                Edite cores, fontes, logotipos, textos e todos os elementos visuais da página inicial
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Edit3 className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">Customização Completa</p>
                  <p className="text-sm text-muted-foreground">
                    Configure header, hero, planos, contatos e mais
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Settings */}
          <Card className="bg-gradient-card border-border cursor-pointer hover:shadow-lg transition-smooth"
                onClick={() => navigate('/admin/settings')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Configurações
              </CardTitle>
              <CardDescription>
                Configurações gerais do sistema e administração
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Settings className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">Configurações do Sistema</p>
                  <p className="text-sm text-muted-foreground">
                    Gerencie administradores e configurações avançadas
                  </p>
                </div>
              </div>
            </CardContent>
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