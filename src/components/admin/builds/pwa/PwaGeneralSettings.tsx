/**
 * PwaGeneralSettings - Configurações gerais do PWA
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, HelpCircle, Globe, Palette, Monitor } from 'lucide-react';
import type { PwaSettings } from './types';
import { DISPLAY_MODES, ORIENTATIONS } from './types';

interface PwaGeneralSettingsProps {
  settings: PwaSettings;
  onChange: (updates: Partial<PwaSettings>) => void;
  disabled?: boolean;
}

export function PwaGeneralSettings({ settings, onChange, disabled }: PwaGeneralSettingsProps) {
  const [localState, setLocalState] = useState(settings);

  useEffect(() => {
    setLocalState(settings);
  }, [settings]);

  const handleChange = (field: keyof PwaSettings, value: string | boolean) => {
    setLocalState(prev => ({ ...prev, [field]: value }));
    onChange({ [field]: value });
  };

  const handleDebounce = (field: keyof PwaSettings, value: string) => {
    setLocalState(prev => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field: keyof PwaSettings) => {
    onChange({ [field]: localState[field] });
  };

  return (
    <div className="space-y-6">
      {/* Identidade do App */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Identidade do App
          </CardTitle>
          <CardDescription>
            Informações básicas que identificam seu PWA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="app_name">Nome do App</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Nome completo exibido na tela de instalação e launcher
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="app_name"
                value={localState.app_name}
                onChange={(e) => handleDebounce('app_name', e.target.value)}
                onBlur={() => handleBlur('app_name')}
                disabled={disabled}
                placeholder="Nome do seu app"
                maxLength={45}
              />
              <p className="text-xs text-muted-foreground text-right">
                {localState.app_name.length}/45 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="short_name">Nome Curto</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Nome curto exibido abaixo do ícone do app
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="short_name"
                value={localState.short_name}
                onChange={(e) => handleDebounce('short_name', e.target.value)}
                onBlur={() => handleBlur('short_name')}
                disabled={disabled}
                placeholder="Nome curto"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground text-right">
                {localState.short_name.length}/12 caracteres
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="description">Descrição</Label>
              <Badge variant="outline" className="text-xs">Opcional</Badge>
            </div>
            <Textarea
              id="description"
              value={localState.description || ''}
              onChange={(e) => handleDebounce('description', e.target.value)}
              onBlur={() => handleBlur('description')}
              disabled={disabled}
              placeholder="Descreva seu app..."
              maxLength={200}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {(localState.description || '').length}/200 caracteres
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="language">Idioma</Label>
              </div>
              <Select
                value={localState.language}
                onValueChange={(value) => handleChange('language', value)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="categories">Categorias</Label>
              </div>
              <Input
                id="categories"
                value={(localState.categories || []).join(', ')}
                onChange={(e) => {
                  const cats = e.target.value.split(',').map(c => c.trim()).filter(Boolean);
                  setLocalState(prev => ({ ...prev, categories: cats }));
                }}
                onBlur={() => onChange({ categories: localState.categories })}
                disabled={disabled}
                placeholder="entertainment, streaming"
              />
              <p className="text-xs text-muted-foreground">
                Separadas por vírgula
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Aparência
          </CardTitle>
          <CardDescription>
            Cores e estilo visual do app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="theme_color">Cor do Tema</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  id="theme_color"
                  value={localState.theme_color}
                  onChange={(e) => handleChange('theme_color', e.target.value)}
                  disabled={disabled}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={localState.theme_color}
                  onChange={(e) => handleChange('theme_color', e.target.value)}
                  disabled={disabled}
                  className="flex-1 font-mono"
                  placeholder="#1a1a2e"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Barra de status e controles do browser
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="background_color">Cor de Fundo</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  id="background_color"
                  value={localState.background_color}
                  onChange={(e) => handleChange('background_color', e.target.value)}
                  disabled={disabled}
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={localState.background_color}
                  onChange={(e) => handleChange('background_color', e.target.value)}
                  disabled={disabled}
                  className="flex-1 font-mono"
                  placeholder="#0f0f23"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Splash screen durante carregamento
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comportamento */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Comportamento
          </CardTitle>
          <CardDescription>
            Como o app se comporta quando instalado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modo de Exibição</Label>
              <Select
                value={localState.display_mode}
                onValueChange={(value) => handleChange('display_mode', value)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPLAY_MODES.map(mode => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div className="flex flex-col">
                        <span>{mode.label}</span>
                        <span className="text-xs text-muted-foreground">{mode.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Orientação</Label>
              <Select
                value={localState.orientation}
                onValueChange={(value) => handleChange('orientation', value)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIENTATIONS.map(orient => (
                    <SelectItem key={orient.value} value={orient.value}>
                      <div className="flex flex-col">
                        <span>{orient.label}</span>
                        <span className="text-xs text-muted-foreground">{orient.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_url">URL Inicial</Label>
              <Input
                id="start_url"
                value={localState.start_url}
                onChange={(e) => handleDebounce('start_url', e.target.value)}
                onBlur={() => handleBlur('start_url')}
                disabled={disabled}
                placeholder="/"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope">Escopo</Label>
              <Input
                id="scope"
                value={localState.scope}
                onChange={(e) => handleDebounce('scope', e.target.value)}
                onBlur={() => handleBlur('scope')}
                disabled={disabled}
                placeholder="/"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label>Preferir Apps Relacionados</Label>
              <p className="text-xs text-muted-foreground">
                Sugere apps nativos em vez do PWA quando disponíveis
              </p>
            </div>
            <Switch
              checked={localState.prefer_related_applications}
              onCheckedChange={(checked) => handleChange('prefer_related_applications', checked)}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
