import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Pencil, Trash2, Shield, ShieldCheck, Search, RefreshCw, Eye, EyeOff, Users, Crown, Star, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppRole } from "@/types/auth";
import { SUPABASE_FUNCTIONS_URL } from "@/config/supabase";

interface AdminUser {
  id: string;
  email: string;
  nome: string;
  telefone: string | null;
  roles: AppRole[];
  created_at: string;
  last_sign_in_at: string | null;
  is_active?: boolean;
  is_master?: boolean;
}

interface EditFormData {
  email: string;
  nome: string;
  telefone: string;
  newPassword: string;
  isActive: boolean;
  roles: AppRole[];
}

const MASTER_ADMIN_EMAIL = 'murillo@gmail.com';
const PROTECTED_EMAILS = [MASTER_ADMIN_EMAIL];

type ExtendedRole = AppRole;

const ALL_ROLES: { value: AppRole; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  { value: 'client', label: 'Cliente', description: 'Acesso básico ao sistema', icon: <User className="h-4 w-4" />, color: 'text-stat-info' },
  { value: 'admin', label: 'Admin', description: 'Acesso total ao dashboard + streaming', icon: <Shield className="h-4 w-4" />, color: 'text-stat-primary' },
  { value: 'master', label: 'Master', description: 'Controle absoluto do sistema', icon: <Star className="h-4 w-4" />, color: 'text-stat-purple' },
];

