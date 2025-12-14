/**
 * IPTV EPG Tab - Electronic Program Guide management
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, Search, RefreshCw, Calendar, Tv, Clock, Loader2 } from 'lucide-react';
import { IPTVStatCard, IPTVStatsGrid } from '@/components/admin/iptv/IPTVStatsCards';
import { useEPGStats } from '@/hooks/useIPTVRealtimeStats';

interface EPGProgram {
  id: string;
  channel_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  category: string | null;
}

export function IPTVEPGTab() {
  const queryClient = useQueryClient();
  const { data: realtimeStats, isLoading: statsLoading } = useEPGStats();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    channel_id: '',
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    category: '',
  });

  const { data: programs = [], isLoading, refetch } = useQuery({
    queryKey: ['epg-programs', search],
    queryFn: async () => {
      let query = supabase
        .from('epg_programs')
        .select('*')
        .order('start_time', { ascending: true })
        .limit(100);
      if (search) {
        query = query.or(`title.ilike.%${search}%,channel_id.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as EPGProgram[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('epg_programs').insert({
        channel_id: data.channel_id,
        title: data.title,
        description: data.description || null,
        start_time: data.start_time,
        end_time: data.end_time,
        category: data.category || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epg-programs'] });
      setIsAddOpen(false);
      setFormData({ channel_id: '', title: '', description: '', start_time: '', end_time: '', category: '' });
      toast.success('Programa adicionado');
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('epg_programs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epg-programs'] });
      toast.success('Programa removido');
    },
    onError: (error) => toast.error(`Erro: ${error.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.channel_id || !formData.title || !formData.start_time || !formData.end_time) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    addMutation.mutate(formData);
  };

  const now = new Date();

  return (
    <div className="space-y-4">
      {/* Stats - Realtime */}
      <IPTVStatsGrid columns={4}>
        <IPTVStatCard label="Total" value={realtimeStats?.total || 0} icon={Calendar} loading={statsLoading} />
        <IPTVStatCard label="Ao Vivo" value={realtimeStats?.active || 0} icon={Tv} color="green" loading={statsLoading} />
        <IPTVStatCard label="A Seguir" value={realtimeStats?.upcoming || 0} icon={Clock} color="blue" loading={statsLoading} />
        <IPTVStatCard label="Canais" value={realtimeStats?.channels || 0} icon={Tv} loading={statsLoading} />
      </IPTVStatsGrid>

      {/* Actions */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Programa</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>ID do Canal *</Label>
                        <Input
                          value={formData.channel_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, channel_id: e.target.value }))}
                          placeholder="Ex: globo.br"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Input
                          value={formData.category}
                          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                          placeholder="Ex: Jornalismo"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Título *</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Nome do programa"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Início *</Label>
                        <Input
                          type="datetime-local"
                          value={formData.start_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fim *</Label>
                        <Input
                          type="datetime-local"
                          value={formData.end_time}
                          onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={addMutation.isPending}>
                        {addMutation.isPending ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : programs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum programa encontrado
                  </TableCell>
                </TableRow>
              ) : (
                programs.map((program) => {
                  const isLive = new Date(program.start_time) <= now && new Date(program.end_time) > now;
                  return (
                    <TableRow key={program.id}>
                      <TableCell className="font-mono text-xs">{program.channel_id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isLive && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                          {program.title}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{program.category || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(program.start_time), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(program.end_time), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => deleteMutation.mutate(program.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
