import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Users, Shield, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadAdmins();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      navigate('/admin/login');
      return;
    }

    const { data: adminData } = await supabase
      .from('admins')
      .select('*')
      .or(`id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!adminData) {
      navigate('/admin/login');
      return;
    }
    
    setLoading(false);
  };

  const loadAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar administradores",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail || !newAdminName) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o email e nome do administrador",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('admins')
        .insert({
          email: newAdminEmail,
          name: newAdminName,
          password_hash: '$2b$10$X8pTBXu3gGrKM8YJ9Q6RVe8qJk4M6L7H9mE2tYqWvXpUwN5oCzVzi', // Default: admin123
          role: 'admin'
        });

      if (error) throw error;

      toast({
        title: "Administrador adicionado",
        description: `${newAdminName} foi adicionado com sucesso. Senha padrão: admin123`,
      });

      setNewAdminEmail("");
      setNewAdminName("");
      loadAdmins();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar administrador",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteAdmin = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover o administrador ${name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('admins')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Administrador removido",
        description: `${name} foi removido com sucesso`,
      });

      loadAdmins();
    } catch (error: any) {
      toast({
        title: "Erro ao remover administrador",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gradient-primary">Configurações do Sistema</h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Admin Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gerenciar Administradores
              </CardTitle>
              <CardDescription>
                Adicione ou remova administradores do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="admin-name">Nome</Label>
                  <Input
                    id="admin-name"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Nome do administrador"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addAdmin} disabled={saving}>
                    {saving ? "Adicionando..." : "Adicionar"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Administradores Atuais</h4>
                {admins.map((admin) => (
                  <div key={admin.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{admin.name}</p>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        admin.role === 'super_admin' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </div>
                    {admin.role !== 'super_admin' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteAdmin(admin.id, admin.name)}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Informações do Sistema
              </CardTitle>
              <CardDescription>
                Status e informações gerais do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-card rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <p className="font-medium">Status de Segurança</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Sistema protegido por RLS</p>
                </div>
                <div className="p-4 bg-card rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4 text-primary" />
                    <p className="font-medium">Banco de Dados</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Supabase - Online</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;