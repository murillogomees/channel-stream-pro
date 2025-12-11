import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminShell } from '@/components/admin/AdminShell';
import { ResponsivePageHeader } from '@/components/admin/ResponsivePageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, Search, RefreshCw, Calendar } from 'lucide-react';

interface EPGProgram {
  id: string;
  channel_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  category: string | null;
  icon_url: string | null;
}

export default function AdminEPGPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    channel_id: '',
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    category: '',
  });

  // Fetch EPG programs
  const { data: programs = [], isLoading } = useQuery({
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

  // Add program mutation
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
      setIsAddDialogOpen(false);
      setFormData({ channel_id: '', title: '', description: '', start_time: '', end_time: '', category: '' });
      toast.success('Programa adicionado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao adicionar programa: ' + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('epg_programs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epg-programs'] });
      toast.success('Programa removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.channel_id || !formData.title || !formData.start_time || !formData.end_time) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    addMutation.mutate(formData);
  };

  // Stats
  const now = new Date();
  const activePrograms = programs.filter(p => 
    new Date(p.start_time) <= now && new Date(p.end_time) > now
  ).length;
  const upcomingPrograms = programs.filter(p => new Date(p.start_time) > now).length;
  const uniqueChannels = new Set(programs.map(p => p.channel_id)).size;

  return (
    <AdminShell backTo="/admin/iptv/channels">
      <ResponsivePageHeader
        title="EPG - Guia de Programação"
        description="Gerencie a programação dos canais"
      />
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{programs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ao Vivo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{activePrograms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Seguir</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{upcomingPrograms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Canais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueChannels}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou canal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['epg-programs'] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
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
                    <Label htmlFor="channel_id">ID do Canal *</Label>
                    <Input
                      id="channel_id"
                      value={formData.channel_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, channel_id: e.target.value }))}
                      placeholder="Ex: globo.br"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="Ex: Jornalismo"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Nome do programa"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição do programa"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_time">Início *</Label>
                    <Input
                      id="start_time"
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_time">Fim *</Label>
                    <Input
                      id="end_time"
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
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
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
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
                          {isLive && (
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          )}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(program.id)}
                        >
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
    </AdminShell>
  );
}
