import { useState, useEffect, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Bell, BellOff, Users, UserCog, Calendar, ArrowLeft, Heart, CreditCard, Activity, Megaphone, Settings, Search, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { automaticNotificationRuleService } from '@/services/automaticNotificationRuleService';
import type { AutomaticNotificationRule, CreateNotificationRuleInput } from '@/types/automaticNotification';
import { useTemplates } from '@/hooks/useTemplates';
import { toast } from 'sonner';
// Categorias de eventos
const EVENT_CATEGORIES = {
  lifecycle: {
    label: 'Ciclo de Vida',
    icon: Heart,
    color: 'bg-pink-500/10 text-pink-600 border-pink-500/30',
    events: ['client_registration', 'subscription_activated', 'trial_expiring', 'trial_expired', 'client_deactivation', 'client_reactivation', 'plan_upgrade', 'plan_downgrade', 'client_anniversary']
  },
  payment: {
    label: 'Pagamento',
    icon: CreditCard,
    color: 'bg-green-500/10 text-green-600 border-green-500/30',
    events: ['payment_due', 'payment_received', 'payment_pending', 'payment_failed', 'recurring_payment', 'subscription_expired']
  },
  engagement: {
    label: 'Engajamento',
    icon: Activity,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    events: ['user_inactive', 'content_recommendation', 'loyalty_reward']
  },
  promotional: {
    label: 'Promocional',
    icon: Megaphone,
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    events: ['promotional_campaign', 'seasonal_greeting', 'new_content', 'maintenance']
  },
  admin: {
    label: 'Administrativo',
    icon: Settings,
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    events: ['churn_risk', 'daily_summary']
  }
};

// Mapeamento completo de tipos de eventos
const EVENT_TYPE_LABELS: Record<string, string> = {
  // Ciclo de vida
  client_registration: 'Cadastro de Cliente',
  subscription_activated: 'Assinatura Ativada',
  trial_expiring: 'Trial Expirando',
  trial_expired: 'Trial Expirado',
  client_deactivation: 'Cliente Desativado',
  client_reactivation: 'Cliente Reativado',
  plan_upgrade: 'Upgrade de Plano',
  plan_downgrade: 'Downgrade de Plano',
  client_anniversary: 'Aniversário de Cliente',
  // Pagamento
  payment_due: 'Vencimento',
  payment_received: 'Pagamento Recebido',
  payment_pending: 'Pagamento Pendente',
  payment_failed: 'Pagamento Falhou',
  recurring_payment: 'Pagamento Recorrente',
  subscription_expired: 'Assinatura Expirada',
  // Engajamento
  user_inactive: 'Usuário Inativo',
  content_recommendation: 'Recomendação de Conteúdo',
  loyalty_reward: 'Recompensa Fidelidade',
  // Promocional
  promotional_campaign: 'Campanha Promocional',
  seasonal_greeting: 'Saudação Sazonal',
  new_content: 'Novo Conteúdo',
  maintenance: 'Manutenção',
  // Admin
  churn_risk: 'Risco de Churn',
  daily_summary: 'Resumo Diário',
  // Legado
  client_update: 'Atualização de Cliente',
  trial_ending: 'Fim do Teste',
};

// Mapeamento de condições de disparo
const TRIGGER_CONDITIONS: Record<string, string> = {
  on_registration: 'No Cadastro',
  on_activation: 'Na Ativação',
  days_before_due: 'Dias Antes do Vencimento',
  days_before_trial_end: 'Dias Antes do Fim do Trial',
  on_trial_expiration: 'Ao Expirar Trial',
  on_deactivation: 'Ao Desativar',
  on_reactivation: 'Ao Reativar',
  on_upgrade: 'Ao Fazer Upgrade',
  on_downgrade: 'Ao Fazer Downgrade',
  on_6_months: 'Aos 6 Meses',
  on_1_year: 'Após 1 Ano',
  on_payment: 'Ao Receber Pagamento',
  on_pending: 'Ao Ficar Pendente',
  on_failure: 'Ao Falhar Pagamento',
  days_before_charge: 'Dias Antes da Cobrança',
  days_after_expiration: 'Dias Após Expirar',
  days_inactive: 'Dias Sem Acesso',
  weekly: 'Semanal',
  on_milestone: 'Ao Atingir Marco',
  scheduled: 'Agendado',
  on_content_added: 'Ao Adicionar Conteúdo',
  high_value_payment: 'Pagamento Alto Valor',
  on_risk_detection: 'Ao Detectar Risco',
  daily: 'Diário',
  on_update: 'Na Atualização',
  on_trial_end: 'Fim do Teste',
};

export default function AdminAutoNotifications() {
  const navigate = useNavigate();
  const { templates, loading: templatesLoading } = useTemplates();
  const [rules, setRules] = useState<AutomaticNotificationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomaticNotificationRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<AutomaticNotificationRule | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState<CreateNotificationRuleInput>({
    name: '',
    description: '',
    event_type: 'client_registration',
    trigger_condition: 'on_registration',
    target_audience: 'client',
    template_reference: '',
    active: true,
    priority: 0,
    days_before: undefined,
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setIsLoading(true);
      const data = await automaticNotificationRuleService.getAll();
      setRules(data);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
      toast.error('Erro ao carregar regras');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar e agrupar regras
  const filteredRules = useMemo(() => {
    let filtered = rules;

    // Filtrar por busca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(rule => 
        rule.name.toLowerCase().includes(query) ||
        rule.description?.toLowerCase().includes(query) ||
        rule.template_reference?.toLowerCase().includes(query)
      );
    }

    // Filtrar por categoria
    if (selectedCategory !== 'all') {
      const categoryEvents = EVENT_CATEGORIES[selectedCategory as keyof typeof EVENT_CATEGORIES]?.events || [];
      filtered = filtered.filter(rule => categoryEvents.includes(rule.event_type));
    }

    return filtered;
  }, [rules, selectedCategory, searchQuery]);

  // Estatísticas
  const stats = useMemo(() => ({
    total: rules.length,
    active: rules.filter(r => r.active).length,
    inactive: rules.filter(r => !r.active).length,
    forClients: rules.filter(r => r.target_audience === 'client').length,
    forAdmins: rules.filter(r => r.target_audience === 'admin').length,
  }), [rules]);

  const getCategoryForEvent = (eventType: string) => {
    for (const [key, category] of Object.entries(EVENT_CATEGORIES)) {
      if (category.events.includes(eventType)) {
        return { key, ...category };
      }
    }
    return null;
  };

  // Get template name by ID
  const getTemplateName = (templateId: string | null | undefined) => {
    if (!templateId) return null;
    const template = templates.find(t => t.id === templateId);
    return template?.name || templateId;
  };

  const handleCreate = async () => {
    try {
      await automaticNotificationRuleService.create(formData);
      toast.success('Regra criada com sucesso!');
      loadRules();
      resetForm();
    } catch (error) {
      toast.error('Erro ao criar regra');
    }
  };

  const handleUpdate = async () => {
    if (!editingRule) return;
    
    try {
      await automaticNotificationRuleService.update({ id: editingRule.id, ...formData });
      toast.success('Regra atualizada com sucesso!');
      loadRules();
      resetForm();
    } catch (error) {
      toast.error('Erro ao atualizar regra');
    }
  };

  const handleDelete = async () => {
    if (!deleteRule) return;
    
    try {
      await automaticNotificationRuleService.delete(deleteRule.id);
      toast.success('Regra excluída com sucesso!');
      loadRules();
      setDeleteRule(null);
    } catch (error) {
      toast.error('Erro ao excluir regra');
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await automaticNotificationRuleService.toggleActive(id, active);
      toast.success('Status atualizado!');
      loadRules();
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      event_type: 'client_registration',
      trigger_condition: 'on_registration',
      target_audience: 'client',
      template_reference: '',
      active: true,
      priority: 0,
      days_before: undefined,
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
      handleUpdate();
    } else {
      handleCreate();
    }
  };

  const needsDaysInput = ['days_before_due', 'days_before_trial_end', 'days_before_charge', 'days_after_expiration', 'days_inactive'].includes(formData.trigger_condition);

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">Notificações Automáticas</h1>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              {stats.total} regras configuradas ({stats.active} ativas)
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()} className="w-full sm:w-auto flex-shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event_type">Tipo de Evento</Label>
                    <Select
                      value={formData.event_type}
                      onValueChange={(value: any) => setFormData({ ...formData, event_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="client_registration">📝 Cadastro de Cliente</SelectItem>
                        <SelectItem value="subscription_activated">✅ Assinatura Ativada</SelectItem>
                        <SelectItem value="trial_expiring">⏳ Trial Expirando</SelectItem>
                        <SelectItem value="trial_expired">❌ Trial Expirado</SelectItem>
                        <SelectItem value="client_deactivation">🚫 Cliente Desativado</SelectItem>
                        <SelectItem value="client_reactivation">🔄 Cliente Reativado</SelectItem>
                        <SelectItem value="plan_upgrade">⬆️ Upgrade de Plano</SelectItem>
                        <SelectItem value="plan_downgrade">⬇️ Downgrade de Plano</SelectItem>
                        <SelectItem value="client_anniversary">🎂 Aniversário de Cliente</SelectItem>
                        <SelectItem value="payment_due">📅 Vencimento</SelectItem>
                        <SelectItem value="payment_received">💰 Pagamento Recebido</SelectItem>
                        <SelectItem value="payment_pending">⏸️ Pagamento Pendente</SelectItem>
                        <SelectItem value="payment_failed">💳 Pagamento Falhou</SelectItem>
                        <SelectItem value="recurring_payment">🔁 Pagamento Recorrente</SelectItem>
                        <SelectItem value="subscription_expired">⚠️ Assinatura Expirada</SelectItem>
                        <SelectItem value="user_inactive">😴 Usuário Inativo</SelectItem>
                        <SelectItem value="content_recommendation">🎬 Recomendação</SelectItem>
                        <SelectItem value="loyalty_reward">🏆 Recompensa Fidelidade</SelectItem>
                        <SelectItem value="promotional_campaign">📢 Campanha</SelectItem>
                        <SelectItem value="seasonal_greeting">🎄 Saudação Sazonal</SelectItem>
                        <SelectItem value="new_content">🆕 Novo Conteúdo</SelectItem>
                        <SelectItem value="maintenance">🔧 Manutenção</SelectItem>
                        <SelectItem value="churn_risk">⚡ Risco de Churn</SelectItem>
                        <SelectItem value="daily_summary">📊 Resumo Diário</SelectItem>
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
                      <SelectContent className="max-h-64">
                        <SelectItem value="on_registration">No Cadastro</SelectItem>
                        <SelectItem value="on_activation">Na Ativação</SelectItem>
                        <SelectItem value="days_before_due">Dias Antes do Vencimento</SelectItem>
                        <SelectItem value="days_before_trial_end">Dias Antes do Fim do Trial</SelectItem>
                        <SelectItem value="on_trial_expiration">Ao Expirar Trial</SelectItem>
                        <SelectItem value="on_deactivation">Ao Desativar</SelectItem>
                        <SelectItem value="on_reactivation">Ao Reativar</SelectItem>
                        <SelectItem value="on_upgrade">Ao Fazer Upgrade</SelectItem>
                        <SelectItem value="on_downgrade">Ao Fazer Downgrade</SelectItem>
                        <SelectItem value="on_6_months">Aos 6 Meses</SelectItem>
                        <SelectItem value="on_1_year">Após 1 Ano</SelectItem>
                        <SelectItem value="on_payment">Ao Receber Pagamento</SelectItem>
                        <SelectItem value="on_pending">Ao Ficar Pendente</SelectItem>
                        <SelectItem value="on_failure">Ao Falhar Pagamento</SelectItem>
                        <SelectItem value="days_before_charge">Dias Antes da Cobrança</SelectItem>
                        <SelectItem value="days_after_expiration">Dias Após Expirar</SelectItem>
                        <SelectItem value="days_inactive">Dias Sem Acesso</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="on_milestone">Ao Atingir Marco</SelectItem>
                        <SelectItem value="scheduled">Agendado</SelectItem>
                        <SelectItem value="on_content_added">Ao Adicionar Conteúdo</SelectItem>
                        <SelectItem value="high_value_payment">Pagamento Alto Valor</SelectItem>
                        <SelectItem value="on_risk_detection">Ao Detectar Risco</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {needsDaysInput && (
                  <div className="space-y-2">
                    <Label htmlFor="days_before">Quantidade de Dias</Label>
                    <Input
                      id="days_before"
                      type="number"
                      min="0"
                      value={formData.days_before ?? ''}
                      onChange={(e) => setFormData({ ...formData, days_before: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Ex: 7"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <SelectItem value="client">👤 Cliente</SelectItem>
                        <SelectItem value="admin">🔑 Administrador</SelectItem>
                        <SelectItem value="both">👥 Ambos</SelectItem>
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
                  <Label htmlFor="template_reference">Template de Notificação</Label>
                  <Select
                    value={formData.template_reference ?? ''}
                    onValueChange={(value) => setFormData({ ...formData, template_reference: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {templatesLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : templates.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Nenhum template cadastrado. Crie templates na aba "Templates".
                        </div>
                      ) : (
                        templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span>{template.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecione o template que será usado para esta notificação automática
                  </p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total de Regras</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-xs text-muted-foreground">Regras Ativas</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold">{stats.forClients}</div>
          <div className="text-xs text-muted-foreground">Para Clientes</div>
        </Card>
        <Card className="p-3">
          <div className="text-2xl font-bold">{stats.forAdmins}</div>
          <div className="text-xs text-muted-foreground">Para Admins</div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar regras..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            <SelectItem value="lifecycle">💖 Ciclo de Vida</SelectItem>
            <SelectItem value="payment">💳 Pagamento</SelectItem>
            <SelectItem value="engagement">📈 Engajamento</SelectItem>
            <SelectItem value="promotional">📢 Promocional</SelectItem>
            <SelectItem value="admin">⚙️ Administrativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : filteredRules.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhuma regra encontrada</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery || selectedCategory !== 'all' 
              ? 'Tente ajustar os filtros de busca' 
              : 'Clique em "Nova Regra" para criar sua primeira regra'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredRules.map((rule) => {
            const category = getCategoryForEvent(rule.event_type);
            const CategoryIcon = category?.icon || Bell;
            
            return (
              <Card key={rule.id} className={`transition-all ${!rule.active ? 'opacity-60' : ''}`}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base truncate">{rule.name}</CardTitle>
                        <Badge variant={rule.active ? 'default' : 'secondary'} className="flex-shrink-0">
                          {rule.active ? <Bell className="h-3 w-3 mr-1" /> : <BellOff className="h-3 w-3 mr-1" />}
                          {rule.active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      {rule.description && (
                        <CardDescription className="line-clamp-1 text-xs">{rule.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteRule(rule)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="flex flex-wrap gap-1.5">
                    {category && (
                      <Badge variant="outline" className={category.color}>
                        <CategoryIcon className="h-3 w-3 mr-1" />
                        {category.label}
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {EVENT_TYPE_LABELS[rule.event_type] || rule.event_type}
                    </Badge>
                    <Badge variant="outline">
                      {rule.target_audience === 'admin' ? <UserCog className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
                      {rule.target_audience === 'admin' ? 'Admin' : rule.target_audience === 'both' ? 'Ambos' : 'Cliente'}
                    </Badge>
                    {rule.days_before !== null && rule.days_before !== undefined && (
                      <Badge variant="outline">
                        <Calendar className="h-3 w-3 mr-1" />
                        {rule.days_before} dias
                      </Badge>
                    )}
                    {rule.template_reference && (
                      <Badge variant="secondary" className="max-w-48 truncate">
                        <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                        {getTemplateName(rule.template_reference)}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch
                      checked={rule.active}
                      onCheckedChange={(checked) => handleToggleActive(rule.id, checked)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {rule.active ? 'Desativar' : 'Ativar'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
            <AlertDialogAction onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
