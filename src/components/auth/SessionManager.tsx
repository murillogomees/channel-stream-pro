/**
 * SessionManager Component - View and manage active sessions
 */

import { useSessionManagement } from '@/hooks/useCustomAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Tv, 
  Loader2, 
  LogOut, 
  RefreshCw,
  MapPin,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function getDeviceIcon(deviceInfo: Record<string, any>) {
  const userAgent = deviceInfo?.user_agent?.toLowerCase() || '';
  
  if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) {
    return <Smartphone className="h-5 w-5" />;
  }
  if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
    return <Tablet className="h-5 w-5" />;
  }
  if (userAgent.includes('tv') || userAgent.includes('webos') || userAgent.includes('tizen')) {
    return <Tv className="h-5 w-5" />;
  }
  return <Monitor className="h-5 w-5" />;
}

function getDeviceName(deviceInfo: Record<string, any>) {
  const userAgent = deviceInfo?.user_agent || '';
  
  if (userAgent.includes('Chrome')) return 'Google Chrome';
  if (userAgent.includes('Firefox')) return 'Mozilla Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Microsoft Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  
  return 'Navegador desconhecido';
}

export function SessionManager() {
  const { 
    sessions, 
    loading, 
    fetchSessions, 
    revokeSession, 
    revokeOtherSessions 
  } = useSessionManagement();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Sessões Ativas</CardTitle>
          <CardDescription>
            Gerencie os dispositivos conectados à sua conta
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSessions}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {sessions.length > 1 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={revokeOtherSessions}
              disabled={loading}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Encerrar outras
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma sessão ativa encontrada
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  session.is_current ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-full bg-muted">
                    {getDeviceIcon(session.device_info)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {getDeviceName(session.device_info)}
                      </span>
                      {session.is_current && (
                        <Badge variant="default" className="text-xs">
                          Este dispositivo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.ip_address || 'IP desconhecido'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Último acesso{' '}
                        {formatDistanceToNow(new Date(session.last_activity), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                
                {!session.is_current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeSession(session.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
