import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { VODStatusIndicator, getVODStorageStatus, VODStorageStatus } from './VODStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, RefreshCw, MoreVertical, Upload, Zap, 
  ExternalLink, Film, Filter, HardDrive, Cloud 
} from 'lucide-react';

interface VODChannel {
  id: string;
  name: string;
  stream_url: string;
  r2_uploaded: boolean | null;
  r2_url: string | null;
  cf_stream_uid: string | null;
  cf_stream_status: string | null;
  cf_stream_url: string | null;
  updated_at: string | null;
}

type FilterType = 'all' | 'none' | 'r2_only' | 'r2_cf' | 'cf_only' | 'syncing';

export function VODStorageList() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<VODChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const fetchVODChannels = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('m3u_channels')
        .select('id, name, stream_url, r2_uploaded, r2_url, cf_stream_uid, cf_stream_status, cf_stream_url, updated_at')
        .eq('is_vod', true)
        .order('name');

      if (error) throw error;
      setChannels(data || []);
    } catch (err: any) {
      toast({ title: 'Erro ao carregar VODs', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVODChannels();
  }, []);

  const triggerR2Upload = async (channelId: string) => {
    setIsSyncing(channelId);
    try {
      const { data, error } = await supabase.functions.invoke('download-vod', {
        body: { channelId }
      });

      if (error) throw error;
      toast({ title: 'Upload iniciado', description: 'VOD está sendo enviado para o R2' });
      
      // Refresh após alguns segundos
      setTimeout(fetchVODChannels, 3000);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setIsSyncing(null);
    }
  };

  const triggerCFSync = async (channel: VODChannel) => {
    if (!channel.r2_url) {
      toast({ title: 'Erro', description: 'VOD precisa estar no R2 primeiro', variant: 'destructive' });
      return;
    }

    setIsSyncing(channel.id);
    try {
      const { data, error } = await supabase.functions.invoke('r2-to-cfstream-trigger', {
        body: { 
          channel_id: channel.id, 
          r2_url: channel.r2_url,
          r2_key: channel.r2_url.split('/').slice(-2).join('/'),
          force: true
        }
      });

      if (error) throw error;
      toast({ title: 'Sync iniciado', description: 'Enviando para CF Stream...' });
      
      setTimeout(fetchVODChannels, 5000);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setIsSyncing(null);
    }
  };

  // Filtrar canais
  const filteredChannels = channels.filter(ch => {
    // Search filter
    if (search && !ch.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }

    // Status filter
    if (filter !== 'all') {
      const status = getVODStorageStatus(ch.r2_uploaded, ch.r2_url, ch.cf_stream_uid, ch.cf_stream_status);
      if (filter !== status) return false;
    }

    return true;
  });

  // Stats
  const stats = {
    total: channels.length,
    r2Only: channels.filter(ch => getVODStorageStatus(ch.r2_uploaded, ch.r2_url, ch.cf_stream_uid, ch.cf_stream_status) === 'r2_only').length,
    r2Cf: channels.filter(ch => getVODStorageStatus(ch.r2_uploaded, ch.r2_url, ch.cf_stream_uid, ch.cf_stream_status) === 'r2_cf').length,
    none: channels.filter(ch => getVODStorageStatus(ch.r2_uploaded, ch.r2_url, ch.cf_stream_uid, ch.cf_stream_status) === 'none').length,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Film className="h-5 w-5" />
              VODs com Status de Storage
            </CardTitle>
            <CardDescription>
              Gerencie o armazenamento de conteúdo VOD no R2 e CF Stream
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchVODChannels} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 bg-muted/50 rounded text-center">
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total VODs</p>
          </div>
          <div className="p-2 bg-orange-500/10 rounded text-center">
            <p className="text-lg font-bold text-orange-500">{stats.r2Only}</p>
            <p className="text-xs text-muted-foreground">Apenas R2</p>
          </div>
          <div className="p-2 bg-green-500/10 rounded text-center">
            <p className="text-lg font-bold text-green-500">{stats.r2Cf}</p>
            <p className="text-xs text-muted-foreground">R2 + CF</p>
          </div>
          <div className="p-2 bg-muted rounded text-center">
            <p className="text-lg font-bold text-muted-foreground">{stats.none}</p>
            <p className="text-xs text-muted-foreground">Não hospedados</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar VOD..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter('all')}>
                Todos ({stats.total})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('none')}>
                Não hospedados ({stats.none})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('r2_only')}>
                Apenas R2 ({stats.r2Only})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('r2_cf')}>
                R2 + CF ({stats.r2Cf})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Table */}
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum VOD encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChannels.map(channel => (
                  <TableRow key={channel.id}>
                    <TableCell>
                      <div className="max-w-[300px]">
                        <p className="font-medium truncate">{channel.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {channel.stream_url}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <VODStatusIndicator
                        r2Uploaded={channel.r2_uploaded}
                        r2Url={channel.r2_url}
                        cfStreamUid={channel.cf_stream_uid}
                        cfStatus={channel.cf_stream_status}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled={isSyncing === channel.id}
                          >
                            {isSyncing === channel.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!channel.r2_uploaded && (
                            <DropdownMenuItem onClick={() => triggerR2Upload(channel.id)}>
                              <HardDrive className="h-4 w-4 mr-2" />
                              Upload para R2
                            </DropdownMenuItem>
                          )}
                          {channel.r2_uploaded && !channel.cf_stream_uid && (
                            <DropdownMenuItem onClick={() => triggerCFSync(channel)}>
                              <Zap className="h-4 w-4 mr-2" />
                              Sync para CF Stream
                            </DropdownMenuItem>
                          )}
                          {channel.r2_url && (
                            <DropdownMenuItem onClick={() => window.open(channel.r2_url!, '_blank')}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Abrir R2 URL
                            </DropdownMenuItem>
                          )}
                          {channel.cf_stream_url && (
                            <DropdownMenuItem onClick={() => window.open(channel.cf_stream_url!, '_blank')}>
                              <Cloud className="h-4 w-4 mr-2" />
                              Abrir CF Stream
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
