/**
 * AdminActivityLogs - Histórico de atividades e logs do sistema
 * Exibe todas as ações realizadas pelos usuários e administradores
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, Activity, User, Calendar, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  created_at: string;
  ip_address?: string | null;
  user_name?: string;
  user_email?: string;
}

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');

  useEffect(() => {
    loadActivityLogs();
  }, []);

  const loadActivityLogs = async () => {
    setLoading(true);
    try {
      // Buscar logs de atividades
      const { data: logsData, error: logsError } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (logsError) throw logsError;

      // Buscar informações dos usuários
      const userIds = [...new Set(logsData?.map(log => log.user_id).filter(Boolean) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Enriquecer logs com informações dos usuários
      const enrichedLogs: ActivityLog[] = logsData?.map(log => ({
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        details: log.details,
        created_at: log.created_at || new Date().toISOString(),
        ip_address: log.ip_address,
        user_name: log.user_id ? profilesMap.get(log.user_id)?.nome || 'Desconhecido' : 'Sistema',
        user_email: log.user_id ? profilesMap.get(log.user_id)?.email || '' : 'sistema@auto',
      })) || [];

      setLogs(enrichedLogs);
    } catch (error) {
      console.error('Erro ao carregar logs de atividades:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeVariant = (actionType: string): any => {
    const variants: Record<string, string> = {
      'create': 'default',
      'update': 'secondary',
      'delete': 'destructive',
      'login': 'outline',
      'logout': 'outline',
      'notification': 'default',
    };
    return variants[actionType] || 'secondary';
  };

  const getActionIcon = (actionType: string) => {
    // Retorna emoji ou ícone baseado no tipo de ação
    const icons: Record<string, string> = {
      'create': '➕',
      'update': '✏️',
      'delete': '🗑️',
      'login': '🔐',
      'logout': '🚪',
      'notification': '📧',
      'role_change': '👤',
      'payment': '💳',
    };
    return icons[actionType] || '📝';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter;

    return matchesSearch && matchesAction && matchesEntity;
  });

  // Estatísticas
  const stats = {
    total: logs.length,
    today: logs.filter(l => 
      new Date(l.created_at).toDateString() === new Date().toDateString()
    ).length,
    uniqueUsers: new Set(logs.map(l => l.user_id).filter(Boolean)).size,
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Atividades</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hoje</p>
                <p className="text-2xl font-bold">{stats.today}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuários Ativos</p>
                <p className="text-2xl font-bold">{stats.uniqueUsers}</p>
              </div>
              <User className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Histórico de Atividades
          </CardTitle>
          <CardDescription>
            Registro completo de todas as ações realizadas no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atividades..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Atualização</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="notification">Notificação</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Entidades</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="profile">Perfil</SelectItem>
                <SelectItem value="role">Role</SelectItem>
                <SelectItem value="notification">Notificação</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadActivityLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Entidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma atividade encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-center text-lg">
                        {getActionIcon(log.action)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{log.user_name}</p>
                          <p className="text-xs text-muted-foreground">{log.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm truncate">{log.action}</p>
                      </TableCell>
                      <TableCell>
                        {log.entity_type && (
                          <Badge variant="outline" className="text-xs">
                            {log.entity_type}
                          </Badge>
                        )}
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
