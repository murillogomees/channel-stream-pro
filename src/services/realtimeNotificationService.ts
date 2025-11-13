import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeNotificationEvent {
  type: 'notification_sent' | 'notification_failed' | 'batch_started' | 'batch_completed';
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

class RealtimeNotificationService {
  private channel: RealtimeChannel | null = null;
  private listeners: Map<string, (event: RealtimeNotificationEvent) => void> = new Map();
  
  connect() {
    if (this.channel) {
      return this.channel;
    }

    this.channel = supabase.channel('notifications_live', {
      config: {
        broadcast: { self: true }
      }
    });

    this.channel
      .on('broadcast', { event: 'notification_event' }, (payload) => {
        console.log('[Realtime] Evento recebido:', payload);
        this.notifyListeners(payload.payload as RealtimeNotificationEvent);
      })
      .subscribe((status) => {
        console.log('[Realtime] Status da conexão:', status);
      });

    return this.channel;
  }

  disconnect() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
      console.log('[Realtime] Desconectado');
    }
  }

  async broadcastNotificationSent(data: {
    clienteId: string;
    clienteNome: string;
    telefone: string;
    template: string;
    status: 'success' | 'error';
    error?: string;
  }) {
    if (!this.channel) {
      console.warn('[Realtime] Canal não conectado');
      return;
    }

    const event: RealtimeNotificationEvent = {
      type: data.status === 'success' ? 'notification_sent' : 'notification_failed',
      timestamp: new Date().toISOString(),
      data,
    };

    await this.channel.send({
      type: 'broadcast',
      event: 'notification_event',
      payload: event,
    });

    console.log('[Realtime] Evento enviado:', event);
  }

  async broadcastBatchStarted(batchSize: number) {
    if (!this.channel) return;

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
  }

  async broadcastBatchCompleted(successCount: number, errorCount: number) {
    if (!this.channel) return;

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
    if (!this.channel) return 'disconnected';
    
    const state = this.channel.state;
    if (state === 'joined') return 'connected';
    if (state === 'joining') return 'connecting';
    return 'disconnected';
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
