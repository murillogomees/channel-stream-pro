import { Cliente } from '@/types/cliente';
import { WhatsAppConfig, WhatsappTemplate } from '@/types/whatsapp';
import { LastRunState } from '@/types/notificationHistory';
import { loadTemplates, getDaysUntilDue, sendNotification } from './notificationScheduler';
import { PaymentDetectionService } from './paymentDetectionService';
import { NotificationErrorHandler } from './notificationErrorHandler';
import { RateLimiter } from '@/utils/rateLimiter';

const LAST_RUN_KEY = 'auto_notification_last_run';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos - verificar com mais frequência

export class AutoNotificationScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRunState: LastRunState | null = null;
  private errorHandler: NotificationErrorHandler;

  constructor() {
    this.errorHandler = new NotificationErrorHandler();
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

    // Executar uma verificação imediatamente ao iniciar
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
      // 1. Buscar configurações
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

      // 2. Verificar horário - deve executar exatamente no horário configurado
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Só executar se estiver na hora certa (entre :00 e :05)
      if (currentHour !== config.sendHour || currentMinute > 5) {
        console.log(`⏰ Fora do horário de envio. Atual: ${currentHour}:${currentMinute}, Configurado: ${config.sendHour}:00`);
        this.isRunning = false;
        return;
      }

      // 3. Verificar se já executou hoje
      const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
      if (this.lastRunState?.lastRunDate === today) {
        console.log('✅ Já executou envio automático hoje');
        this.isRunning = false;
        return;
      }

      console.log(`🎯 Iniciando envio automático às ${currentHour}h`);

      // 4. Buscar clientes
      const clientes = this.getClientes();
      console.log(`📋 Total de clientes: ${clientes.length}`);

      // 5. Detectar pagamentos
      const paymentService = new PaymentDetectionService();
      paymentService.loadPreviousData();
      
      const paidClients = paymentService.hasPreviousData() 
        ? paymentService.detectPayments(clientes)
        : [];

      // 6. Limpar histórico de clientes que pagaram
      const { clearClientHistory } = this.getNotificationHistory();
      for (const cliente of paidClients) {
        clearClientHistory(cliente.id);
      }

      // 7. Salvar snapshot atual
      paymentService.saveCurrentData(clientes);

      // 8. Processar notificações
      const result = await this.processNotifications(clientes, config);

      // 9. Salvar estado de execução
      this.saveLastRunState({
        lastRunDate: now.toISOString().split('T')[0],
        lastRunHour: config.sendHour,
        totalSent: result.sent,
        errors: result.errors,
      });

      console.log(`✅ Envio automático concluído: ${result.sent} enviadas, ${result.errors} erros`);

    } catch (error) {
      console.error('❌ Erro no envio automático:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async processNotifications(clientes: Cliente[], config: WhatsAppConfig) {
    const rateLimiter = new RateLimiter();
    const { hasSentToday, addNotificationRecord } = this.getNotificationHistory();
    const { addLog } = this.getNotificationLogs();

    let sent = 0;
    let errors = 0;

    const notifications: Array<{
      cliente: Cliente;
      template: WhatsappTemplate;
      daysUntilDue: number;
    }> = [];

    // Carregar templates atualizados
    const templates = loadTemplates();

    // Coletar todas as notificações a enviar
    for (const cliente of clientes) {
      if (!cliente.dataVencimento) continue;

      const daysUntilDue = getDaysUntilDue(cliente.dataVencimento);

      // Encontrar template correspondente
      const template = templates.find(t => t.daysBeforeDue === daysUntilDue);
      if (!template) continue;

      // Verificar se está nos dias configurados para notificar
      if (!config.daysToNotify.includes(daysUntilDue)) continue;

      // Verificar se já enviou hoje
      if (hasSentToday(cliente.id, daysUntilDue)) {
        console.log(`⏭️ Já enviou para ${cliente.nome} (${daysUntilDue} dias)`);
        continue;
      }

      notifications.push({ cliente, template, daysUntilDue });
    }

    console.log(`📤 ${notifications.length} notificações a enviar`);

    // Enviar com rate limiting
    for (const { cliente, template, daysUntilDue } of notifications) {
      try {
        await rateLimiter.add(async () => {
          try {
            const result = await sendNotification(cliente, template, addLog);
            
            addNotificationRecord(
              cliente.id,
              cliente.dataVencimento!,
              daysUntilDue,
              template.id,
              true
            );

            sent++;
            console.log(`✅ Enviado para ${cliente.nome}: ${template.name}`);
            return result;
          } catch (error) {
            this.errorHandler.logError(cliente, error as Error);
            
            addNotificationRecord(
              cliente.id,
              cliente.dataVencimento!,
              daysUntilDue,
              template.id,
              false
            );

            errors++;
            console.error(`❌ Erro ao enviar para ${cliente.nome}:`, error);
            throw error;
          }
        });
      } catch (error) {
        // Erro já foi logado dentro do rateLimiter
      }
    }

    return { sent, errors };
  }

  private getConfig(): WhatsAppConfig {
    const stored = localStorage.getItem('whatsapp_config');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      appkey: '',
      authkey: '',
      enabled: false,
      autoSendEnabled: false,
      sendHour: 10,
      daysToNotify: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
    };
  }

  private getClientes(): Cliente[] {
    const stored = localStorage.getItem('clientes');
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  }

  private getNotificationHistory() {
    // Importar dinamicamente para evitar circular dependency
    const stored = localStorage.getItem('notification_history');
    const history = stored ? JSON.parse(stored) : {};

    return {
      hasSentToday: (clienteId: string, daysBeforeDue: number) => {
        const clientHistory = history[clienteId];
        if (!clientHistory) return false;

        const today = new Date().toISOString().split('T')[0];
        return clientHistory.notificacoesEnviadas.some((record: any) => {
          const recordDate = new Date(record.sentAt).toISOString().split('T')[0];
          return recordDate === today && record.daysBeforeDue === daysBeforeDue && record.success;
        });
      },
      addNotificationRecord: (
        clienteId: string,
        dataVencimento: string,
        daysBeforeDue: number,
        templateId: string,
        success: boolean
      ) => {
        const clientHistory = history[clienteId] || {
          clienteId,
          dataVencimentoAtual: dataVencimento,
          notificacoesEnviadas: [],
        };

        if (clientHistory.dataVencimentoAtual !== dataVencimento) {
          clientHistory.notificacoesEnviadas = [];
          clientHistory.dataVencimentoAtual = dataVencimento;
        }

        clientHistory.notificacoesEnviadas.push({
          daysBeforeDue,
          sentAt: new Date().toISOString(),
          templateId,
          success,
        });

        history[clienteId] = clientHistory;
        localStorage.setItem('notification_history', JSON.stringify(history));
      },
      clearClientHistory: (clienteId: string) => {
        delete history[clienteId];
        localStorage.setItem('notification_history', JSON.stringify(history));
      },
    };
  }

  private getNotificationLogs() {
    return {
      addLog: (log: any) => {
        const stored = localStorage.getItem('notification_logs');
        const logs = stored ? JSON.parse(stored) : [];
        
        const newLog = {
          ...log,
          id: crypto.randomUUID(),
          dataEnvio: new Date().toISOString(),
        };

        logs.unshift(newLog);
        localStorage.setItem('notification_logs', JSON.stringify(logs.slice(0, 1000)));
      },
    };
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getLastRunState(): LastRunState | null {
    return this.lastRunState;
  }

  getNextRunTime(config: WhatsAppConfig): Date {
    const now = new Date();
    const next = new Date();
    next.setHours(config.sendHour, 0, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  }

  getErrorHandler(): NotificationErrorHandler {
    return this.errorHandler;
  }
}
