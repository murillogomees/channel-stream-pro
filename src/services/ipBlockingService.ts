import { supabase } from "@/integrations/supabase/client";

export interface IPBlock {
  id: string;
  ip_address: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  blocked_at: string;
  blocked_by?: string;
  auto_blocked: boolean;
  failed_attempts: number;
  last_attempt_at?: string;
  expires_at?: string;
  notes?: string;
  unblocked_at?: string;
  unblocked_by?: string;
}

export const ipBlockingService = {
  /**
   * Check if an IP is blocked
   */
  async isIPBlocked(ipAddress: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('check_and_block_ip', {
          _ip_address: ipAddress,
          _event_type: 'failed_login',
          _threshold: 5,
          _window_minutes: 15
        });

      if (error) {
        console.error('[IPBlocking] Error checking IP:', error);
        return false;
      }

      return data as boolean;
    } catch (error) {
      console.error('[IPBlocking] Error checking IP block:', error);
      return false;
    }
  },

  /**
   * Manually block an IP address
   */
  async blockIP(
    ipAddress: string,
    reason: string,
    severity: 'low' | 'medium' | 'high' = 'medium',
    expiresInHours?: number,
    notes?: string
  ): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const expiresAt = expiresInHours 
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase
        .from('ip_blacklist')
        .insert({
          ip_address: ipAddress,
          reason,
          severity,
          blocked_by: user?.id,
          auto_blocked: false,
          expires_at: expiresAt,
          notes
        });

      if (error) {
        console.error('[IPBlocking] Failed to block IP:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[IPBlocking] Error blocking IP:', error);
      return false;
    }
  },

  /**
   * Unblock an IP address
   */
  async unblockIP(ipAddress: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ip_blacklist')
        .update({
          unblocked_at: new Date().toISOString(),
          unblocked_by: user?.id
        })
        .eq('ip_address', ipAddress)
        .is('unblocked_at', null);

      if (error) {
        console.error('[IPBlocking] Failed to unblock IP:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[IPBlocking] Error unblocking IP:', error);
      return false;
    }
  },

  /**
   * Get all blocked IPs
   */
  async getBlockedIPs(includeExpired: boolean = false): Promise<IPBlock[]> {
    try {
      let query = supabase
        .from('ip_blacklist')
        .select('*')
        .is('unblocked_at', null)
        .order('blocked_at', { ascending: false });

      if (!includeExpired) {
        query = query.or('expires_at.is.null,expires_at.gt.now()');
      }

      const { data, error } = await query;

      if (error) {
        console.error('[IPBlocking] Failed to fetch blocked IPs:', error);
        return [];
      }

      return (data || []) as IPBlock[];
    } catch (error) {
      console.error('[IPBlocking] Error getting blocked IPs:', error);
      return [];
    }
  },

  /**
   * Get blocking statistics
   */
  async getBlockingStats(): Promise<{
    totalBlocked: number;
    autoBlocked: number;
    manualBlocked: number;
    activeBlocks: number;
    expiredBlocks: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('ip_blacklist')
        .select('auto_blocked, expires_at, unblocked_at');

      if (error) {
        console.error('[IPBlocking] Failed to get stats:', error);
        return {
          totalBlocked: 0,
          autoBlocked: 0,
          manualBlocked: 0,
          activeBlocks: 0,
          expiredBlocks: 0
        };
      }

      const blocks = data || [];
      const now = new Date();

      return {
        totalBlocked: blocks.length,
        autoBlocked: blocks.filter(b => b.auto_blocked).length,
        manualBlocked: blocks.filter(b => !b.auto_blocked).length,
        activeBlocks: blocks.filter(b => 
          !b.unblocked_at && (!b.expires_at || new Date(b.expires_at) > now)
        ).length,
        expiredBlocks: blocks.filter(b => 
          b.expires_at && new Date(b.expires_at) <= now
        ).length
      };
    } catch (error) {
      console.error('[IPBlocking] Error getting stats:', error);
      return {
        totalBlocked: 0,
        autoBlocked: 0,
        manualBlocked: 0,
        activeBlocks: 0,
        expiredBlocks: 0
      };
    }
  },

  /**
   * Get top threat IPs from analytics
   */
  async getTopThreatIPs(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_top_threat_ips', { _limit: limit });

      if (error) {
        console.error('[IPBlocking] Failed to get threat IPs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[IPBlocking] Error getting threat IPs:', error);
      return [];
    }
  }
};
