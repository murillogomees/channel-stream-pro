/**
 * Admin IPTV Channels Management
 * CRUD for 209k+ channels with search, filters, and bulk actions
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AdminShell } from '@/components/admin/AdminShell';
import { ResponsivePageHeader } from '@/components/admin/ResponsivePageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Plus, Search, RefreshCw, Trash2, Edit, Play, 
  CheckCircle, XCircle, Loader2, Filter, Download,
  Upload, Tv, Radio, Film, ChevronLeft, ChevronRight
} from 'lucide-react';
import { IPTVChannelForm } from '@/components/admin/iptv/IPTVChannelForm';
import { IPTVChannelImport } from '@/components/admin/iptv/IPTVChannelImport';

interface Channel {
  id: number;
  slug: string;
  name: string;
  original_url: string;
  logo_url: string | null;
  category: string | null;
  content_type: string;
  is_healthy: boolean;
  health_score: number;
  transcode_status: string;
  last_probe_at: string | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 50;

export default function AdminIPTVChannels() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // Fetch channels with pagination
  const { data: channelsData, isLoading, refetch } = useQuery({
    queryKey: ['iptv-channels', page, search, categoryFilter, healthFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('iptv_channels')
        .select('*', { count: 'exact' })
        .order('name', { ascending: true })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,category.ilike.%${search}%`);
      }
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }
      if (healthFilter !== 'all') {
        query = query.eq('is_healthy', healthFilter === 'healthy');
      }
      if (typeFilter !== 'all') {
        query = query.eq('content_type', typeFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { channels: data as Channel[], total: count || 0 };
    },
  });

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['iptv-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_channels')
        .select('category')
        .not('category', 'is', null)
        .order('category');
      if (error) throw error;
      const unique = [...new Set(data.map(c => c.category))].filter(Boolean);
      return unique as string[];
    },
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['iptv-stats'],
    queryFn: async () => {
      const [total, healthy, unhealthy, transcoded] = await Promise.all([
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_healthy', true),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_healthy', false),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('transcode_status', 'ready'),
      ]);
      return {
        total: total.count || 0,
        healthy: healthy.count || 0,
        unhealthy: unhealthy.count || 0,
        transcoded: transcoded.count || 0,
      };
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const { error } = await supabase
        .from('iptv_channels')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Canais excluídos com sucesso');
      setSelectedChannels([]);
      queryClient.invalidateQueries({ queryKey: ['iptv-channels'] });
      queryClient.invalidateQueries({ queryKey: ['iptv-stats'] });
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // Trigger probe mutation
  const probeMutation = useMutation({
    mutationFn: async (channelIds: number[]) => {
      // This would call the external probe API
      const { error } = await supabase
        .from('iptv_probe_jobs')
        .insert(channelIds.map(id => ({ channel_id: id, status: 'pending' })));
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Probe agendado com sucesso');
      setSelectedChannels([]);
    },
    onError: (error) => {
      toast.error(`Erro ao agendar probe: ${error.message}`);
    },
  });

  const channels = channelsData?.channels || [];
  const totalPages = Math.ceil((channelsData?.total || 0) / ITEMS_PER_PAGE);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedChannels(channels.map(c => c.id));
    } else {
      setSelectedChannels([]);
    }
  };

  const handleSelectChannel = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedChannels(prev => [...prev, id]);
    } else {
      setSelectedChannels(prev => prev.filter(i => i !== id));
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'live': return <Tv className="h-4 w-4" />;
      case 'vod': return <Film className="h-4 w-4" />;
      case 'series': return <Radio className="h-4 w-4" />;
      default: return <Tv className="h-4 w-4" />;
    }
  };

  return (
    <AdminShell>
      <div className="space-y-4 md:space-y-6 p-2 md:p-6">
        <ResponsivePageHeader
          title="Canais IPTV"
          description="Gerenciar canais de streaming"
          backTo="/admin"
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Total</p>
                  <p className="text-xl md:text-2xl font-bold">{stats?.total?.toLocaleString() || 0}</p>
                </div>
                <Tv className="h-6 w-6 md:h-8 md:w-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Saudáveis</p>
                  <p className="text-xl md:text-2xl font-bold text-green-500">{stats?.healthy?.toLocaleString() || 0}</p>
                </div>
                <CheckCircle className="h-6 w-6 md:h-8 md:w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Com Falha</p>
                  <p className="text-xl md:text-2xl font-bold text-red-500">{stats?.unhealthy?.toLocaleString() || 0}</p>
                </div>
                <XCircle className="h-6 w-6 md:h-8 md:w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Transcodados</p>
                  <p className="text-xl md:text-2xl font-bold text-blue-500">{stats?.transcoded?.toLocaleString() || 0}</p>
                </div>
                <Play className="h-6 w-6 md:h-8 md:w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, slug ou categoria..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories?.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={healthFilter} onValueChange={(v) => { setHealthFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="healthy">Saudável</SelectItem>
                    <SelectItem value="unhealthy">Com Falha</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="vod">VOD</SelectItem>
                    <SelectItem value="series">Séries</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                
                <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Importar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Importar Canais M3U</DialogTitle>
                    </DialogHeader>
                    <IPTVChannelImport onSuccess={() => {
                      setIsImportOpen(false);
                      refetch();
                    }} />
                  </DialogContent>
                </Dialog>

                <Dialog open={isFormOpen} onOpenChange={(open) => {
                  setIsFormOpen(open);
                  if (!open) setEditingChannel(null);
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingChannel ? 'Editar Canal' : 'Novo Canal'}</DialogTitle>
                    </DialogHeader>
                    <IPTVChannelForm 
                      channel={editingChannel}
                      onSuccess={() => {
                        setIsFormOpen(false);
                        setEditingChannel(null);
                        refetch();
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedChannels.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedChannels.length} selecionado(s)
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => probeMutation.mutate(selectedChannels)}
                  disabled={probeMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Probe
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => deleteMutation.mutate(selectedChannels)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channels Table */}
        <Card>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedChannels.length === channels.length && channels.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Transcode</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : channels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum canal encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  channels.map((channel) => (
                    <TableRow key={channel.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedChannels.includes(channel.id)}
                          onCheckedChange={(checked) => handleSelectChannel(channel.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        {channel.logo_url ? (
                          <img 
                            src={channel.logo_url} 
                            alt="" 
                            className="w-8 h-8 rounded object-cover"
                            onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            {getContentTypeIcon(channel.content_type)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{channel.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{channel.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{channel.category || '-'}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1">
                          {getContentTypeIcon(channel.content_type)}
                          <span className="text-sm capitalize">{channel.content_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={channel.is_healthy ? 'default' : 'destructive'}>
                          {channel.is_healthy ? 'OK' : 'Erro'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={
                          channel.transcode_status === 'ready' ? 'default' :
                          channel.transcode_status === 'processing' ? 'secondary' :
                          'outline'
                        }>
                          {channel.transcode_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingChannel(channel);
                              setIsFormOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(channel.original_url, '_blank')}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Página {page + 1} de {totalPages || 1} ({channelsData?.total?.toLocaleString() || 0} canais)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
