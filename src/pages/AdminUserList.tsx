/**
 * AdminUserList - Lista completa de usuários com CRUD
 * Exibe todos os usuários do sistema com informações detalhadas
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfiles, UnifiedProfile } from '@/hooks/useProfiles';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Search, RefreshCw, Edit, Trash2, Shield, User, Mail, Phone, Calendar, DollarSign, CreditCard, UserPlus, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdminUserForm } from '@/components/admin/AdminUserForm';
import { SUPABASE_FUNCTIONS_URL } from '@/config/supabase';

interface UserWithRole extends UnifiedProfile {
  roles: string[];
  totp_enabled?: boolean;
  totp_secret?: string;
  totp_verified_at?: string;
}

export default function AdminUserList() {
  const { profiles, loading: profilesLoading, refresh } = useProfiles();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  
  // Get current user's role - usar isAdmin/isMaster que são mais confiáveis
  const currentUserRole: 'client' | 'admin' | 'master' = 
    currentUser?.isMaster ? 'master' : 
    currentUser?.isAdmin ? 'admin' : 
    (currentUser?.roles?.[0] as 'client' | 'admin' | 'master') || 'client';
  
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [enviarNotificacao, setEnviarNotificacao] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Create user dialog state
  const [createDialog, setCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createFormData, setCreateFormData] = useState<any>({
    email: '',
    password: '',
    nome: '',
    contact_phone: '',
    cliente_ativo: true,
    situacao: 'Testando',
    plano: 'Mensal',
    valor_pago: 0,
    is_recorrente: false,
    user_role: 'client', // Default role para novos usuários
  });

  useEffect(() => {
    // Profiles já vem com roles do useProfiles via Edge Function
    if (profiles.length > 0) {
      const usersWithRoles: UserWithRole[] = profiles.map(profile => ({
        ...profile,
        roles: profile.roles || ['client'],
      }));
      setUsers(usersWithRoles);
      setLoading(false);
    } else if (!profilesLoading) {
      setUsers([]);
      setLoading(false);
    }
  }, [profiles, profilesLoading]);

  const loadUsersWithRoles = async () => {
    // Apenas refresh dos profiles - roles já vem junto via Edge Function
    refresh();
  };

  const handleEdit = (user: UserWithRole) => {
    // Determinar a role do usuário sendo editado
    const userRole = user.roles && user.roles.length > 0 ? user.roles[0] : 'client';
    
    
    
    setSelectedUser(user);
    setEditFormData({
      ...user,
      cliente_ativo: user.cliente_ativo ?? true,
      totp_enabled: user.totp_enabled ?? false,
      valor_pago: user.valor_pago ?? 0,
      user_role: userRole as 'client' | 'admin' | 'master',
    });
    setEnviarNotificacao(false);
    setEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedUser) return;

    setSavingEdit(true);
    try {
      // Detectar se cliente foi desativado
      const clienteEraAtivo = selectedUser.cliente_ativo !== false;
      const clienteAgoraInativo = editFormData.cliente_ativo === false;
      const clienteDesativado = clienteEraAtivo && clienteAgoraInativo;

      // Preparar dados para update (remover campos readonly e que não existem em profiles)
      const { id, created_at, updated_at, totp_secret, totp_verified_at, totp_enabled,
              roles, user_role, ...updateData } = editFormData;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', selectedUser.id);

      if (error) throw error;

      // Atualizar role se foi alterada
      const oldRole = selectedUser.roles[0] || 'client';
      const newRole = user_role || 'client';
      
      if (oldRole !== newRole) {
        // Deletar role antiga
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', selectedUser.id);
        
        // Inserir nova role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: selectedUser.id, role: newRole });
        
        if (roleError) {
          console.error('Erro ao atualizar role:', roleError);
          toast({
            title: 'Aviso',
            description: 'Usuário atualizado, mas erro ao alterar função',
            variant: 'default',
          });
        }
      }

      // Enviar notificação se cliente foi desativado e checkbox está marcada
      if (clienteDesativado && enviarNotificacao) {
        try {
          
          const { automaticNotificationTriggerService } = await import('@/services/automaticNotificationTriggerService');
          
          const telefoneCliente = editFormData.contact_phone || 
                                  selectedUser.contact_phone || '';
          
          const clienteData = {
            id: selectedUser.id,
            nome: editFormData.nome || selectedUser.nome,
            email: editFormData.email || selectedUser.email,
            telefone: telefoneCliente,
            plano: editFormData.plano || selectedUser.plano,
            situacao: editFormData.situacao || 'Inativo',
            dataVencimento: editFormData.data_vencimento || selectedUser.data_vencimento,
            dataContratacao: editFormData.data_contratacao || selectedUser.data_contratacao,
            valorPago: editFormData.valor_pago || selectedUser.valor_pago || 0,
            dataCadastro: selectedUser.created_at,
            dataUltimaEdicao: new Date().toISOString(),
            clienteAtivo: false,
          };

          const result = await automaticNotificationTriggerService.triggerClientDeactivation(clienteData as any);
          
          if (result.messagesSent > 0) {
            toast({
              title: 'Notificação enviada',
              description: `Mensagem de desativação enviada para ${editFormData.nome}`,
            });
          } else if (result.errors.length > 0) {
            console.warn('[AdminUserList] Erros ao enviar notificação:', result.errors);
            toast({
              title: 'Aviso',
              description: result.errors[0],
              variant: 'default',
            });
          }
        } catch (notifError) {
          console.error('[AdminUserList] Erro ao enviar notificação:', notifError);
          toast({
            title: 'Aviso',
            description: 'Usuário atualizado, mas erro ao enviar notificação',
            variant: 'default',
          });
        }
      }

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
    } finally {
      setSavingEdit(false);
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
        description: 'Preencha todos os campos obrigatórios (nome, email e senha)',
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

      // Determinar role a ser atribuída com base nas permissões
      let roleToAssign = createFormData.user_role || 'client';
      
      // Validar permissões: admin só pode criar client
      if (currentUserRole === 'admin' && roleToAssign !== 'client') {
        roleToAssign = 'client';
      }
      // Apenas master pode criar admin ou master
      if (currentUserRole !== 'master' && (roleToAssign === 'admin' || roleToAssign === 'master')) {
        roleToAssign = 'client';
      }

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/create-admin-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: createFormData.email,
            password: createFormData.password,
            name: createFormData.nome,
            phone: createFormData.contact_phone || '',
            role: roleToAssign,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      // Update profile with additional data if user was created
      if (result.user?.id) {
        await supabase
          .from('profiles')
          .update({
            cliente_ativo: createFormData.cliente_ativo,
            situacao: createFormData.situacao,
            plano: createFormData.plano,
            valor_pago: createFormData.valor_pago,
            is_recorrente: createFormData.is_recorrente,
            origem_cadastro: createFormData.origem_cadastro,
            data_contratacao: createFormData.data_contratacao,
            data_vencimento: createFormData.data_vencimento,
            forma_ultimo_pagamento: createFormData.forma_ultimo_pagamento,
          })
          .eq('id', result.user.id);
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
        contact_phone: '',
        cliente_ativo: true,
        situacao: 'Testando',
        plano: 'Mensal',
        valor_pago: 0,
        is_recorrente: false,
        user_role: 'client',
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
      (user.contact_phone || '').toLowerCase().includes(searchTerm.toLowerCase());

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
                <p className="text-xl sm:text-2xl font-bold">{users.length}</p>
              </div>
              <User className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Admins</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {users.filter(u => u.roles.includes('admin') || u.roles.includes('master')).length}
                </p>
              </div>
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Ativos</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {users.filter(u => u.situacao === 'Ativo').length}
                </p>
              </div>
              <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Testando</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {users.filter(u => u.situacao === 'Testando').length}
                </p>
              </div>
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">Lista de Usuários</CardTitle>
              <CardDescription className="text-sm hidden sm:block">Gerenciamento completo de todos os usuários</CardDescription>
            </div>
            <Button onClick={() => setCreateDialog(true)} className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4 mr-2" />
              Criar Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div className="flex flex-col gap-3 mb-4 sm:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-11"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="flex-1 min-w-[120px] h-10">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Roles</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 min-w-[120px] h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Testando">Testando</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => { refresh(); loadUsersWithRoles(); }} className="h-10 px-3">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Tabela de Usuários - Responsiva */}
          <div className="rounded-md border overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Usuário</TableHead>
                  <TableHead className="min-w-[120px] hidden sm:table-cell">Contato</TableHead>
                  <TableHead className="min-w-[80px]">Role</TableHead>
                  <TableHead className="min-w-[80px]">Status</TableHead>
                  <TableHead className="min-w-[100px] hidden md:table-cell">Plano</TableHead>
                  <TableHead className="min-w-[100px] hidden lg:table-cell">Cadastro</TableHead>
                  <TableHead className="text-right min-w-[80px]">Ações</TableHead>
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
                          <div className="min-w-0">
                            <p className="font-medium truncate">{user.nome}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="text-sm">
                          {user.contact_phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{user.contact_phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.roles)}</TableCell>
                      <TableCell>{getStatusBadge(user.situacao)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{user.plano || '-'}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(user.created_at), 'dd/MM/yy', { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
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
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
            <DialogTitle className="text-lg sm:text-xl">Editar Usuário</DialogTitle>
            <DialogDescription className="text-sm">
              Altere as informações do usuário {selectedUser?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 sm:px-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            <AdminUserForm
              formData={editFormData}
              onChange={setEditFormData}
              isEdit={true}
              currentUserRole={currentUserRole}
            />
          </div>
          
          {/* Checkbox de notificação ao desativar */}
          {selectedUser?.cliente_ativo !== false && editFormData.cliente_ativo === false && (
            <div className="px-4 sm:px-6 pb-4 pt-2 border-t">
              <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Checkbox
                  id="enviar-notificacao"
                  checked={enviarNotificacao}
                  onCheckedChange={(checked) => setEnviarNotificacao(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="enviar-notificacao" className="text-sm font-medium cursor-pointer">
                    📱 Enviar notificação WhatsApp
                  </Label>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Uma mensagem será enviada informando sobre a desativação
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditDialog(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button 
              onClick={handleEditSubmit} 
              className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
              disabled={savingEdit}
            >
              {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
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
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
            <DialogTitle className="text-lg sm:text-xl">Criar Novo Usuário</DialogTitle>
            <DialogDescription className="text-sm">
              Preencha os dados para criar um novo usuário
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
            {/* Campos de Autenticação */}
            <div className="px-4 sm:px-6 space-y-4 border-b pb-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 sm:p-4">
                <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Dados de Acesso
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-email" className="text-sm font-medium flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="create-email"
                      type="email"
                      placeholder="usuario@exemplo.com"
                      value={createFormData.email || ''}
                      onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                      className="h-11 sm:h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-password" className="text-sm font-medium flex items-center gap-2">
                      Senha <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="create-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres"
                        value={createFormData.password || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                        className="h-11 sm:h-12 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-11 sm:h-12"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Form completo usando AdminUserForm */}
            <div className="px-4 sm:px-6">
              <AdminUserForm
                formData={createFormData}
                onChange={setCreateFormData}
                isEdit={false}
                hideEmail={true}
                currentUserRole={currentUserRole}
              />
            </div>
          </div>
          
          <DialogFooter className="px-4 sm:px-6 pb-4 sm:pb-6 border-t pt-4 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCreateDialog(false)} disabled={createLoading} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={createLoading} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
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