const AdminCreateUser = () => {
  const { isMaster, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  
  // Create form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nome: "",
    telefone: "",
    role: "admin" as AppRole,
  });

  // Edit dialog state
  const [editDialog, setEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    email: "",
    nome: "",
    telefone: "",
    newPassword: "",
    isActive: true,
    roles: [],
  });
  const [editLoading, setEditLoading] = useState(false);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const isMasterUser = user?.email === MASTER_ADMIN_EMAIL;

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/list-users`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();
      
      if (response.ok && result.users) {
        // Filter only admin/master users
        const adminUsers = result.users.filter((u: any) => 
          u.roles?.includes('admin') || u.roles?.includes('master')
        ).map((u: any) => ({
          id: u.id,
          email: u.email,
          nome: u.profile?.nome || u.email,
          telefone: u.profile?.telefone || null,
          roles: u.roles || [],
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        }));
        setUsers(adminUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isMaster) {
      fetchUsers();
    }
  }, [isMaster, fetchUsers]);

  if (!isMaster) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const validateForm = () => {
    if (!formData.email || !formData.email.includes('@')) {
      toast({ title: "Erro", description: "Email inválido", variant: "destructive" });
      return false;
    }
    if (!formData.password || formData.password.length < 8) {
      toast({ title: "Erro", description: "Senha deve ter no mínimo 8 caracteres", variant: "destructive" });
      return false;
    }
    if (!formData.nome || formData.nome.length < 2) {
      toast({ title: "Erro", description: "Nome é obrigatório", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Sessão não encontrada");
      }

      const response = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/create-admin-user`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...formData,
            role: formData.role,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao criar usuário");
      }

      toast({
        title: "Sucesso!",
        description: `Usuário ${formData.role === 'master' ? 'Master' : formData.role === 'admin' ? 'Admin' : 'Cliente'} ${formData.email} criado!`,
      });

      setFormData({
        email: "",
        password: "",
        nome: "",
        telefone: "",
        role: "admin",
      });

      fetchUsers();

    } catch (error: any) {
      console.error("Erro:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário admin",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isMasterAdmin = (email: string) => email === MASTER_ADMIN_EMAIL;
  const canEditUser = (adminUser: AdminUser) => {
    // Master admin can edit anyone
    if (user?.email === MASTER_ADMIN_EMAIL) return true;
    // No one else can edit master admin
    if (isMasterAdmin(adminUser.email)) return false;
    // Others can edit themselves or non-master admins
    return true;
  };
  const canDeleteUser = (adminUser: AdminUser) => {
    // No one can delete master admin
    if (isMasterAdmin(adminUser.email)) return false;
    // Can't delete yourself
    if (adminUser.id === user?.id) return false;
    // Master admin can delete anyone else
    if (user?.email === MASTER_ADMIN_EMAIL) return true;
    // Super admins can delete other non-master admins
    return true;
  };

  const handleEdit = (adminUser: AdminUser) => {
    if (!canEditUser(adminUser)) {
      toast({
        title: "Ação bloqueada",
        description: "Você não tem permissão para editar este usuário",
        variant: "destructive",
      });
      return;
    }
    setEditingUser(adminUser);
    
    // Determine roles including master designation
    const userRoles: ExtendedRole[] = [...adminUser.roles];
    if (isMasterAdmin(adminUser.email)) {
      userRoles.push('master');
    }
    
    setEditFormData({
      email: adminUser.email,
      nome: adminUser.nome,
      telefone: adminUser.telefone || "",
      newPassword: "",
      isActive: true,
      roles: userRoles,
    });
    setShowEditPassword(false);
    setEditDialog(true);
  };

  const toggleRole = (role: ExtendedRole) => {
    // Master role can only be toggled by murillo
    if (role === 'master' && !isMasterUser) return;
    
    setEditFormData(prev => {
      const hasRole = prev.roles.includes(role);
      if (hasRole) {
        return { ...prev, roles: prev.roles.filter(r => r !== role) };
      } else {
        return { ...prev, roles: [...prev.roles, role] };
      }
    });
  };

  const handleEditSubmit = async () => {
    if (!editingUser) return;
    
    setEditLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada");

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome: editFormData.nome,
          telefone: editFormData.telefone || null,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update password if provided (via edge function)
      if (editFormData.newPassword && editFormData.newPassword.length >= 8) {
        const response = await fetch(
          `${SUPABASE_FUNCTIONS_URL}/update-user-password`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: editingUser.id,
              newPassword: editFormData.newPassword,
            }),
          }
        );
        if (!response.ok) {
          const err = await response.json();
          console.warn("Password update failed:", err);
        }
      }

      // Get current roles from DB
      const { data: currentRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', editingUser.id);

      const currentRoleSet = new Set<AppRole>(currentRoles?.map(r => r.role as AppRole) || []);
      const newRoleSet = new Set<AppRole>(editFormData.roles);

      // Remove roles that are no longer selected
      for (const role of currentRoleSet) {
        if (!newRoleSet.has(role)) {
          await (supabase as any)
            .from('user_roles')
            .delete()
            .eq('user_id', editingUser.id)
            .eq('role', role);
        }
      }

      // Add new roles (usando 'as any' até types serem regenerados)
      for (const role of newRoleSet) {
        if (!currentRoleSet.has(role)) {
          const { error: insertError } = await (supabase as any)
            .from('user_roles')
            .insert({
              user_id: editingUser.id,
              role: role,
            });
          
          if (insertError) {
            console.error('Error inserting role:', insertError);
          }
        }
      }

      toast({
        title: "Sucesso!",
        description: "Usuário atualizado com sucesso",
      });

      setEditDialog(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar usuário",
        variant: "destructive",
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = (adminUser: AdminUser) => {
    if (!canDeleteUser(adminUser)) {
      toast({
        title: "Ação bloqueada",
        description: isMasterAdmin(adminUser.email) 
          ? "O administrador master não pode ser removido"
          : "Você não pode remover seu próprio usuário",
        variant: "destructive",
      });
      return;
    }
    setDeletingUser(adminUser);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    
    setDeleteLoading(true);
    try {
      // Remove all admin/master roles (effectively demoting to client)
      const { error } = await (supabase as any)
        .from('user_roles')
        .delete()
        .eq('user_id', deletingUser.id)
        .in('role', ['admin', 'master']);

      if (error) throw error;

      // Add client role back
      await supabase
        .from('user_roles')
        .insert({
          user_id: deletingUser.id,
          role: 'client',
        });

      toast({
        title: "Sucesso!",
        description: `Permissões de admin removidas de ${deletingUser.email}`,
      });

      setDeleteDialog(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover permissões",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (roles: AppRole[], email: string) => {
    if (isMasterAdmin(email)) {
      return <Badge className="bg-stat-purple/20 text-stat-purple border-stat-purple/30"><Crown className="h-3 w-3 mr-1" />Master</Badge>;
    }
    if (roles.includes('master')) {
      return <Badge className="bg-stat-purple/20 text-stat-purple border-stat-purple/30"><Star className="h-3 w-3 mr-1" />Master</Badge>;
    }
    if (roles.includes('admin')) {
      return <Badge className="bg-stat-primary/20 text-stat-primary border-stat-primary/30"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    }
    return <Badge className="bg-stat-info/20 text-stat-info border-stat-info/30"><User className="h-3 w-3 mr-1" />Cliente</Badge>;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="inline-flex h-11 p-1.5 bg-surface-1 border border-border/50 rounded-xl gap-1 max-w-md">
          <TabsTrigger value="list" className="flex items-center gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
            <Users className="h-4 w-4" />
            Administradores
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all">
            <UserPlus className="h-4 w-4" />
            Criar Novo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-stat-primary" />
                    Usuários Administrativos
                  </CardTitle>
                  <CardDescription>
                    {users.length} administrador(es) cadastrado(s)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-11 w-full sm:w-64"
                    />
                  </div>
                  <Button variant="outline" size="icon" className="h-11 w-11" onClick={fetchUsers} disabled={loadingUsers}>
                    <RefreshCw className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="font-semibold">Usuário</TableHead>
                        <TableHead className="font-semibold">Permissão</TableHead>
                        <TableHead className="hidden md:table-cell font-semibold">Telefone</TableHead>
                        <TableHead className="hidden lg:table-cell font-semibold">Cadastro</TableHead>
                        <TableHead className="hidden lg:table-cell font-semibold">Último Acesso</TableHead>
                        <TableHead className="text-right font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhum administrador encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map((adminUser) => (
                          <TableRow key={adminUser.id} className="hover:bg-muted/20">
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{adminUser.nome}</span>
                                <span className="text-xs text-muted-foreground">{adminUser.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getRoleBadge(adminUser.roles, adminUser.email)}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {adminUser.telefone || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {format(new Date(adminUser.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {adminUser.last_sign_in_at 
                                ? format(new Date(adminUser.last_sign_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                                : <span className="text-muted-foreground">Nunca</span>
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(adminUser)}
                                  disabled={!canEditUser(adminUser)}
                                  title={isMasterAdmin(adminUser.email) && user?.email !== MASTER_ADMIN_EMAIL ? "Master admin só pode ser editado por ele mesmo" : "Editar"}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(adminUser)}
                                  disabled={!canDeleteUser(adminUser)}
                                  className="text-destructive hover:text-destructive"
                                  title={isMasterAdmin(adminUser.email) ? "Master admin não pode ser removido" : "Remover permissões"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UserPlus className="h-6 w-6" />
                <CardTitle>Criar Usuário Administrativo</CardTitle>
              </div>
              <CardDescription>
                Crie um novo usuário com permissões de administrador ou super administrador
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 8 caracteres"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        disabled={loading}
                        minLength={8}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo *</Label>
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Nome completo"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Nível de Permissão *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o nível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span>Cliente</span>
                          <span className="text-xs text-muted-foreground">- Acesso ao streaming</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>Admin</span>
                          <span className="text-xs text-muted-foreground">- Dashboard + streaming</span>
                        </div>
                      </SelectItem>
                      {isMaster && (
                        <SelectItem value="master">
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-purple-500" />
                            <span>Master</span>
                            <span className="text-xs text-muted-foreground">- Acesso total</span>
                          </div>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.role === 'master' 
                      ? 'Master: controle absoluto incluindo manipulação de admins'
                      : formData.role === 'admin'
                      ? 'Admin: acesso ao painel administrativo e streaming'
                      : 'Cliente: acesso apenas ao streaming (/app/*)'
                    }
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando usuário...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Criar {formData.role === 'master' ? 'Master' : formData.role === 'admin' ? 'Admin' : 'Usuário'}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário Administrador</DialogTitle>
            <DialogDescription>
              Editando: {editingUser?.email}
              {isMasterAdmin(editingUser?.email || '') && (
                <Badge className="ml-2 bg-purple-500/20 text-purple-500 border-purple-500/30">
                  <Star className="h-3 w-3 mr-1" />Master
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 py-4 px-1">
              {/* Email (readonly) */}
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
              </div>

              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome Completo *</Label>
                <Input
                  id="edit-nome"
                  value={editFormData.nome}
                  onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                  disabled={editLoading}
                  placeholder="Nome completo"
                />
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="edit-telefone">Telefone</Label>
                <Input
                  id="edit-telefone"
                  type="tel"
                  value={editFormData.telefone}
                  onChange={(e) => setEditFormData({ ...editFormData, telefone: e.target.value })}
                  disabled={editLoading}
                  placeholder="(11) 99999-9999"
                />
              </div>

              {/* Nova Senha */}
              <div className="space-y-2">
                <Label htmlFor="edit-password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? "text" : "password"}
                    value={editFormData.newPassword}
                    onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                    disabled={editLoading}
                    placeholder="Deixe em branco para manter a atual"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Deixe vazio para não alterar.</p>
              </div>

              <Separator />

              {/* Permissões (Multiple Roles) */}
              <div className="space-y-3">
                <Label>Permissões</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Selecione uma ou mais permissões para este usuário
                </p>
                <div className="space-y-3">
                  {ALL_ROLES.map((roleOption) => {
                    const isChecked = editFormData.roles.includes(roleOption.value);
                    const isDisabled = editLoading || 
                      (roleOption.value === 'master' && !isMasterUser) ||
                      (isMasterAdmin(editingUser?.email || '') && roleOption.value === 'master');
                    
                    return (
                      <div
                        key={roleOption.value}
                        className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                          isChecked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => !isDisabled && toggleRole(roleOption.value)}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={isDisabled}
                          onCheckedChange={() => !isDisabled && toggleRole(roleOption.value)}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={roleOption.color}>{roleOption.icon}</span>
                            <span className="font-medium">{roleOption.label}</span>
                            {roleOption.value === 'master' && !isMasterUser && (
                              <Badge variant="outline" className="text-xs">Apenas Master</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{roleOption.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {editFormData.roles.length === 0 && (
                  <p className="text-xs text-destructive">Selecione pelo menos uma permissão</p>
                )}
              </div>

              {/* Status Ativo */}
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label>Usuário Ativo</Label>
                  <p className="text-xs text-muted-foreground">Desativar bloqueia o acesso ao sistema</p>
                </div>
                <Switch
                  checked={editFormData.isActive}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, isActive: checked })}
                  disabled={editLoading || isMasterAdmin(editingUser?.email || '')}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditDialog(false)} disabled={editLoading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEditSubmit} 
              disabled={editLoading || editFormData.roles.length === 0}
            >
              {editLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover permissões de admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover as permissões administrativas de <strong>{deletingUser?.email}</strong>. 
              O usuário será convertido para cliente comum e perderá acesso ao painel administrativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover Permissões
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCreateUser;
