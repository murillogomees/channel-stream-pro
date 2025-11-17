import { supabase } from '@/integrations/supabase/client';
import type { 
  AutomaticNotificationRule, 
  CreateNotificationRuleInput, 
  UpdateNotificationRuleInput 
} from '@/types/automaticNotification';

export class AutomaticNotificationRuleService {
  async getAll(): Promise<AutomaticNotificationRule[]> {
    const { data, error } = await supabase
      .from('automatic_notification_rules')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar regras de notificação:', error);
      throw error;
    }

    return data as AutomaticNotificationRule[];
  }

  async getById(id: string): Promise<AutomaticNotificationRule | null> {
    const { data, error } = await supabase
      .from('automatic_notification_rules')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar regra de notificação:', error);
      throw error;
    }

    return data as AutomaticNotificationRule | null;
  }

  async create(input: CreateNotificationRuleInput): Promise<AutomaticNotificationRule> {
    const { data, error } = await supabase
      .from('automatic_notification_rules')
      .insert({
        name: input.name,
        description: input.description || null,
        event_type: input.event_type,
        trigger_condition: input.trigger_condition,
        days_before: input.days_before || null,
        target_audience: input.target_audience,
        template_reference: input.template_reference || null,
        active: input.active ?? true,
        priority: input.priority ?? 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar regra de notificação:', error);
      throw error;
    }

    return data as AutomaticNotificationRule;
  }

  async update(input: UpdateNotificationRuleInput): Promise<AutomaticNotificationRule> {
    const { id, ...updates } = input;
    
    const { data, error } = await supabase
      .from('automatic_notification_rules')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar regra de notificação:', error);
      throw error;
    }

    return data as AutomaticNotificationRule;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('automatic_notification_rules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar regra de notificação:', error);
      throw error;
    }
  }

  async toggleActive(id: string, active: boolean): Promise<void> {
    const { error } = await supabase
      .from('automatic_notification_rules')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Erro ao alternar status da regra:', error);
      throw error;
    }
  }

  async getActiveRulesByEventType(eventType: string): Promise<AutomaticNotificationRule[]> {
    const { data, error } = await supabase
      .from('automatic_notification_rules')
      .select('*')
      .eq('event_type', eventType)
      .eq('active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Erro ao buscar regras ativas por tipo:', error);
      throw error;
    }

    return data as AutomaticNotificationRule[];
  }
}

export const automaticNotificationRuleService = new AutomaticNotificationRuleService();
