import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface M3UViewHistory {
  id: string;
  m3u_list_id: string;
  admin_id: string;
  admin_name: string;
  viewed_at: string;
  view_type: 'view' | 'edit' | 'export';
  metadata?: any;
}

export function useM3UViewHistory() {
  const [isLoading, setIsLoading] = useState(false);

  const logView = async (
    listId: string, 
    viewType: 'view' | 'edit' | 'export' = 'view',
    metadata?: any
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user.id)
        .single();

      await supabase
        .from('m3u_view_history')
        .insert({
          m3u_list_id: listId,
          admin_id: user.id,
          admin_name: profile?.nome || user.email || 'Admin',
          view_type: viewType,
          metadata
        });
    } catch (error: any) {
      console.error('Error logging view:', error);
    }
  };

  const getListHistory = async (listId: string): Promise<M3UViewHistory[]> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('m3u_view_history')
        .select('*')
        .eq('m3u_list_id', listId)
        .order('viewed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as M3UViewHistory[]) || [];
    } catch (error: any) {
      console.error('Error loading history:', error);
      toast.error('Erro ao carregar histórico');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getAdminHistory = async (adminId: string): Promise<M3UViewHistory[]> => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('m3u_view_history')
        .select('*')
        .eq('admin_id', adminId)
        .order('viewed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as M3UViewHistory[]) || [];
    } catch (error: any) {
      console.error('Error loading admin history:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    logView,
    getListHistory,
    getAdminHistory
  };
}
