export type TemplateEventType = 
  | 'expiration' // Baseado em dias antes/depois do vencimento
  | 'welcome_trial' // Novo cliente em período de teste
  | 'welcome_plan' // Novo cliente com plano contratado
  | 'renewal' // Pagamento detectado/renovação confirmada
  | 'payment_reminder' // Lembrete genérico de pagamento
  | 'payment_approved' // Pagamento aprovado
  | 'payment_pending' // Pagamento pendente (boleto, pix aguardando)
  | 'payment_in_process' // Pagamento em processamento
  | 'payment_rejected' // Pagamento recusado
  | 'payment_refunded' // Pagamento reembolsado
  | 'payment_cancelled' // Pagamento cancelado
  | 'trial_ending' // Teste terminando em breve
  | 'trial_expiring' // Teste expirando amanhã
  | 'trial_expired' // Teste expirou
  | 'plan_upgrade' // Upgrade de plano
  | 'plan_downgrade' // Downgrade de plano
  | 'user_inactive' // Usuário inativo
  | 'affiliate_referral' // Nova indicação de afiliado
  | 'affiliate_commission' // Comissão de afiliado creditada
  | 'loyalty_reward' // Recompensa de fidelidade
  | 'client_anniversary' // Aniversário como cliente
  | 'promotional_campaign' // Campanha promocional
  | 'seasonal_greeting' // Mensagem sazonal
  | 'new_content' // Novo conteúdo adicionado
  | 'maintenance' // Manutenção programada/concluída
  | 'churn_risk' // Risco de cancelamento
  | 'client_reactivation' // Cliente reativado
  | 'client_deactivation' // Cliente desativado
  | 'manual'; // Template manual para uso em automações

export interface WhatsappTemplate {
  id: string;
  name: string;
  message: string;
  variables: string[];
  type: 'local' | 'botbot';
  botbotTemplateId?: string;
  eventType: TemplateEventType;
  daysBeforeDue?: number; // Usado apenas para eventType 'expiration'
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

export interface TestContact {
  id: string;
  name: string;
  phone: string;
  addedAt: string;
}

export interface WhatsAppConfig {
  appkey: string;
  authkey: string;
  enabled: boolean;
  autoSendEnabled: boolean;
  sendHour: number;
  daysToNotify: number[];
  testPhoneNumber: string;
  testContacts: TestContact[];
  adminPhones: string[]; // Telefones de administradores para receber alertas
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
