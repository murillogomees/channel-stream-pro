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

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 flex-wrap">
              <Shield className="h-5 w-5 sm:h-8 sm:w-8 flex-shrink-0" />
              <span className="truncate">Monitor de Segurança</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
              Acompanhe eventos de segurança em tempo real
            </p>
          </div>
        </div>
        <Button onClick={refetch} className="w-full sm:w-auto flex-shrink-0">
          Atualizar
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
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
      </div>

      {/* Events List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle>Eventos de Segurança</CardTitle>
              <CardDescription>
                Monitoramento em tempo real de atividades de segurança
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[180px]">
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
                <SelectTrigger className="w-full sm:w-[140px]">
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
          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando eventos...</p>
            ) : filteredEvents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum evento encontrado</p>
            ) : (
              filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} onResolve={resolveEvent} />
              ))
            )}
          </div>
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
            {event.created_at && format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onResolve(event.id)}
        className="ml-4"
      >
        <CheckCircle2 className="h-4 w-4 mr-1" />
        Resolver
      </Button>
    </div>
  );
}
