/**
 * PwaInstallSettings - Configurações do banner de instalação
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, HelpCircle, MessageSquare, Clock, Eye } from 'lucide-react';
import type { PwaSettings } from './types';
import { BANNER_STYLES } from './types';

interface PwaInstallSettingsProps {
  settings: PwaSettings;
  onChange: (updates: Partial<PwaSettings>) => void;
  disabled?: boolean;
}

export function PwaInstallSettings({ settings, onChange, disabled }: PwaInstallSettingsProps) {
  const handleChange = (field: keyof PwaSettings, value: string | boolean | number) => {
    onChange({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Status do Banner */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                Banner de Instalação
              </CardTitle>
              <CardDescription>
                Incentiva usuários a instalar o PWA
              </CardDescription>
            </div>
            <Switch
              checked={settings.install_banner_enabled}
              onCheckedChange={(checked) => handleChange('install_banner_enabled', checked)}
              disabled={disabled}
            />
          </div>
        </CardHeader>
      </Card>

      {settings.install_banner_enabled && (
        <>
          {/* Estilo e Mensagem */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Aparência e Mensagem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Estilo do Banner</Label>
                  <Select
                    value={settings.install_banner_style}
                    onValueChange={(value) => handleChange('install_banner_style', value)}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BANNER_STYLES.map(style => (
                        <SelectItem key={style.value} value={style.value}>
                          <div className="flex flex-col">
                            <span>{style.label}</span>
                            <span className="text-xs text-muted-foreground">{style.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 p-3 rounded-lg border">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Label>Delay para Exibir</Label>
                    </div>
                    <Badge variant="outline">{settings.install_banner_delay_seconds}s</Badge>
                  </div>
                  <Slider
                    value={[settings.install_banner_delay_seconds]}
                    min={0}
                    max={120}
                    step={5}
                    onValueChange={([value]) => handleChange('install_banner_delay_seconds', value)}
                    disabled={disabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo de espera antes de mostrar o banner
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Mensagem do Banner</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Texto principal exibido no banner de instalação
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  value={settings.install_banner_message}
                  onChange={(e) => handleChange('install_banner_message', e.target.value)}
                  disabled={disabled}
                  placeholder="Instale nosso app para uma experiência melhor!"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {settings.install_banner_message.length}/100 caracteres
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview do Banner */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </CardTitle>
              <CardDescription>
                Visualização aproximada do banner
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Simulated device frame */}
                <div className="bg-muted rounded-lg p-4 min-h-[200px] flex flex-col justify-end">
                  {/* Content placeholder */}
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    Conteúdo do App
                  </div>

                  {/* Banner preview */}
                  {settings.install_banner_style === 'bottom-sheet' && (
                    <div className="bg-background border rounded-t-2xl p-4 shadow-lg -mx-4 -mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                          {settings.icon_192 ? (
                            <img src={settings.icon_192} alt="App" className="w-8 h-8 rounded" />
                          ) : (
                            <Download className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{settings.app_name}</p>
                          <p className="text-xs text-muted-foreground">{settings.install_banner_message}</p>
                        </div>
                        <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                          Instalar
                        </button>
                      </div>
                    </div>
                  )}

                  {settings.install_banner_style === 'snackbar' && (
                    <div className="bg-background border rounded-lg p-3 shadow-lg -mx-4 -mb-4 mx-2 mb-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm">{settings.install_banner_message}</p>
                        <button className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium whitespace-nowrap">
                          Instalar
                        </button>
                      </div>
                    </div>
                  )}

                  {settings.install_banner_style === 'modal' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                      <div className="bg-background border rounded-xl p-6 m-4 max-w-sm text-center shadow-xl">
                        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          {settings.icon_192 ? (
                            <img src={settings.icon_192} alt="App" className="w-12 h-12 rounded-xl" />
                          ) : (
                            <Download className="h-8 w-8 text-primary" />
                          )}
                        </div>
                        <h3 className="font-semibold mb-2">{settings.app_name}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{settings.install_banner_message}</p>
                        <div className="flex gap-2 justify-center">
                          <button className="px-4 py-2 border rounded-lg text-sm">Agora não</button>
                          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
                            Instalar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
