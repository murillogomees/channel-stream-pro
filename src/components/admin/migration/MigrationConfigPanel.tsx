import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Save, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function MigrationConfigPanel() {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      console.log('[MigrationConfig] Loading config...');
      
      // Use RPC function with type casting
      const { data, error } = await (supabase.rpc as any)('get_r2_config');

      if (error) {
        console.error('[MigrationConfig] RPC load error:', error);
        // Fallback to direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('r2_migration_config')
          .select('*');
        
        if (fallbackError) throw fallbackError;
        
        const configMap: Record<string, any> = {};
        fallbackData?.forEach((item: any) => {
          let value = item.value;
          if (value === 'true' || value === true) value = true;
          else if (value === 'false' || value === false) value = false;
          configMap[item.key] = value;
        });
        console.log('[MigrationConfig] Fallback config:', configMap);
        setConfig(configMap);
        return;
      }

      console.log('[MigrationConfig] Raw RPC data:', data);

      const configMap: Record<string, any> = {};
      const items = data as Array<{ key: string; value: any; description: string; updated_at: string }>;
      items?.forEach((item) => {
        let value = item.value;
        if (value === 'true' || value === true) value = true;
        else if (value === 'false' || value === false) value = false;
        configMap[item.key] = value;
      });
      console.log('[MigrationConfig] Processed config:', configMap);
      setConfig(configMap);
    } catch (error: any) {
      console.error('Error loading config:', error);
      toast.error(`Erro ao carregar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async (key: string, value: any) => {
    setIsSaving(true);
    try {
      // Normalize boolean values
      let normalizedValue = value;
      if (value === 'true') normalizedValue = true;
      if (value === 'false') normalizedValue = false;
      
      console.log('[MigrationConfig] Saving:', key, normalizedValue);
      
      // Try RPC first
      const { data, error } = await (supabase.rpc as any)('update_r2_config', { 
        p_key: key, 
        p_value: normalizedValue 
      });

      if (error) {
        console.error('[MigrationConfig] RPC save error:', error);
        
        // Fallback to direct update
        const { error: updateError } = await supabase
          .from('r2_migration_config')
          .update({ 
            value: normalizedValue,
            updated_at: new Date().toISOString()
          })
          .eq('key', key);

        if (updateError) throw updateError;
      }

      console.log('[MigrationConfig] Save result:', data);
      setConfig(prev => ({ ...prev, [key]: normalizedValue }));
      toast.success('Configuração salva');
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfigValue = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {config.USE_R2_STORAGE && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-600 font-medium">R2 Storage está ativo</span>
        </div>
      )}
      
      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feature Flags</CardTitle>
          <CardDescription>Controle de funcionalidades da migração</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Usar R2 Storage</Label>
              <p className="text-sm text-muted-foreground">
                Servir assets do R2 CDN ao invés do Supabase
              </p>
            </div>
            <Switch
              checked={config.USE_R2_STORAGE === true}
              onCheckedChange={(checked) => saveConfig('USE_R2_STORAGE', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Migration Worker Ativo</Label>
              <p className="text-sm text-muted-foreground">
                Permitir execução de jobs de migração
              </p>
            </div>
            <Switch
              checked={config.MIGRATION_ENABLED === true}
              onCheckedChange={(checked) => saveConfig('MIGRATION_ENABLED', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Throttle de Custo</Label>
              <p className="text-sm text-muted-foreground">
                Pausar automaticamente se atingir limite de operações
              </p>
            </div>
            <Switch
              checked={config.THROTTLE_ENABLED === true}
              onCheckedChange={(checked) => saveConfig('THROTTLE_ENABLED', checked)}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Worker Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurações do Worker</CardTitle>
          <CardDescription>Performance e limites de processamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Batch Size: {config.BATCH_SIZE || 100}</Label>
            <Slider
              value={[parseInt(config.BATCH_SIZE) || 100]}
              onValueChange={([value]) => updateConfigValue('BATCH_SIZE', value.toString())}
              onValueCommit={([value]) => saveConfig('BATCH_SIZE', value.toString())}
              min={10}
              max={500}
              step={10}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Número de items processados por batch
            </p>
          </div>

          <div className="space-y-2">
            <Label>Concorrência: {config.CONCURRENCY || 8}</Label>
            <Slider
              value={[parseInt(config.CONCURRENCY) || 8]}
              onValueChange={([value]) => updateConfigValue('CONCURRENCY', value.toString())}
              onValueCommit={([value]) => saveConfig('CONCURRENCY', value.toString())}
              min={1}
              max={32}
              step={1}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Uploads simultâneos por worker
            </p>
          </div>

          <div className="space-y-2">
            <Label>Max Retries: {config.MAX_RETRIES || 3}</Label>
            <Slider
              value={[parseInt(config.MAX_RETRIES) || 3]}
              onValueChange={([value]) => updateConfigValue('MAX_RETRIES', value.toString())}
              onValueCommit={([value]) => saveConfig('MAX_RETRIES', value.toString())}
              min={1}
              max={10}
              step={1}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Tentativas antes de marcar como falha
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cost Control */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Controle de Custos</CardTitle>
          <CardDescription>Limites de operações e orçamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Orçamento Mensal de Operações</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={config.OPS_BUDGET_MONTHLY || 1000000}
                onChange={(e) => updateConfigValue('OPS_BUDGET_MONTHLY', e.target.value)}
                className="flex-1"
                disabled={isSaving}
              />
              <Button 
                size="sm"
                onClick={() => saveConfig('OPS_BUDGET_MONTHLY', config.OPS_BUDGET_MONTHLY)}
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Operações R2 máximas por mês (Class A + Class B)
            </p>
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-600">Custo Estimado R2</p>
              <p className="text-muted-foreground">
                Class A (write): $4.50/milhão ops • Class B (read): $0.36/milhão ops
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image Optimization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Otimização de Imagens</CardTitle>
          <CardDescription>Compressão e formatos para logos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Compressão Ativa</Label>
              <p className="text-sm text-muted-foreground">
                Converter logos para WebP otimizado
              </p>
            </div>
            <Switch
              checked={config.IMAGE_COMPRESSION?.enabled ?? true}
              onCheckedChange={(checked) => {
                const newConfig = { ...config.IMAGE_COMPRESSION, enabled: checked };
                saveConfig('IMAGE_COMPRESSION', newConfig);
              }}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label>Qualidade: {config.IMAGE_COMPRESSION?.quality || 75}%</Label>
            <Slider
              value={[config.IMAGE_COMPRESSION?.quality || 75]}
              onValueChange={([value]) => {
                updateConfigValue('IMAGE_COMPRESSION', { ...config.IMAGE_COMPRESSION, quality: value });
              }}
              onValueCommit={([value]) => {
                saveConfig('IMAGE_COMPRESSION', { ...config.IMAGE_COMPRESSION, quality: value });
              }}
              min={50}
              max={100}
              step={5}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={loadConfig} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Recarregar Configurações
        </Button>
      </div>
    </div>
  );
}
