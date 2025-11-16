export interface SecurityAlertTemplate {
  id: string;
  event_type: string;
  template_name: string;
  message_template: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_VARIABLES = {
  common: [
    { var: '{timestamp}', description: 'Data e hora do evento' },
    { var: '{severity}', description: 'Nível de severidade (CRITICAL, WARNING)' },
    { var: '{ip_address}', description: 'Endereço IP' },
    { var: '{event_type}', description: 'Tipo do evento' },
  ],
  failed_login: [
    { var: '{email}', description: 'Email da tentativa de login' },
  ],
  permission_change: [
    { var: '{old_role}', description: 'Permissão anterior' },
    { var: '{new_role}', description: 'Nova permissão' },
  ],
  suspicious_activity: [
    { var: '{description}', description: 'Descrição da atividade suspeita' },
  ],
  rate_limit_exceeded: [
    { var: '{endpoint}', description: 'Endpoint que excedeu o limite' },
  ],
  unauthorized_access: [
    { var: '{resource}', description: 'Recurso acessado indevidamente' },
  ],
} as const;

export type EventType = 
  | 'failed_login' 
  | 'permission_change' 
  | 'suspicious_activity' 
  | 'rate_limit_exceeded' 
  | 'unauthorized_access';
