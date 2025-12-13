/**
 * LoginAlertsPanel Component - View and manage login alerts
 */

import { useState } from 'react';
import { useLoginAlerts } from '@/hooks/useAdvancedAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Check, MapPin, Loader2, AlertTriangle, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function LoginAlertsPanel() {
  const { alerts, loading, acknowledgeAlert, setPreferences, unreadCount } = useLoginAlerts();
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const handlePreferenceSave = async () => {
    setSavingPrefs(true);
    await setPreferences({ email: emailEnabled, whatsapp: whatsappEnabled });
    setSavingPrefs(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas de Login
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Receba notificações quando novos dispositivos acessarem sua conta
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preferences */}
        <div className="p-4 rounded-lg border bg-muted/30">
          <h4 className="font-medium mb-3">Preferências de Notificação</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-alerts" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Alertas por Email
              </Label>
              <Switch
                id="email-alerts"
                checked={emailEnabled}
                onCheckedChange={setEmailEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="whatsapp-alerts" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Alertas por WhatsApp
              </Label>
              <Switch
                id="whatsapp-alerts"
                checked={whatsappEnabled}
                onCheckedChange={setWhatsappEnabled}
              />
            </div>
            <Button 
              onClick={handlePreferenceSave} 
              disabled={savingPrefs}
              size="sm"
              className="w-full"
            >
              {savingPrefs ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Preferências
            </Button>
          </div>
        </div>

        {/* Alerts List */}
        <div>
          <h4 className="font-medium mb-3">Alertas Recentes</h4>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <BellOff className="h-8 w-8 mb-2" />
              <p className="text-sm">Nenhum alerta de login</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    !alert.acknowledged_at ? 'bg-yellow-500/5 border-yellow-500/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        alert.alert_type === 'new_device' 
                          ? 'bg-yellow-500/10' 
                          : 'bg-red-500/10'
                      }`}>
                        <AlertTriangle className={`h-4 w-4 ${
                          alert.alert_type === 'new_device' 
                            ? 'text-yellow-500' 
                            : 'text-red-500'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {alert.alert_type === 'new_device' 
                            ? 'Novo dispositivo detectado' 
                            : 'Login suspeito'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          {alert.ip_address && (
                            <>
                              <MapPin className="h-3 w-3" />
                              <span>{alert.ip_address}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            {format(new Date(alert.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {alert.alert_sent_via && alert.alert_sent_via.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {alert.alert_sent_via.map((via: string) => (
                              <Badge key={via} variant="secondary" className="text-xs">
                                {via}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {!alert.acknowledged_at && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="text-green-500 hover:text-green-600"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
