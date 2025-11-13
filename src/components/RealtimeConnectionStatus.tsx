import { useEffect, useState } from 'react';
import { getRealtimeService } from '@/services/realtimeNotificationService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const RealtimeConnectionStatus = () => {
  const [health, setHealth] = useState({
    status: 'disconnected' as 'connected' | 'disconnected' | 'connecting',
    fallbackMode: false,
    retryCount: 0,
    errorCount: 0,
    lastConnection: null as number | null,
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const realtimeService = getRealtimeService();
    
    const updateHealth = () => {
      const currentHealth = realtimeService.getConnectionHealth();
      setHealth(currentHealth);
    };

    // Update immediately
    updateHealth();

    // Update every 5 seconds
    const interval = setInterval(updateHealth, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleForceReconnect = () => {
    const realtimeService = getRealtimeService();
    realtimeService.forceReconnect();
    setHealth(realtimeService.getConnectionHealth());
  };

  const getStatusColor = () => {
    if (health.status === 'connected' && !health.fallbackMode) return 'text-green-500';
    if (health.status === 'connecting') return 'text-yellow-500';
    if (health.fallbackMode) return 'text-orange-500';
    return 'text-red-500';
  };

  const getStatusIcon = () => {
    if (health.status === 'connected' && !health.fallbackMode) {
      return <Wifi className={cn("h-5 w-5", getStatusColor())} />;
    }
    if (health.status === 'connecting') {
      return <RefreshCw className={cn("h-5 w-5 animate-spin", getStatusColor())} />;
    }
    if (health.fallbackMode) {
      return <AlertTriangle className={cn("h-5 w-5", getStatusColor())} />;
    }
    return <WifiOff className={cn("h-5 w-5", getStatusColor())} />;
  };

  const getStatusText = () => {
    if (health.status === 'connected' && !health.fallbackMode) return 'Conectado';
    if (health.status === 'connecting') return 'Conectando...';
    if (health.fallbackMode) return 'Modo Fallback';
    return 'Desconectado';
  };

  const getStatusDescription = () => {
    if (health.status === 'connected' && !health.fallbackMode) {
      return 'Conexão WebSocket ativa - atualizações em tempo real';
    }
    if (health.status === 'connecting') {
      return `Tentando estabelecer conexão (tentativa ${health.retryCount + 1})`;
    }
    if (health.fallbackMode) {
      return 'WebSocket indisponível. Reconexão automática em andamento.';
    }
    return 'Sem conexão WebSocket. As atualizações podem não aparecer em tempo real.';
  };

  // Only show alert if there's an issue
  if (health.status === 'connected' && !health.fallbackMode && !showDetails) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {getStatusIcon()}
        <span>{getStatusText()}</span>
      </div>
    );
  }

  return (
    <Alert 
      variant={health.fallbackMode || health.status === 'disconnected' ? 'destructive' : 'default'}
      className="mb-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          {getStatusIcon()}
          <div className="flex-1">
            <AlertTitle className="mb-1">{getStatusText()}</AlertTitle>
            <AlertDescription className="text-sm">
              {getStatusDescription()}
            </AlertDescription>
            
            {showDetails && (
              <div className="mt-2 text-xs space-y-1 text-muted-foreground">
                <div>Tentativas de reconexão: {health.retryCount}</div>
                <div>Erros de conexão: {health.errorCount}</div>
                {health.lastConnection && (
                  <div>
                    Última conexão bem-sucedida: {new Date(health.lastConnection).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Ocultar' : 'Detalhes'}
          </Button>
          
          {(health.status === 'disconnected' || health.fallbackMode) && (
            <Button
              size="sm"
              variant="default"
              onClick={handleForceReconnect}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Reconectar
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
};
