/**
 * Automatic Notification Rule Service
 * Uses auto_notifications table - aligned with types/automaticNotification.ts
 */

import { supabase } from '@/integrations/supabase/client';
import type { AutomaticNotificationRule, CreateNotificationRuleInput, UpdateNotificationRuleInput } from '@/types/automaticNotification';

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

    // Map database fields to expected interface
    return (data || []).map(row => this.mapToRule(row));
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

    return data ? this.mapToRule(data) : null;
  }

  async create(input: CreateNotificationRuleInput): Promise<AutomaticNotificationRule | null> {
    const { data, error } = await supabase
      .from('auto_notifications')
      .insert({
        name: input.name,
        description: input.description || null,
        trigger_type: input.event_type,
        is_active: input.active ?? true,
        template_key: input.template_reference || null,
        delay_hours: input.days_before || 0,
        conditions: {
          trigger_condition: input.trigger_condition,
          target_audience: input.target_audience,
          priority: input.priority || 0,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar regra de notificação:', error);
      throw error;
    }

    return data ? this.mapToRule(data) : null;
  }

  async update(input: UpdateNotificationRuleInput): Promise<AutomaticNotificationRule | null> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.event_type !== undefined) updateData.trigger_type = input.event_type;
    if (input.active !== undefined) updateData.is_active = input.active;
    if (input.template_reference !== undefined) updateData.template_key = input.template_reference;
    if (input.days_before !== undefined) updateData.delay_hours = input.days_before;
    
    // Get current conditions and merge
    const current = await this.getById(input.id);
    const conditions: Record<string, any> = {};
    if (input.trigger_condition !== undefined) conditions.trigger_condition = input.trigger_condition;
    if (input.target_audience !== undefined) conditions.target_audience = input.target_audience;
    if (input.priority !== undefined) conditions.priority = input.priority;
    
    if (Object.keys(conditions).length > 0) {
      updateData.conditions = {
        ...(current ? {
          trigger_condition: current.trigger_condition,
          target_audience: current.target_audience,
          priority: current.priority,
        } : {}),
        ...conditions,
      };
    }

    const { data, error } = await supabase
      .from('auto_notifications')
      .update(updateData)
      .eq('id', input.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar regra de notificação:', error);
      throw error;
    }

    return data ? this.mapToRule(data) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('auto_notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar regra de notificação:', error);
      throw error;
    }

    return true;
  }

  async toggleActive(id: string, active: boolean): Promise<AutomaticNotificationRule | null> {
    const { data, error } = await supabase
      .from('auto_notifications')
      .update({ 
        is_active: active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao alternar status da regra:', error);
      throw error;
    }

    return data ? this.mapToRule(data) : null;
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

    return (data || []).map(row => this.mapToRule(row));
  }

  // Map database row to AutomaticNotificationRule interface
  private mapToRule(row: any): AutomaticNotificationRule {
    const conditions = row.conditions || {};
    return {
      id: row.id,
      name: row.name || '',
      description: row.description,
      event_type: row.trigger_type || 'manual',
      trigger_condition: conditions.trigger_condition || 'on_registration',
      days_before: row.delay_hours || null,
      target_audience: conditions.target_audience || 'client',
      template_reference: row.template_key,
      active: row.is_active ?? true,
      priority: conditions.priority || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export const automaticNotificationRuleService = new AutomaticNotificationRuleService();
