/**
 * IPTV Cache Tab - CDN cache and Redis cache management
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { iptvTranscodeService } from '@/services/iptvTranscodeService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Database, RefreshCw, Loader2, Trash2, Search, 
  HardDrive, Zap, Clock, AlertTriangle, Flame, Server, MemoryStick
} from 'lucide-react';
import { IPTVStatCard, IPTVStatsGrid } from '@/components/admin/iptv/IPTVStatsCards';
import { useCacheStats } from '@/hooks/useIPTVRealtimeStats';

interface CacheEntry {
  id: number;
  cache_key: string;
  channel_id: number | null;
  cdn_provider: string;
  manifest_url: string | null;
  is_warm: boolean;
  last_access_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function IPTVCacheTab() {
  const queryClient = useQueryClient();
  const { data: realtimeStats, isLoading: statsLoading } = useCacheStats();
  const [search, setSearch] = useState('');
  const [isWarmupOpen, setIsWarmupOpen] = useState(false);
  const [warmupTTL, setWarmupTTL] = useState(3600);
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);

  // Fetch cache entries from database
  const { data: cacheEntries = [], isLoading, refetch } = useQuery({
    queryKey: ['iptv-cache', search],
    queryFn: async () => {
      let query = supabase
        .from('iptv_cdn_cache')
        .select('*')
        .order('last_access_at', { ascending: false, nullsFirst: false })
        .limit(100);
      
      if (search) {
        query = query.or(`cache_key.ilike.%${search}%,cdn_provider.ilike.%${search}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as CacheEntry[];
    },
  });

  // Fetch channels for warmup
  const { data: channels = [] } = useQuery({
    queryKey: ['iptv-channels-warmup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_channels')
        .select('id, name, is_healthy')
        .eq('is_healthy', true)
        .order('name')
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async (ids?: number[]) => {
      if (ids && ids.length > 0) {
        const { error } = await supabase.from('iptv_cdn_cache').delete().in('id', ids);
        if (error) throw error;
      } else {
        await iptvTranscodeService.flushCache();
      }
    },
    onSuccess: () => {
      toast.success('Cache limpo');
      queryClient.invalidateQueries({ queryKey: ['iptv-cache'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-cache-stats'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Warm cache mutation
  const warmCacheMutation = useMutation({
    mutationFn: async () => {
      if (selectedChannels.length === 0) {
        throw new Error('Selecione ao menos um canal');
      }
      return iptvTranscodeService.warmupCache(selectedChannels, warmupTTL);
    },
    onSuccess: (data) => {
      toast.success(`Cache aquecido para ${data.warmed.length} canais`);
      queryClient.invalidateQueries({ queryKey: ['iptv-cache'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-cache-stats'] });
      setIsWarmupOpen(false);
      setSelectedChannels([]);
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Warm single entry
  const warmSingleMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('iptv_cdn_cache')
        .update({ is_warm: true, last_access_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cache aquecido');
      queryClient.invalidateQueries({ queryKey: ['iptv-cache'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-4">
      {/* Stats - Realtime */}
      <IPTVStatsGrid columns={4}>
        <IPTVStatCard label="Total Entradas" value={realtimeStats?.total || 0} icon={Database} loading={statsLoading} />
        <IPTVStatCard label="Cache Quente" value={realtimeStats?.warm || 0} icon={Zap} color="green" loading={statsLoading} />
        <IPTVStatCard label="Cache Frio" value={realtimeStats?.cold || 0} icon={HardDrive} color="blue" loading={statsLoading} />
        <IPTVStatCard label="Expirados" value={realtimeStats?.expired || 0} icon={Clock} color="red" loading={statsLoading} />
      </IPTVStatsGrid>

      {/* Info Card */}
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            Sistema de Cache Redis
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            O cache Redis armazena manifests HLS, metadados de canais e URLs de stream para reduzir latência.
            Quando Redis não está configurado, o sistema utiliza cache em memória + banco de dados como fallback.
          </p>
          <div className="flex gap-4 text-xs flex-wrap">
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-green-500" /> Quente = Acessado recentemente</span>
            <span className="flex items-center gap-1"><HardDrive className="h-3 w-3 text-blue-500" /> Frio = Em storage</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-red-500" /> Expirado = Precisa refresh</span>
            <span className="flex items-center gap-1"><MemoryStick className="h-3 w-3 text-purple-500" /> Memória = Cache rápido</span>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cache key ou provider..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Dialog open={isWarmupOpen} onOpenChange={setIsWarmupOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Flame className="h-4 w-4 mr-1" />
                    Warmup
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Aquecer Cache</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>TTL (segundos): {warmupTTL}</Label>
                      <Slider
                        value={[warmupTTL]}
                        onValueChange={([v]) => setWarmupTTL(v)}
                        min={300}
                        max={86400}
                        step={300}
                      />
                      <p className="text-xs text-muted-foreground">
                        {Math.floor(warmupTTL / 3600)}h {Math.floor((warmupTTL % 3600) / 60)}m
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Canais ({selectedChannels.length} selecionados)</Label>
                      <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                        {channels.map((ch) => (
                          <label key={ch.id} className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={selectedChannels.includes(ch.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChannels([...selectedChannels, ch.id]);
                                } else {
                                  setSelectedChannels(selectedChannels.filter(id => id !== ch.id));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm truncate">{ch.name}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedChannels(channels.map(c => c.id))}>
                          Selecionar todos
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedChannels([])}>
                          Limpar
                        </Button>
                      </div>
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={() => warmCacheMutation.mutate()}
                      disabled={warmCacheMutation.isPending || selectedChannels.length === 0}
                    >
                      {warmCacheMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Flame className="h-4 w-4 mr-1" />}
                      Aquecer {selectedChannels.length} Canais
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  if (confirm('Limpar todo o cache? Esta ação não pode ser desfeita.')) {
                    clearCacheMutation.mutate(undefined);
                  }
                }}
                disabled={clearCacheMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Limpar Cache
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cache Key</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : cacheEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma entrada de cache encontrada
                  </TableCell>
                </TableRow>
              ) : (
                cacheEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <span className="font-mono text-xs truncate max-w-[200px] block">
                        {entry.cache_key}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.cdn_provider || 'default'}</Badge>
                    </TableCell>
                    <TableCell>
                      {isExpired(entry.expires_at) ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Expirado
                        </Badge>
                      ) : entry.is_warm ? (
                        <Badge className="bg-green-500">
                          <Zap className="h-3 w-3 mr-1" />
                          Quente
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <HardDrive className="h-3 w-3 mr-1" />
                          Frio
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.last_access_at 
                        ? formatDistanceToNow(new Date(entry.last_access_at), { addSuffix: true, locale: ptBR })
                        : 'Nunca'
                      }
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.expires_at 
                        ? format(new Date(entry.expires_at), 'dd/MM HH:mm', { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!entry.is_warm && (
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => warmSingleMutation.mutate(entry.id)} title="Aquecer cache">
                            <Zap className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => clearCacheMutation.mutate([entry.id])} title="Remover">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
