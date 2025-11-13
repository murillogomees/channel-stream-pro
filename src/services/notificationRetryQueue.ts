interface RetryQueueItem {
  id: string;
  type: 'prospect_welcome' | 'admin_notification';
  prospectData: {
    nome: string;
    email: string;
    celular: string;
    mac: string;
  };
  recipient: {
    phone: string;
    name?: string;
  };
  message: string;
  attempts: number;
  maxAttempts: number;
  lastAttempt: string;
  nextAttempt: string;
  error?: string;
  createdAt: string;
}

const RETRY_QUEUE_KEY = 'notification_retry_queue';
const MAX_ATTEMPTS = 5;
const INITIAL_DELAY = 60000; // 1 minuto

export class NotificationRetryQueue {
  private queue: RetryQueueItem[] = [];
  private isProcessing = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.loadQueue();
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(RETRY_QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`[RetryQueue] Carregadas ${this.queue.length} notificações pendentes`);
      }
    } catch (error) {
      console.error('[RetryQueue] Erro ao carregar fila:', error);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[RetryQueue] Erro ao salvar fila:', error);
    }
  }

  add(item: Omit<RetryQueueItem, 'id' | 'attempts' | 'createdAt' | 'lastAttempt' | 'nextAttempt'>) {
    const now = new Date().toISOString();
    const queueItem: RetryQueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      attempts: 0,
      createdAt: now,
      lastAttempt: now,
      nextAttempt: new Date(Date.now() + INITIAL_DELAY).toISOString(),
    };

    this.queue.push(queueItem);
    this.saveQueue();
    console.log(`[RetryQueue] Adicionada notificação para ${item.recipient.phone}`);
  }

  remove(id: string) {
    this.queue = this.queue.filter(item => item.id !== id);
    this.saveQueue();
    console.log(`[RetryQueue] Removida notificação ${id}`);
  }

  async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const now = Date.now();

    console.log(`[RetryQueue] Processando fila com ${this.queue.length} itens`);

    for (const item of [...this.queue]) {
      const nextAttemptTime = new Date(item.nextAttempt).getTime();

      // Verificar se chegou a hora de tentar novamente
      if (nextAttemptTime <= now) {
        if (item.attempts >= item.maxAttempts) {
          console.error(`[RetryQueue] Máximo de tentativas atingido para ${item.id}`);
          this.remove(item.id);
          continue;
        }

        try {
          await this.retryNotification(item);
          // Se sucesso, remover da fila
          this.remove(item.id);
          console.log(`[RetryQueue] Notificação ${item.id} enviada com sucesso`);
        } catch (error) {
          // Se falhou, atualizar tentativas e próximo retry
          const newAttempts = item.attempts + 1;
          const backoffDelay = INITIAL_DELAY * Math.pow(2, newAttempts); // Exponential backoff
          
          const updatedItem: RetryQueueItem = {
            ...item,
            attempts: newAttempts,
            lastAttempt: new Date().toISOString(),
            nextAttempt: new Date(Date.now() + backoffDelay).toISOString(),
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          };

          const index = this.queue.findIndex(i => i.id === item.id);
          if (index !== -1) {
            this.queue[index] = updatedItem;
            this.saveQueue();
          }

          console.error(`[RetryQueue] Falha na tentativa ${newAttempts}/${item.maxAttempts} para ${item.id}:`, error);
        }
      }
    }

    this.isProcessing = false;
  }

  private async retryNotification(item: RetryQueueItem): Promise<void> {
    const whatsappConfigStr = localStorage.getItem('whatsapp_config');
    if (!whatsappConfigStr) {
      throw new Error('Configurações do WhatsApp não encontradas');
    }

    const whatsappConfig = JSON.parse(whatsappConfigStr);
    if (!whatsappConfig.appkey || !whatsappConfig.authkey) {
      throw new Error('Credenciais do WhatsApp não configuradas');
    }

    const response = await fetch('https://api.botbot.com.br/waboxapp/api/send/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appkey: whatsappConfig.appkey,
        authkey: whatsappConfig.authkey,
        to: item.recipient.phone,
        message: item.message,
        typing_time: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Falha no envio: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    if (data.message_status !== 'success') {
      throw new Error(`Status não é sucesso: ${data.message_status}`);
    }
  }

  startAutoProcess(intervalMs: number = 120000) { // 2 minutos
    if (this.intervalId) {
      return;
    }

    console.log(`[RetryQueue] Iniciando processamento automático a cada ${intervalMs / 1000}s`);
    this.intervalId = setInterval(() => {
      this.processQueue();
    }, intervalMs);

    // Processar imediatamente ao iniciar
    this.processQueue();
  }

  stopAutoProcess() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[RetryQueue] Processamento automático parado');
    }
  }

  getQueue(): RetryQueueItem[] {
    return [...this.queue];
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clearQueue() {
    this.queue = [];
    this.saveQueue();
    console.log('[RetryQueue] Fila limpa');
  }

  getStats() {
    const total = this.queue.length;
    const byType = this.queue.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const highAttempts = this.queue.filter(item => item.attempts >= 3).length;

    return {
      total,
      byType,
      highAttempts,
    };
  }
}

// Singleton instance
let retryQueueInstance: NotificationRetryQueue | null = null;

export function getRetryQueue(): NotificationRetryQueue {
  if (!retryQueueInstance) {
    retryQueueInstance = new NotificationRetryQueue();
    retryQueueInstance.startAutoProcess();
  }
  return retryQueueInstance;
}
