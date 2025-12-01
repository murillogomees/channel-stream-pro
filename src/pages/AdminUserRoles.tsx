import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, Shield, UserPlus, Trash2, RefreshCw, History, Filter, CheckSquare, XSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DatePicker } from "@/components/ui/date-picker";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
}

interface AuditLog {
  id: string;
  user_id: string;
  changed_by: string;
  action: 'added' | 'removed';
  role: string;
  created_at: string;
  user_email?: string;
  changed_by_email?: string;
}

const AdminUserRoles = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<string>("admin");
  const [bulkAction, setBulkAction] = useState<"add" | "remove">("add");

  const loadUsers = async () => {
    try {
      setLoading(true);

      // Call Edge Function to list users (uses service_role internally)
      const { data: usersResponse, error: usersError } = await supabase.functions.invoke('list-users');
      
      if (usersError) {
        console.error('Error invoking list-users:', usersError);
        throw new Error(usersError.message || 'Failed to load users');
      }

      if (!usersResponse?.users) {
        throw new Error('Invalid response from list-users function');
      }

      // Transform response to match UserWithRole interface
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

  const loadAuditLogs = async () => {
    try {
      const { data: logs, error } = await (supabase as any)
        .from('role_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
      
      const enrichedLogs: AuditLog[] = (logs || []).map((log: any) => {
        const user = (authUsers || []).find((u: any) => u.id === log.user_id);
        const changedBy = (authUsers || []).find((u: any) => u.id === log.changed_by);
        return {
          id: log.id,
          user_id: log.user_id,
          changed_by: log.changed_by,
          action: log.action,
          role: log.role,
          created_at: log.created_at,
          user_email: user?.email || 'Usuário desconhecido',
          changed_by_email: changedBy?.email || 'Admin desconhecido',
        };
      });

      setAuditLogs(enrichedLogs);
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadAuditLogs();
  }, []);

  const logAuditAction = async (userId: string, action: 'added' | 'removed', role: string) => {
    try {
      if (!currentUser?.id) return;
      
      await (supabase as any)
        .from('role_audit_log')
        .insert([{
          user_id: userId,
          changed_by: currentUser.id,
          action,
          role: role as 'admin' | 'client',
        }]);
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  };

  const handleAddRole = async (userId: string, role: string) => {
    try {
      const validRoles = ['admin', 'client', 'master'];
      if (!validRoles.includes(role)) {
        throw new Error('Role inválida');
      }

      // Apenas master pode criar outros masters ou modificar admins
      if (role === 'master' && !currentUser?.isMaster) {
        throw new Error('Apenas o usuário master pode criar outros masters');
      }

      const { error } = await (supabase as any)
        .from('user_roles')
        .insert([{ 
          user_id: userId, 
          role: role
        }]);

      if (error) throw error;

      await logAuditAction(userId, 'added', role);

      toast({
        title: "Role adicionada",
        description: `Role "${role}" adicionada com sucesso.`,
      });

      loadUsers();
      loadAuditLogs();
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

      await logAuditAction(userId, 'removed', role);

      toast({
        title: "Role removida",
        description: `Role "${role}" removida com sucesso.`,
      });

      loadUsers();
      loadAuditLogs();
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

    try {
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
      loadAuditLogs();
    } catch (error: any) {
      toast({
        title: "Erro na ação em lote",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
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
    const matchesId = userIdFilter === "" || user.id.toLowerCase().includes(userIdFilter.toLowerCase());
    const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
    const matchesDate = dateFilter === "" || user.created_at.startsWith(dateFilter);
    
    return matchesEmail && matchesId && matchesRole && matchesDate;
  });

  const filteredLogs = auditLogs.filter(log => {
    const matchesEmail = emailFilter === "" || log.user_email?.toLowerCase().includes(emailFilter.toLowerCase());
    const matchesId = userIdFilter === "" || log.user_id.toLowerCase().includes(userIdFilter.toLowerCase());
    const matchesRole = roleFilter === "all" || log.role === roleFilter;
    const matchesDate = dateFilter === "" || log.created_at.startsWith(dateFilter);
    
    return matchesEmail && matchesId && matchesRole && matchesDate;
  });

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <Button variant="ghost" onClick={() => navigate('/admin/dashboard')} className="flex-shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Voltar</span>
            </Button>
          </div>
          <Button onClick={() => { loadUsers(); loadAuditLogs(); }} variant="outline" className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Gerencie as permissões dos usuários do sistema. Role 'admin' concede acesso total ao painel administrativo.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 h-auto">
            <TabsTrigger value="users" className="text-xs sm:text-sm py-2">
              <Shield className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Gerenciar Roles</span>
              <span className="sm:hidden">Roles</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs sm:text-sm py-2">
              <History className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Histórico</span>
              <span className="sm:hidden">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Roles</CardTitle>
                <CardDescription>
                  Adicione ou remova roles de usuários cadastrados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filtros Avançados */}
                <div className="mb-6 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Filtros</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                      <Input
                        placeholder="Filtrar por email..."
                        value={emailFilter}
                        onChange={(e) => setEmailFilter(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">ID do Usuário</label>
                      <Input
                        placeholder="Filtrar por ID..."
                        value={userIdFilter}
                        onChange={(e) => setUserIdFilter(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Role</label>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as roles</SelectItem>
                          <SelectItem value="master">Master</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Data de Cadastro</label>
                      <DatePicker
                        date={dateFilter ? parseISO(dateFilter) : undefined}
                        onDateChange={(date) => setDateFilter(date ? format(date, 'yyyy-MM-dd') : '')}
                        placeholder="Filtrar por data"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Ações em Lote */}
                {selectedUsers.size > 0 && (
                  <Card className="mb-4 border-primary">
                    <CardContent className="pt-4">
                      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-5 w-5 text-primary" />
                          <span className="font-semibold">{selectedUsers.size} usuário(s) selecionado(s)</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                          <Select value={bulkAction} onValueChange={(v) => setBulkAction(v as "add" | "remove")}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="add">Adicionar</SelectItem>
                              <SelectItem value="remove">Remover</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={bulkRole} onValueChange={setBulkRole}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {currentUser?.isMaster && <SelectItem value="master">Master</SelectItem>}
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="client">Client</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button onClick={handleBulkAction} variant="default">
                            Aplicar
                          </Button>
                          <Button onClick={() => setSelectedUsers(new Set())} variant="outline">
                            <XSquare className="h-4 w-4 mr-2" />
                            Limpar Seleção
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Cadastrado em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhum usuário encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedUsers.has(user.id)}
                                onCheckedChange={() => toggleUserSelection(user.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {user.id.substring(0, 8)}...
                            </TableCell>
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
                              {format(new Date(user.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Select
                                  value={selectedRole}
                                  onValueChange={setSelectedRole}
                                >
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="client">Client</SelectItem>
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
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Auditoria</CardTitle>
                <CardDescription>
                  Registro completo de todas as mudanças de roles realizadas no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filtros para Auditoria */}
                <div className="mb-6 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Filtros</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                      <Input
                        placeholder="Filtrar por email..."
                        value={emailFilter}
                        onChange={(e) => setEmailFilter(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">ID do Usuário</label>
                      <Input
                        placeholder="Filtrar por ID..."
                        value={userIdFilter}
                        onChange={(e) => setUserIdFilter(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Role</label>
                      <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todas as roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as roles</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">Data</label>
                      <DatePicker
                        date={dateFilter ? parseISO(dateFilter) : undefined}
                        onDateChange={(date) => setDateFilter(date ? format(date, 'yyyy-MM-dd') : '')}
                        placeholder="Filtrar por data"
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Usuário Afetado</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Alterado Por</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            Nenhum registro de auditoria encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{log.user_email}</span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {log.user_id.substring(0, 8)}...
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.action === 'added' ? 'default' : 'destructive'}>
                                {log.action === 'added' ? 'Adicionada' : 'Removida'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.role}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {log.changed_by_email}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminUserRoles;
