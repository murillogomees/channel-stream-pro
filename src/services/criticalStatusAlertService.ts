import { supabase } from '@/integrations/supabase/client';

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

  private constructor() {}

  public static getInstance(): CriticalStatusAlertService {
    if (!CriticalStatusAlertService.instance) {
      CriticalStatusAlertService.instance = new CriticalStatusAlertService();
    }
    return CriticalStatusAlertService.instance;
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
      // Buscar últimas mudanças de status (últimos 5 minutos)
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

      if (!recentChanges || recentChanges.length === 0) {
        return;
      }

      // Verificar se alguma mudança é para status crítico
      for (const change of recentChanges) {
        const isCriticalStatus = CRITICAL_STATUSES.includes(change.new_status.toLowerCase());
        const wasNotCritical = change.previous_status && 
          !CRITICAL_STATUSES.includes(change.previous_status.toLowerCase());

        // Se mudou de não-crítico para crítico, enviar alerta
        if (isCriticalStatus && wasNotCritical) {
          const lastStatus = this.lastCheckedStatuses.get(change.service_name);
          
          // Evitar alertas duplicados
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

      // Buscar telefones dos administradores ativos
      const { data: adminPhones, error: phonesError } = await supabase
        .from('admin_phones')
        .select('phone, name')
        .eq('active', true);

      if (phonesError) {
        console.error('Erro ao buscar telefones de admin:', phonesError);
        return;
      }

      if (!adminPhones || adminPhones.length === 0) {
        console.warn('Nenhum telefone de administrador ativo encontrado');
        return;
      }

      // Buscar configuração do WhatsApp
      const { data: settings } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('name', 'whatsapp_config')
        .single();

      if (!settings) {
        console.warn('Configuração WhatsApp não encontrada');
        return;
      }

      // Montar mensagem de alerta
      const message = this.buildAlertMessage(change);

      // Enviar para cada administrador
      for (const admin of adminPhones) {
        try {
          await this.sendWhatsAppMessage(admin.phone, message);
          console.log(`Alerta enviado para ${admin.name} (${admin.phone})`);
        } catch (error) {
          console.error(`Erro ao enviar alerta para ${admin.phone}:`, error);
        }
      }

      // Registrar envio do alerta
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
   * Envia mensagem via WhatsApp usando a API configurada
   */
  private async sendWhatsAppMessage(phone: string, message: string): Promise<void> {
    // Buscar configuração do WhatsApp
    const { data: config } = await supabase
      .from('notification_templates')
      .select('variables')
      .eq('name', 'whatsapp_config')
      .single();

    if (!config || !config.variables) {
      throw new Error('Configuração WhatsApp não encontrada');
    }

    const { appkey, authkey } = config.variables as any;

    if (!appkey || !authkey) {
      throw new Error('Credenciais WhatsApp não configuradas');
    }

    // Enviar via API BotBot
    const response = await fetch('https://api.iagentechat.com.br/v2/api/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AppKey': appkey,
        'AuthKey': authkey,
      },
      body: JSON.stringify({
        phone: phone.replace(/\D/g, ''),
        message: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao enviar WhatsApp: ${response.status}`);
    }
  }

  /**
   * Registra uma mudança de status manualmente (pode ser chamado de outros serviços)
   */
  public async logStatusChange(
    serviceName: string,
    previousStatus: string | null,
    newStatus: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Registrar no histórico
      await supabase.rpc('log_status_change', {
        p_service_name: serviceName,
        p_previous_status: previousStatus,
        p_new_status: newStatus,
        p_metadata: metadata || null,
      });

      // Verificar se é status crítico e enviar alerta
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

// Exportar instância singleton
export const criticalStatusAlertService = CriticalStatusAlertService.getInstance();
