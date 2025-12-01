import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Shield, User, Users, Crown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/types/auth';

interface UserWithRole {
  user_id: string;
  email: string;
  nome: string;
  role: AppRole;
  created_at: string;
}

export default function AdminRolesManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isMaster, isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin && !isMaster) {
      navigate('/403');
      return;
    }
    loadUsers();
  }, [isAdmin, isMaster, navigate]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          role,
          created_at,
          profiles!inner (
            nome,
            email
          )
        `);

      if (error) throw error;

      const mappedUsers: UserWithRole[] = (data || []).map((item: any) => ({
        user_id: item.user_id,
        email: item.profiles?.email || 'N/A',
        nome: item.profiles?.nome || 'Sem nome',
        role: item.role,
        created_at: item.created_at,
      }));

      setUsers(mappedUsers);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    // Apenas master pode alterar roles de admin ou criar masters
    if (!isMaster && (newRole === 'admin' || newRole === 'master')) {
      toast({
        title: 'Permissão negada',
        description: 'Apenas o master pode gerenciar roles de admin',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Role atualizada',
        description: 'A permissão do usuário foi alterada com sucesso',
      });

      await loadUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Erro ao atualizar role',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const getRoleIcon = (role: AppRole) => {
    switch (role) {
      case 'master':
        return <Crown className="h-4 w-4 text-amber-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'client':
        return <User className="h-4 w-4 text-green-500" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'master':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'client':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case 'master':
        return 'Master';
      case 'admin':
        return 'Administrador';
      case 'client':
        return 'Cliente';
      default:
        return role;
    }
  };

  const stats = {
    total: users.length,
    masters: users.filter(u => u.role === 'master').length,
    admins: users.filter(u => u.role === 'admin').length,
    clients: users.filter(u => u.role === 'client').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin/usuarios')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento de Roles</h1>
            <p className="text-muted-foreground">Controle as permissões de acesso dos usuários</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total de Usuários</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Users className="h-6 w-6" />
                {stats.total}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Masters</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Crown className="h-6 w-6 text-amber-500" />
                {stats.masters}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Administradores</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Shield className="h-6 w-6 text-blue-500" />
                {stats.admins}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Clientes</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <User className="h-6 w-6 text-green-500" />
                {stats.clients}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários e Permissões</CardTitle>
            <CardDescription>
              Gerencie as roles de acesso de cada usuário
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role Atual</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.nome}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1 w-fit">
                        {getRoleIcon(user.role)}
                        {getRoleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) => handleRoleChange(user.user_id, newRole as AppRole)}
                        disabled={updating === user.user_id || (!isMaster && user.role === 'master')}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Cliente</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                          {isMaster && <SelectItem value="master">Master</SelectItem>}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted">
          <CardHeader>
            <CardTitle className="text-lg">ℹ️ Informações sobre Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Crown className="h-4 w-4 text-amber-500 mt-0.5" />
              <div>
                <strong>Master:</strong> Acesso total ao sistema, incluindo gerenciamento de admins
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-blue-500 mt-0.5" />
              <div>
                <strong>Admin:</strong> Acesso ao dashboard e funções administrativas + streaming
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <strong>Client:</strong> Acesso apenas ao player de streaming (/app/*)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
