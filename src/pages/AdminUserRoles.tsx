import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, UserPlus, Trash2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

const AdminUserRoles = () => {
  const { isAdmin, loading: authLoading } = useSupabaseAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("admin");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate('/admin/dashboard');
    }
  }, [isAdmin, authLoading, navigate, toast]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Buscar usuários do auth
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;

      // Buscar roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combinar dados
      const usersWithRoles: UserWithRole[] = (authUsers || []).map(user => {
        const userRoles = rolesData?.filter(r => r.user_id === user.id).map(r => r.role) || [];
        return {
          id: user.id,
          email: user.email || 'Sem email',
          created_at: user.created_at,
          roles: userRoles,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        title: "Erro ao carregar usuários",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const handleAddRole = async (userId: string, role: string) => {
    try {
      // Validar que o role é válido (conforme enum app_role)
      const validRoles = ['admin', 'user'];
      if (!validRoles.includes(role)) {
        throw new Error('Role inválida');
      }

      const { error } = await supabase
        .from('user_roles')
        .insert([{ 
          user_id: userId, 
          role: role as 'admin' | 'user'
        }]);

      if (error) throw error;

      toast({
        title: "Role adicionada",
        description: `Role "${role}" adicionada com sucesso.`,
      });

      loadUsers();
    } catch (error: any) {
      console.error('Error adding role:', error);
      toast({
        title: "Erro ao adicionar role",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role as 'admin' | 'user' | 'app_user');

      if (error) throw error;

      toast({
        title: "Role removida",
        description: `Role "${role}" removida com sucesso.`,
      });

      loadUsers();
    } catch (error: any) {
      console.error('Error removing role:', error);
      toast({
        title: "Erro ao remover role",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(emailFilter.toLowerCase())
  );

  if (authLoading || loading) {
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
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Gerenciar Roles de Usuários
            </h1>
            <p className="text-muted-foreground mt-1">
              Adicione ou remova roles de administrador, moderador, etc.
            </p>
          </div>
          <Button variant="outline" onClick={loadUsers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Roles definem permissões de acesso. Adicione "admin" para dar acesso total ao painel administrativo.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Usuários Registrados</CardTitle>
            <CardDescription>
              Total de {users.length} usuário(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Filtrar por email..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length === 0 ? (
                              <Badge variant="outline">Sem roles</Badge>
                            ) : (
                              user.roles.map((role) => (
                                <Badge key={role} variant="default" className="gap-1">
                                  {role}
                                  <button
                                    onClick={() => handleRemoveRole(user.id, role)}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <Select
                              value={selectedRole}
                              onValueChange={setSelectedRole}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => handleAddRole(user.id, selectedRole)}
                              disabled={user.roles.includes(selectedRole)}
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminUserRoles;
