/**
 * Cliente WhatsApp Unificado
 * Fonte única para comunicação com API WhatsApp (BotBot)
 */

import { formatToBrazilianInternational, isValidBrazilianPhone } from '@/utils/phoneFormatter';
import { BotBotResponse } from '@/types/whatsapp';

const BOTBOT_API_URL = 'https://botbot.chat/api/create-message';

export interface WhatsAppCredentials {
  appkey: string;
  authkey: string;
}

export class WhatsAppClient {
  private credentials: WhatsAppCredentials;

  constructor(credentials: WhatsAppCredentials) {
    if (!credentials.appkey || !credentials.authkey) {
      throw new Error('Credenciais WhatsApp inválidas');
    }
    this.credentials = credentials;
  }

  private validatePhone(phone: string): string {
    const formatted = formatToBrazilianInternational(phone);
    if (!isValidBrazilianPhone(formatted)) {
      throw new Error(`Telefone inválido: ${phone}`);
    }
    return formatted;
  }

  async sendTextMessage(
    to: string,
    message: string,
    typingDelay: number = 3
  ): Promise<BotBotResponse> {
    const phone = this.validatePhone(to);
    
    const formData = new FormData();
    formData.append('appkey', this.credentials.appkey);
    formData.append('authkey', this.credentials.authkey);
    formData.append('to', phone);
    formData.append('typingDelay', typingDelay.toString());
    formData.append('message', message);

    return this.makeRequest(formData);
  }

  async sendTemplateMessage(
    to: string,
    templateId: string,
    variables: Record<string, string> = {},
    typingDelay: number = 3
  ): Promise<BotBotResponse> {
    const phone = this.validatePhone(to);
    
    const formData = new FormData();
    formData.append('appkey', this.credentials.appkey);
    formData.append('authkey', this.credentials.authkey);
    formData.append('to', phone);
    formData.append('typingDelay', typingDelay.toString());
    formData.append('template_id', templateId);
    
    if (Object.keys(variables).length > 0) {
      formData.append('variables', JSON.stringify(variables));
    }

    return this.makeRequest(formData);
  }

  async sendFileByUrl(
    to: string,
    fileUrl: string,
    message?: string,
    typingDelay: number = 3
  ): Promise<BotBotResponse> {
    const phone = this.validatePhone(to);
    
    const formData = new FormData();
    formData.append('appkey', this.credentials.appkey);
    formData.append('authkey', this.credentials.authkey);
    formData.append('to', phone);
    formData.append('typingDelay', typingDelay.toString());
    
    if (fileUrl.startsWith('data:') || fileUrl.startsWith('file:')) {
      formData.append('file', fileUrl);
    } else {
      formData.append('file', `url:${fileUrl}`);
    }
    
    if (message) {
      formData.append('message', message);
    }

    return this.makeRequest(formData);
  }

  private async makeRequest(formData: FormData): Promise<BotBotResponse> {
    try {
      const response = await fetch(BOTBOT_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[WhatsAppClient] Erro:', error);
      throw error;
    }
  }
}
