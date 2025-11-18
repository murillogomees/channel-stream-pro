import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getWebSocketMetricsService } from './websocketMetricsService';
import { getSystemHealthService, ServiceHealth } from './systemHealthService';
import { getAdminAlertService } from './adminAlertService';
import { getMetricsPersistenceService } from './metricsPersistenceService';

export interface RealtimeNotificationEvent {
  type: 'notification_sent' | 'notification_failed' | 'batch_started' | 'batch_completed' | 'playlist_inactive_alert';
  timestamp: string;
  data: {
    clienteId?: string;
    clienteNome?: string;
    telefone?: string;
    template?: string;
    status?: 'success' | 'error';
    error?: string;
    batchSize?: number;
    successCount?: number;
    errorCount?: number;
  };
}

export interface RealtimeStats {
  totalSent: number;
  successCount: number;
  errorCount: number;
  lastUpdate: string;
}

interface ConnectionConfig {
  maxRetries: number;
  retryDelayMs: number;
  maxRetryDelayMs: number;
  connectionTimeoutMs: number;
  heartbeatIntervalMs: number;
}

const DEFAULT_CONFIG: ConnectionConfig = {
  maxRetries: 8,
  retryDelayMs: 2000,
  maxRetryDelayMs: 60000,
  connectionTimeoutMs: 30000,
  heartbeatIntervalMs: 45000,
};

class RealtimeNotificationService {
  private channel: RealtimeChannel | null = null;
  private listeners: Map<string, (event: RealtimeNotificationEvent) => void> = new Map();
  private retryCount: number = 0;
  private config: ConnectionConfig = DEFAULT_CONFIG;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private isConnecting: boolean = false;
  private useFallbackMode: boolean = false;
  private fallbackTimer: number | null = null;
  private connectionErrorCount: number = 0;
  private lastSuccessfulConnection: number = 0;
  private metricsService = getWebSocketMetricsService();
  private healthService = getSystemHealthService();
  private alertService = getAdminAlertService();
  private persistenceService = getMetricsPersistenceService();
  private networkStatusListener: (() => void) | null = null;
  private offlineStatusListener: (() => void) | null = null;
  private isOnline: boolean = navigator.onLine;

  connect() {
    if (this.isConnecting) {
      console.log('[Realtime] Conexão já em andamento');
      return this.channel;
    }

    if (this.channel && this.getConnectionStatus() === 'connected') {
      console.log('[Realtime] Já conectado');
      return this.channel;
    }

    this.isConnecting = true;
    
    // Setup network detection for smart reconnection
    this.setupNetworkDetection();
    
    // Start auto-save when connecting
    this.persistenceService.startAutoSave(
      () => this.metricsService.getMetrics(),
      () => this.healthService.getStatus()
    );
    
    this.attemptConnection();
    return this.channel;
  }

  private async attemptConnection() {
    this.metricsService.recordConnectionAttempt();
    
    try {
      console.log(`[Realtime] Tentando conectar (tentativa ${this.retryCount + 1}/${this.config.maxRetries})`);
      
      // Cleanup existing channel
      if (this.channel) {
        await supabase.removeChannel(this.channel);
        this.channel = null;
      }

      const startTime = Date.now();
      
      // Create new channel with timeout
      const connectionPromise = this.createChannel();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeoutMs)
      );

      await Promise.race([connectionPromise, timeoutPromise]);
      
      // Record latency
      const latency = Date.now() - startTime;
      this.metricsService.recordLatency(latency);
      
