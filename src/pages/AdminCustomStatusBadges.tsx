import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCustomStatusBadges } from '@/hooks/useCustomStatusBadges';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AdminCustomStatusBadges() {
  const navigate = useNavigate();
  const { badges, loading, createBadge, updateBadge, deleteBadge } = useCustomStatusBadges();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    description: '',
    color: '#3b82f6',
    icon_name: 'circle',
    is_critical: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedBadge) {
      const success = await updateBadge(selectedBadge.id, formData);
      if (success) {
        setDialogOpen(false);
        resetForm();
      }
    } else {
      const success = await createBadge(formData as any);
      if (success) {
        setDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleEdit = (badge: any) => {
    setSelectedBadge(badge);
    setFormData({
      name: badge.name,
      label: badge.label,
      description: badge.description || '',
      color: badge.color,
      icon_name: badge.icon_name || 'circle',
      is_critical: badge.is_critical,
    });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (selectedBadge) {
      const success = await deleteBadge(selectedBadge.id);
      if (success) {
        setDeleteDialogOpen(false);
        setSelectedBadge(null);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      label: '',
      description: '',
      color: '#3b82f6',
      icon_name: 'circle',
      is_critical: false,
    });
    setSelectedBadge(null);
  };

  const iconOptions = [
    'circle', 'check-circle', 'alert-circle', 'x-circle', 'clock',
    'loader', 'alert-triangle', 'help-circle', 'info', 'zap'
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Sparkles className="h-8 w-8 text-primary" />
                Badges Personalizados
              </h1>
              <p className="text-muted-foreground">
                Crie e gerencie status personalizados para seu sistema
              </p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Badge
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {selectedBadge ? 'Editar Badge' : 'Novo Badge'}
                  </DialogTitle>
                  <DialogDescription>
                    Defina as propriedades do status personalizado
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome (ID único)</Label>
                    <Input
                      id="name"
                      placeholder="ex: aguardando_aprovacao"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={!!selectedBadge}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="label">Rótulo (exibido no badge)</Label>
                    <Input
                      id="label"
                      placeholder="ex: Aguardando Aprovação"
                      value={formData.label}
                      onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      placeholder="Explique o significado deste status"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="color">Cor</Label>
                      <div className="flex gap-2">
                        <Input
                          id="color"
                          type="color"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="w-16 h-10"
                        />
                        <Input
                          type="text"
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          placeholder="#3b82f6"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="icon">Ícone</Label>
                      <select
                        id="icon"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={formData.icon_name}
                        onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                      >
                        {iconOptions.map((icon) => (
                          <option key={icon} value={icon}>
                            {icon}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="critical">Status Crítico</Label>
                      <p className="text-sm text-muted-foreground">
                        Adiciona efeito de pulso para atenção
                      </p>
                    </div>
                    <Switch
                      id="critical"
                      checked={formData.is_critical}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_critical: checked })}
                    />
                  </div>
                  <div className="pt-4 border-t">
                    <Label className="mb-2 block">Preview</Label>
                    <Badge
                      style={{
                        backgroundColor: `${formData.color}20`,
                        color: formData.color,
                        borderColor: `${formData.color}40`,
                      }}
                      className={formData.is_critical ? 'animate-pulse' : ''}
                    >
                      {formData.label || 'Preview'}
                    </Badge>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {selectedBadge ? 'Salvar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Badges Configurados</CardTitle>
            <CardDescription>
              Gerencie todos os status personalizados do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : badges.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Nenhum badge personalizado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie seu primeiro badge personalizado para começar
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {badges.map((badge) => (
                  <Card key={badge.id} className="relative">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <Badge
                            style={{
                              backgroundColor: `${badge.color}20`,
                              color: badge.color,
                              borderColor: `${badge.color}40`,
                            }}
                            className={badge.is_critical ? 'animate-pulse' : ''}
                          >
                            {badge.label}
                          </Badge>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(badge)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                setSelectedBadge(badge);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{badge.name}</p>
                          {badge.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {badge.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Cor: {badge.color}</span>
                          <span>•</span>
                          <span>Ícone: {badge.icon_name}</span>
                          {badge.is_critical && (
                            <>
                              <span>•</span>
                              <span className="text-red-500 font-medium">Crítico</span>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este badge personalizado? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
