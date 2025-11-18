import { supabase } from '@/integrations/supabase/client';

export interface SmartOneRetryQueueItem {
  id: string;
  cliente_id: string;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  error_details: any;
  status: 'pending' | 'retrying' | 'exhausted' | 'succeeded';
  created_at: string;
  updated_at: string;
}

export const smartoneRetryQueueService = {
  /**
   * Add a failed sync to the retry queue
   */
  async addToQueue(clienteId: string, error: string, errorDetails?: any): Promise<void> {
    try {
      console.log(`📥 Adding cliente ${clienteId} to retry queue`);

      // Check if already in queue
      const { data: existing } = await supabase
        .from('smartone_sync_retry_queue')
        .select('id, status')
        .eq('cliente_id', clienteId)
        .in('status', ['pending', 'retrying'])
        .single();

      if (existing) {
        console.log(`⚠️ Cliente ${clienteId} already in retry queue`);
        return;
      }

      // Add to queue
      const { error: insertError } = await supabase
        .from('smartone_sync_retry_queue')
        .insert({
          cliente_id: clienteId,
          attempt_count: 0,
          max_attempts: 5,
          status: 'pending',
          last_error: error,
          error_details: errorDetails || { error, timestamp: new Date().toISOString() }
        });

      if (insertError) {
        throw insertError;
      }

      console.log(`✅ Cliente ${clienteId} added to retry queue`);
    } catch (error: any) {
      console.error('❌ Error adding to retry queue:', error);
      throw error;
    }
  },

  /**
   * Get all retry queue items
   */
  async getRetryQueue(): Promise<SmartOneRetryQueueItem[]> {
    try {
      const { data, error } = await supabase
        .from('smartone_sync_retry_queue')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as SmartOneRetryQueueItem[];
    } catch (error: any) {
      console.error('❌ Error fetching retry queue:', error);
      throw error;
    }
  },

  /**
   * Get retry queue statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    retrying: number;
    exhausted: number;
    succeeded: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('smartone_sync_retry_queue')
        .select('status');

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        pending: data?.filter(r => r.status === 'pending').length || 0,
        retrying: data?.filter(r => r.status === 'retrying').length || 0,
        exhausted: data?.filter(r => r.status === 'exhausted').length || 0,
        succeeded: data?.filter(r => r.status === 'succeeded').length || 0
      };

      return stats;
    } catch (error: any) {
      console.error('❌ Error fetching retry queue stats:', error);
      throw error;
    }
  },

  /**
   * Manually trigger retry queue processing
   */
  async processQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    try {
      console.log('🔄 Manually triggering retry queue processing...');

      const { data, error } = await supabase.functions.invoke('process-smartone-retry-queue');

      if (error) throw error;

      console.log('✅ Retry queue processing triggered:', data);
      return data;
    } catch (error: any) {
      console.error('❌ Error processing retry queue:', error);
      throw error;
    }
  },

  /**
   * Remove an item from the retry queue
   */
  async removeFromQueue(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('smartone_sync_retry_queue')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error: any) {
      console.error('❌ Error removing from retry queue:', error);
      throw error;
    }
  },

  /**
   * Retry a specific item immediately
   */
  async retryNow(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('smartone_sync_retry_queue')
        .update({
          status: 'pending',
          next_retry_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Trigger processing
      await this.processQueue();
    } catch (error: any) {
      console.error('❌ Error retrying item:', error);
      throw error;
    }
  }
};
