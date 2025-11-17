import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Bell, BellOff, Users, UserCog, Calendar } from 'lucide-react';
import { automaticNotificationRuleService } from '@/services/automaticNotificationRuleService';
import type { AutomaticNotificationRule, CreateNotificationRuleInput } from '@/types/automaticNotification';
import { toast } from 'sonner';

export default function AdminAutoNotifications() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomaticNotificationRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<AutomaticNotificationRule | null>(null);
  
  const [formData, setFormData] = useState<CreateNotificationRuleInput>({
    name: '',
    description: '',
    event_type: 'client_registration',
    trigger_condition: 'on_registration',
    target_audience: 'client',
    active: true,
    priority: 0,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automatic-notification-rules'],
    queryFn: () => automaticNotificationRuleService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateNotificationRuleInput) => automaticNotificationRuleService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automatic-notification-rules'] });
      toast.success('Regra criada com sucesso!');
      resetForm();
    },
    onError: () => toast.error('Erro ao criar regra'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string } & Partial<CreateNotificationRuleInput>) => 
      automaticNotificationRuleService.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automatic-notification-rules'] });
      toast.success('Regra atualizada com sucesso!');
      resetForm();
    },
    onError: () => toast.error('Erro ao atualizar regra'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => automaticNotificationRuleService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automatic-notification-rules'] });
      toast.success('Regra excluída com sucesso!');
      setDeleteRule(null);
    },
    onError: () => toast.error('Erro ao excluir regra'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      automaticNotificationRuleService.toggleActive(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automatic-notification-rules'] });
      toast.success('Status atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      event_type: 'client_registration',
      trigger_condition: 'on_registration',
      target_audience: 'client',
      active: true,
      priority: 0,
    });
    setEditingRule(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (rule: AutomaticNotificationRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      event_type: rule.event_type,
      trigger_condition: rule.trigger_condition,
      days_before: rule.days_before || undefined,
      target_audience: rule.target_audience,
      template_reference: rule.template_reference || '',
      active: rule.active,
      priority: rule.priority,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      client_registration: 'Cadastro de Cliente',
      payment_due: 'Vencimento',
      payment_received: 'Pagamento Recebido',
      client_update: 'Atualização de Cliente',
      trial_ending: 'Fim do Teste',
    };
    return labels[type] || type;
  };

  const getTargetAudienceIcon = (audience: string) => {
    if (audience === 'admin') return <UserCog className="h-4 w-4" />;
    if (audience === 'both') return <Users className="h-4 w-4" />;
    return <Users className="h-4 w-4" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notificações Automáticas</h1>
          <p className="text-muted-foreground">
            Gerencie todas as notificações automáticas do sistema
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? 'Editar Regra' : 'Nova Regra de Notificação'}
                </DialogTitle>
                <DialogDescription>
                  Configure quando e para quem a notificação será enviada
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Regra</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event_type">Tipo de Evento</Label>
                    <Select
                      value={formData.event_type}
                      onValueChange={(value: any) => setFormData({ ...formData, event_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client_registration">Cadastro de Cliente</SelectItem>
                        <SelectItem value="payment_due">Vencimento</SelectItem>
                        <SelectItem value="payment_received">Pagamento Recebido</SelectItem>
                        <SelectItem value="client_update">Atualização de Cliente</SelectItem>
                        <SelectItem value="trial_ending">Fim do Teste</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trigger_condition">Condição de Disparo</Label>
                    <Select
                      value={formData.trigger_condition}
                      onValueChange={(value: any) => setFormData({ ...formData, trigger_condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_registration">No Cadastro</SelectItem>
                        <SelectItem value="days_before_due">Dias Antes do Vencimento</SelectItem>
                        <SelectItem value="on_payment">No Pagamento</SelectItem>
                        <SelectItem value="on_update">Na Atualização</SelectItem>
                        <SelectItem value="on_trial_end">Fim do Teste</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.trigger_condition === 'days_before_due' && (
                  <div className="space-y-2">
                    <Label htmlFor="days_before">Dias Antes</Label>
                    <Input
                      id="days_before"
                      type="number"
                      min="0"
                      value={formData.days_before || ''}
                      onChange={(e) => setFormData({ ...formData, days_before: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="target_audience">Destinatário</Label>
                    <Select
                      value={formData.target_audience}
                      onValueChange={(value: any) => setFormData({ ...formData, target_audience: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Cliente</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="both">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridade</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template_reference">Referência do Template</Label>
                  <Input
                    id="template_reference"
                    value={formData.template_reference}
                    onChange={(e) => setFormData({ ...formData, template_reference: e.target.value })}
                    placeholder="ex: welcome_trial, expiration_7_days"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  />
                  <Label htmlFor="active">Regra Ativa</Label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingRule ? 'Atualizar' : 'Criar'} Regra
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{rule.name}</CardTitle>
                      <Badge variant={rule.active ? 'default' : 'secondary'}>
                        {rule.active ? <Bell className="h-3 w-3 mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
                        {rule.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    {rule.description && (
                      <CardDescription>{rule.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteRule(rule)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {getEventTypeLabel(rule.event_type)}
                  </Badge>
                  <Badge variant="outline">
                    {getTargetAudienceIcon(rule.target_audience)}
                    <span className="ml-1">
                      {rule.target_audience === 'admin' ? 'Admin' : rule.target_audience === 'both' ? 'Ambos' : 'Cliente'}
                    </span>
                  </Badge>
                  {rule.days_before !== null && (
                    <Badge variant="outline">
                      <Calendar className="h-3 w-3 mr-1" />
                      {rule.days_before} dias antes
                    </Badge>
                  )}
                  <Badge variant="outline">
                    Prioridade: {rule.priority}
                  </Badge>
                  {rule.template_reference && (
                    <Badge variant="secondary">
                      Template: {rule.template_reference}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Switch
                    checked={rule.active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: rule.id, active: checked })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    {rule.active ? 'Desativar' : 'Ativar'} notificação
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteRule} onOpenChange={() => setDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a regra "{deleteRule?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteRule && deleteMutation.mutate(deleteRule.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
