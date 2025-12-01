/**
 * AdminUserStreaming - Streaming mais vistos por usuário
 * Analytics de consumo de conteúdo por usuário
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, RefreshCw, Play, Eye, Clock, TrendingUp } from 'lucide-react';

interface UserStreamingData {
  user_id: string;
  user_name: string;
  user_email: string;
  total_views: number;
  total_watch_time: number;
  top_channel: string;
  last_watched: string;
}

export default function AdminUserStreaming() {
  const [streamingData, setStreamingData] = useState<UserStreamingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadStreamingData();
  }, []);

  const loadStreamingData = async () => {
    setLoading(true);
    try {
      // Buscar dados de uso de streaming por usuário
      const { data: usageStats, error } = await supabase
        .from('channel_usage_stats')
        .select(`
          profile_id,
          channel_id,
          view_count,
          total_watch_time_seconds,
          last_watched_at,
          user_profiles!inner (
            id,
            name
          )
        `)
        .order('view_count', { ascending: false });

      if (error) throw error;

      // Agregar dados por usuário
      const userDataMap = new Map<string, UserStreamingData>();

      usageStats?.forEach((stat: any) => {
        const userId = stat.profile_id;
        
        if (!userDataMap.has(userId)) {
          userDataMap.set(userId, {
            user_id: userId,
            user_name: stat.user_profiles?.name || 'Desconhecido',
            user_email: '', // Será preenchido depois
            total_views: 0,
            total_watch_time: 0,
            top_channel: '',
            last_watched: stat.last_watched_at || '',
          });
        }

        const userData = userDataMap.get(userId)!;
        userData.total_views += stat.view_count || 0;
        userData.total_watch_time += stat.total_watch_time_seconds || 0;
        
        if (!userData.top_channel) {
          userData.top_channel = stat.channel_id || 'N/A';
        }

        if (new Date(stat.last_watched_at) > new Date(userData.last_watched)) {
          userData.last_watched = stat.last_watched_at;
        }
      });

      // Buscar emails dos usuários
      const userIds = Array.from(userDataMap.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      profiles?.forEach(profile => {
        const userData = userDataMap.get(profile.id);
        if (userData) {
          userData.user_email = profile.email;
        }
      });

      setStreamingData(Array.from(userDataMap.values()));
    } catch (error) {
      console.error('Erro ao carregar dados de streaming:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = streamingData.filter(data =>
    data.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    data.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    totalUsers: streamingData.length,
    totalViews: streamingData.reduce((sum, d) => sum + d.total_views, 0),
    totalWatchTime: streamingData.reduce((sum, d) => sum + d.total_watch_time, 0),
    avgViewsPerUser: streamingData.length > 0 
      ? streamingData.reduce((sum, d) => sum + d.total_views, 0) / streamingData.length 
      : 0,
  };

  const formatWatchTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuários Ativos</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
              </div>
              <Eye className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Views</p>
                <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
              </div>
              <Play className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Total</p>
                <p className="text-2xl font-bold">{formatWatchTime(stats.totalWatchTime)}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média por Usuário</p>
                <p className="text-2xl font-bold">{Math.round(stats.avgViewsPerUser)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Streaming */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Consumo de Streaming por Usuário
          </CardTitle>
          <CardDescription>
            Analytics de visualização e tempo assistido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={loadStreamingData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Total de Views</TableHead>
                  <TableHead>Tempo Assistido</TableHead>
                  <TableHead>Canal Favorito</TableHead>
                  <TableHead>Última Visualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum dado de streaming encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((data) => (
                    <TableRow key={data.user_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{data.user_name}</p>
                          <p className="text-xs text-muted-foreground">{data.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {data.total_views}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatWatchTime(data.total_watch_time)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {data.top_channel}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {data.last_watched 
                          ? new Date(data.last_watched).toLocaleDateString('pt-BR')
                          : 'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
