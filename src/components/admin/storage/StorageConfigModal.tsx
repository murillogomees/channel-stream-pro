import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Zap, DollarSign, HardDrive, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface StorageConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: {
    auto_transcode_enabled: boolean;
    transcode_preset: string;
    monthly_alert_threshold: number;
  };
  onConfigUpdate: (key: string, value: any) => Promise<void>;
}

const PRESETS = [
  { value: 'fast', label: 'Fast', description: 'Menor qualidade, processamento rápido', bitrate: '1.5 Mbps' },
  { value: 'standard', label: 'Standard', description: 'Qualidade balanceada', bitrate: '3 Mbps' },
  { value: 'high', label: 'High', description: 'Alta qualidade', bitrate: '6 Mbps' },
  { value: 'ultra', label: 'Ultra', description: 'Máxima qualidade, maior custo', bitrate: '12 Mbps' },
];

export function StorageConfigModal({ open, onOpenChange, config, onConfigUpdate }: StorageConfigModalProps) {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState(config);
  const [isSaving, setIsSaving] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState({ encoding: 0, storage: 0, total: 0 });

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    // Estimar custo baseado no preset
    const presetMultipliers: Record<string, number> = {
      fast: 0.5,
      standard: 1,
      high: 1.8,
      ultra: 3
    };
    const multiplier = presetMultipliers[localConfig.transcode_preset] || 1;
    
    // Assumindo 100 minutos de vídeo por mês como base
    const baseMinutes = 100;
    const encodingCost = baseMinutes * 0.01 * multiplier;
    const storageCost = baseMinutes * 0.005 * multiplier;
    
    setEstimatedCost({
      encoding: Number(encodingCost.toFixed(2)),
      storage: Number(storageCost.toFixed(2)),
      total: Number((encodingCost + storageCost).toFixed(2))
    });
  }, [localConfig.transcode_preset]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onConfigUpdate('auto_transcode_enabled', { enabled: localConfig.auto_transcode_enabled });
      await onConfigUpdate('transcode_preset', { preset: localConfig.transcode_preset });
      await onConfigUpdate('cost_thresholds', { monthly_alert: localConfig.monthly_alert_threshold });
      
      toast({ title: 'Configurações salvas', description: 'Auto-sync configurado com sucesso' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedPreset = PRESETS.find(p => p.value === localConfig.transcode_preset);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuração de Auto-Sync R2 → CF Stream
          </DialogTitle>
          <DialogDescription>
            Configure a sincronização automática de VODs do R2 para o Cloudflare Stream
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Auto-Transcode Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Auto-Transcode
              </CardTitle>
              <CardDescription>
                Enviar automaticamente novos VODs do R2 para o CF Stream
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Habilitar Auto-Sync</Label>
                  <p className="text-xs text-muted-foreground">
                    VODs enviados ao R2 serão automaticamente processados pelo CF Stream
                  </p>
                </div>
                <Switch
                  checked={localConfig.auto_transcode_enabled}
                  onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, auto_transcode_enabled: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preset Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-blue-500" />
                Preset de Qualidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={localConfig.transcode_preset}
                onValueChange={(value) => setLocalConfig(prev => ({ ...prev, transcode_preset: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o preset" />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{preset.label}</span>
                        <Badge variant="outline" className="text-xs">{preset.bitrate}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedPreset && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">{selectedPreset.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span>Bitrate: <strong>{selectedPreset.bitrate}</strong></span>
                  </div>
                </div>
              )}

              {/* Cost Estimate */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-orange-500/10 rounded">
                  <p className="text-xs text-muted-foreground">Encoding</p>
                  <p className="font-medium text-orange-500">${estimatedCost.encoding}</p>
                </div>
                <div className="p-2 bg-blue-500/10 rounded">
                  <p className="text-xs text-muted-foreground">Storage</p>
                  <p className="font-medium text-blue-500">${estimatedCost.storage}</p>
                </div>
                <div className="p-2 bg-green-500/10 rounded">
                  <p className="text-xs text-muted-foreground">Total/mês*</p>
                  <p className="font-medium text-green-500">${estimatedCost.total}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                * Estimativa baseada em 100 min/mês de conteúdo
              </p>
            </CardContent>
          </Card>

          {/* Alert Threshold */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Alerta de Custo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Limite mensal</Label>
                  <span className="text-sm font-medium">${localConfig.monthly_alert_threshold}</span>
                </div>
                <Slider
                  value={[localConfig.monthly_alert_threshold]}
                  onValueChange={([value]) => setLocalConfig(prev => ({ ...prev, monthly_alert_threshold: value }))}
                  min={10}
                  max={500}
                  step={10}
                />
                <p className="text-xs text-muted-foreground">
                  Você receberá um alerta quando o custo mensal ultrapassar este valor
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
