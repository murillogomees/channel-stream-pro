import { Cliente } from '@/types/cliente';
import { WhatsappTemplate } from '@/types/whatsapp';

const STORAGE_KEY = 'whatsapp_templates';

export class TemplateEngine {
  loadTemplates(): WhatsappTemplate[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Erro ao carregar templates:', error);
        return [];
      }
    }
    return [];
  }

  fill(template: WhatsappTemplate, cliente: Cliente, extraVars?: Record<string, string>): string {
    let message = template.message;
    
    // Substituir variáveis padrão do cliente
    message = message.replace(/{nome}/g, cliente.nome);
    message = message.replace(/{valor}/g, cliente.valorPago?.toFixed(2) || '0.00');
    
    if (cliente.dataVencimento) {
      const dataFormatada = new Date(cliente.dataVencimento).toLocaleDateString('pt-BR');
      message = message.replace(/{dataVencimento}/g, dataFormatada);
    }
    
    if (cliente.plano) {
      message = message.replace(/{plano}/g, cliente.plano);
    }
    
    // Substituir variáveis extras
    if (extraVars) {
      Object.entries(extraVars).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        message = message.replace(regex, value);
      });
    }
    
    return message;
  }

  findTemplateByEvent(eventType: string, daysBeforeDue?: number): WhatsappTemplate | undefined {
    const templates = this.loadTemplates();
    
    if (eventType === 'expiration' && daysBeforeDue !== undefined) {
      return templates.find(t => t.eventType === 'expiration' && t.daysBeforeDue === daysBeforeDue);
    }
    
    return templates.find(t => t.eventType === eventType);
  }
}
