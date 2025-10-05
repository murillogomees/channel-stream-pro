import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionPlan {
  id: string;
  name: string;
  duration_days: number;
  max_devices: number;
  m3u_list_id: string | null;
  price: number;
  active: boolean;
  created_at: string;
}

interface M3UList {
  id: string;
  name: string;
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [m3uLists, setM3ULists] = useState<M3UList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    duration_days: 30,
    max_devices: 1,
    m3u_list_id: '',
    price: 0,
    active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const [plansResult, listsResult] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('created_at', { ascending: false }),
        supabase.from('m3u_lists').select('id, name').eq('status', 'active')
      ]);

      if (plansResult.error) throw plansResult.error;
      if (listsResult.error) throw listsResult.error;

      setPlans(plansResult.data || []);
      setM3ULists(listsResult.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      duration_days: 30,
      max_devices: 1,
      m3u_list_id: '',
      price: 0,
      active: true
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      duration_days: plan.duration_days,
      max_devices: plan.max_devices,
      m3u_list_id: plan.m3u_list_id || '',
      price: plan.price,
      active: plan.active
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const data = {
        ...formData,
        m3u_list_id: formData.m3u_list_id || null
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(data)
          .eq('id', editingPlan.id);

        if (error) throw error;
        toast.success('Plano atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert([data]);

        if (error) throw error;
        toast.success('Plano criado com sucesso!');
      }

      setIsDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error('Erro ao salvar plano', {
        description: error.message
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return;

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Plano excluído com sucesso!');
      loadData();
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao excluir plano', {
        description: error.message
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Planos de Assinatura</h1>
          <p className="text-muted-foreground">Gerencie os planos disponíveis para ativação</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planos Cadastrados</CardTitle>
          <CardDescription>
            {plans.length} plano(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Dispositivos</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Lista M3U</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{plan.duration_days} dias</TableCell>
                  <TableCell>{plan.max_devices}</TableCell>
                  <TableCell>R$ {plan.price.toFixed(2)}</TableCell>
                  <TableCell>
                    {m3uLists.find(l => l.id === plan.m3u_list_id)?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      plan.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {plan.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(plan)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(plan.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Editar Plano' : 'Novo Plano'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do plano de assinatura
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do Plano</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Plano Mensal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="duration">Duração (dias)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration_days}
                  onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="devices">Max Dispositivos</Label>
                <Input
                  id="devices"
                  type="number"
                  value={formData.max_devices}
                  onChange={(e) => setFormData({ ...formData, max_devices: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="m3u">Lista M3U</Label>
              <Select
                value={formData.m3u_list_id}
                onValueChange={(value) => setFormData({ ...formData, m3u_list_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma lista" />
                </SelectTrigger>
                <SelectContent>
                  {m3uLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
              <Label htmlFor="active">Plano ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
