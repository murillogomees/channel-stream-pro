import { useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, Trash2, RefreshCw, Filter, CheckSquare, XSquare, Users, Crown, Star, User, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

const AdminUserRoles = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  // Estado individual por usuário para o select de role
  const [userRoleSelections, setUserRoleSelections] = useState<Record<string, string>>({});
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<string>("admin");
  const [bulkAction, setBulkAction] = useState<"add" | "remove">("add");

  // Função para obter a role selecionada de um usuário específico
  const getUserSelectedRole = (userId: string) => {
    return userRoleSelections[userId] || "admin";
  };

  // Função para atualizar a role selecionada de um usuário específico
  const setUserSelectedRole = (userId: string, role: string) => {
    setUserRoleSelections(prev => ({
      ...prev,
      [userId]: role
    }));
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data: usersResponse, error: usersError } = await supabase.functions.invoke('list-users');
      
      if (usersError) {
        console.error('Error invoking list-users:', usersError);
        throw new Error(usersError.message || 'Failed to load users');
      }

      if (!usersResponse?.users) {
        throw new Error('Invalid response from list-users function');
      }

      const usersWithRoles: UserWithRole[] = usersResponse.users.map((user: any) => ({
        id: user.id,
        email: user.email || 'Sem email',
        created_at: user.created_at,
        roles: user.roles || [],
      }));

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
    loadUsers();
  }, []);

  const handleAddRole = async (userId: string, role: string) => {
    try {
      const validRoles = ['admin', 'client', 'master'];
      if (!validRoles.includes(role)) {
        throw new Error('Role inválida');
      }

      if (role === 'master' && !currentUser?.isMaster) {
        throw new Error('Apenas o usuário master pode criar outros masters');
      }

      const { error } = await (supabase as any)
        .from('user_roles')
        .insert([{ user_id: userId, role: role }]);

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
      const { error } = await (supabase as any)
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

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

  const handleBulkAction = async () => {
    if (selectedUsers.size === 0) {
      toast({
        title: "Nenhum usuário selecionado",
        description: "Selecione pelo menos um usuário para aplicar ações em lote.",
        variant: "destructive",
      });
      return;
    }

    const userIds = Array.from(selectedUsers);
    let successCount = 0;
    let errorCount = 0;

    for (const userId of userIds) {
      try {
        if (bulkAction === 'add') {
          await handleAddRole(userId, bulkRole);
        } else {
          await handleRemoveRole(userId, bulkRole);
        }
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    toast({
      title: "Ação em lote concluída",
      description: `${successCount} usuário(s) atualizado(s). ${errorCount > 0 ? `${errorCount} erro(s).` : ''}`,
    });

    setSelectedUsers(new Set());
    loadUsers();
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesEmail = user.email.toLowerCase().includes(emailFilter.toLowerCase());
    const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
    return matchesEmail && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'master':
        return <Badge className="bg-stat-purple/20 text-stat-purple border-stat-purple/30 gap-1"><Crown className="h-3 w-3" />Master</Badge>;
      case 'admin':
        return <Badge className="bg-stat-primary/20 text-stat-primary border-stat-primary/30 gap-1"><Shield className="h-3 w-3" />Admin</Badge>;
      case 'client':
        return <Badge className="bg-stat-info/20 text-stat-info border-stat-info/30 gap-1"><User className="h-3 w-3" />Cliente</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  // Stats
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.roles.includes('admin')).length;
  const masterCount = users.filter(u => u.roles.includes('master')).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Carregando usuários...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="stat">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Usuários</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalUsers}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-stat-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-stat-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="stat-info">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Administradores</p>
                <p className="text-3xl font-bold text-foreground mt-1">{adminCount}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-stat-info/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-stat-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="stat-purple">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Masters</p>
                <p className="text-3xl font-bold text-foreground mt-1">{masterCount}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-stat-purple/10 flex items-center justify-center">
                <Crown className="h-6 w-6 text-stat-purple" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card variant="surface">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              Filtros
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadUsers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por email..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Todas as roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as roles</SelectItem>
                <SelectItem value="master">Master</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <Card variant="accent">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <span className="font-semibold">{selectedUsers.size} usuário(s) selecionado(s)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <Select value={bulkAction} onValueChange={(v) => setBulkAction(v as "add" | "remove")}>
                  <SelectTrigger className="w-32 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Adicionar</SelectItem>
                    <SelectItem value="remove">Remover</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={bulkRole} onValueChange={setBulkRole}>
                  <SelectTrigger className="w-32 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUser?.isMaster && <SelectItem value="master">Master</SelectItem>}
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="client">Cliente</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleBulkAction} size="sm">
                  Aplicar
                </Button>
                <Button onClick={() => setSelectedUsers(new Set())} variant="ghost" size="sm">
                  <XSquare className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-stat-primary" />
            Gerenciamento de Roles
          </CardTitle>
          <CardDescription>
            {filteredUsers.length} usuário(s) encontrado(s) • Adicione ou remova roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">ID</TableHead>
                  <TableHead className="font-semibold">Roles</TableHead>
                  <TableHead className="font-semibold">Cadastro</TableHead>
                  <TableHead className="text-right font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/20">
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{user.email}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {user.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {user.roles.length === 0 ? (
                            <Badge variant="outline" className="text-muted-foreground">Sem roles</Badge>
                          ) : (
                            user.roles.map((role) => (
                              <div key={role} className="flex items-center">
                                {getRoleBadge(role)}
                                <button
                                  onClick={() => handleRemoveRole(user.id, role)}
                                  className="ml-1 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={getUserSelectedRole(user.id)}
                            onValueChange={(role) => setUserSelectedRole(user.id, role)}
                          >
                            <SelectTrigger className="w-28 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              {currentUser?.isMaster && <SelectItem value="master">Master</SelectItem>}
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="client">Cliente</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAddRole(user.id, getUserSelectedRole(user.id))}
                            disabled={user.roles.includes(getUserSelectedRole(user.id))}
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
  );
};

export default AdminUserRoles;
