import { supabase } from '@/integrations/supabase/client';
import type { ActivityLog } from '@/types/activity';

export class ActivityLogService {
  async getRecentActivities(limit = 10): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar atividades:', error);
      throw error;
    }

    return data as ActivityLog[];
  }

  async logActivity(
    actionType: string,
    description: string,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user?.id || null,
        action_type: actionType,
        action_description: description,
        entity_type: entityType || null,
        entity_id: entityId || null,
        metadata: metadata || null,
      });

    if (error) {
      console.error('Erro ao registrar atividade:', error);
    }
  }

  subscribeToActivities(callback: (activity: ActivityLog) => void) {
    const channel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs'
        },
        (payload) => callback(payload.new as ActivityLog)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const activityLogService = new ActivityLogService();
