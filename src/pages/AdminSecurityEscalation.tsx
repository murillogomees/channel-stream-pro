import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Users, Save, Plus, Trash2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface EscalationRule {
  id: string;
  rule_name: string;
  event_type: string;
  severity_level: string;
  time_window_minutes: number;
  escalation_action: string;
  secondary_admin_ids: string[] | null;
  enabled: boolean;
}

interface AdminPhone {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}

const EVENT_TYPES = [
  { value: 'failed_login', label: 'Login Falhou' },
  { value: 'permission_change', label: 'Mudança de Permissão' },
  { value: 'suspicious_activity', label: 'Atividade Suspeita' },
  { value: 'rate_limit_exceeded', label: 'Limite Excedido' },
  { value: 'unauthorized_access', label: 'Acesso Não Autorizado' },
];

const SEVERITY_LEVELS = [
  { value: 'critical', label: 'Crítico' },
  { value: 'warning', label: 'Aviso' },
  { value: 'info', label: 'Informação' },
];

export default function AdminSecurityEscalation() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [admins, setAdmins] = useState<AdminPhone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [showNewRule, setShowNewRule] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    
    // Real-time updates via Supabase
    const rulesChannel = supabase
      .channel('escalation-rules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'security_alert_escalation_rules'
        },
        () => {
          console.log('[Escalation] Mudança em regras detectada');
          fetchRules();
        }
      )
      .subscribe();
    
    // Atualização periódica a cada 60 segundos
    const interval = setInterval(() => {
      fetchData();
    }, 60000);
    
    return () => {
      supabase.removeChannel(rulesChannel);
      clearInterval(interval);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchRules(), fetchAdmins()]);
    setLoading(false);
  };

  const fetchRules = async () => {
    const { data, error } = await supabase
      .from('security_alert_escalation_rules')
      .select('*')
      .order('event_type');

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar regras",
        variant: "destructive",
      });
      return;
    }

    setRules(data || []);
  };

  const fetchAdmins = async () => {
    const { data, error } = await supabase
      .from('admin_phones')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar admins",
        variant: "destructive",
      });
      return;
    }

    setAdmins(data || []);
  };

  const createRule = async () => {
    const newRule = {
      rule_name: 'Nova Regra',
      event_type: 'failed_login',
      severity_level: 'critical',
      time_window_minutes: 10,
      escalation_action: 'notify_all',
      enabled: true,
    };

    const { data, error } = await supabase
      .from('security_alert_escalation_rules')
      .insert([newRule])
      .select()
      .single();

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar regra",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Regra criada com sucesso",
    });

    setEditingRule(data);
    setShowNewRule(false);
    fetchRules();
  };

  const saveRule = async (rule: EscalationRule) => {
    const { error } = await supabase
      .from('security_alert_escalation_rules')
      .update({
        rule_name: rule.rule_name,
        event_type: rule.event_type,
        severity_level: rule.severity_level,
        time_window_minutes: rule.time_window_minutes,
        escalation_action: rule.escalation_action,
        secondary_admin_ids: rule.secondary_admin_ids,
        enabled: rule.enabled,
      })
      .eq('id', rule.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar regra",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Regra atualizada com sucesso",
    });

    setEditingRule(null);
    fetchRules();
  };

  const toggleRule = async (id: string, currentEnabled: boolean) => {
    const { error } = await supabase
      .from('security_alert_escalation_rules')
      .update({ enabled: !currentEnabled })
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar regra",
        variant: "destructive",
      });
      return;
    }

    fetchRules();
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase
      .from('security_alert_escalation_rules')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Erro",
        description: "Falha ao deletar regra",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sucesso",
      description: "Regra removida",
    });

    fetchRules();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-primary" />
            Regras de Escalonamento
          </h1>
        </div>
        <Button onClick={() => setShowNewRule(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Regra
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Como Funciona o Escalonamento</CardTitle>
          <CardDescription>
            Alertas críticos não confirmados são automaticamente escalonados após o tempo configurado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• O sistema verifica alertas enviados a cada 5 minutos</p>
            <p>• Se um alerta não for confirmado dentro do tempo limite, ele é escalonado</p>
            <p>• Você pode escolher notificar todos os admins ou admins específicos</p>
            <p>• Configure regras diferentes para cada tipo de evento e nível de severidade</p>
          </div>
        </CardContent>
      </Card>

      {showNewRule && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Nova Regra</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={createRule}>Criar Regra</Button>
            <Button variant="ghost" onClick={() => setShowNewRule(false)} className="ml-2">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {rule.rule_name}
                    <Badge variant={rule.enabled ? "default" : "secondary"}>
                      {rule.enabled ? "Ativa" : "Inativa"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {EVENT_TYPES.find(t => t.value === rule.event_type)?.label} • {' '}
                    {SEVERITY_LEVELS.find(s => s.value === rule.severity_level)?.label}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => toggleRule(rule.id, rule.enabled)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingRule(rule)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Tempo de Espera</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {rule.time_window_minutes} minutos
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ação</Label>
                  <p className="font-medium">
                    {rule.escalation_action === 'notify_all' ? 'Notificar Todos' : 'Notificar Específicos'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Admins Secundários</Label>
                  <p className="font-medium flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {rule.secondary_admin_ids?.length || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editingRule && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Regra: {editingRule.rule_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Regra</Label>
              <Input
                value={editingRule.rule_name}
                onChange={(e) =>
                  setEditingRule({ ...editingRule, rule_name: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Evento</Label>
                <Select
                  value={editingRule.event_type}
                  onValueChange={(value) =>
                    setEditingRule({ ...editingRule, event_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nível de Severidade</Label>
                <Select
                  value={editingRule.severity_level}
                  onValueChange={(value) =>
                    setEditingRule({ ...editingRule, severity_level: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tempo de Espera (minutos)</Label>
              <Input
                type="number"
                min="1"
                value={editingRule.time_window_minutes}
                onChange={(e) =>
                  setEditingRule({
                    ...editingRule,
                    time_window_minutes: parseInt(e.target.value) || 10,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Tempo antes de escalonar se não houver confirmação
              </p>
            </div>

            <div className="space-y-2">
              <Label>Ação de Escalonamento</Label>
              <Select
                value={editingRule.escalation_action}
                onValueChange={(value) =>
                  setEditingRule({ ...editingRule, escalation_action: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="notify_all">Notificar Todos os Admins</SelectItem>
                  <SelectItem value="notify_secondary">Notificar Admins Específicos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => saveRule(editingRule)}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setEditingRule(null)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
