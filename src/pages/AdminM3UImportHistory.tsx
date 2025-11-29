import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useM3UImport } from '@/hooks/useM3UImport';
import { Calendar, Clock, FileText, Filter, Search, Play, Pause, XCircle, RefreshCw, Trash2 } from 'lucide-react';
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
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [changes, setChanges] = useState<ImportChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  const {
    session: activeSession,
    progress: importProgress,
    isImporting,
    loadExistingSession,
    pauseImport,
    resumeImport,
    cancelImport,
    resetImport,
  } = useM3UImport();

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

  const handleResumeSession = async (session: ImportSession) => {
    try {
      setImportDialogOpen(true);
      await loadExistingSession(session.id);
    } catch (error) {
      console.error('Error resuming session:', error);
    }
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    resetImport();
    loadSessions(); // Refresh list
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir esta sessão de importação?')) return;
    
    try {
      // Delete related changes first
      await supabase
        .from('m3u_import_changes')
        .delete()
        .eq('session_id', sessionId);
      
      // Delete queue entry
      await supabase
        .from('m3u_import_queue')
        .delete()
        .eq('session_id', sessionId);
      
      // Delete the session
      const { error } = await supabase
        .from('m3u_import_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
      
      // Clear selection if deleted
      if (selectedSession === sessionId) {
        setSelectedSession(null);
        setChanges([]);
      }
      
      loadSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const handleCancelSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja cancelar esta importação?')) return;
    
    try {
      const { error } = await supabase
        .from('m3u_import_sessions')
        .update({ 
          status: 'failed', 
          error_message: 'Cancelado pelo usuário',
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      if (error) throw error;
      loadSessions();
    } catch (error) {
      console.error('Error cancelling session:', error);
    }
  };

  // Update list when active session changes
  useEffect(() => {
    if (activeSession?.status === 'completed' || activeSession?.status === 'failed') {
      loadSessions();
    }
  }, [activeSession?.status]);

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg sm:text-xl font-semibold">Histórico de Importações</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Timeline de importações M3U</p>
        </div>
      </div>

      {/* Stats Grid - 2x2 no mobile, 5 colunas no desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">OK</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-green-500">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">Falhas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-red-500">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">Canais</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold">{stats.totalChannels}</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs font-medium">Conflitos</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-yellow-500">{stats.totalConflicts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros responsivos */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px] h-9">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="completed">OK</SelectItem>
            <SelectItem value="processing">Processando</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid responsivo - stack no mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sessions List */}
        <Card>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base">Sessões</CardTitle>
            <CardDescription className="text-xs">{filteredSessions.length} importação(ões)</CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            <ScrollArea className="h-[400px] sm:h-[500px] pr-2">
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
                ) : filteredSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma importação</p>
                ) : (
                  filteredSessions.map((session) => (
                    <Card
                      key={session.id}
                      className={`cursor-pointer transition-all ${selectedSession === session.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setSelectedSession(session.id)}
                    >
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate">{session.list_name}</h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {session.source_type === 'url' ? '🔗' : '📋'} {session.source_url ? session.source_url.substring(0, 30) + '...' : 'Colado'}
                              </p>
                            </div>
                            {getStatusBadge(session.status)}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {session.processed_channels || 0}/{session.total_channels || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(session.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </span>
                          </div>

                          {(session.status === 'processing' || session.status === 'paused') && session.total_channels > 0 && (
                            <Progress value={(session.processed_channels / session.total_channels) * 100} className="h-1.5" />
                          )}

                          {session.error_message && (
                            <p className="text-xs text-destructive truncate">⚠️ {session.error_message}</p>
                          )}

                          <div className="flex gap-1 pt-1">
                            {(session.status === 'paused' || session.status === 'processing') && session.source_type === 'url' && (
                              <Button size="sm" variant="default" className="flex-1 h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleResumeSession(session); }}>
                                <RefreshCw className="h-3 w-3 mr-1" />Retomar
                              </Button>
                            )}
                            {(session.status === 'processing' || session.status === 'paused') && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => handleCancelSession(session.id, e)}>
                                <XCircle className="h-3 w-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={(e) => handleDeleteSession(session.id, e)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
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
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="text-sm sm:text-base">Detalhes</CardTitle>
            <CardDescription className="text-xs">
              {selectedSession ? `${changes.length} mudança(s)` : 'Selecione uma sessão'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-0">
            {!selectedSession ? (
              <div className="flex items-center justify-center h-[400px] sm:h-[500px] text-muted-foreground">
                <div className="text-center">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Selecione uma sessão</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[400px] sm:h-[500px] pr-2">
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

      {/* Import Progress Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importação M3U</DialogTitle>
            <DialogDescription>
              {activeSession?.status === 'completed' 
                ? 'Importação concluída com sucesso!' 
                : activeSession?.status === 'failed'
                ? 'Erro na importação'
                : 'Acompanhe o progresso da importação'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              {activeSession?.status === 'completed' && (
                <Badge variant="default">Concluído</Badge>
              )}
              {activeSession?.status === 'failed' && (
                <Badge variant="destructive">Falhou</Badge>
              )}
              {activeSession?.status === 'processing' && (
                <Badge variant="outline">Processando</Badge>
              )}
              {activeSession?.status === 'paused' && (
                <Badge variant="secondary">Pausado</Badge>
              )}
            </div>

            {/* Progress */}
            {activeSession && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>
                    {activeSession.processedChannels || 0} / {activeSession.totalChannels || '?'} canais
                  </span>
                </div>
                <Progress value={importProgress} className="h-3" />
                <p className="text-xs text-muted-foreground text-center">
                  {importProgress.toFixed(1)}% concluído
                </p>
              </div>
            )}

            {/* Error message */}
            {activeSession?.errorMessage && (
              <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-sm text-destructive">{activeSession.errorMessage}</p>
              </div>
            )}

            {/* Control buttons */}
            {isImporting && activeSession?.status === 'processing' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={pauseImport}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pausar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    cancelImport();
                    handleCloseImportDialog();
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            )}

            {activeSession?.status === 'paused' && (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={resumeImport}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Continuar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    cancelImport();
                    handleCloseImportDialog();
                  }}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            )}

            {(activeSession?.status === 'completed' || activeSession?.status === 'failed') && (
              <Button
                variant="default"
                className="w-full"
                onClick={handleCloseImportDialog}
              >
                Fechar
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
