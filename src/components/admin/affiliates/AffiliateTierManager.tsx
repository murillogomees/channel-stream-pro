import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAffiliateTiers, AffiliateTier } from '@/hooks/useAffiliateTiers';
import { Plus, Edit2, Trash2, Medal, Award, Crown, Gem } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const iconMap: Record<string, any> = {
  medal: Medal,
  award: Award,
  crown: Crown,
  gem: Gem
};

export function AffiliateTierManager() {
  const { tiers, loading, createTier, updateTier, deleteTier } = useAffiliateTiers();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<AffiliateTier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    min_referrals: 0,
    min_revenue: 0,
    commission_percentage: 10,
    bonus_amount: 0,
    icon: 'medal',
    color: '#CD7F32',
    description: ''
  });

  const handleOpenCreate = () => {
    setEditingTier(null);
    setFormData({
      name: '',
      min_referrals: 0,
      min_revenue: 0,
      commission_percentage: 10,
      bonus_amount: 0,
      icon: 'medal',
      color: '#CD7F32',
      description: ''
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (tier: AffiliateTier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      min_referrals: tier.min_referrals,
      min_revenue: tier.min_revenue,
      commission_percentage: tier.commission_percentage,
      bonus_amount: tier.bonus_amount,
      icon: tier.icon || 'medal',
      color: tier.color || '#CD7F32',
      description: tier.description || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTier) {
      await updateTier(editingTier.id, formData);
    } else {
      await createTier(formData);
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este tier?')) {
      await deleteTier(id);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tiers de Afiliados</h3>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Novo Tier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTier ? 'Editar Tier' : 'Criar Tier'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input 
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="color"
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      className="w-12 h-9 p-1"
                    />
                    <Input 
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mín. Indicações</Label>
                  <Input 
                    type="number"
                    value={formData.min_referrals}
                    onChange={e => setFormData({ ...formData, min_referrals: Number(e.target.value) })}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mín. Receita (R$)</Label>
                  <Input 
                    type="number"
                    value={formData.min_revenue}
                    onChange={e => setFormData({ ...formData, min_revenue: Number(e.target.value) })}
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Comissão (%)</Label>
                  <Input 
                    type="number"
                    value={formData.commission_percentage}
                    onChange={e => setFormData({ ...formData, commission_percentage: Number(e.target.value) })}
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bônus (R$)</Label>
                  <Input 
                    type="number"
                    value={formData.bonus_amount}
                    onChange={e => setFormData({ ...formData, bonus_amount: Number(e.target.value) })}
                    min={0}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ícone</Label>
                <div className="flex gap-2">
                  {Object.entries(iconMap).map(([key, Icon]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={formData.icon === key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFormData({ ...formData, icon: key })}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input 
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingTier ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map(tier => {
          const Icon = iconMap[tier.icon || 'medal'] || Medal;
          
          return (
            <Card key={tier.id} className="relative overflow-hidden">
              <div 
                className="absolute inset-0 opacity-10"
                style={{ backgroundColor: tier.color }}
              />
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon className="h-5 w-5" style={{ color: tier.color }} />
                  {tier.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 relative">
                <div className="text-3xl font-bold" style={{ color: tier.color }}>
                  {tier.commission_percentage}%
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Mín. {tier.min_referrals} indicações</p>
                  <p>Mín. R$ {tier.min_revenue.toLocaleString('pt-BR')}</p>
                  {tier.bonus_amount > 0 && (
                    <p className="text-green-500">+R$ {tier.bonus_amount} bônus</p>
                  )}
                </div>
                {tier.description && (
                  <p className="text-xs text-muted-foreground">{tier.description}</p>
                )}
                <div className="flex gap-1 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(tier)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(tier.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
