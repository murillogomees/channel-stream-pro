export type NotificationEventType = 
  | 'client_registration'
  | 'payment_due'
  | 'payment_received'
  | 'payment_pending'
  | 'payment_failed'
  | 'recurring_payment'
  | 'client_update'
  | 'trial_ending'
  | 'trial_expiring'
  | 'trial_expired'
  | 'client_deactivation'
  | 'client_reactivation'
  | 'subscription_activated'
  | 'subscription_expired'
  | 'plan_upgrade'
  | 'plan_downgrade'
  | 'client_anniversary'
  | 'user_inactive'
  | 'content_recommendation'
  | 'loyalty_reward'
  | 'promotional_campaign'
  | 'seasonal_greeting'
  | 'new_content'
  | 'maintenance'
  | 'churn_risk'
  | 'daily_summary'
  | 'manual';

export type NotificationTriggerCondition =
  | 'on_registration'
  | 'on_activation'
  | 'days_before_due'
  | 'days_before_trial_end'
  | 'on_trial_expiration'
  | 'on_payment'
  | 'on_pending'
  | 'on_failure'
  | 'days_before_charge'
  | 'days_after_expiration'
  | 'on_update'
  | 'on_trial_end'
  | 'on_deactivation'
  | 'on_reactivation'
  | 'on_upgrade'
  | 'on_downgrade'
  | 'on_6_months'
  | 'on_1_year'
  | 'days_inactive'
  | 'weekly'
  | 'daily'
  | 'on_milestone'
  | 'scheduled'
  | 'on_content_added'
  | 'high_value_payment'
  | 'on_risk_detection';

export type NotificationTargetAudience = 'client' | 'admin' | 'both';

export interface AutomaticNotificationRule {
  id: string;
  name: string;
  description: string | null;
  event_type: string; // Usar string para flexibilidade com novos tipos
  trigger_condition: string; // Usar string para flexibilidade
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
  event_type: string;
  trigger_condition: string;
  days_before?: number;
  target_audience: NotificationTargetAudience;
  template_reference?: string;
  active?: boolean;
  priority?: number;
}

export interface UpdateNotificationRuleInput extends Partial<CreateNotificationRuleInput> {
  id: string;
}
