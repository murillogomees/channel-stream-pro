/**
 * PwaPushSettings - Configurações de Push Notifications
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Bell, 
  HelpCircle, 
  Key, 
  Send, 
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import type { PwaSettings } from './types';
import { toast } from 'sonner';

interface PwaPushSettingsProps {
  settings: PwaSettings;
  onChange: (updates: Partial<PwaSettings>) => void;
  disabled?: boolean;
}

export function PwaPushSettings({ settings, onChange, disabled }: PwaPushSettingsProps) {
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleChange = (field: keyof PwaSettings, value: string | boolean) => {
    onChange({ [field]: value });
  };

  const generateVapidKeys = async () => {
    setIsGenerating(true);
    try {
      // Web Crypto API para gerar chaves VAPID
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        true,
        ['sign', 'verify']
      );

      const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
      const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKey)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      onChange({
        push_vapid_public_key: publicKeyBase64,
        push_vapid_private_key: privateKeyBase64,
      });

      toast.success('Chaves VAPID geradas com sucesso');
    } catch (err) {
      console.error('[PWA] Error generating VAPID keys:', err);
      toast.error('Erro ao gerar chaves VAPID');
    } finally {
      setIsGenerating(false);
    }
  };

  const sendTestNotification = async () => {
    if (!settings.push_vapid_public_key) {
      toast.error('Configure as chaves VAPID primeiro');
      return;
    }

    setIsTesting(true);
    try {
      // Solicitar permissão
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Permissão de notificação negada');
        return;
      }

      // Mostrar notificação local de teste
      new Notification('Teste PWA', {
        body: 'Esta é uma notificação de teste do seu PWA!',
        icon: settings.icon_192 || '/favicon.ico',
        badge: settings.icon_192 || '/favicon.ico',
      });

      toast.success('Notificação de teste enviada');
    } catch (err) {
      console.error('[PWA] Error sending test notification:', err);
      toast.error('Erro ao enviar notificação de teste');
    } finally {
      setIsTesting(false);
    }
  };

  const hasValidKeys = settings.push_vapid_public_key && settings.push_vapid_private_key;

  return (
    <div className="space-y-6">
      {/* Status das Push Notifications */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Push Notifications
              </CardTitle>
              <CardDescription>
                Envie notificações para usuários mesmo com o app fechado
              </CardDescription>
            </div>
            <Switch
              checked={settings.push_enabled}
              onCheckedChange={(checked) => handleChange('push_enabled', checked)}
              disabled={disabled}
            />
          </div>
        </CardHeader>
      </Card>

      {settings.push_enabled && (
        <>
          {/* VAPID Keys */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />
                Chaves VAPID
              </CardTitle>
              <CardDescription>
                Chaves de autenticação para push notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasValidKeys && (
                <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    As chaves VAPID são necessárias para enviar push notifications. 
                    Gere um par de chaves ou insira suas chaves existentes.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Chave Pública</Label>
                    {settings.push_vapid_public_key && (
                      <Badge variant="outline" className="text-green-500 border-green-500/50">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Configurada
                      </Badge>
                    )}
                  </div>
                  <Input
                    value={settings.push_vapid_public_key || ''}
                    onChange={(e) => handleChange('push_vapid_public_key', e.target.value)}
                    disabled={disabled}
                    placeholder="BEw8..."
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label>Chave Privada</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Mantenha esta chave em segredo. Não compartilhe publicamente.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                    >
                      {showPrivateKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Input
                    type={showPrivateKey ? 'text' : 'password'}
                    value={settings.push_vapid_private_key || ''}
                    onChange={(e) => handleChange('push_vapid_private_key', e.target.value)}
                    disabled={disabled}
                    placeholder="••••••••"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={generateVapidKeys}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Gerar Novas Chaves
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endpoint e Teste */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" />
                Configuração do Servidor
              </CardTitle>
              <CardDescription>
                Endpoint para envio de notificações push
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Endpoint do Servidor</Label>
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                </div>
                <Input
                  value={settings.push_endpoint || ''}
                  onChange={(e) => handleChange('push_endpoint', e.target.value)}
                  disabled={disabled}
                  placeholder="https://api.example.com/push"
                />
                <p className="text-xs text-muted-foreground">
                  URL do seu servidor que receberá as subscrições push
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={sendTestNotification}
                  disabled={disabled || isTesting || !hasValidKeys}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4 mr-2" />
                  )}
                  Enviar Notificação de Teste
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
