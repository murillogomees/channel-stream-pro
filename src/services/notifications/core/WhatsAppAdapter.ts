import { getWhatsAppService } from '../../whatsapp';
import { BotBotResponse } from '@/types/whatsapp';

export class WhatsAppAdapter {
  isConfigured(): boolean {
    const service = getWhatsAppService();
    return service !== null;
  }

  async sendText(phone: string, message: string): Promise<BotBotResponse> {
    const service = getWhatsAppService();
    if (!service) {
      throw new Error('Serviço WhatsApp não configurado');
    }
    return await service.sendTextMessage(phone, message);
  }

  async sendFile(phone: string, fileBase64: string, caption: string): Promise<BotBotResponse> {
    const service = getWhatsAppService();
    if (!service) {
      throw new Error('Serviço WhatsApp não configurado');
    }
    return await service.sendFileByUrl(phone, fileBase64, caption);
  }

  async sendTemplate(phone: string, templateId: string, message: string): Promise<BotBotResponse> {
    const service = getWhatsAppService();
    if (!service) {
      throw new Error('Serviço WhatsApp não configurado');
    }
    return await service.sendTemplateMessage(phone, templateId);
  }
}
