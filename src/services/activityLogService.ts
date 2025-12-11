import { supabase } from '@/lib/supabase';

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}

export class ActivityLogService {
  async getRecentActivities(limit = 10): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar atividades:', error);
      return [];
    }

    return (data || []) as ActivityLog[];
  }

  async logActivity(
    action: string,
    description?: string,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('activity_logs').insert({
        user_id: user?.id || null,
        action: action,
        entity_type: entityType || null,
        entity_id: entityId || null,
        details: metadata || null,
      });
    } catch (error) {
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
