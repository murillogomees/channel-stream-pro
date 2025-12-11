/**
 * IPTV Integration Status Component
 * Shows status of IPTV system and quick links
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Tv, CheckCircle2, XCircle, AlertCircle, 
  Play, List, Settings, ExternalLink, Loader2,
  Radio, Film, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function IPTVIntegrationStatus() {
  // Get IPTV stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['iptv-integration-stats'],
    queryFn: async () => {
      const [total, healthy, unhealthy, live, vod, playlists] = await Promise.all([
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_healthy', true),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_healthy', false),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('content_type', 'live'),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('content_type', 'vod'),
        supabase.from('iptv_playlists').select('id', { count: 'exact', head: true }),
      ]);

      return {
        total: total.count || 0,
        healthy: healthy.count || 0,
        unhealthy: unhealthy.count || 0,
        live: live.count || 0,
        vod: vod.count || 0,
        playlists: playlists.count || 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Get recent probe jobs
  const { data: recentProbes } = useQuery({
    queryKey: ['iptv-recent-probes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_probe_jobs')
        .select('id, status, created_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) return [];
      return data;
    },
  });

  const healthPercentage = stats?.total 
    ? Math.round((stats.healthy / stats.total) * 100) 
    : 0;

  const isHealthy = healthPercentage >= 80;
  const isWarning = healthPercentage >= 50 && healthPercentage < 80;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Alert className={
        isHealthy 
          ? "bg-green-500/10 border-green-500/30" 
          : isWarning 
            ? "bg-yellow-500/10 border-yellow-500/30"
            : "bg-red-500/10 border-red-500/30"
      }>
        {isHealthy ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : isWarning ? (
          <AlertCircle className="h-5 w-5 text-yellow-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        <AlertDescription className={
          isHealthy ? "text-green-700" : isWarning ? "text-yellow-700" : "text-red-700"
        }>
          <strong>Sistema IPTV: {healthPercentage}% Saudável</strong>
          <br />
          {stats?.total?.toLocaleString()} canais cadastrados, {stats?.healthy?.toLocaleString()} funcionando.
        </AlertDescription>
      </Alert>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Tv className="h-6 w-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{stats?.total?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Canais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold text-green-600">{stats?.healthy?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Saudáveis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <p className="text-2xl font-bold text-red-600">{stats?.unhealthy?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Com Falha</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Radio className="h-6 w-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold text-blue-600">{stats?.live?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Ao Vivo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Film className="h-6 w-6 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold text-purple-600">{stats?.vod?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">VOD</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <List className="h-6 w-6 mx-auto mb-2 text-orange-500" />
            <p className="text-2xl font-bold text-orange-600">{stats?.playlists?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Playlists</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Gerenciamento IPTV
          </CardTitle>
          <CardDescription>
            Acesse as ferramentas de gerenciamento de canais e playlists
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Link to="/admin/iptv/channels">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Tv className="h-4 w-4" />
                Gerenciar Canais
                <ExternalLink className="h-3 w-3 ml-auto" />
              </Button>
            </Link>
            <Link to="/admin/iptv/playlists">
              <Button variant="outline" className="w-full justify-start gap-2">
                <List className="h-4 w-4" />
                Gerenciar Playlists
                <ExternalLink className="h-3 w-3 ml-auto" />
              </Button>
            </Link>
          </div>

          <Separator />

          {/* Recent Probe Jobs */}
          {recentProbes && recentProbes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Jobs de Verificação Recentes
              </h4>
              <div className="space-y-2">
                {recentProbes.map((job) => (
                  <div key={job.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                    <span className="text-muted-foreground">
                      {new Date(job.created_at).toLocaleString('pt-BR')}
                    </span>
                    <Badge variant={
                      job.status === 'completed' ? 'default' :
                      job.status === 'pending' ? 'secondary' :
                      job.status === 'running' ? 'outline' : 'destructive'
                    }>
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Endpoints Info */}
          <div>
            <h4 className="text-sm font-medium mb-2">Endpoints da API</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <code className="text-xs">/functions/v1/iptv-play?channelId=X</code>
                <Badge variant="outline">GET</Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted rounded">
                <code className="text-xs">/functions/v1/iptv-playlist?type=m3u</code>
                <Badge variant="outline">GET</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
