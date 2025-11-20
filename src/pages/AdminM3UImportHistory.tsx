import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Calendar, Clock, FileText, TrendingUp, Filter, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ImportSession {
  id: string;
  custom_list_id: string;
  status: string;
  source_type: string;
  source_url?: string;
  total_channels: number;
  processed_channels: number;
  conflicts_detected: number;
  conflict_resolution_mode?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  list_name?: string;
}

interface ImportChange {
  id: string;
  session_id: string;
  change_type: string;
  entity_type: string;
  entity_name: string;
  created_at: string;
}

export default function AdminM3UImportHistory() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [changes, setChanges] = useState<ImportChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSessions();
  }, [statusFilter]);

  useEffect(() => {
    if (selectedSession) {
      loadChanges(selectedSession);
    }
  }, [selectedSession]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('m3u_import_sessions')
        .select(`
          *,
          m3u_custom_lists!inner(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      setSessions(data.map(s => ({
        ...s,
        list_name: s.m3u_custom_lists?.name
      })));
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChanges = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('m3u_import_changes')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChanges(data || []);
    } catch (error) {
      console.error('Error loading changes:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Concluído</Badge>;
      case 'failed':
        return <Badge variant="destructive">Falhou</Badge>;
      case 'processing':
        return <Badge variant="outline">Processando</Badge>;
      case 'paused':
        return <Badge variant="secondary">Pausado</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added': return '➕';
      case 'removed': return '➖';
      case 'modified': return '✏️';
      default: return '•';
    }
  };

  const filteredSessions = sessions.filter(session =>
    searchQuery === '' ||
    session.list_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.source_url?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: sessions.length,
    completed: sessions.filter(s => s.status === 'completed').length,
    failed: sessions.filter(s => s.status === 'failed').length,
    totalChannels: sessions.reduce((acc, s) => acc + (s.total_channels || 0), 0),
    totalConflicts: sessions.reduce((acc, s) => acc + (s.conflicts_detected || 0), 0)
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/m3u-management')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Histórico de Importações M3U</h1>
          <p className="text-muted-foreground">
            Timeline completa de todas as importações realizadas
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Importações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Falhadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Canais Importados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChannels}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Conflitos Resolvidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.totalConflicts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por lista ou URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="completed">Concluído</SelectItem>
            <SelectItem value="processing">Processando</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions List */}
        <Card>
          <CardHeader>
            <CardTitle>Sessões de Importação</CardTitle>
            <CardDescription>
              {filteredSessions.length} importação(ões) encontrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                ) : filteredSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma importação encontrada
                  </p>
                ) : (
                  filteredSessions.map((session) => (
                    <Card
                      key={session.id}
                      className={`cursor-pointer transition-all ${
                        selectedSession === session.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedSession(session.id)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium">{session.list_name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {session.source_type === 'url' ? '🔗 URL' : '📋 Colado'}
                                {session.source_url && ` • ${session.source_url.substring(0, 40)}...`}
                              </p>
                            </div>
                            {getStatusBadge(session.status)}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {session.total_channels || 0} canais
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(session.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                            </div>
                          </div>

                          {session.conflicts_detected > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {session.conflicts_detected} conflito(s) • {session.conflict_resolution_mode || 'manual'}
                            </Badge>
                          )}

                          {session.error_message && (
                            <p className="text-xs text-destructive">
                              ⚠️ {session.error_message}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Changes Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Importação</CardTitle>
            <CardDescription>
              {selectedSession ? `${changes.length} mudança(s) detectada(s)` : 'Selecione uma sessão'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedSession ? (
              <div className="flex items-center justify-center h-[600px] text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma sessão para ver os detalhes</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {changes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma mudança registrada
                    </p>
                  ) : (
                    changes.map((change) => (
                      <Card key={change.id} className="p-3">
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{getChangeIcon(change.change_type)}</span>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{change.entity_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {change.entity_type === 'category' ? 'Categoria' : 'Canal'} •{' '}
                              {change.change_type === 'added' ? 'Adicionado' :
                               change.change_type === 'removed' ? 'Removido' : 'Modificado'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(change.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
