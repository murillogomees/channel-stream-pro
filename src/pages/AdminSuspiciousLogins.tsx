import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, AlertTriangle, Shield, Clock } from 'lucide-react';
import { suspiciousLoginService } from '@/services/suspiciousLoginService';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminSuspiciousLogins() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);
  const [blockedAttempts, setBlockedAttempts] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    
    // Real-time updates via Supabase
    const channel = supabase
      .channel('suspicious-logins-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'suspicious_login_attempts'
        },
        () => {
          console.log('[SuspiciousLogins] Mudança detectada, recarregando');
          loadData();
        }
      )
      .subscribe();
    
    // Atualização periódica a cada 30 segundos
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recent, blocked] = await Promise.all([
        suspiciousLoginService.getRecentAttempts(100),
        suspiciousLoginService.getBlockedAttempts(50)
      ]);

      setRecentAttempts(recent);
      setBlockedAttempts(blocked);
    } catch (error) {
      console.error('Erro ao carregar tentativas suspeitas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const suspiciousCount = recentAttempts.filter(a => a.attempt_count >= 3).length;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/dashboard')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Dashboard
        </Button>
        <h1 className="text-3xl font-bold">Tentativas de Login Suspeitas</h1>
        <p className="text-muted-foreground mt-2">
          Monitoramento de atividades suspeitas e bloqueios automáticos
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tentativas Totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{recentAttempts.length}</span>
              <Clock className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suspeitas (3+ tentativas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{suspiciousCount}</span>
              <AlertTriangle className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bloqueados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{blockedAttempts.length}</span>
              <Shield className="h-8 w-8 text-destructive opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recent">Tentativas Recentes</TabsTrigger>
          <TabsTrigger value="blocked">Bloqueados</TabsTrigger>
        </TabsList>

        <TabsContent value="recent">
          <Card>
            <CardHeader>
              <CardTitle>Tentativas Recentes (Últimas 100)</CardTitle>
              <CardDescription>
                Registro de tentativas de login com falha
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentAttempts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma tentativa registrada
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Email Tentado</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Primeira Tentativa</TableHead>
                      <TableHead>Última Tentativa</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentAttempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-mono">{attempt.ip_address}</TableCell>
                        <TableCell>{attempt.attempted_email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={attempt.attempt_count >= 5 ? 'destructive' : attempt.attempt_count >= 3 ? 'default' : 'secondary'}>
                            {attempt.attempt_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(attempt.first_attempt_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(attempt.last_attempt_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {attempt.blocked ? (
                            <Badge variant="destructive">Bloqueado</Badge>
                          ) : attempt.attempt_count >= 3 ? (
                            <Badge variant="default">Suspeito</Badge>
                          ) : (
                            <Badge variant="outline">Normal</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked">
          <Card>
            <CardHeader>
              <CardTitle>IPs Bloqueados</CardTitle>
              <CardDescription>
                Endereços IP bloqueados automaticamente por atividade suspeita
              </CardDescription>
            </CardHeader>
            <CardContent>
              {blockedAttempts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum IP bloqueado no momento
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Email Tentado</TableHead>
                      <TableHead>Total de Tentativas</TableHead>
                      <TableHead>Bloqueado Em</TableHead>
                      <TableHead>Alerta Enviado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blockedAttempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell className="font-mono">{attempt.ip_address}</TableCell>
                        <TableCell>{attempt.attempted_email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{attempt.attempt_count}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(attempt.last_attempt_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {attempt.alert_sent ? (
                            <Badge variant="default">Sim</Badge>
                          ) : (
                            <Badge variant="secondary">Não</Badge>
                          )}
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