      // Connection successful
      this.onConnectionSuccess();
      
    } catch (error) {
      console.error('[Realtime] Erro na conexão:', error);
      this.onConnectionError(error);
    }
  }

  private createChannel(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.channel = supabase.channel('notifications_live', {
        config: {
          broadcast: { self: true },
          presence: { key: '' }
        }
      });

      this.channel
        .on('broadcast', { event: 'notification_event' }, (payload) => {
          console.log('[Realtime] Evento recebido:', payload);
          this.notifyListeners(payload.payload as RealtimeNotificationEvent);
        })
        .subscribe((status, error) => {
          console.log('[Realtime] Status da subscrição:', status, error);
          
          if (status === 'SUBSCRIBED') {
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(error || new Error(`Subscription failed: ${status}`));
          } else if (status === 'CLOSED') {
            console.log('[Realtime] Canal fechado, tentando reconectar...');
            this.scheduleReconnect();
          }
        });
    });
  }

  private onConnectionSuccess() {
    console.log('[Realtime] Conexão estabelecida com sucesso');
    this.isConnecting = false;
    this.retryCount = 0;
    this.connectionErrorCount = 0;
    this.lastSuccessfulConnection = Date.now();
    this.useFallbackMode = false;
    
    // Record metrics
    this.metricsService.recordConnectionSuccess();
    
    // Update health
    const health: ServiceHealth = {
      name: 'WebSocket Realtime',
      status: 'operational',
      latency: this.metricsService.getMetrics().averageLatency,
      lastCheck: Date.now(),
    };
    this.healthService.updateWebSocketHealth(health);
    
    // Clear any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Start heartbeat
    this.startHeartbeat();
  }

  private onConnectionError(error: any) {
    console.error('[Realtime] Falha na conexão:', error);
    this.isConnecting = false;
    this.connectionErrorCount++;
    
    // Record metrics
    this.metricsService.recordConnectionFailure();
    
    // Update health - more lenient status thresholds
    const health: ServiceHealth = {
      name: 'WebSocket Realtime',
      status: this.connectionErrorCount >= 5 ? 'down' : 'degraded',
      latency: null,
      lastCheck: Date.now(),
      error: error instanceof Error ? error.message : 'Connection failed',
    };
    this.healthService.updateWebSocketHealth(health);
    
    // Check if we should switch to fallback mode
    if (this.connectionErrorCount >= this.config.maxRetries) {
      console.warn('[Realtime] Muitas falhas, ativando modo fallback (polling)');
      this.activateFallbackMode();
      return;
    }
    
    // Alert if high error rate - but only after more failures
    if (this.connectionErrorCount === 5) {
      this.alertService.alertHighErrorRate(
        this.connectionErrorCount / this.config.maxRetries,
        'WebSocket'
      );
    }
    
    // Schedule retry with exponential backoff
    this.scheduleReconnect();
  }

  private setupNetworkDetection() {
    // Remove existing listeners first
    this.removeNetworkDetection();
    
    // Listen for network coming back online
    this.networkStatusListener = () => {
      console.log('[Realtime] Rede voltou online, reconectando imediatamente...');
      this.isOnline = true;
      
      // Clear any pending reconnect timers
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Reset retry count for immediate reconnection
      this.retryCount = 0;
      this.connectionErrorCount = 0;
      
      // Reconnect immediately
      if (!this.channel || this.getConnectionStatus() !== 'connected') {
        this.connect();
      }
    };
    
    // Listen for network going offline
    this.offlineStatusListener = () => {
      console.log('[Realtime] Rede offline detectada');
      this.isOnline = false;
      
      // Update health status
      const health: ServiceHealth = {
        name: 'WebSocket Realtime',
        status: 'down',
        latency: null,
        lastCheck: Date.now(),
        error: 'Sem conexão de rede',
      };
      this.healthService.updateWebSocketHealth(health);
    };
    
    window.addEventListener('online', this.networkStatusListener);
    window.addEventListener('offline', this.offlineStatusListener);
  }
  
  private removeNetworkDetection() {
    if (this.networkStatusListener) {
      window.removeEventListener('online', this.networkStatusListener);
      this.networkStatusListener = null;
    }
    
    if (this.offlineStatusListener) {
      window.removeEventListener('offline', this.offlineStatusListener);
      this.offlineStatusListener = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Se offline, não agendar reconexão (vai esperar evento 'online')
    if (!this.isOnline) {
      console.log('[Realtime] Rede offline, aguardando reconexão...');
      return;
    }

    const delay = Math.min(
      this.config.retryDelayMs * Math.pow(2, this.retryCount),
      this.config.maxRetryDelayMs
    );

    console.log(`[Realtime] Reagendando conexão em ${delay}ms`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.retryCount++;
      if (this.retryCount < this.config.maxRetries) {
        this.connect();
      } else {
        console.error('[Realtime] Máximo de tentativas atingido');
        this.activateFallbackMode();
      }
    }, delay);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = window.setInterval(() => {
      const status = this.getConnectionStatus();
      
      if (status !== 'connected') {
        console.warn('[Realtime] Heartbeat falhou, reconectando...');
        this.connect();
      } else {
        console.log('[Realtime] Heartbeat OK');
      }
    }, this.config.heartbeatIntervalMs);
  }

  private activateFallbackMode() {
    this.useFallbackMode = true;
    console.log('[Realtime] Modo fallback ativado - notificações podem ter delay');
    
    // Record metrics
    this.metricsService.recordFallbackMode();
    
    // Update health
    const health: ServiceHealth = {
      name: 'WebSocket Realtime',
      status: 'down',
      latency: null,
      lastCheck: Date.now(),
      error: 'Modo fallback ativado após múltiplas falhas',
    };
    this.healthService.updateWebSocketHealth(health);
    
    // Send alert
    this.alertService.alertWebSocketFallback({
      errorCount: this.connectionErrorCount,
      retryCount: this.retryCount,
    });
    
    // Notify listeners about fallback mode
    this.notifyListeners({
      type: 'notification_failed',
      timestamp: new Date().toISOString(),
      data: {
        status: 'error',
        error: 'WebSocket indisponível, usando modo fallback'
      }
    });
    
    // Start fallback polling (simplified - could poll database)
    this.startFallbackPolling();
  }

  private startFallbackPolling() {
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
    }

    // Try to reconnect every minute in fallback mode
    this.fallbackTimer = window.setInterval(() => {
      console.log('[Realtime] Tentando sair do modo fallback...');
      this.retryCount = 0;
      this.connectionErrorCount = 0;
      this.connect();
    }, 60000);
  }

  disconnect() {
    console.log('[Realtime] Desconectando...');
    
    // Stop auto-save
    this.persistenceService.stopAutoSave();
    
    // Remove network detection listeners
    this.removeNetworkDetection();
    
    // Clear all timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
    
    // Remove channel
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    
    this.isConnecting = false;
    this.useFallbackMode = false;
    console.log('[Realtime] Desconectado');
  }

  async broadcastNotificationSent(data: {
    clienteId: string;
    clienteNome: string;
    telefone: string;
    template: string;
    status: 'success' | 'error';
    error?: string;
  }) {
    if (!this.channel || this.getConnectionStatus() !== 'connected') {
      console.warn('[Realtime] Canal não conectado, tentando reconectar...');
      this.connect();
      
      // If in fallback mode, just log locally
      if (this.useFallbackMode) {
        console.log('[Realtime] Modo fallback - evento armazenado localmente');
        this.metricsService.recordEventFailed();
        return;
      }
      this.metricsService.recordEventFailed();
      return;
    }

    try {
      const event: RealtimeNotificationEvent = {
        type: data.status === 'success' ? 'notification_sent' : 'notification_failed',
        timestamp: new Date().toISOString(),
        data,
      };

      const sendStart = Date.now();
      await this.channel.send({
        type: 'broadcast',
        event: 'notification_event',
        payload: event,
      });
      
      const sendLatency = Date.now() - sendStart;
      this.metricsService.recordEventSent();
      this.metricsService.recordLatency(sendLatency);

      console.log('[Realtime] Evento enviado:', event);
    } catch (error) {
      console.error('[Realtime] Erro ao enviar evento:', error);
      this.metricsService.recordEventFailed();
      // Trigger reconnect on send error
      this.scheduleReconnect();
    }
  }

  async broadcastBatchStarted(batchSize: number) {
    if (!this.channel || this.getConnectionStatus() !== 'connected') {
      console.warn('[Realtime] Canal não conectado para batch_started');
      return;
    }

    try {
      const event: RealtimeNotificationEvent = {
        type: 'batch_started',
        timestamp: new Date().toISOString(),
        data: { batchSize },
      };

      await this.channel.send({
        type: 'broadcast',
        event: 'notification_event',
        payload: event,
      });
    } catch (error) {
      console.error('[Realtime] Erro ao enviar batch_started:', error);
    }
  }

  async broadcastBatchCompleted(successCount: number, errorCount: number) {
    if (!this.channel || this.getConnectionStatus() !== 'connected') {
      console.warn('[Realtime] Canal não conectado para batch_completed');
      return;
    }

    try {
      const event: RealtimeNotificationEvent = {
        type: 'batch_completed',
        timestamp: new Date().toISOString(),
        data: { successCount, errorCount },
      };

      await this.channel.send({
        type: 'broadcast',
        event: 'notification_event',
        payload: event,
      });
    } catch (error) {
      console.error('[Realtime] Erro ao enviar batch_completed:', error);
    }
  }

  subscribe(id: string, callback: (event: RealtimeNotificationEvent) => void) {
    this.listeners.set(id, callback);
    console.log(`[Realtime] Listener registrado: ${id}`);
  }

  unsubscribe(id: string) {
    this.listeners.delete(id);
    console.log(`[Realtime] Listener removido: ${id}`);
  }

  private notifyListeners(event: RealtimeNotificationEvent) {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[Realtime] Erro ao notificar listener:', error);
      }
    });
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (this.isConnecting) return 'connecting';
    if (!this.channel) return 'disconnected';
    
    const state = this.channel.state;
    if (state === 'joined') return 'connected';
    if (state === 'joining') return 'connecting';
    return 'disconnected';
  }

  isInFallbackMode(): boolean {
    return this.useFallbackMode;
  }

  getConnectionHealth(): {
    status: 'connected' | 'disconnected' | 'connecting';
    fallbackMode: boolean;
    retryCount: number;
    errorCount: number;
    lastConnection: number | null;
  } {
    return {
      status: this.getConnectionStatus(),
      fallbackMode: this.useFallbackMode,
      retryCount: this.retryCount,
      errorCount: this.connectionErrorCount,
      lastConnection: this.lastSuccessfulConnection || null,
    };
  }

  // Force reconnect (useful for manual recovery)
  forceReconnect() {
    console.log('[Realtime] Forçando reconexão...');
    this.disconnect();
    this.retryCount = 0;
    this.connectionErrorCount = 0;
    this.useFallbackMode = false;
    this.connect();
  }
}

// Singleton instance
let realtimeServiceInstance: RealtimeNotificationService | null = null;

export function getRealtimeService(): RealtimeNotificationService {
  if (!realtimeServiceInstance) {
    realtimeServiceInstance = new RealtimeNotificationService();
  }
  return realtimeServiceInstance;
}
