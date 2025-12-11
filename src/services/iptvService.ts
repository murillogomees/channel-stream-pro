/**
 * IPTV Service
 * Centralized service for IPTV channel management and playback
 */

import { supabase } from '@/lib/supabase';

export interface IPTVChannel {
  id: number;
  slug: string;
  name: string;
  original_url: string;
  logo_url: string | null;
  category: string | null;
  content_type: 'live' | 'vod' | 'series';
  is_healthy: boolean;
  health_score: number;
  resolution: string | null;
  transcode_status: string;
}

export interface IPTVPlaylist {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  is_public: boolean;
  channel_count: number;
  user_id: string | null;
}

export interface PlaybackInfo {
  url: string;
  cdnList: Array<{
    url: string;
    priority: number;
    type: string;
    region?: string;
  }>;
  expiresAt: string;
  channel: {
    id: number;
    name: string;
  };
}

export interface ChannelGroup {
  name: string;
  channels: IPTVChannel[];
}

class IPTVService {
  private baseUrl = import.meta.env.VITE_SUPABASE_URL;

  /**
   * Get channels with pagination and filters
   */
  async getChannels(options: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    contentType?: string;
    healthyOnly?: boolean;
  } = {}): Promise<{ channels: IPTVChannel[]; total: number }> {
    const { 
      page = 0, 
      limit = 50, 
      search, 
      category, 
      contentType,
      healthyOnly = true 
    } = options;

    let query = supabase
      .from('iptv_channels')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(page * limit, (page + 1) * limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,category.ilike.%${search}%`);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (contentType) {
      query = query.eq('content_type', contentType);
    }
    if (healthyOnly) {
      query = query.eq('is_healthy', true);
    }

    const { data, error, count } = await query;
    
    if (error) {
      console.error('[IPTVService] Error fetching channels:', error);
      throw error;
    }

    return { 
      channels: (data || []) as IPTVChannel[], 
      total: count || 0 
    };
  }

  /**
   * Get single channel by ID
   */
  async getChannel(channelId: number): Promise<IPTVChannel | null> {
    const { data, error } = await supabase
      .from('iptv_channels')
      .select('*')
      .eq('id', channelId)
      .single();

    if (error) {
      console.error('[IPTVService] Error fetching channel:', error);
      return null;
    }

    return data as IPTVChannel;
  }

  /**
   * Get channel by slug
   */
  async getChannelBySlug(slug: string): Promise<IPTVChannel | null> {
    const { data, error } = await supabase
      .from('iptv_channels')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('[IPTVService] Error fetching channel by slug:', error);
      return null;
    }

    return data as IPTVChannel;
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('iptv_channels')
      .select('category')
      .not('category', 'is', null)
      .eq('is_healthy', true);

    if (error) {
      console.error('[IPTVService] Error fetching categories:', error);
      return [];
    }

    const unique = [...new Set(data.map(c => c.category))].filter(Boolean) as string[];
    return unique.sort();
  }

  /**
   * Get channels grouped by category
   */
  async getChannelsGrouped(options: {
    healthyOnly?: boolean;
    contentType?: string;
  } = {}): Promise<ChannelGroup[]> {
    const { healthyOnly = true, contentType } = options;

    let query = supabase
      .from('iptv_channels')
      .select('*')
      .order('category')
      .order('name');

    if (healthyOnly) {
      query = query.eq('is_healthy', true);
    }
    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[IPTVService] Error fetching grouped channels:', error);
      return [];
    }

    // Group by category
    const groups: Record<string, IPTVChannel[]> = {};
    for (const channel of (data || []) as IPTVChannel[]) {
      const cat = channel.category || 'Sem Categoria';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(channel);
    }

    return Object.entries(groups).map(([name, channels]) => ({ name, channels }));
  }

  /**
   * Get playback URL for a channel
   */
  async getPlaybackUrl(channelId: number): Promise<PlaybackInfo | null> {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.access_token) {
        console.error('[IPTVService] No auth session');
        return null;
      }

      const response = await fetch(
        `${this.baseUrl}/functions/v1/iptv-play?channelId=${channelId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('[IPTVService] Playback error:', error);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[IPTVService] Error getting playback URL:', error);
      return null;
    }
  }

  /**
   * Get user's playlists
   */
  async getUserPlaylists(): Promise<IPTVPlaylist[]> {
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user?.id) {
      return [];
    }

    const { data, error } = await supabase
      .from('iptv_playlists')
      .select('*')
      .or(`user_id.eq.${session.session.user.id},is_public.eq.true`)
      .order('name');

    if (error) {
      console.error('[IPTVService] Error fetching playlists:', error);
      return [];
    }

    return (data || []) as IPTVPlaylist[];
  }

  /**
   * Get channels in a playlist
   */
  async getPlaylistChannels(playlistId: number): Promise<IPTVChannel[]> {
    const { data, error } = await supabase
      .from('iptv_playlist_channels')
      .select(`
        position,
        custom_name,
        custom_logo,
        is_hidden,
        channel:iptv_channels(*)
      `)
      .eq('playlist_id', playlistId)
      .eq('is_hidden', false)
      .order('position');

    if (error) {
      console.error('[IPTVService] Error fetching playlist channels:', error);
      return [];
    }

    return (data || []).map(item => ({
      ...item.channel,
      name: item.custom_name || item.channel.name,
      logo_url: item.custom_logo || item.channel.logo_url,
    })) as IPTVChannel[];
  }

  /**
   * Generate M3U playlist URL
   */
  async getM3UPlaylistUrl(playlistId?: number): Promise<string | null> {
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.access_token) {
      return null;
    }

    let url = `${this.baseUrl}/functions/v1/iptv-playlist?type=m3u`;
    if (playlistId) {
      url += `&playlistId=${playlistId}`;
    }

    return url;
  }

  /**
   * Get channel stats
   */
  async getStats(): Promise<{
    total: number;
    healthy: number;
    unhealthy: number;
    live: number;
    vod: number;
  }> {
    const [total, healthy, unhealthy, live, vod] = await Promise.all([
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }),
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_healthy', true),
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_healthy', false),
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('content_type', 'live'),
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('content_type', 'vod'),
    ]);

    return {
      total: total.count || 0,
      healthy: healthy.count || 0,
      unhealthy: unhealthy.count || 0,
      live: live.count || 0,
      vod: vod.count || 0,
    };
  }
}

export const iptvService = new IPTVService();
