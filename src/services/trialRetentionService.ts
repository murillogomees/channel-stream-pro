import { supabase } from '@/integrations/supabase/client';
import { NotificationService, TemplateEngine } from './notifications';
import { WhatsAppConfig } from '@/types/whatsapp';

export class TrialRetentionService {
  private notificationService: NotificationService;
  private templateEngine: TemplateEngine;

  constructor() {
    this.notificationService = new NotificationService();
    this.templateEngine = new TemplateEngine();
  }

  async sendStrategicMessage(clientId: string, dayNumber: number, config: WhatsAppConfig) {
    try {
      // Use profiles table (source of truth)
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error || !profileData) throw new Error('Perfil não encontrado');

      // Transform to client format
      const client = {
        id: profileData.id,
        nome: profileData.nome,
        telefone: profileData.contact_phone || profileData.telefone || '',
        email: profileData.email || '',
        situacao: profileData.situacao || 'Testando',
        dataContratacao: profileData.data_contratacao || '',
        dataVencimento: profileData.data_vencimento || '',
        plano: profileData.plano || 'Mensal',
        valorPago: profileData.valor_pago || 0,
        dataUltimoPagamento: profileData.data_ultimo_pagamento || '',
        formaUltimoPagamento: profileData.forma_ultimo_pagamento || '',
        dataCadastro: profileData.created_at || '',
        dataUltimaEdicao: profileData.updated_at || '',
        clienteAtivo: profileData.cliente_ativo,
        origemCadastro: profileData.origem_cadastro || 'Website'
      } as any;

      const messages = this.getStrategicMessages();
      const message = messages[dayNumber];

      if (!message) return;

      await this.notificationService.send({
        cliente: client,
        template: {
          id: `trial_day_${dayNumber}`,
          name: `Mensagem Estratégica - Dia ${dayNumber}`,
          message: message,
          variables: ['nome', 'dias_restantes'],
          type: 'local',
          eventType: 'welcome_trial'
        },
        addLog: async (log) => {
          await supabase.from('notification_logs').insert([{
            cliente_id: client.id,
            phone: client.telefone,
            status: log.status,
            template_name: `trial_day_${dayNumber}`,
            message_content: message,
            error_message: log.erro
          }]);
        }
      });

      // Track behavior
      await this.trackBehavior(clientId, 'strategic_message_sent', {
        day: dayNumber,
        message_type: `day_${dayNumber}`
      });

    } catch (error) {
      console.error('Error sending strategic message:', error);
    }
  }

  private getStrategicMessages(): Record<number, string> {
    return {
      3: `Olá {{nome}}! 👋

Já são 3 dias do seu teste grátis de IPTV! Como está sendo a experiência?

✨ Lembre-se que você tem acesso a:
• +10.000 canais em Full HD e 4K
• Filmes e séries ilimitados
• Suporte técnico dedicado

Ainda restam {{dias_restantes}} dias do seu teste. Aproveite ao máximo! 🎬

Precisa de ajuda? Estamos aqui! 💬`,

      7: `Ei {{nome}}! 🎉

Você já está no meio do seu teste grátis! Como tem sido?

💡 Dica: Explore os canais premium e a seção de filmes 4K para aproveitar ainda mais.

Restam apenas {{dias_restantes}} dias do teste. Depois disso, você pode continuar com nossos planos a partir de R$ 30/mês.

🎁 Quer garantir um desconto exclusivo? Responda esta mensagem!`,

      12: `Olá {{nome}}! ⏰

Seu teste está quase terminando ({{dias_restantes}} dias restantes).

🌟 Gostou da experiência? Temos uma oferta especial para você:

📢 CUPOM EXCLUSIVO: TESTE15
💰 15% OFF no primeiro mês de qualquer plano!

Válido apenas nas próximas 72 horas. Não perca! 🚀

[Link para assinar com desconto]`,

      14: `{{nome}}, seu teste termina AMANHÃ! 🎯

Não fique sem seus canais favoritos! 📺

🔥 ÚLTIMA CHANCE: Use o cupom TESTE15
✅ 15% OFF + Garantia de 7 dias
✅ Instalação grátis
✅ Suporte prioritário

Clique aqui para ativar seu plano agora e não perder nada:
[Link de conversão]

Estamos aguardando você! 💙`
    };
  }

  async generatePersonalizedCoupon(clientId: string, discountPercentage: number = 15): Promise<string> {
    try {
      // Use profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      const phone = profile.contact_phone || profile.telefone || '';
      const code = `TRIAL${discountPercentage}_${phone.slice(-4)}`;
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7); // Válido por 7 dias

      const { error } = await supabase
        .from('discount_coupons')
        .insert([{
          code,
          discount_type: 'percentage',
          discount_value: discountPercentage,
          valid_from: new Date().toISOString(),
          valid_until: validUntil.toISOString(),
          max_uses: 1,
          auto_generated: true,
          conditions: {
            client_id: clientId,
            first_purchase_only: true
          }
        }]);

      if (error) throw error;

      return code;
    } catch (error) {
      console.error('Error generating coupon:', error);
      throw error;
    }
  }

  async trackBehavior(clientId: string, eventType: string, eventData: any) {
    try {
      await supabase
        .from('trial_behavior_tracking')
        .insert([{
          client_id: clientId,
          event_type: eventType,
          event_data: eventData
        }]);
    } catch (error) {
      console.error('Error tracking behavior:', error);
    }
  }

  async initializeTrialMetrics(clientId: string, trialStartDate: Date, trialEndDate: Date) {
    try {
      await supabase
        .from('conversion_metrics')
        .insert([{
          client_id: clientId,
          trial_start_date: trialStartDate.toISOString(),
          trial_end_date: trialEndDate.toISOString(),
          converted: false
        }]);
    } catch (error) {
      console.error('Error initializing trial metrics:', error);
    }
  }
}

export const trialRetentionService = new TrialRetentionService();
