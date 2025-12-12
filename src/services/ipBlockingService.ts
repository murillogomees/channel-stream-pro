/**
 * IP Blocking Service - Simplified
 * Uses ip_blacklist table (existing schema only)
 */

import { supabase } from "@/lib/supabase";

export interface IPBlock {
  id: string;
  ip_address: string;
  reason: string | null;
  blocked_until: string | null;
  is_permanent: boolean | null;
  created_at: string | null;
}

export const ipBlockingService = {
  /**
   * Check if an IP is blocked
   */
  async isIPBlocked(ipAddress: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('ip_blacklist')
        .select('id, blocked_until, is_permanent')
        .eq('ip_address', ipAddress)
        .maybeSingle();

      if (error || !data) return false;

      // Check if permanent or not yet expired
      if (data.is_permanent) return true;
      if (data.blocked_until && new Date(data.blocked_until) > new Date()) return true;

      return false;
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
    isPermanent: boolean = false,
    blockedUntil?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('ip_blacklist')
        .insert({
          ip_address: ipAddress,
          reason,
          is_permanent: isPermanent,
          blocked_until: blockedUntil || null,
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
      const { error } = await supabase
        .from('ip_blacklist')
        .delete()
        .eq('ip_address', ipAddress);

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
  async getBlockedIPs(): Promise<IPBlock[]> {
    try {
      const { data, error } = await supabase
        .from('ip_blacklist')
        .select('*')
        .order('created_at', { ascending: false });

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
    permanentBlocks: number;
    temporaryBlocks: number;
  }> {
    try {
      const { data, error } = await supabase
        .from('ip_blacklist')
        .select('is_permanent');

      if (error) {
        console.error('[IPBlocking] Failed to get stats:', error);
        return {
          totalBlocked: 0,
          permanentBlocks: 0,
          temporaryBlocks: 0,
        };
      }

      const blocks = data || [];

      return {
        totalBlocked: blocks.length,
        permanentBlocks: blocks.filter(b => b.is_permanent).length,
        temporaryBlocks: blocks.filter(b => !b.is_permanent).length,
      };
    } catch (error) {
      console.error('[IPBlocking] Error getting stats:', error);
      return {
        totalBlocked: 0,
        permanentBlocks: 0,
        temporaryBlocks: 0,
      };
    }
  },
};
