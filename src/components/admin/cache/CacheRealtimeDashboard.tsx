import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Radio } from 'lucide-react';

export function CacheRealtimeDashboard() {
  const [liveStats, setLiveStats] = useState({
    requests_per_second: 0,
    hits_per_second: 0,
    misses_per_second: 0,
    active_rules: 0,
  });

  useEffect(() => {
    // Subscribe to real-time cache stats updates
    const subscription = supabase
      .channel('cache_stats_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'cache_stats',
      }, (payload) => {
        console.log('Real-time cache stat:', payload);
        
        // Update live stats
        setLiveStats(prev => ({
          ...prev,
          requests_per_second: prev.requests_per_second + 1,
          hits_per_second: payload.new.hits || 0,
          misses_per_second: payload.new.misses || 0,
        }));
      })
      .subscribe();

    // Simulate real-time updates (remove in production)
    const interval = setInterval(() => {
      setLiveStats(prev => ({
        requests_per_second: Math.floor(Math.random() * 100) + 50,
        hits_per_second: Math.floor(Math.random() * 80) + 30,
        misses_per_second: Math.floor(Math.random() * 20) + 5,
        active_rules: 12,
      }));
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="w-5 h-5 animate-pulse text-green-500" />
          Dashboard em Tempo Real
          <Badge variant="default" className="ml-auto">AO VIVO</Badge>
        </CardTitle>
        <CardDescription>
          Monitoramento de cache com atualizações via WebSocket
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <Activity className="w-6 h-6 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{liveStats.requests_per_second}</div>
            <div className="text-xs text-muted-foreground">Requests/s</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{liveStats.hits_per_second}</div>
            <div className="text-xs text-muted-foreground">Hits/s</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{liveStats.misses_per_second}</div>
            <div className="text-xs text-muted-foreground">Misses/s</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{liveStats.active_rules}</div>
            <div className="text-xs text-muted-foreground">Regras Ativas</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
