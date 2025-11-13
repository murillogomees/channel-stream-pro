import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Radio, CheckCircle2, XCircle, Clock, Activity, Zap, Filter, Save, Trash2, Bookmark, Play, Pause, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getRealtimeService, RealtimeNotificationEvent, RealtimeStats } from "@/services/realtimeNotificationService";
import { RealtimeConnectionStatus } from "@/components/RealtimeConnectionStatus";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const AdminNotificationLive = () => {
  const navigate = useNavigate();
  const realtimeService = getRealtimeService();
  
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [events, setEvents] = useState<RealtimeNotificationEvent[]>([]);
  const [bufferedEvents, setBufferedEvents] = useState<RealtimeNotificationEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<RealtimeStats>({
    totalSent: 0,
    successCount: 0,
    errorCount: 0,
    lastUpdate: new Date().toISOString(),
  });
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  
  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    types: {
      notification_sent: true,
      notification_failed: true,
      batch_started: true,
      batch_completed: true,
    },
    status: {
      success: true,
      error: true,
    },
    templates: {
      vencimento: true,
      boas_vindas: true,
      renovacao: true,
      admin: true,
      outros: true,
    }
  });

  // Presets de filtros
  const [savedPresets, setSavedPresets] = useState<Array<{
    id: string;
    name: string;
    filters: typeof filters;
  }>>([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  const defaultPresets = [
    {
      id: 'all',
      name: 'Todos',
      filters: {
        types: {
          notification_sent: true,
          notification_failed: true,
          batch_started: true,
          batch_completed: true,
        },
        status: { success: true, error: true },
        templates: {
          vencimento: true,
          boas_vindas: true,
          renovacao: true,
          admin: true,
          outros: true,
        }
      }
    },
    {
      id: 'errors_only',
      name: 'Apenas Erros',
      filters: {
        types: {
          notification_sent: false,
          notification_failed: true,
          batch_started: false,
          batch_completed: false,
        },
        status: { success: false, error: true },
        templates: {
          vencimento: true,
          boas_vindas: true,
          renovacao: true,
          admin: true,
          outros: true,
        }
      }
    },
    {
      id: 'success_only',
      name: 'Apenas Sucessos',
      filters: {
        types: {
          notification_sent: true,
          notification_failed: false,
          batch_started: false,
          batch_completed: false,
        },
        status: { success: true, error: false },
        templates: {
          vencimento: true,
          boas_vindas: true,
          renovacao: true,
          admin: true,
          outros: true,
        }
      }
    },
    {
      id: 'vencimentos',
      name: 'Vencimentos',
      filters: {
        types: {
          notification_sent: true,
          notification_failed: true,
          batch_started: false,
          batch_completed: false,
        },
        status: { success: true, error: true },
        templates: {
          vencimento: true,
          boas_vindas: false,
          renovacao: false,
          admin: false,
          outros: false,
        }
      }
    },
    {
      id: 'boas_vindas',
      name: 'Boas-vindas',
      filters: {
        types: {
          notification_sent: true,
          notification_failed: true,
          batch_started: false,
          batch_completed: false,
        },
        status: { success: true, error: true },
        templates: {
          vencimento: false,
          boas_vindas: true,
          renovacao: false,
          admin: false,
          outros: false,
        }
      }
    },
    {
      id: 'renovacoes',
      name: 'Renovações',
      filters: {
        types: {
          notification_sent: true,
          notification_failed: true,
          batch_started: false,
          batch_completed: false,
        },
        status: { success: true, error: true },
        templates: {
          vencimento: false,
          boas_vindas: false,
          renovacao: true,
          admin: false,
          outros: false,
        }
      }
    },
    {
      id: 'batch_only',
      name: 'Apenas Lotes',
      filters: {
        types: {
          notification_sent: false,
          notification_failed: false,
          batch_started: true,
          batch_completed: true,
        },
        status: { success: true, error: true },
        templates: {
          vencimento: true,
          boas_vindas: true,
          renovacao: true,
          admin: true,
          outros: true,
        }
      }
    },
  ];
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const listenerIdRef = useRef(`live-dashboard-${Date.now()}`);

  useEffect(() => {
    // Conectar ao canal Realtime
    realtimeService.connect();
    setConnectionStatus(realtimeService.getConnectionStatus());

    // Registrar listener para eventos
    const listenerId = listenerIdRef.current;
    realtimeService.subscribe(listenerId, handleRealtimeEvent);

    // Carregar presets salvos
    loadSavedPresets();

    // Atualizar status da conexão periodicamente
    const statusInterval = setInterval(() => {
      setConnectionStatus(realtimeService.getConnectionStatus());
    }, 2000);

    return () => {
      clearInterval(statusInterval);
      realtimeService.unsubscribe(listenerId);
    };
  }, []);

  // Auto-scroll para o final quando novos eventos chegam (somente se não estiver pausado)
  useEffect(() => {
    if (scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, isPaused]);

  const handleRealtimeEvent = (event: RealtimeNotificationEvent) => {
    console.log('[Dashboard] Evento recebido:', event);
    
    // Se estiver pausado, adicionar ao buffer
    if (isPaused) {
      setBufferedEvents((prev) => [event, ...prev]);
      console.log('[Dashboard] Evento adicionado ao buffer (pausado)');
      return;
    }

    // Se não estiver pausado, adicionar normalmente
    setEvents((prev) => {
      const newEvents = [event, ...prev];
      // Manter apenas os últimos 100 eventos
      return newEvents.slice(0, 100);
    });

    // Atualizar estatísticas
    setStats((prev) => {
      const newStats = { ...prev, lastUpdate: event.timestamp };
      
      if (event.type === 'notification_sent') {
        newStats.totalSent++;
        newStats.successCount++;
      } else if (event.type === 'notification_failed') {
        newStats.totalSent++;
        newStats.errorCount++;
      } else if (event.type === 'batch_started') {
        setIsBatchRunning(true);
      } else if (event.type === 'batch_completed') {
        setIsBatchRunning(false);
        if (event.data.successCount) newStats.successCount += event.data.successCount;
        if (event.data.errorCount) newStats.errorCount += event.data.errorCount;
      }
      
      return newStats;
    });
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
    
    // Se está despausando e há eventos no buffer, adicionar aos eventos visíveis
    if (isPaused && bufferedEvents.length > 0) {
      setEvents((prev) => {
        const combined = [...bufferedEvents, ...prev];
        return combined.slice(0, 100);
      });
      
      // Processar estatísticas dos eventos do buffer
      bufferedEvents.forEach(event => {
        setStats((prev) => {
          const newStats = { ...prev, lastUpdate: event.timestamp };
          
          if (event.type === 'notification_sent') {
            newStats.totalSent++;
            newStats.successCount++;
          } else if (event.type === 'notification_failed') {
            newStats.totalSent++;
            newStats.errorCount++;
          } else if (event.type === 'batch_completed') {
            if (event.data.successCount) newStats.successCount += event.data.successCount;
            if (event.data.errorCount) newStats.errorCount += event.data.errorCount;
          }
          
          return newStats;
        });
      });
      
      setBufferedEvents([]);
    }
  };

  const resumeAndProcess = () => {
    if (bufferedEvents.length > 0) {
      setEvents((prev) => {
        const combined = [...bufferedEvents, ...prev];
        return combined.slice(0, 100);
      });
      
      // Processar estatísticas
      bufferedEvents.forEach(event => {
        setStats((prev) => {
          const newStats = { ...prev, lastUpdate: event.timestamp };
          
          if (event.type === 'notification_sent') {
            newStats.totalSent++;
            newStats.successCount++;
          } else if (event.type === 'notification_failed') {
            newStats.totalSent++;
            newStats.errorCount++;
          } else if (event.type === 'batch_completed') {
            if (event.data.successCount) newStats.successCount += event.data.successCount;
            if (event.data.errorCount) newStats.errorCount += event.data.errorCount;
          }
          
          return newStats;
        });
      });
      
      setBufferedEvents([]);
    }
    setIsPaused(false);
  };

  const clearBuffer = () => {
    setBufferedEvents([]);
  };

  const clearEvents = () => {
    setEvents([]);
    setStats({
      totalSent: 0,
      successCount: 0,
      errorCount: 0,
      lastUpdate: new Date().toISOString(),
    });
  };

  const toggleFilter = (category: 'types' | 'status' | 'templates', key: string) => {
    setFilters(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key as keyof typeof prev[typeof category]]
      }
    }));
  };

  const resetFilters = () => {
    setFilters({
      types: {
        notification_sent: true,
        notification_failed: true,
        batch_started: true,
        batch_completed: true,
      },
      status: {
        success: true,
        error: true,
      },
      templates: {
        vencimento: true,
        boas_vindas: true,
        renovacao: true,
        admin: true,
        outros: true,
      }
    });
  };

  const loadSavedPresets = () => {
    try {
      const stored = localStorage.getItem('notification_live_presets');
      if (stored) {
        setSavedPresets(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Erro ao carregar presets:', error);
    }
  };

  const savePreset = () => {
    if (!presetName.trim()) {
      return;
    }

    const newPreset = {
      id: `custom_${Date.now()}`,
      name: presetName.trim(),
      filters: { ...filters },
    };

    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    localStorage.setItem('notification_live_presets', JSON.stringify(updated));
    
    setPresetName('');
    setShowSavePreset(false);
  };

  const deletePreset = (id: string) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem('notification_live_presets', JSON.stringify(updated));
  };

  const applyPreset = (preset: typeof defaultPresets[0]) => {
    setFilters(preset.filters);
  };

  const getTemplateCategory = (templateName: string): keyof typeof filters.templates => {
    const lower = templateName.toLowerCase();
    if (lower.includes('venc') || lower.includes('expira')) return 'vencimento';
    if (lower.includes('boas-vindas') || lower.includes('bem-vindo') || lower.includes('welcome')) return 'boas_vindas';
    if (lower.includes('renova') || lower.includes('pagamento')) return 'renovacao';
    if (lower.includes('admin') || lower.includes('prospecto')) return 'admin';
    return 'outros';
  };

  const filteredEvents = events.filter(event => {
    // Filtro por tipo de evento
    if (!filters.types[event.type as keyof typeof filters.types]) {
      return false;
    }

    // Filtro por status
    if (event.data.status) {
      if (!filters.status[event.data.status as keyof typeof filters.status]) {
        return false;
      }
    }

    // Filtro por template
    if (event.data.template) {
      const category = getTemplateCategory(event.data.template);
      if (!filters.templates[category]) {
        return false;
      }
    }

    return true;
  });

  const getEventIcon = (type: RealtimeNotificationEvent['type']) => {
    switch (type) {
      case 'notification_sent':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'notification_failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'batch_started':
        return <Zap className="h-5 w-5 text-blue-600" />;
      case 'batch_completed':
        return <CheckCircle2 className="h-5 w-5 text-purple-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getEventTitle = (event: RealtimeNotificationEvent) => {
    switch (event.type) {
      case 'notification_sent':
        return `Enviado para ${event.data.clienteNome}`;
      case 'notification_failed':
        return `Falha ao enviar para ${event.data.clienteNome}`;
      case 'batch_started':
        return `Lote iniciado (${event.data.batchSize} notificações)`;
      case 'batch_completed':
        return `Lote concluído (${event.data.successCount} sucesso, ${event.data.errorCount} erros)`;
      default:
        return 'Evento desconhecido';
    }
  };

  const successRate = stats.totalSent > 0 
    ? ((stats.successCount / stats.totalSent) * 100).toFixed(1) 
    : '0.0';

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Dashboard em Tempo Real</h1>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-3 w-3 rounded-full animate-pulse",
                  connectionStatus === 'connected' && "bg-green-500",
                  connectionStatus === 'connecting' && "bg-yellow-500",
                  connectionStatus === 'disconnected' && "bg-red-500"
                )} />
                <Badge variant={connectionStatus === 'connected' ? 'default' : 'secondary'}>
                  {connectionStatus === 'connected' && 'Conectado'}
                  {connectionStatus === 'connecting' && 'Conectando...'}
                  {connectionStatus === 'disconnected' && 'Desconectado'}
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground">
              Monitoramento ao vivo de notificações WhatsApp
            </p>
          </div>
          <div className="flex gap-2">
            {/* Controles de Pause/Play */}
            <div className="flex items-center gap-2">
              <Button
                variant={isPaused ? "default" : "outline"}
                onClick={togglePause}
                className={cn(
                  "transition-all",
                  isPaused && "bg-yellow-600 hover:bg-yellow-700"
                )}
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Retomar
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </>
                )}
              </Button>

              {isPaused && bufferedEvents.length > 0 && (
                <>
                  <Badge variant="secondary" className="animate-pulse">
                    {bufferedEvents.length} em buffer
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resumeAndProcess}
                    title="Processar eventos do buffer e retomar"
                  >
                    <FastForward className="h-4 w-4 mr-2" />
                    Processar ({bufferedEvents.length})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearBuffer}
                    title="Descartar eventos do buffer"
                  >
                    Descartar
                  </Button>
                </>
              )}
            </div>

            <Separator orientation="vertical" className="h-10" />

            <Button 
              variant={showFilters ? "default" : "outline"} 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            {events.length > 0 && (
              <Button variant="outline" onClick={clearEvents}>
                Limpar Eventos
              </Button>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <RealtimeConnectionStatus />

        {/* Painel de Filtros */}
        {showFilters && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
                <div className="flex gap-2">
                  <Dialog open={showSavePreset} onOpenChange={setShowSavePreset}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Preset
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Salvar Preset de Filtro</DialogTitle>
                        <DialogDescription>
                          Salve a configuração atual de filtros para uso rápido
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="preset-name">Nome do Preset</Label>
                          <Input
                            id="preset-name"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            placeholder="Ex: Erros Críticos"
                            onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                          />
                        </div>
                        <Button onClick={savePreset} className="w-full" disabled={!presetName.trim()}>
                          <Save className="h-4 w-4 mr-2" />
                          Salvar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Resetar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Presets Rápidos */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  Presets Rápidos
                </h3>
                <div className="flex flex-wrap gap-2">
                  {defaultPresets.map((preset) => (
                    <Button
                      key={preset.id}
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(preset)}
                      className="text-xs"
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Presets Salvos */}
              {savedPresets.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Meus Presets
                    </h3>
                    <div className="space-y-2">
                      {savedPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between p-2 border rounded-lg"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => applyPreset(preset)}
                            className="flex-1 justify-start"
                          >
                            {preset.name}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePreset(preset.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Filtro por Tipo de Evento */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Tipo de Evento</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-sent" className="flex items-center gap-2 cursor-pointer">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Enviado
                        </Label>
                        <Switch
                          id="filter-sent"
                          checked={filters.types.notification_sent}
                          onCheckedChange={() => toggleFilter('types', 'notification_sent')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-failed" className="flex items-center gap-2 cursor-pointer">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Falha
                        </Label>
                        <Switch
                          id="filter-failed"
                          checked={filters.types.notification_failed}
                          onCheckedChange={() => toggleFilter('types', 'notification_failed')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-batch-start" className="flex items-center gap-2 cursor-pointer">
                          <Zap className="h-4 w-4 text-blue-600" />
                          Lote Iniciado
                        </Label>
                        <Switch
                          id="filter-batch-start"
                          checked={filters.types.batch_started}
                          onCheckedChange={() => toggleFilter('types', 'batch_started')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-batch-end" className="flex items-center gap-2 cursor-pointer">
                          <CheckCircle2 className="h-4 w-4 text-purple-600" />
                          Lote Concluído
                        </Label>
                        <Switch
                          id="filter-batch-end"
                          checked={filters.types.batch_completed}
                          onCheckedChange={() => toggleFilter('types', 'batch_completed')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filtro por Status */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Status</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-success" className="flex items-center gap-2 cursor-pointer">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          Sucesso
                        </Label>
                        <Switch
                          id="filter-success"
                          checked={filters.status.success}
                          onCheckedChange={() => toggleFilter('status', 'success')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-error" className="flex items-center gap-2 cursor-pointer">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Erro
                        </Label>
                        <Switch
                          id="filter-error"
                          checked={filters.status.error}
                          onCheckedChange={() => toggleFilter('status', 'error')}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filtro por Template */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3">Tipo de Notificação</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-vencimento" className="cursor-pointer">
                          Vencimento
                        </Label>
                        <Switch
                          id="filter-vencimento"
                          checked={filters.templates.vencimento}
                          onCheckedChange={() => toggleFilter('templates', 'vencimento')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-boas-vindas" className="cursor-pointer">
                          Boas-vindas
                        </Label>
                        <Switch
                          id="filter-boas-vindas"
                          checked={filters.templates.boas_vindas}
                          onCheckedChange={() => toggleFilter('templates', 'boas_vindas')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-renovacao" className="cursor-pointer">
                          Renovação
                        </Label>
                        <Switch
                          id="filter-renovacao"
                          checked={filters.templates.renovacao}
                          onCheckedChange={() => toggleFilter('templates', 'renovacao')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-admin" className="cursor-pointer">
                          Admin/Prospecto
                        </Label>
                        <Switch
                          id="filter-admin"
                          checked={filters.templates.admin}
                          onCheckedChange={() => toggleFilter('templates', 'admin')}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="filter-outros" className="cursor-pointer">
                          Outros
                        </Label>
                        <Switch
                          id="filter-outros"
                          checked={filters.templates.outros}
                          onCheckedChange={() => toggleFilter('templates', 'outros')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Indicador de Filtros Ativos */}
              <Separator className="my-4" />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Mostrando {filteredEvents.length} de {events.length} eventos
                </span>
                {filteredEvents.length !== events.length && (
                  <Badge variant="secondary">
                    {events.length - filteredEvents.length} ocultos
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cards de Estatísticas em Tempo Real */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className={cn(
            "transition-all duration-300",
            isBatchRunning && "ring-2 ring-primary"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Enviado</p>
                  <p className="text-3xl font-bold">{stats.totalSent}</p>
                </div>
                <Radio className={cn(
                  "h-8 w-8",
                  isBatchRunning ? "text-primary animate-pulse" : "text-muted-foreground"
                )} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Sucesso</p>
                  <p className="text-3xl font-bold text-green-600">{stats.successCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Erros</p>
                  <p className="text-3xl font-bold text-red-600">{stats.errorCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-3xl font-bold">{successRate}%</p>
                </div>
                <Activity className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stream de Eventos em Tempo Real */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Radio className={cn(
                    "h-5 w-5",
                    isPaused ? "text-yellow-600" : "text-red-600 animate-pulse"
                  )} />
                  Stream de Eventos ao Vivo
                  {isPaused && (
                    <Badge variant="secondary" className="ml-2">
                      PAUSADO
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isPaused 
                    ? "Stream pausado - eventos estão sendo armazenados em buffer"
                    : "Acompanhe as notificações sendo enviadas em tempo real"
                  }
                </CardDescription>
              </div>
              {stats.lastUpdate && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Última atualização</p>
                  <p className="text-sm font-medium">
                    {format(new Date(stats.lastUpdate), "HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Aguardando eventos...</p>
                <p className="text-sm text-muted-foreground">
                  Os eventos aparecerão aqui quando notificações forem enviadas
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[500px] pr-4" ref={scrollRef}>
                <div className="space-y-3">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-12">
                      <Filter className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium">Nenhum evento corresponde aos filtros</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Ajuste os filtros para ver mais eventos
                      </p>
                      <Button variant="outline" onClick={resetFilters}>
                        Resetar Filtros
                      </Button>
                    </div>
                  ) : (
                    filteredEvents.map((event, index) => (
                    <div
                      key={`${event.timestamp}-${index}`}
                      className={cn(
                        "p-4 border rounded-lg transition-all duration-300 animate-in slide-in-from-top-2",
                        event.type === 'notification_sent' && "border-green-200 bg-green-50/50",
                        event.type === 'notification_failed' && "border-red-200 bg-red-50/50",
                        event.type === 'batch_started' && "border-blue-200 bg-blue-50/50",
                        event.type === 'batch_completed' && "border-purple-200 bg-purple-50/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium">{getEventTitle(event)}</p>
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(event.timestamp), "HH:mm:ss", { locale: ptBR })}
                            </Badge>
                          </div>
                          
                          {event.data.telefone && (
                            <p className="text-sm text-muted-foreground font-mono">
                              {event.data.telefone}
                            </p>
                          )}
                          
                          {event.data.template && (
                            <p className="text-sm text-muted-foreground">
                              Template: {event.data.template}
                            </p>
                          )}
                          
                          {event.data.error && (
                            <p className="text-sm text-red-600 mt-1">
                              Erro: {event.data.error}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Informação sobre o Sistema */}
        <Card>
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• O dashboard se conecta em tempo real ao sistema de notificações</p>
            <p>• Todos os envios são exibidos instantaneamente conforme acontecem</p>
            <p>• As estatísticas são atualizadas automaticamente a cada evento</p>
            <p>• A conexão é mantida via WebSocket do Supabase Realtime</p>
            <p>• Os eventos são armazenados apenas durante a sessão ativa</p>
            <p>• <strong>Pause o stream</strong> para analisar eventos sem perder novos envios</p>
            <p>• Eventos recebidos durante a pausa ficam em buffer e podem ser processados ou descartados</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminNotificationLive;
