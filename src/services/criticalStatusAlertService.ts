import { supabase } from '@/integrations/supabase/client';
import { WhatsAppService } from './whatsapp';

interface CriticalStatusChange {
  serviceName: string;
  previousStatus: string | null;
  newStatus: string;
  timestamp: Date;
  metadata?: any;
}

const CRITICAL_STATUSES = ['critical', 'down', 'error', 'erro', 'failed', 'offline'];

export class CriticalStatusAlertService {
  private static instance: CriticalStatusAlertService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCheckedStatuses: Map<string, string> = new Map();
  private whatsAppService: WhatsAppService | null = null;

  private constructor() {}

  public static getInstance(): CriticalStatusAlertService {
    if (!CriticalStatusAlertService.instance) {
      CriticalStatusAlertService.instance = new CriticalStatusAlertService();
    }
    return CriticalStatusAlertService.instance;
  }

  /**
   * Inicializa o serviço WhatsApp com credenciais do banco
   */
  private async initWhatsAppService(): Promise<WhatsAppService | null> {
    if (this.whatsAppService) return this.whatsAppService;

    try {
      const { data: config } = await supabase
        .from('notification_templates')
        .select('variables')
        .eq('name', 'whatsapp_config')
        .single();

      if (!config?.variables) return null;

      const { appkey, authkey } = config.variables as { appkey?: string; authkey?: string };
      if (!appkey || !authkey) return null;

      this.whatsAppService = new WhatsAppService(appkey, authkey);
      return this.whatsAppService;
    } catch (error) {
      console.error('Erro ao inicializar WhatsApp service:', error);
      return null;
    }
  }

  /**
   * Inicia o monitoramento automático de status críticos
   */
  public startMonitoring(intervalMs: number = 60000) {
    if (this.monitoringInterval) {
      console.warn('Monitoramento já está ativo');
      return;
    }

    console.log('Iniciando monitoramento de status críticos...');
    
    // Verificação inicial
    this.checkCriticalStatuses();

    // Verificações periódicas
    this.monitoringInterval = setInterval(() => {
      this.checkCriticalStatuses();
    }, intervalMs);
  }

  /**
   * Para o monitoramento automático
   */
  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Monitoramento de status críticos parado');
    }
  }

  /**
   * Verifica mudanças para status críticos
   */
  private async checkCriticalStatuses() {
    try {
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

      const { data: recentChanges, error } = await supabase
        .from('status_change_history')
        .select('*')
        .gte('changed_at', fiveMinutesAgo.toISOString())
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar mudanças de status:', error);
        return;
      }

      if (!recentChanges || recentChanges.length === 0) return;

      for (const change of recentChanges) {
        const isCriticalStatus = CRITICAL_STATUSES.includes(change.new_status.toLowerCase());
        const wasNotCritical = change.previous_status && 
          !CRITICAL_STATUSES.includes(change.previous_status.toLowerCase());

        if (isCriticalStatus && wasNotCritical) {
          const lastStatus = this.lastCheckedStatuses.get(change.service_name);
          
          if (lastStatus !== change.new_status) {
            await this.sendCriticalStatusAlert({
              serviceName: change.service_name,
              previousStatus: change.previous_status,
              newStatus: change.new_status,
              timestamp: new Date(change.changed_at),
              metadata: change.metadata,
            });

            this.lastCheckedStatuses.set(change.service_name, change.new_status);
          }
        }
      }
    } catch (error) {
      console.error('Erro no monitoramento de status críticos:', error);
    }
  }

  /**
   * Envia alerta de status crítico via WhatsApp
   */
  private async sendCriticalStatusAlert(change: CriticalStatusChange) {
    try {
      console.log('Enviando alerta de status crítico:', change);

      const whatsApp = await this.initWhatsAppService();
      if (!whatsApp) {
        console.warn('Serviço WhatsApp não disponível');
        return;
      }

      const { data: adminPhones, error: phonesError } = await supabase
        .from('admin_phones')
        .select('phone, name')
        .eq('active', true);

      if (phonesError || !adminPhones?.length) {
        console.warn('Nenhum telefone de administrador ativo encontrado');
        return;
      }

      const message = this.buildAlertMessage(change);

      for (const admin of adminPhones) {
        try {
          await whatsApp.sendTextMessage(admin.phone, message);
          console.log(`Alerta enviado para ${admin.name} (${admin.phone})`);
        } catch (error) {
          console.error(`Erro ao enviar alerta para ${admin.phone}:`, error);
        }
      }

      await supabase.from('notification_logs').insert({
        phone: adminPhones.map(p => p.phone).join(', '),
        status: 'success',
        template_name: 'critical_status_alert',
        message_content: message,
      });

    } catch (error) {
      console.error('Erro ao enviar alerta crítico:', error);
    }
  }

  /**
   * Constrói a mensagem de alerta
   */
  private buildAlertMessage(change: CriticalStatusChange): string {
    const statusEmoji = this.getStatusEmoji(change.newStatus);
    
    return `🚨 *ALERTA DE STATUS CRÍTICO* ${statusEmoji}\n\n` +
           `*Serviço:* ${change.serviceName}\n` +
           `*Status Anterior:* ${change.previousStatus || 'Inicial'}\n` +
           `*Novo Status:* ${change.newStatus.toUpperCase()}\n` +
           `*Horário:* ${change.timestamp.toLocaleString('pt-BR')}\n\n` +
           `⚠️ *Ação necessária:* Verificar o serviço imediatamente.\n\n` +
           `_Este é um alerta automático do sistema de monitoramento._`;
  }

  /**
   * Retorna emoji apropriado para o status
   */
  private getStatusEmoji(status: string): string {
    const statusLower = status.toLowerCase();
    if (statusLower === 'critical') return '🔴';
    if (statusLower === 'down' || statusLower === 'offline') return '💀';
    if (statusLower === 'error' || statusLower === 'erro') return '❌';
    if (statusLower === 'failed') return '⛔';
    return '⚠️';
  }

  /**
   * Registra uma mudança de status manualmente
   */
  public async logStatusChange(
    serviceName: string,
    previousStatus: string | null,
    newStatus: string,
    metadata?: any
  ): Promise<void> {
    try {
      await supabase.rpc('log_status_change', {
        p_service_name: serviceName,
        p_previous_status: previousStatus,
        p_new_status: newStatus,
        p_metadata: metadata || null,
      });

      if (CRITICAL_STATUSES.includes(newStatus.toLowerCase())) {
        const wasNotCritical = !previousStatus || 
          !CRITICAL_STATUSES.includes(previousStatus.toLowerCase());

        if (wasNotCritical) {
          await this.sendCriticalStatusAlert({
            serviceName,
            previousStatus,
            newStatus,
            timestamp: new Date(),
            metadata,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao registrar mudança de status:', error);
    }
  }
}

export const criticalStatusAlertService = CriticalStatusAlertService.getInstance();
