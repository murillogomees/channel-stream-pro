/**
 * PwaServiceWorkerSettings - Configurações do Service Worker
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Settings, 
  HelpCircle, 
  ChevronDown, 
  AlertTriangle,
  Database,
  Wifi,
  Image,
  Code,
  RefreshCw
} from 'lucide-react';
import type { PwaSettings } from './types';
import { CACHE_STRATEGIES } from './types';

interface PwaServiceWorkerSettingsProps {
  settings: PwaSettings;
  onChange: (updates: Partial<PwaSettings>) => void;
  disabled?: boolean;
}

export function PwaServiceWorkerSettings({ settings, onChange, disabled }: PwaServiceWorkerSettingsProps) {
  const [strategiesOpen, setStrategiesOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleChange = (field: keyof PwaSettings, value: string | boolean | number) => {
    onChange({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Status do Service Worker */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Service Worker
              </CardTitle>
              <CardDescription>
                Controla cache, offline e performance do PWA
              </CardDescription>
            </div>
            <Switch
              checked={settings.sw_enabled}
              onCheckedChange={(checked) => handleChange('sw_enabled', checked)}
              disabled={disabled}
            />
          </div>
        </CardHeader>
        {settings.sw_enabled && (
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label>Precache do App Shell</Label>
                <p className="text-xs text-muted-foreground">
                  Cacheia arquivos essenciais durante a instalação
                </p>
              </div>
              <Switch
                checked={settings.sw_app_shell_precache}
                onCheckedChange={(checked) => handleChange('sw_app_shell_precache', checked)}
                disabled={disabled}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Estratégias de Cache */}
      {settings.sw_enabled && (
        <Collapsible open={strategiesOpen} onOpenChange={setStrategiesOpen}>
          <Card className="border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Estratégias de Cache
                    </CardTitle>
                    <CardDescription>
                      Configure como diferentes recursos são cacheados
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${strategiesOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {/* JS/CSS Strategy */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-muted-foreground" />
                      <Label>JS / CSS</Label>
                    </div>
                    <Select
                      value={settings.sw_js_css_strategy}
                      onValueChange={(value) => handleChange('sw_js_css_strategy', value)}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CACHE_STRATEGIES.map(strategy => (
                          <SelectItem key={strategy.value} value={strategy.value}>
                            <div className="flex flex-col">
                              <span>{strategy.label}</span>
                              <span className="text-xs text-muted-foreground">{strategy.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Images Strategy */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-muted-foreground" />
                      <Label>Imagens</Label>
                    </div>
                    <Select
                      value={settings.sw_images_strategy}
                      onValueChange={(value) => handleChange('sw_images_strategy', value)}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CACHE_STRATEGIES.map(strategy => (
                          <SelectItem key={strategy.value} value={strategy.value}>
                            <div className="flex flex-col">
                              <span>{strategy.label}</span>
                              <span className="text-xs text-muted-foreground">{strategy.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* API Strategy */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-muted-foreground" />
                      <Label>API / Dados</Label>
                    </div>
                    <Select
                      value={settings.sw_api_strategy}
                      onValueChange={(value) => handleChange('sw_api_strategy', value)}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CACHE_STRATEGIES.map(strategy => (
                          <SelectItem key={strategy.value} value={strategy.value}>
                            <div className="flex flex-col">
                              <span>{strategy.label}</span>
                              <span className="text-xs text-muted-foreground">{strategy.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Cache Limits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3 rounded-lg border">
                    <div className="flex justify-between items-center">
                      <Label>Expiração do Cache</Label>
                      <Badge variant="outline">{settings.sw_cache_expiration_days} dias</Badge>
                    </div>
                    <Slider
                      value={[settings.sw_cache_expiration_days]}
                      min={1}
                      max={90}
                      step={1}
                      onValueChange={([value]) => handleChange('sw_cache_expiration_days', value)}
                      disabled={disabled}
                    />
                  </div>

                  <div className="space-y-2 p-3 rounded-lg border">
                    <div className="flex justify-between items-center">
                      <Label>Limite de Itens</Label>
                      <Badge variant="outline">{settings.sw_max_cache_items} itens</Badge>
                    </div>
                    <Slider
                      value={[settings.sw_max_cache_items]}
                      min={20}
                      max={500}
                      step={10}
                      onValueChange={([value]) => handleChange('sw_max_cache_items', value)}
                      disabled={disabled}
                    />
                  </div>
                </div>

                {/* Offline Page */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Página Offline</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        URL exibida quando o usuário está offline e a página não está em cache
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    value={settings.sw_offline_page_url || ''}
                    onChange={(e) => handleChange('sw_offline_page_url', e.target.value)}
                    disabled={disabled}
                    placeholder="/offline.html"
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Configurações Avançadas */}
      {settings.sw_enabled && (
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Card className="border-border/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Atualizações e Comportamento
                    </CardTitle>
                    <CardDescription>
                      Configurações avançadas do ciclo de vida do SW
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label>Auto Update</Label>
                      <p className="text-xs text-muted-foreground">
                        Verifica atualizações automaticamente
                      </p>
                    </div>
                    <Switch
                      checked={settings.sw_auto_update}
                      onCheckedChange={(checked) => handleChange('sw_auto_update', checked)}
                      disabled={disabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label>Popup de Atualização</Label>
                      <p className="text-xs text-muted-foreground">
                        Notifica usuário sobre nova versão
                      </p>
                    </div>
                    <Switch
                      checked={settings.sw_show_update_popup}
                      onCheckedChange={(checked) => handleChange('sw_show_update_popup', checked)}
                      disabled={disabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Label>Clients Claim</Label>
                      <p className="text-xs text-muted-foreground">
                        SW controla tabs abertas imediatamente
                      </p>
                    </div>
                    <Switch
                      checked={settings.sw_clients_claim}
                      onCheckedChange={(checked) => handleChange('sw_clients_claim', checked)}
                      disabled={disabled}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <div>
                      <Label className="flex items-center gap-2">
                        Skip Waiting
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Ativa SW novo imediatamente (pode causar inconsistências)
                      </p>
                    </div>
                    <Switch
                      checked={settings.sw_skip_waiting}
                      onCheckedChange={(checked) => handleChange('sw_skip_waiting', checked)}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
