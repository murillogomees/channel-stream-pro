import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, Shield, Activity, Clock, Loader2, TrendingUp } from 'lucide-react';
import { authLoggingService } from '@/services/authLoggingService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminAuthStatus() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [recentLogins, setRecentLogins] = useState<any[]>([]);
  const [accessDenied, setAccessDenied] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin/dashboard');
      return;
    }
    loadData();
  }, [isAdmin, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessions, logins, denied, stats] = await Promise.all([
        authLoggingService.getActiveSessions(),
        authLoggingService.getRecentLogins(30),
        authLoggingService.getAccessDeniedAttempts(30),
        authLoggingService.getStatistics(7)
      ]);

      setActiveSessions(sessions);
      setRecentLogins(logins);
      setAccessDenied(denied);
      setStatistics(stats);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration: string) => {
    const match = duration.match(/(\d+):(\d+):(\d+)/);
    if (!match) return duration;
    
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalLogins = statistics.reduce((sum, s) => sum + Number(s.total_logins || 0), 0);
  const totalDenied = statistics.reduce((sum, s) => sum + Number(s.access_denied || 0), 0);
  const uniqueUsers = new Set(recentLogins.map(l => l.user_id)).size;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/dashboard')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Status de Autenticação</h1>
        <p className="text-muted-foreground mt-2">
          Monitoramento de sessões, logins e tentativas de acesso
        </p>
      </div>

      {/* Estatísticas Resumidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sessões Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{activeSessions.length}</span>
              <Users className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Logins (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{totalLogins}</span>
              <Activity className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Acessos Negados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{totalDenied}</span>
              <Shield className="h-8 w-8 text-destructive opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Usuários Únicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{uniqueUsers}</span>
              <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Logins por Dia</CardTitle>
            <CardDescription>Últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statistics.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'dd/MM', { locale: ptBR })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })}
                />
                <Legend />
                <Bar dataKey="total_logins" name="Logins" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acessos Negados</CardTitle>
            <CardDescription>Últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={statistics.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'dd/MM', { locale: ptBR })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="access_denied" 
                  name="Acessos Negados" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com Detalhes */}
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sessions">Sessões Ativas</TabsTrigger>
          <TabsTrigger value="logins">Histórico de Logins</TabsTrigger>
          <TabsTrigger value="denied">Acessos Negados</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Sessões Ativas (Últimas 24h)</CardTitle>
              <CardDescription>
                Usuários com sessão ativa no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeSessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma sessão ativa no momento
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Último Login</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSessions.map((session) => (
                      <TableRow key={session.user_id}>
                        <TableCell className="font-medium">
                          {session.user_email.split('@')[0]}
                        </TableCell>
                        <TableCell>{session.user_email}</TableCell>
                        <TableCell>
                          {format(new Date(session.last_login), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            <Clock className="mr-1 h-3 w-3" />
                            {formatDuration(session.session_duration)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {session.ip_address || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logins">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Logins</CardTitle>
              <CardDescription>Últimos 30 eventos de login/logout</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogins.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant={log.event_type === 'login' ? 'default' : 'secondary'}>
                          {log.event_type === 'login' ? 'Login' : 'Logout'}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.user_email}</TableCell>
                      <TableCell>
                        {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.ip_address || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="denied">
          <Card>
            <CardHeader>
              <CardTitle>Tentativas de Acesso Negado</CardTitle>
              <CardDescription>Últimas 30 tentativas bloqueadas</CardDescription>
            </CardHeader>
            <CardContent>
              {accessDenied.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma tentativa de acesso negado registrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Caminho</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessDenied.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.user_email}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {log.metadata?.reason || 'Sem permissão'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.metadata?.path || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {log.ip_address || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
