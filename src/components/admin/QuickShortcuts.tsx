import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Plus, X, GripVertical } from 'lucide-react';
import { shortcutService } from '@/services/shortcutService';
import type { AdminShortcut } from '@/types/activity';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';

const iconOptions = [
  'Users', 'Bell', 'Smartphone', 'Shield', 'BarChart3', 
  'Settings', 'User', 'Palette', 'FileText', 'Activity'
];

export function QuickShortcuts() {
  const [shortcuts, setShortcuts] = useState<AdminShortcut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    path: '',
    icon: 'Star',
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadShortcuts();
  }, []);

  const loadShortcuts = async () => {
    try {
      const data = await shortcutService.getShortcuts();
      setShortcuts(data);
    } catch (error) {
      console.error('Erro ao carregar atalhos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      await shortcutService.addShortcut(
        formData.title,
        formData.description,
        formData.path,
        formData.icon
      );
      toast.success('Atalho adicionado com sucesso!');
      setDialogOpen(false);
      setFormData({ title: '', description: '', path: '', icon: 'Star' });
      loadShortcuts();
    } catch (error) {
      toast.error('Erro ao adicionar atalho');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await shortcutService.removeShortcut(id);
      toast.success('Atalho removido!');
      loadShortcuts();
    } catch (error) {
      toast.error('Erro ao remover atalho');
    }
  };

  const getIcon = (iconName: string) => {
    const IconComponent = (Icons as any)[iconName] || Icons.Star;
    return <IconComponent className="h-4 w-4" />;
  };

  if (isLoading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Atalhos Rápidos</CardTitle>
              <CardDescription>Acesso rápido às suas páginas favoritas</CardDescription>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Atalho</DialogTitle>
                <DialogDescription>
                  Adicione uma página aos seus atalhos rápidos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Lista de Clientes"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Ex: Visualizar todos os clientes"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Caminho</Label>
                  <Input
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    placeholder="Ex: /admin/clientes"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                    <SelectTrigger>
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAdd}>Adicionar</Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.id}
                className="group relative p-4 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate(shortcut.path)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(shortcut.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {getIcon(shortcut.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none mb-1">{shortcut.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {shortcut.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
