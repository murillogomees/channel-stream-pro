import { formatToBrazilianInternational, isValidBrazilianPhone } from '@/utils/phoneFormatter';
import { BotBotResponse } from '@/types/whatsapp';

const BOTBOT_API_URL = 'https://botbot.chat/api/create-message';

export class WhatsAppService {
  private appkey: string;
  private authkey: string;

  constructor(appkey: string, authkey: string) {
    this.appkey = appkey;
    this.authkey = authkey;
  }

  async sendTextMessage(to: string, message: string, typingDelay: number = 3): Promise<BotBotResponse> {
    const formattedPhone = formatToBrazilianInternational(to);
    
    if (!isValidBrazilianPhone(formattedPhone)) {
      throw new Error(`Número de telefone inválido: ${to}`);
    }

    const formData = new FormData();
    formData.append('appkey', this.appkey);
    formData.append('authkey', this.authkey);
    formData.append('to', formattedPhone);
    formData.append('typingDelay', typingDelay.toString());
    formData.append('message', message);

    try {
      const response = await fetch(BOTBOT_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data as BotBotResponse;
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);
      throw error;
    }
  }

  async sendTemplateMessage(
    to: string,
    templateId: string,
    variables: Record<string, string> = {},
    typingDelay: number = 3
  ): Promise<BotBotResponse> {
    const formattedPhone = formatToBrazilianInternational(to);
    
    if (!isValidBrazilianPhone(formattedPhone)) {
      throw new Error(`Número de telefone inválido: ${to}`);
    }

    const formData = new FormData();
    formData.append('appkey', this.appkey);
    formData.append('authkey', this.authkey);
    formData.append('to', formattedPhone);
    formData.append('typingDelay', typingDelay.toString());
    formData.append('template_id', templateId);
    
    if (Object.keys(variables).length > 0) {
      formData.append('variables', JSON.stringify(variables));
    }

    try {
      const response = await fetch(BOTBOT_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data as BotBotResponse;
    } catch (error) {
      console.error('Erro ao enviar template WhatsApp:', error);
      throw error;
    }
  }

  async sendFile(
    to: string,
    file: File,
    message?: string,
    typingDelay: number = 3
  ): Promise<BotBotResponse> {
    const formattedPhone = formatToBrazilianInternational(to);
    
    if (!isValidBrazilianPhone(formattedPhone)) {
      throw new Error(`Número de telefone inválido: ${to}`);
    }

    const formData = new FormData();
    formData.append('appkey', this.appkey);
    formData.append('authkey', this.authkey);
    formData.append('to', formattedPhone);
    formData.append('typingDelay', typingDelay.toString());
    formData.append('file', file);
    
    if (message) {
      formData.append('message', message);
    }

    try {
      const response = await fetch(BOTBOT_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data as BotBotResponse;
    } catch (error) {
      console.error('Erro ao enviar arquivo WhatsApp:', error);
      throw error;
    }
  }

  static validateCredentials(appkey: string, authkey: string): boolean {
    return appkey.trim().length > 0 && authkey.trim().length > 0;
  }
}

export function getWhatsAppService(): WhatsAppService | null {
  const configStr = localStorage.getItem('whatsapp_config');
  if (!configStr) return null;

  try {
    const config = JSON.parse(configStr);
    if (!config.appkey || !config.authkey) return null;

    return new WhatsAppService(config.appkey, config.authkey);
  } catch {
    return null;
  }
}
