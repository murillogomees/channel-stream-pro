export type NotificationEventType = 
  | 'client_registration'
  | 'payment_due'
  | 'payment_received'
  | 'client_update'
  | 'trial_ending'
  | 'client_deactivation';

export type NotificationTriggerCondition =
  | 'on_registration'
  | 'days_before_due'
  | 'on_payment'
  | 'on_update'
  | 'on_trial_end'
  | 'on_deactivation';

export type NotificationTargetAudience = 'client' | 'admin' | 'both';

export interface AutomaticNotificationRule {
  id: string;
  name: string;
  description: string | null;
  event_type: NotificationEventType;
  trigger_condition: NotificationTriggerCondition;
  days_before: number | null;
  target_audience: NotificationTargetAudience;
  template_reference: string | null;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationRuleInput {
  name: string;
  description?: string;
  event_type: NotificationEventType;
  trigger_condition: NotificationTriggerCondition;
  days_before?: number;
  target_audience: NotificationTargetAudience;
  template_reference?: string;
  active?: boolean;
  priority?: number;
}

export interface UpdateNotificationRuleInput extends Partial<CreateNotificationRuleInput> {
  id: string;
}
