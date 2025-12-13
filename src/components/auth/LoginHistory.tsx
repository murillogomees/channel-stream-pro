/**
 * LoginHistory Component - View recent login activity
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  Loader2, 
  RefreshCw,
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LoginEvent {
  id: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  metadata: {
    success?: boolean;
    reason?: string;
    device?: string;
    browser?: string;
    location?: string;
  } | null;
}

export function LoginHistory() {
  const { user } = useAuth();
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('auth_sessions_log')
        .select('*')
        .eq('user_id', user.id)
        .in('event_type', ['login', 'logout', 'failed_login', 'password_reset'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setEvents(data as LoginEvent[]);
      }
    } catch (e) {
      console.error('Error fetching login history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id]);

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Monitor className="h-4 w-4" />;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (ua.includes('tablet') || ua.includes('ipad')) {
      return <Tablet className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getBrowserName = (userAgent: string | null) => {
    if (!userAgent) return 'Desconhecido';
    const ua = userAgent.toLowerCase();
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('edge')) return 'Edge';
    if (ua.includes('opera')) return 'Opera';
    return 'Navegador';
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case 'login':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">Login</Badge>;
      case 'logout':
        return <Badge variant="secondary">Logout</Badge>;
      case 'failed_login':
        return <Badge variant="destructive">Falha</Badge>;
      case 'password_reset':
        return <Badge variant="outline" className="border-yellow-500/50 text-yellow-600">Senha</Badge>;
      default:
        return <Badge variant="outline">{eventType}</Badge>;
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'login':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed_login':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted">
              <History className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Histórico de Login</CardTitle>
              <CardDescription>
                Atividade recente da sua conta
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchHistory} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum histórico encontrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {events.map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {getEventIcon(event.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getEventBadge(event.event_type)}
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {getDeviceIcon(event.user_agent)}
                        {getBrowserName(event.user_agent)}
                      </span>
                      {event.ip_address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.ip_address}
                        </span>
                      )}
                    </div>
                    {event.event_type === 'failed_login' && event.metadata?.reason && (
                      <p className="text-xs text-destructive mt-1">
                        {event.metadata.reason}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(event.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
