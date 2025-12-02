/**
 * AdminUserList - Lista completa de usuários com CRUD
 * Exibe todos os usuários do sistema com informações detalhadas
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfiles, UnifiedProfile } from '@/hooks/useProfiles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Search, RefreshCw, Edit, Trash2, Shield, User, Mail, Phone, Calendar, DollarSign, CreditCard, UserPlus, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdminUserForm } from '@/components/admin/AdminUserForm';

interface UserWithRole extends UnifiedProfile {
  roles: string[];
  totp_enabled?: boolean;
  totp_secret?: string;
  totp_verified_at?: string;
}

export default function AdminUserList() {
  const { profiles, loading: profilesLoading, refresh } = useProfiles();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  // Create user dialog state
  const [createDialog, setCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    email: '',
    password: '',
    nome: '',
    telefone: '',
    role: 'client' as 'client' | 'admin' | 'master',
  });

  useEffect(() => {
    loadUsersWithRoles();
  }, [profiles]);

  const loadUsersWithRoles = async () => {
    setLoading(true);
    try {
      // Buscar roles para cada perfil
      const usersWithRoles: UserWithRole[] = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);

          return {
            ...profile,
            roles: roles?.map(r => r.role) || ['client'],
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar lista de usuários',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: UserWithRole) => {
    setSelectedUser(user);
    setEditFormData({
      ...user,
      cliente_ativo: user.cliente_ativo ?? true,
      is_recorrente: user.is_recorrente ?? false,
      totp_enabled: user.totp_enabled ?? false,
      valor_pago: user.valor_pago ?? 0,
    });
    setEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedUser) return;

    try {
      // Preparar dados para update (remover campos readonly e undefined)
      const { id, created_at, updated_at, totp_secret, totp_verified_at, 
              roles, ...updateData } = editFormData;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Usuário atualizado com sucesso',
      });

      setEditDialog(false);
      refresh();
      loadUsersWithRoles();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar usuário',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (user: UserWithRole) => {
    setSelectedUser(user);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Usuário removido com sucesso',
      });

      setDeleteDialog(false);
      refresh();
      loadUsersWithRoles();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover usuário',
        variant: 'destructive',
      });
    }
  };

  const handleCreateUser = async () => {
    if (!createFormData.email || !createFormData.password || !createFormData.nome) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (createFormData.password.length < 8) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter no mínimo 8 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setCreateLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');

      const response = await fetch(
        `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/create-admin-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(createFormData),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      toast({
        title: 'Sucesso!',
        description: `Usuário ${createFormData.email} criado com sucesso`,
      });

      setCreateDialog(false);
      setCreateFormData({
        email: '',
        password: '',
        nome: '',
        telefone: '',
        role: 'client',
      });
      refresh();
      loadUsersWithRoles();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar usuário',
        variant: 'destructive',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const getRoleBadge = (roles: string[]) => {
    if (roles.includes('master')) {
      return <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">Master</Badge>;
    }
    if (roles.includes('admin')) {
      return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Admin</Badge>;
    }
    return <Badge variant="secondary">Cliente</Badge>;
  };

  const getStatusBadge = (situacao?: string) => {
    const status = situacao || 'Testando';
    const variants: Record<string, string> = {
      'Ativo': 'default',
      'Testando': 'secondary',
      'Inativo': 'destructive',
    };
    return <Badge variant={variants[status] as any || 'secondary'}>{status}</Badge>;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.telefone?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter);
    const matchesStatus = statusFilter === 'all' || user.situacao === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading || profilesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <User className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Administradores</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.roles.includes('admin') || u.roles.includes('master')).length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.situacao === 'Ativo').length}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Teste</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.situacao === 'Testando').length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Usuários</CardTitle>
              <CardDescription>Gerenciamento completo de todos os usuários do sistema</CardDescription>
            </div>
            <Button onClick={() => setCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Criar Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Filtrar role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Roles</SelectItem>
                <SelectItem value="master">Master</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Testando">Testando</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { refresh(); loadUsersWithRoles(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {/* Tabela de Usuários */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium">{user.nome}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.telefone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {user.telefone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.roles)}</TableCell>
                      <TableCell>{getStatusBadge(user.situacao)}</TableCell>
                      <TableCell>
                        <span className="text-sm">{user.plano || 'Não definido'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Dialog de Edição */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações do usuário {selectedUser?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="px-6">
            <AdminUserForm
              formData={editFormData}
              onChange={setEditFormData}
              isEdit={true}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} className="bg-primary hover:bg-primary/90">
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o usuário <strong>{selectedUser?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Criar Usuário */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados para criar um novo usuário no sistema
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-nome">Nome Completo *</Label>
              <Input
                id="create-nome"
                placeholder="Digite o nome completo"
                value={createFormData.nome}
                onChange={(e) => setCreateFormData({ ...createFormData, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Senha *</Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={createFormData.password}
                  onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-telefone">Telefone</Label>
              <Input
                id="create-telefone"
                placeholder="(00) 00000-0000"
                value={createFormData.telefone}
                onChange={(e) => setCreateFormData({ ...createFormData, telefone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Tipo de Usuário *</Label>
              <Select 
                value={createFormData.role} 
                onValueChange={(value: any) => setCreateFormData({ ...createFormData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)} disabled={createLoading}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={createLoading}>
              {createLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar Usuário
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
