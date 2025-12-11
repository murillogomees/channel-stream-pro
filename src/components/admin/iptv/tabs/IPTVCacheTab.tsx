/**
 * IPTV Cache Tab - CDN cache and Redis-like cache management
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Database, RefreshCw, Loader2, Trash2, Search, 
  HardDrive, Zap, Clock, CheckCircle, AlertTriangle
} from 'lucide-react';

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
  const [search, setSearch] = useState('');

  // Fetch cache entries
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

  // Stats
  const stats = {
    total: cacheEntries.length,
    warm: cacheEntries.filter(c => c.is_warm).length,
    cold: cacheEntries.filter(c => !c.is_warm).length,
    expired: cacheEntries.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length,
    providers: new Set(cacheEntries.map(c => c.cdn_provider)).size,
  };

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async (ids?: number[]) => {
      if (ids && ids.length > 0) {
        const { error } = await supabase.from('iptv_cdn_cache').delete().in('id', ids);
        if (error) throw error;
      } else {
        // Clear all cache
        const { error } = await supabase.from('iptv_cdn_cache').delete().neq('id', 0);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Cache limpo');
      queryClient.invalidateQueries({ queryKey: ['iptv-cache'] });
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  // Warm cache mutation
  const warmCacheMutation = useMutation({
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
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Entradas</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
              <Database className="h-6 w-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Cache Quente</p>
                <p className="text-xl font-bold text-green-500">{stats.warm}</p>
              </div>
              <Zap className="h-6 w-6 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Cache Frio</p>
                <p className="text-xl font-bold text-blue-500">{stats.cold}</p>
              </div>
              <HardDrive className="h-6 w-6 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Expirados</p>
                <p className="text-xl font-bold text-red-500">{stats.expired}</p>
              </div>
              <Clock className="h-6 w-6 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Providers</p>
                <p className="text-xl font-bold">{stats.providers}</p>
              </div>
              <HardDrive className="h-6 w-6 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/50 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            Sistema de Cache CDN
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            O cache CDN armazena manifests HLS e metadados de canais para reduzir latência e carga no origin.
            Entradas "quentes" são frequentemente acessadas e mantidas em memória para acesso rápido.
          </p>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-green-500" /> Quente = Acessado recentemente</span>
            <span className="flex items-center gap-1"><HardDrive className="h-3 w-3 text-blue-500" /> Frio = Em storage</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-red-500" /> Expirado = Precisa refresh</span>
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
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  if (confirm('Limpar todo o cache? Esta ação não pode ser desfeita.')) {
                    clearCacheMutation.mutate([]);
                  }
                }}
                disabled={clearCacheMutation.isPending}
              >
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
                            onClick={() => warmCacheMutation.mutate(entry.id)} title="Aquecer cache">
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
