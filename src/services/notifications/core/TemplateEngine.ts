/**
 * Motor de Templates Centralizado - Versão Unificada
 * Gerencia preenchimento de variáveis em templates de mensagem
 */

import { Cliente } from '@/types/cliente';
import { WhatsappTemplate } from '@/types/whatsapp';
import { DEFAULT_TEMPLATES } from '@/constants/defaultTemplates';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STORAGE_KEY = 'whatsapp_templates';

export class TemplateEngine {
  /**
   * Carrega templates do localStorage com fallback para padrões
   */
  loadTemplates(): WhatsappTemplate[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedTemplates = JSON.parse(stored);
        
        const validTemplates = parsedTemplates.filter((t: WhatsappTemplate) => {
          return t.eventType && typeof t.eventType === 'string';
        });
        
        if (validTemplates.length > 0) {
          return validTemplates;
        }
      } catch (error) {
        console.error('[TemplateEngine] Erro ao carregar templates:', error);
      }
    }
    
    return DEFAULT_TEMPLATES;
  }

  /**
   * Preenche variáveis em template (método legado)
   */
  fill(template: WhatsappTemplate, cliente: Cliente, extraVars?: Record<string, string>): string {
    return this.fillTemplate(template, cliente, extraVars);
  }

  /**
   * Preenche variáveis em template de mensagem
   */
  fillTemplate(
    template: string | WhatsappTemplate,
    cliente: Cliente,
    extraVars?: Record<string, string>
  ): string {
    let message = typeof template === 'string' ? template : template.message;
    
    message = message.replace(/\{nome\}/g, cliente.nome);
    message = message.replace(/\{telefone\}/g, cliente.telefone || '');
    message = message.replace(/\{email\}/g, cliente.email || '');
    message = message.replace(/\{plano\}/g, cliente.plano);
    message = message.replace(/\{valor\}/g, cliente.valorPago?.toFixed(2) || '0.00');
    message = message.replace(/\{macSmartOne\}/g, cliente.macSmartOne || '');
    
    if (cliente.dataVencimento) {
      const dataFormatada = format(new Date(cliente.dataVencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      message = message.replace(/\{dataVencimento\}/g, dataFormatada);
    }
    
    if (cliente.dataContratacao) {
      const dataContratacao = format(new Date(cliente.dataContratacao), "dd/MM/yyyy");
      message = message.replace(/\{dataContratacao\}/g, dataContratacao);
    }
    
    if (cliente.dataVencimento) {
      const diasAteVencimento = this.getDaysUntilDue(cliente.dataVencimento);
      message = message.replace(/\{diasAteVencimento\}/g, Math.abs(diasAteVencimento).toString());
    }
    
    if (extraVars) {
      Object.entries(extraVars).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        message = message.replace(regex, value);
      });
    }
    
    return message;
  }

  /**
   * Busca template por tipo de evento
   */
  findTemplateByEvent(eventType: string, daysBeforeDue?: number): WhatsappTemplate | undefined {
    const templates = this.loadTemplates();
    
    if (eventType === 'expiration' && daysBeforeDue !== undefined) {
      return templates.find(t => t.eventType === 'expiration' && t.daysBeforeDue === daysBeforeDue);
    }
    
    return templates.find(t => t.eventType === eventType);
  }

  /**
   * Calcula dias até vencimento
   */
  getDaysUntilDue(dataVencimento: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(dataVencimento);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Verifica se deve enviar notificação de vencimento
   */
  shouldSendDueDateNotification(
    cliente: Cliente,
    targetDaysBefore: number,
    sentLogs: Array<{ cliente_id: string; sent_at: string; template_name: string }>
  ): boolean {
    if (!cliente.dataVencimento) return false;

    const daysUntil = this.getDaysUntilDue(cliente.dataVencimento);
    if (daysUntil !== targetDaysBefore) return false;

    const today = new Date().toDateString();
    const sentToday = sentLogs.some(log => 
      log.cliente_id === cliente.id &&
      new Date(log.sent_at).toDateString() === today
    );

    return !sentToday;
  }

  /**
   * Gera mensagem de boas-vindas personalizada
   */
  generateWelcomeMessage(cliente: Cliente): string {
    const dataVencimento = cliente.dataVencimento
      ? format(new Date(cliente.dataVencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : 'não definida';

    const periodoPlano = cliente.plano === 'Mensal' ? 'mensal'
      : cliente.plano === 'Trimestral' ? 'trimestral'
      : cliente.plano === 'Semestral' ? 'semestral'
      : 'anual';

    return `🎉 *Bem-vindo à IPTV LINK!*

Olá *${cliente.nome}*! 

Seu acesso foi ativado com sucesso! 🚀

📊 *Detalhes do Seu Plano:*
• Plano: *${cliente.plano}* (${periodoPlano})
• Valor: *R$ ${cliente.valorPago?.toFixed(2) || '0.00'}*
• Data de Vencimento: *${dataVencimento}*
• MAC Cadastrado: *${cliente.macSmartOne || 'Não informado'}*

💡 *Dicas Importantes:*

1️⃣ *Primeiro Acesso*
Seu aplicativo SmartOne IPTV já está configurado e pronto para usar!

2️⃣ *Explore os Canais*
Temos mais de 10.000 canais em Full HD e 4K.

3️⃣ *Qualidade de Imagem*
Para melhor experiência, conexão de 10 Mbps recomendada.

4️⃣ *Suporte Técnico*
Estamos disponíveis neste WhatsApp para ajudar você!

🎁 *Programa de Indicação*
Indique um amigo e ganhe 1 mês grátis!

Aproveite sua experiência IPTV LINK! 🎬📺`;
  }
}
