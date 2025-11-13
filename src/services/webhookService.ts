import { supabase } from '@/integrations/supabase/client';

export interface WebhookEvent {
  id: string;
  event: 'playlist.created' | 'playlist.updated' | 'playlist.deleted' | 'playlist.error';
  mac: string;
  playlist_id?: string;
  status: string;
  error_message?: string;
  received_at: string;
  processed: boolean;
}

class WebhookService {
  private webhookUrl: string;

  constructor() {
    // Construir URL do webhook baseado no projeto Supabase
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'fcmwpbgdehtuqxcjqmxi';
    this.webhookUrl = `https://${projectId}.supabase.co/functions/v1/smartone-webhook`;
  }

  getWebhookUrl(): string {
    return this.webhookUrl;
  }

  async testWebhook(): Promise<{ success: boolean; message: string }> {
    try {
      const testPayload = {
        event: 'playlist.created',
        playlist_id: 'test_playlist_123',
        mac: '00:00:00:00:00:00',
        status: 'active',
        created_at: new Date().toISOString(),
        metadata: {
          test: true,
        },
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        message: `Webhook testado com sucesso! Evento: ${data.event || 'test'}`,
      };
    } catch (error: any) {
      console.error('Erro ao testar webhook:', error);
      return {
        success: false,
        message: `Erro ao testar webhook: ${error.message}`,
      };
    }
  }

  // Simular recebimento de webhook (para testes locais)
  async simulateWebhook(
    event: 'playlist.created' | 'playlist.updated' | 'playlist.deleted' | 'playlist.error',
    mac: string,
    playlistId?: string,
    errorMessage?: string
  ): Promise<void> {
    const payload = {
      event,
      playlist_id: playlistId || `playlist_${Date.now()}`,
      mac,
      status: event === 'playlist.error' ? 'error' : 'active',
      error_message: errorMessage,
      created_at: new Date().toISOString(),
      metadata: {
        simulated: true,
      },
    };

    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  // Recuperar eventos de webhook armazenados (se implementarmos storage)
  async getRecentEvents(limit: number = 50): Promise<WebhookEvent[]> {
    // Esta funcionalidade requer uma tabela no Supabase para armazenar webhooks
    // Por enquanto, retornamos array vazio
    // TODO: Implementar storage de webhooks no Supabase
    return [];
  }

  // Marcar evento como processado
  async markAsProcessed(eventId: string): Promise<void> {
    // TODO: Implementar quando tivermos tabela de webhooks
    console.log(`Marking webhook event ${eventId} as processed`);
  }

  // Gerar chave secreta para validação de webhooks
  generateWebhookSecret(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

export const webhookService = new WebhookService();
