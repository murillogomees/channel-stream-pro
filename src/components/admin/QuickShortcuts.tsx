import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Plus, Trash2, ExternalLink, Home, Users, FileText, Settings, BarChart2, Bell, Shield, X, FolderOpen, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FormSection, FormFieldGroup, DialogBody } from '@/components/ui/form-section';
import { Separator } from '@/components/ui/separator';

interface Shortcut {
  id: string;
  title: string;
  description: string | null;
  path: string;
  icon: string;
  order_index: number;
}

const iconOptions = ['Home', 'Users', 'FileText', 'Settings', 'BarChart2', 'Bell', 'Shield', 'Bookmark', 'FolderOpen', 'Link2'];

const getIcon = (iconName: string) => {
  const icons: Record<string, React.ReactNode> = {
    Home: <Home className="h-4 w-4" />,
    Users: <Users className="h-4 w-4" />,
    FileText: <FileText className="h-4 w-4" />,
    Settings: <Settings className="h-4 w-4" />,
    BarChart2: <BarChart2 className="h-4 w-4" />,
    Bell: <Bell className="h-4 w-4" />,
    Shield: <Shield className="h-4 w-4" />,
    Bookmark: <Bookmark className="h-4 w-4" />,
    FolderOpen: <FolderOpen className="h-4 w-4" />,
    Link2: <Link2 className="h-4 w-4" />,
  };
  return icons[iconName] || <Bookmark className="h-4 w-4" />;
};

export function QuickShortcuts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    path: '',
    icon: 'Bookmark'
  });

  useEffect(() => {
    if (user) loadShortcuts();
  }, [user]);

  const loadShortcuts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('admin_shortcuts')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index');

      if (error) throw error;
      setShortcuts(data || []);
    } catch (error) {
      console.error('Error loading shortcuts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!user || !formData.title || !formData.path) {
      toast.error('Preencha título e caminho');
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_shortcuts')
        .insert({
          user_id: user.id,
          title: formData.title,
          description: formData.description || null,
          path: formData.path,
          icon: formData.icon,
          order_index: shortcuts.length
        });

      if (error) throw error;

      toast.success('Atalho adicionado!');
      setFormData({ title: '', description: '', path: '', icon: 'Bookmark' });
      setDialogOpen(false);
      loadShortcuts();
    } catch (error) {
      toast.error('Erro ao adicionar atalho');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_shortcuts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Atalho removido');
      loadShortcuts();
    } catch (error) {
      toast.error('Erro ao remover atalho');
    }
  };

  if (loading) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary" />
          Atalhos Rápidos
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {shortcuts.length} atalho(s)
          </Badge>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>
                  <Bookmark className="h-5 w-5" />
                  Novo Atalho
                </DialogTitle>
                <DialogDescription>
                  Adicione uma página aos seus atalhos rápidos
                </DialogDescription>
              </DialogHeader>

              <DialogBody>
                <div className="space-y-4">
                  <FormSection
                    icon={<Link2 className="h-5 w-5" />}
                    title="Informações do Atalho"
                    description="Configure o atalho personalizado"
                    variant="primary"
                  />
                  
                  <FormFieldGroup columns={1}>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Título <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Ex: Lista de Clientes"
                        className="h-12 transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Descrição
                      </Label>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Ex: Visualizar todos os clientes"
                        className="h-12 transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Caminho <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={formData.path}
                        onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                        placeholder="Ex: /admin/usuarios"
                        className="h-12 transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Ícone</Label>
                      <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                        <SelectTrigger className="h-12 transition-all focus:ring-2 focus:ring-primary/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {iconOptions.map((icon) => (
                            <SelectItem key={icon} value={icon}>
                              <div className="flex items-center gap-2">
                                {getIcon(icon)}
                                <span>{icon}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </FormFieldGroup>
                </div>
              </DialogBody>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-12">
                  Cancelar
                </Button>
                <Button onClick={handleAdd} className="h-12">
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {shortcuts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum atalho configurado. Clique em "Adicionar" para criar um.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.id}
                className="group relative flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-all"
                onClick={() => navigate(shortcut.path)}
              >
                <div className="flex-shrink-0 text-primary">
                  {getIcon(shortcut.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{shortcut.title}</p>
                  {shortcut.description && (
                    <p className="text-xs text-muted-foreground truncate">{shortcut.description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(shortcut.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
