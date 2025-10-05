export interface NotificationRecord {
  daysBeforeDue: number;
  sentAt: string;
  templateId: string;
  success: boolean;
}

export interface ClientNotificationHistory {
  clienteId: string;
  dataVencimentoAtual: string;
  notificacoesEnviadas: NotificationRecord[];
  ultimoPagamentoDetectado?: string;
}

export interface NotificationHistoryState {
  [clienteId: string]: ClientNotificationHistory;
}

export interface LastRunState {
  lastRunDate: string;
  lastRunHour: number;
  totalSent: number;
  errors: number;
}
