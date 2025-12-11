/**
 * Event Notification Service
 * Triggers automatic notifications based on system events
 */

import { supabase } from '@/integrations/supabase/client';

export type NotificationEventType = 
  | 'client_registration'
  | 'subscription_activated'
  | 'payment_received'
  | 'payment_pending'
  | 'payment_failed'
  | 'trial_expiring'
  | 'trial_expired'
  | 'plan_upgrade'
  | 'plan_downgrade';

interface TriggerNotificationParams {
  eventType: NotificationEventType;
  userId: string;
  extraData?: Record<string, string>;
}

class EventNotificationService {
  /**
   * Trigger a notification for a specific event
   */
  async triggerNotification(params: TriggerNotificationParams): Promise<{ success: boolean; sent?: number; error?: string }> {
    const { eventType, userId, extraData } = params;

    try {
      const { data, error } = await supabase.functions.invoke('trigger-event-notification', {
        body: {
          event_type: eventType,
          user_id: userId,
          extra_data: extraData,
        },
      });

      if (error) {
        console.error('Error triggering notification:', error);
        return { success: false, error: error.message };
      }

      return { success: true, sent: data?.sent || 0 };
    } catch (error: any) {
      console.error('Error in triggerNotification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trigger welcome notification for new trial user
   */
  async triggerWelcomeTrial(userId: string): Promise<{ success: boolean }> {
    return this.triggerNotification({
      eventType: 'client_registration',
      userId,
    });
  }

  /**
   * Trigger welcome notification for paid subscription
   */
  async triggerWelcomePlan(userId: string, planName?: string, amount?: number): Promise<{ success: boolean }> {
    return this.triggerNotification({
      eventType: 'subscription_activated',
      userId,
      extraData: {
        plano: planName || '',
        valor: amount?.toFixed(2) || '',
      },
    });
  }

  /**
   * Trigger payment received notification
   */
  async triggerPaymentReceived(userId: string, planName?: string, amount?: number): Promise<{ success: boolean }> {
    return this.triggerNotification({
      eventType: 'payment_received',
      userId,
      extraData: {
        plano: planName || '',
        valor: amount?.toFixed(2) || '',
      },
    });
  }

  /**
   * Trigger payment pending notification
   */
  async triggerPaymentPending(userId: string, planName?: string, amount?: number): Promise<{ success: boolean }> {
    return this.triggerNotification({
      eventType: 'payment_pending',
      userId,
      extraData: {
        plano: planName || '',
        valor: amount?.toFixed(2) || '',
      },
    });
  }

  /**
   * Trigger payment failed notification
   */
  async triggerPaymentFailed(userId: string, planName?: string, amount?: number, reason?: string): Promise<{ success: boolean }> {
    return this.triggerNotification({
      eventType: 'payment_failed',
      userId,
      extraData: {
        plano: planName || '',
        valor: amount?.toFixed(2) || '',
        motivoErro: reason || 'Erro não especificado',
      },
    });
  }

  /**
   * Trigger plan upgrade notification
   */
  async triggerPlanUpgrade(userId: string, oldPlan: string, newPlan: string, amount?: number): Promise<{ success: boolean }> {
    return this.triggerNotification({
      eventType: 'plan_upgrade',
      userId,
      extraData: {
        planoAnterior: oldPlan,
        novoPlano: newPlan,
        valor: amount?.toFixed(2) || '',
      },
    });
  }

  /**
   * Trigger plan downgrade notification
   */
  async triggerPlanDowngrade(userId: string, oldPlan: string, newPlan: string, amount?: number): Promise<{ success: boolean }> {
    return this.triggerNotification({
      eventType: 'plan_downgrade',
      userId,
      extraData: {
        planoAnterior: oldPlan,
        novoPlano: newPlan,
        valor: amount?.toFixed(2) || '',
      },
    });
  }
}

export const eventNotificationService = new EventNotificationService();
