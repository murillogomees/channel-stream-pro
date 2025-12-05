import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Shield, User, Calendar, Clock, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminRoleAudit() {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const { data: logs, error: logsError } = await supabase
        .from('role_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (logsError) throw logsError;

      const userIds = [...new Set(logs?.map(log => log.user_id) || [])];
      const changedByIds = [...new Set(logs?.map(log => log.changed_by) || [])];
      const allUserIds = [...new Set([...userIds, ...changedByIds])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, nome')
        .in('id', allUserIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedLogs = logs?.map(log => ({
        ...log,
        user_email: profilesMap.get(log.user_id)?.email || 'Desconhecido',
        user_name: profilesMap.get(log.user_id)?.nome || 'Desconhecido',
        changed_by_email: profilesMap.get(log.changed_by)?.email || 'Sistema',
        changed_by_name: profilesMap.get(log.changed_by)?.nome || 'Sistema'
      })) || [];

      setAuditLogs(enrichedLogs);
    } catch (error) {
      console.error('Erro ao carregar logs de auditoria:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.changed_by_email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || log.role === roleFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesRole && matchesAction;
  });

  const last24hCount = auditLogs.filter(l => 
    new Date(l.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  const uniqueUsersCount = new Set(auditLogs.map(l => l.user_id)).size;

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'INSERT':
        return <Badge className="bg-stat-success/20 text-stat-success border-stat-success/30">Adicionado</Badge>;
      case 'UPDATE':
        return <Badge className="bg-stat-warning/20 text-stat-warning border-stat-warning/30">Atualizado</Badge>;
      case 'DELETE':
        return <Badge className="bg-stat-danger/20 text-stat-danger border-stat-danger/30">Removido</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'master':
        return <Badge className="bg-stat-purple/20 text-stat-purple border-stat-purple/30">Master</Badge>;
      case 'admin':
        return <Badge className="bg-stat-primary/20 text-stat-primary border-stat-primary/30">Admin</Badge>;
      case 'client':
        return <Badge className="bg-stat-info/20 text-stat-info border-stat-info/30">Cliente</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Carregando histórico...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="stat">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Alterações</p>
                <p className="text-3xl font-bold text-foreground mt-1">{auditLogs.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-stat-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-stat-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="stat-info">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usuários Afetados</p>
                <p className="text-3xl font-bold text-foreground mt-1">{uniqueUsersCount}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-stat-info/10 flex items-center justify-center">
                <User className="h-6 w-6 text-stat-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="stat-success">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Últimas 24h</p>
                <p className="text-3xl font-bold text-foreground mt-1">{last24hCount}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-stat-success/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-stat-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card variant="surface">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              Filtros
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadAuditLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Filtrar por role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Roles</SelectItem>
                <SelectItem value="master">Master</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Filtrar por ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="INSERT">Adição</SelectItem>
                <SelectItem value="UPDATE">Atualização</SelectItem>
                <SelectItem value="DELETE">Remoção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-stat-primary" />
            Histórico de Alterações
          </CardTitle>
          <CardDescription>
            {filteredLogs.length} registro(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhum registro encontrado com os filtros selecionados
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Data/Hora</TableHead>
                    <TableHead className="font-semibold">Ação</TableHead>
                    <TableHead className="font-semibold">Usuário Afetado</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Alterado Por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {getActionBadge(log.action)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{log.user_name}</p>
                          <p className="text-xs text-muted-foreground">{log.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(log.role)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{log.changed_by_name}</p>
                          <p className="text-xs text-muted-foreground">{log.changed_by_email}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
