import { useState } from "react";
import { Shield, AlertTriangle, Activity, Lock, Eye, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSecurityEvents } from "@/hooks/useSecurityEvents";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AdminSecurityMonitor() {
  const navigate = useNavigate();
  const { events, loading, stats, refetch, resolveEvent } = useSecurityEvents(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const filteredEvents = events.filter(event => {
    if (filterType !== "all" && event.event_type !== filterType) return false;
    if (filterSeverity !== "all" && event.severity !== filterSeverity) return false;
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'default';
      case 'info': return 'secondary';
      default: return 'secondary';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'failed_login': return 'Login Falhou';
      case 'permission_change': return 'Mudança de Permissão';
      case 'suspicious_activity': return 'Atividade Suspeita';
      case 'rate_limit_exceeded': return 'Limite Excedido';
      case 'unauthorized_access': return 'Acesso Não Autorizado';
      default: return type;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'failed_login': return <Lock className="h-4 w-4" />;
      case 'permission_change': return <Shield className="h-4 w-4" />;
      case 'suspicious_activity': return <AlertTriangle className="h-4 w-4" />;
      case 'rate_limit_exceeded': return <Activity className="h-4 w-4" />;
      case 'unauthorized_access': return <Eye className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Monitor de Segurança
          </h1>
          <p className="text-muted-foreground">
            Acompanhe eventos de segurança em tempo real
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={refetch}>
          Atualizar
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.criticalEvents}</div>
            <p className="text-xs text-muted-foreground">Requer atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Login Falhou</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failedLogins}</div>
            <p className="text-xs text-muted-foreground">Tentativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permissões</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.permissionChanges}</div>
            <p className="text-xs text-muted-foreground">Alterações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspeitas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.suspiciousActivities}</div>
            <p className="text-xs text-muted-foreground">Atividades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Não Resolvidos</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unresolvedEvents}</div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Events List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Eventos de Segurança</CardTitle>
              <CardDescription>
                Monitoramento em tempo real de atividades de segurança
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="failed_login">Login Falhou</SelectItem>
                  <SelectItem value="permission_change">Mudança de Permissão</SelectItem>
                  <SelectItem value="suspicious_activity">Atividade Suspeita</SelectItem>
                  <SelectItem value="rate_limit_exceeded">Limite Excedido</SelectItem>
                  <SelectItem value="unauthorized_access">Acesso Não Autorizado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Severidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                  <SelectItem value="warning">Aviso</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="unresolved">
            <TabsList>
              <TabsTrigger value="unresolved">
                Não Resolvidos ({filteredEvents.filter(e => !e.resolved).length})
              </TabsTrigger>
              <TabsTrigger value="all">
                Todos ({filteredEvents.length})
              </TabsTrigger>
              <TabsTrigger value="resolved">
                Resolvidos ({filteredEvents.filter(e => e.resolved).length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="unresolved" className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Carregando eventos...</p>
              ) : filteredEvents.filter(e => !e.resolved).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum evento não resolvido</p>
              ) : (
                filteredEvents.filter(e => !e.resolved).map((event) => (
                  <EventCard key={event.id} event={event} onResolve={resolveEvent} />
                ))
              )}
            </TabsContent>

            <TabsContent value="all" className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Carregando eventos...</p>
              ) : filteredEvents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum evento encontrado</p>
              ) : (
                filteredEvents.map((event) => (
                  <EventCard key={event.id} event={event} onResolve={resolveEvent} />
                ))
              )}
            </TabsContent>

            <TabsContent value="resolved" className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Carregando eventos...</p>
              ) : filteredEvents.filter(e => e.resolved).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum evento resolvido</p>
              ) : (
                filteredEvents.filter(e => e.resolved).map((event) => (
                  <EventCard key={event.id} event={event} onResolve={resolveEvent} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function EventCard({ 
  event, 
  onResolve 
}: { 
  event: any; 
  onResolve: (id: string) => void;
}) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'default';
      case 'info': return 'secondary';
      default: return 'secondary';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'failed_login': return 'Login Falhou';
      case 'permission_change': return 'Mudança de Permissão';
      case 'suspicious_activity': return 'Atividade Suspeita';
      case 'rate_limit_exceeded': return 'Limite Excedido';
      case 'unauthorized_access': return 'Acesso Não Autorizado';
      default: return type;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'failed_login': return <Lock className="h-4 w-4" />;
      case 'permission_change': return <Shield className="h-4 w-4" />;
      case 'suspicious_activity': return <AlertTriangle className="h-4 w-4" />;
      case 'rate_limit_exceeded': return <Activity className="h-4 w-4" />;
      case 'unauthorized_access': return <Eye className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex items-start justify-between p-4 border rounded-lg bg-card">
      <div className="flex gap-3 flex-1">
        <div className="mt-1">
          {getEventIcon(event.event_type)}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={event.severity} />
            <Badge variant="outline">
              {getEventTypeLabel(event.event_type)}
            </Badge>
            {event.resolved && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Resolvido
              </Badge>
            )}
          </div>
          <p className="text-sm">
            {event.event_type === 'failed_login' && event.event_details?.email ? (
              <>
                Email tentado: <span className="font-mono text-primary">{event.event_details.email}</span>
                {event.event_details.passwordAttempted && (
                  <Badge variant="destructive" className="ml-2 text-[10px]">
                    Com senha
                  </Badge>
                )}
              </>
            ) : (
              event.event_details?.description || event.event_details?.email || 'Evento de segurança'
            )}
          </p>
          {event.ip_address && (
            <p className="text-xs text-muted-foreground">
              IP: {event.ip_address}
            </p>
          )}
          {event.event_details && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground">
                Ver detalhes
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                {JSON.stringify(event.event_details, null, 2)}
              </pre>
            </details>
          )}
          <p className="text-xs text-muted-foreground">
            {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
      {!event.resolved && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onResolve(event.id)}
          className="ml-4"
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Resolver
        </Button>
      )}
    </div>
  );
}
