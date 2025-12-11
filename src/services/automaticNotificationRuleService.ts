/**
 * Automatic Notification Rule Service - Simplified
 * Uses auto_notifications table
 */

import { supabase } from '@/integrations/supabase/client';

export interface AutomaticNotificationRule {
  id: string;
  name: string | null;
  description: string | null;
  trigger_type: string;
  is_active: boolean | null;
  template_key: string | null;
  delay_hours: number | null;
  conditions: any;
  created_at: string | null;
  updated_at: string | null;
}

export class AutomaticNotificationRuleService {
  async getAll(): Promise<AutomaticNotificationRule[]> {
    const { data, error } = await supabase
      .from('auto_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar regras de notificação:', error);
      return [];
    }

    return (data || []) as AutomaticNotificationRule[];
  }

  async getById(id: string): Promise<AutomaticNotificationRule | null> {
    const { data, error } = await supabase
      .from('auto_notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar regra de notificação:', error);
      return null;
    }

    return data as AutomaticNotificationRule | null;
  }

  async create(input: Partial<AutomaticNotificationRule>): Promise<AutomaticNotificationRule | null> {
    const { data, error } = await supabase
      .from('auto_notifications')
      .insert({
        name: input.name || null,
        description: input.description || null,
        trigger_type: input.trigger_type || 'manual',
        is_active: input.is_active ?? true,
        template_key: input.template_key || null,
        delay_hours: input.delay_hours || 0,
        conditions: input.conditions || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar regra de notificação:', error);
      return null;
    }

    return data as AutomaticNotificationRule;
  }

  async update(id: string, input: Partial<AutomaticNotificationRule>): Promise<AutomaticNotificationRule | null> {
    const { data, error } = await supabase
      .from('auto_notifications')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar regra de notificação:', error);
      return null;
    }

    return data as AutomaticNotificationRule;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('auto_notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar regra de notificação:', error);
      return false;
    }

    return true;
  }

  async toggleActive(id: string): Promise<AutomaticNotificationRule | null> {
    const current = await this.getById(id);
    if (!current) return null;

    return this.update(id, { is_active: !current.is_active });
  }

  async getActiveRulesByEventType(eventType: string): Promise<AutomaticNotificationRule[]> {
    const { data, error } = await supabase
      .from('auto_notifications')
      .select('*')
      .eq('trigger_type', eventType)
      .eq('is_active', true);

    if (error) {
      console.error('Erro ao buscar regras ativas por tipo:', error);
      return [];
    }

    return (data || []) as AutomaticNotificationRule[];
  }
}

export const automaticNotificationRuleService = new AutomaticNotificationRuleService();
