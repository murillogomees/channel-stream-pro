import { Cliente } from '@/types/cliente';
import { WhatsAppConfig } from '@/types/whatsapp';
import { LastRunState } from '@/types/notificationHistory';
import { PaymentDetector, EventNotificationHandler, DueDateNotificationHandler } from './notifications';
import { RateLimiter } from '@/utils/rateLimiter';

const LAST_RUN_KEY = 'auto_notification_last_run';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

export class AutoNotificationScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRunState: LastRunState | null = null;

  constructor() {
    this.loadLastRunState();
  }

  private loadLastRunState() {
    const stored = localStorage.getItem(LAST_RUN_KEY);
    if (stored) {
      try {
        this.lastRunState = JSON.parse(stored);
      } catch (error) {
        console.error('Erro ao carregar estado da última execução:', error);
      }
    }
  }

  private saveLastRunState(state: LastRunState) {
    this.lastRunState = state;
    localStorage.setItem(LAST_RUN_KEY, JSON.stringify(state));
  }

  start() {
    if (this.intervalId) {
      console.log('⚠️ Agendador já está rodando');
      return;
    }

    console.log('🚀 Iniciando agendador automático de notificações');
    this.intervalId = setInterval(() => {
      this.checkAndSend();
    }, CHECK_INTERVAL);

    setTimeout(() => this.checkAndSend(), 5000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Agendador automático parado');
    }
  }

  async checkAndSend() {
    if (this.isRunning) {
      console.log('⏳ Verificação já em andamento, aguardando...');
      return;
    }

    this.isRunning = true;

    try {
      const config = this.getConfig();
      if (!config.autoSendEnabled) {
        console.log('⚫ Envio automático desabilitado');
        this.isRunning = false;
        return;
      }

      if (!config.appkey || !config.authkey) {
        console.log('⚠️ Credenciais WhatsApp não configuradas');
        this.isRunning = false;
        return;
      }

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour !== config.sendHour || currentMinute > 5) {
        console.log(`⏰ Fora do horário de envio. Atual: ${currentHour}:${currentMinute}, Configurado: ${config.sendHour}:00`);
        this.isRunning = false;
        return;
      }

      const today = now.toISOString().split('T')[0];
      if (this.lastRunState?.lastRunDate === today) {
        console.log('✅ Já executou envio automático hoje');
        this.isRunning = false;
        return;
      }

      console.log(`🎯 Iniciando envio automático às ${currentHour}h`);

      const clientes = this.getClientes();
      console.log(`📋 Total de clientes: ${clientes.length}`);

      const paymentDetector = new PaymentDetector();
      paymentDetector.loadPreviousData();

      const paidClients = paymentDetector.hasPreviousData()
        ? paymentDetector.detectPayments(clientes)
        : [];

      console.log(`💰 Pagamentos detectados: ${paidClients.length}`);

      const { clearClientHistory } = this.getNotificationHistory();
      for (const cliente of paidClients) {
        clearClientHistory(cliente.id);
      }

      paymentDetector.saveCurrentData(clientes);

      const eventHandler = new EventNotificationHandler();
      const { addLog } = this.getNotificationLogs();
      const eventResult = await eventHandler.processEvents(clientes, paidClients, addLog);
      console.log(`🎉 Eventos processados: ${eventResult.welcomeSent} boas-vindas, ${eventResult.renewalSent} renovações`);

      const result = await this.processNotifications(clientes, config);

      this.saveLastRunState({
        lastRunDate: today,
        lastRunHour: currentHour,
        totalSent: result.sent,
        errors: result.errors,
      });

      console.log(`✅ Envio automático concluído: ${result.sent} enviados, ${result.errors} erros`);
    } catch (error) {
      console.error('❌ Erro no envio automático:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async processNotifications(clientes: Cliente[], config: WhatsAppConfig): Promise<{ sent: number; errors: number }> {
    const dueDateHandler = new DueDateNotificationHandler();
    const { addLog } = this.getNotificationLogs();
    const { hasNotification, addNotification } = this.getNotificationHistory();
    const notificationLogs = this.getNotificationLogs().logs;
    const rateLimiter = new RateLimiter();

    let sent = 0;
    let errors = 0;

    for (const cliente of clientes) {
      if (!cliente.dataVencimento) continue;

      for (const daysBeforeDue of config.daysToNotify) {
        const shouldSend = dueDateHandler.shouldSendNotification(cliente, daysBeforeDue, notificationLogs);

        if (!shouldSend) continue;

        const alreadySent = hasNotification(cliente.id, cliente.dataVencimento, daysBeforeDue);
        if (alreadySent) continue;

        try {
          await rateLimiter.add(async () => {
            const success = await dueDateHandler.sendDueDateNotification(cliente, daysBeforeDue, addLog);

            if (success) {
              sent++;
              addNotification(cliente.id, cliente.dataVencimento, daysBeforeDue, true);
            } else {
              errors++;
              addNotification(cliente.id, cliente.dataVencimento, daysBeforeDue, false);
            }
          });
        } catch (error) {
          console.error(`Erro ao enviar para ${cliente.nome}:`, error);
          errors++;
          addNotification(cliente.id, cliente.dataVencimento, daysBeforeDue, false);
        }
      }
    }

    return { sent, errors };
  }

  private getConfig(): WhatsAppConfig {
    const stored = localStorage.getItem('whatsapp_config');
    if (!stored) {
      return {
        appkey: '',
        authkey: '',
        enabled: false,
        autoSendEnabled: false,
        sendHour: 9,
        daysToNotify: [],
        testPhoneNumber: '',
        testContacts: [],
      };
    }
    return JSON.parse(stored);
  }

  private getClientes(): Cliente[] {
    const stored = localStorage.getItem('clientes');
    return stored ? JSON.parse(stored) : [];
  }

  private getNotificationHistory() {
    const HISTORY_KEY = 'notification_history';

    return {
      hasNotification: (clienteId: string, dataVencimento: string, daysBeforeDue: number): boolean => {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (!stored) return false;

        const history = JSON.parse(stored);
        const clientHistory = history[clienteId];

        if (!clientHistory || clientHistory.dataVencimentoAtual !== dataVencimento) {
          return false;
        }

        return clientHistory.notificacoesEnviadas.some((n: any) => n.daysBeforeDue === daysBeforeDue);
      },

      addNotification: (clienteId: string, dataVencimento: string, daysBeforeDue: number, success: boolean) => {
        const stored = localStorage.getItem(HISTORY_KEY);
        const history = stored ? JSON.parse(stored) : {};

        if (!history[clienteId] || history[clienteId].dataVencimentoAtual !== dataVencimento) {
          history[clienteId] = {
            clienteId,
            dataVencimentoAtual: dataVencimento,
            notificacoesEnviadas: [],
          };
        }

        history[clienteId].notificacoesEnviadas.push({
          daysBeforeDue,
          sentAt: new Date().toISOString(),
          success,
        });

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      },

      clearClientHistory: (clienteId: string) => {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (!stored) return;

        const history = JSON.parse(stored);
        delete history[clienteId];
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      },
    };
  }

  private getNotificationLogs() {
    const LOGS_KEY = 'notification_logs';

    return {
      logs: (() => {
        const stored = localStorage.getItem(LOGS_KEY);
        return stored ? JSON.parse(stored) : [];
      })(),

      addLog: (log: any) => {
        const stored = localStorage.getItem(LOGS_KEY);
        const logs = stored ? JSON.parse(stored) : [];
        logs.unshift(log);

        if (logs.length > 1000) {
          logs.splice(1000);
        }

        localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
      },
    };
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getLastRunState(): LastRunState | null {
    return this.lastRunState;
  }

  getNextRunTime(config: WhatsAppConfig): Date | null {
    if (!config.autoSendEnabled) return null;

    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(config.sendHour, 0, 0, 0);

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }
}
