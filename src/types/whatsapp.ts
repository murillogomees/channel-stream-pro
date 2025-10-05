export interface WhatsappTemplate {
  id: string;
  name: string;
  message: string;
  variables: string[];
  type: 'local' | 'botbot';
  botbotTemplateId?: string;
  daysBeforeDue?: number;
  arquivo?: {
    nome: string;
    tipo: string;
    tamanho: number;
    base64?: string;
  };
}

export interface NotificationLog {
  id: string;
  clienteId: string;
  clienteNome: string;
  telefone: string;
  tipo: string;
  template: string;
  dataEnvio: string;
  status: 'success' | 'error';
  erro?: string;
  resposta?: {
    message_status?: string;
    status_code?: number;
    data?: any;
  };
  arquivoEnviado?: {
    nome: string;
    tipo: string;
    tamanho: number;
  };
}

export interface NotificationSchedule {
  clienteId: string;
  dataVencimento: Date;
  notificationsLog: {
    daysBeforeDue: number;
    sent: boolean;
    sentAt?: Date;
    error?: string;
  }[];
}

export interface WhatsAppConfig {
  appkey: string;
  authkey: string;
  enabled: boolean;
  autoSendEnabled: boolean;
  sendHour: number;
  daysToNotify: number[];
}

export interface BotBotResponse {
  message_status: string;
  data?: {
    from: string;
    to: string;
    status_code: number;
  };
  error?: string;
}
