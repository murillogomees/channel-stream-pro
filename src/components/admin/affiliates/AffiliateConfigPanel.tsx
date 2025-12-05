import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAffiliateConfig } from '@/hooks/useAffiliateConfig';
import { Save, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function AffiliateConfigPanel() {
  const { config, loading, updateMultipleConfigs } = useAffiliateConfig();
  const [localConfig, setLocalConfig] = useState(config);
  const [saving, setSaving] = useState(false);

  // Sync local state when config loads
  useState(() => {
    setLocalConfig(config);
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMultipleConfigs({
        min_withdrawal_amount: localConfig.min_withdrawal_amount,
        withdrawal_cooldown_days: localConfig.withdrawal_cooldown_days,
        max_withdrawals_per_month: localConfig.max_withdrawals_per_month,
        auto_confirm_referrals: localConfig.auto_confirm_referrals,
        fraud_detection_enabled: { enabled: localConfig.fraud_detection_enabled },
        recurring_commission_enabled: localConfig.recurring_commission_enabled,
        cookie_duration_days: localConfig.cookie_duration_days
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Configurações de Saques
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Valor Mínimo para Saque (R$)</Label>
              <Input
                type="number"
                value={localConfig.min_withdrawal_amount}
                onChange={e => setLocalConfig({ ...localConfig, min_withdrawal_amount: Number(e.target.value) })}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Intervalo entre Saques (dias)</Label>
              <Input
                type="number"
                value={localConfig.withdrawal_cooldown_days}
                onChange={e => setLocalConfig({ ...localConfig, withdrawal_cooldown_days: Number(e.target.value) })}
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Máx. Saques por Mês</Label>
              <Input
                type="number"
                value={localConfig.max_withdrawals_per_month}
                onChange={e => setLocalConfig({ ...localConfig, max_withdrawals_per_month: Number(e.target.value) })}
                min={1}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Confirmação de Indicações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Confirmar Automaticamente</Label>
              <p className="text-sm text-muted-foreground">
                Confirmar indicações automaticamente após período de espera
              </p>
            </div>
            <Switch
              checked={localConfig.auto_confirm_referrals.enabled}
              onCheckedChange={checked => setLocalConfig({
                ...localConfig,
                auto_confirm_referrals: { ...localConfig.auto_confirm_referrals, enabled: checked }
              })}
            />
          </div>
          {localConfig.auto_confirm_referrals.enabled && (
            <div className="space-y-2">
              <Label>Tempo de Espera (horas)</Label>
              <Input
                type="number"
                value={localConfig.auto_confirm_referrals.delay_hours}
                onChange={e => setLocalConfig({
                  ...localConfig,
                  auto_confirm_referrals: { ...localConfig.auto_confirm_referrals, delay_hours: Number(e.target.value) }
                })}
                min={1}
                className="w-32"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comissão Recorrente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Habilitar Comissão em Renovações</Label>
              <p className="text-sm text-muted-foreground">
                Pagar comissão quando cliente indicado renova assinatura
              </p>
            </div>
            <Switch
              checked={localConfig.recurring_commission_enabled.enabled}
              onCheckedChange={checked => setLocalConfig({
                ...localConfig,
                recurring_commission_enabled: { ...localConfig.recurring_commission_enabled, enabled: checked }
              })}
            />
          </div>
          {localConfig.recurring_commission_enabled.enabled && (
            <div className="space-y-2">
              <Label>Percentual de Comissão em Renovações (%)</Label>
              <Input
                type="number"
                value={localConfig.recurring_commission_enabled.percentage}
                onChange={e => setLocalConfig({
                  ...localConfig,
                  recurring_commission_enabled: { ...localConfig.recurring_commission_enabled, percentage: Number(e.target.value) }
                })}
                min={0}
                max={100}
                className="w-32"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rastreamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Duração do Cookie (dias)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Tempo que o link de afiliado permanece ativo após o clique
            </p>
            <Input
              type="number"
              value={localConfig.cookie_duration_days}
              onChange={e => setLocalConfig({ ...localConfig, cookie_duration_days: Number(e.target.value) })}
              min={1}
              className="w-32"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Segurança</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Detecção de Fraude</Label>
              <p className="text-sm text-muted-foreground">
                Detectar padrões suspeitos como auto-indicação e cliques repetidos
              </p>
            </div>
            <Switch
              checked={localConfig.fraud_detection_enabled}
              onCheckedChange={checked => setLocalConfig({ ...localConfig, fraud_detection_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
