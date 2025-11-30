import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Pencil, Trash2, Shield, ShieldCheck, Search, RefreshCw, Eye, EyeOff, Users, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppRole } from "@/types/auth";

interface AdminUser {
  id: string;
  email: string;
  nome: string;
  telefone: string | null;
  roles: AppRole[];
  created_at: string;
  last_sign_in_at: string | null;
}

const MASTER_ADMIN_EMAIL = 'murillo@gmail.com';
const PROTECTED_EMAILS = [MASTER_ADMIN_EMAIL]; // Only master admin is fully protected

const AdminCreateUser = () => {
  const { isSuperAdmin, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Create form state
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    nome: "",
    telefone: "",
    role: "admin" as "admin" | "super_admin",
  });

  // Edit dialog state
  const [editDialog, setEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editFormData, setEditFormData] = useState({
    nome: "",
    telefone: "",
    role: "admin" as "admin" | "super_admin",
  });
  const [editLoading, setEditLoading] = useState(false);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/list-users`,
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
        // Filter only admin/super_admin users
        const adminUsers = result.users.filter((u: any) => 
          u.roles?.includes('admin') || u.roles?.includes('super_admin')
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
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin, fetchUsers]);

  if (!isSuperAdmin) {
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
        `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/create-admin-user`,
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
        description: `Usuário ${formData.role === 'super_admin' ? 'Super Admin' : 'Admin'} ${formData.email} criado!`,
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
    setEditFormData({
      nome: adminUser.nome,
      telefone: adminUser.telefone || "",
      role: adminUser.roles.includes('super_admin') ? 'super_admin' : 'admin',
    });
    setEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!editingUser) return;
    
    setEditLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          nome: editFormData.nome,
          telefone: editFormData.telefone || null,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update role if changed
      const currentRole = editingUser.roles.includes('super_admin') ? 'super_admin' : 'admin';
      if (currentRole !== editFormData.role) {
        // Remove old role
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', editingUser.id)
          .eq('role', currentRole);

        // Add new role
        await supabase
          .from('user_roles')
          .insert({
            user_id: editingUser.id,
            role: editFormData.role,
          });
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
      // Remove all roles (effectively demoting to client)
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', deletingUser.id)
        .in('role', ['admin', 'super_admin']);

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
      return <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30"><Crown className="h-3 w-3 mr-1" />Master</Badge>;
    }
    if (roles.includes('super_admin')) {
      return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30"><ShieldCheck className="h-3 w-3 mr-1" />Super Admin</Badge>;
    }
    if (roles.includes('admin')) {
      return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    }
    return <Badge variant="secondary">Usuário</Badge>;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Administradores
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
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
                    <ShieldCheck className="h-5 w-5" />
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
                      className="pl-9 w-full sm:w-64"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loadingUsers}>
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
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Permissão</TableHead>
                        <TableHead className="hidden md:table-cell">Telefone</TableHead>
                        <TableHead className="hidden lg:table-cell">Cadastro</TableHead>
                        <TableHead className="hidden lg:table-cell">Último Acesso</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
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
                          <TableRow key={adminUser.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{adminUser.nome}</span>
                                <span className="text-sm text-muted-foreground">{adminUser.email}</span>
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
                    onValueChange={(value: "admin" | "super_admin") => setFormData({ ...formData, role: value })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o nível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>Admin</span>
                          <span className="text-xs text-muted-foreground">- Gerenciamento geral</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="super_admin">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-amber-500" />
                          <span>Super Admin</span>
                          <span className="text-xs text-muted-foreground">- Acesso total</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {formData.role === 'super_admin' 
                      ? 'Super Admin: pode criar/editar outros admins e acessar todas as configurações'
                      : 'Admin: acesso ao painel administrativo e gerenciamento de clientes'
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
                      Criar {formData.role === 'super_admin' ? 'Super Admin' : 'Admin'}
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
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Editando: {editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input
                id="edit-nome"
                value={editFormData.nome}
                onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                disabled={editLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input
                id="edit-telefone"
                value={editFormData.telefone}
                onChange={(e) => setEditFormData({ ...editFormData, telefone: e.target.value })}
                disabled={editLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Nível de Permissão</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value: "admin" | "super_admin") => setEditFormData({ ...editFormData, role: value })}
                disabled={editLoading || isMasterAdmin(editingUser?.email || '')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)} disabled={editLoading}>
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} disabled={editLoading}>
              {editLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
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
