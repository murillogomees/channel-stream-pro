/**
 * IPTV Service
 * Centralized service for IPTV channel management and playback
 * With caching layer for improved performance
 */

import { supabase } from '@/integrations/supabase/client';

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

// Cache configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

class IPTVService {
  private baseUrl = import.meta.env.VITE_SUPABASE_URL;
  private cache = new CacheManager();
  
  // Cache TTLs
  private readonly CATEGORIES_TTL = 60 * 60 * 1000; // 1 hour
  private readonly STATS_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly CHANNELS_TTL = 2 * 60 * 1000; // 2 minutes

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

    // Generate cache key based on options
    const cacheKey = `channels:${JSON.stringify(options)}`;
    const cached = this.cache.get<{ channels: IPTVChannel[]; total: number }>(cacheKey);
    if (cached) return cached;

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

    const result = { 
      channels: (data || []) as IPTVChannel[], 
      total: count || 0 
    };

    this.cache.set(cacheKey, result, this.CHANNELS_TTL);
    return result;
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
   * Get all categories with caching (1 hour TTL)
   */
  async getCategories(): Promise<string[]> {
    const cacheKey = 'categories:all';
    const cached = this.cache.get<string[]>(cacheKey);
    if (cached) {
      console.log('[IPTVService] Categories served from cache');
      return cached;
    }

    // Use distinct query with limit to avoid scanning entire table
    const { data, error } = await supabase
      .from('iptv_channels')
      .select('category')
      .not('category', 'is', null)
      .eq('is_healthy', true)
      .limit(10000);

    if (error) {
      console.error('[IPTVService] Error fetching categories:', error);
      return [];
    }

    const unique = [...new Set(data.map(c => c.category))].filter(Boolean) as string[];
    const sorted = unique.sort();

    this.cache.set(cacheKey, sorted, this.CATEGORIES_TTL);
    console.log(`[IPTVService] Categories cached: ${sorted.length} categories`);
    
    return sorted;
  }

  /**
   * Invalidate categories cache (call when categories change)
   */
  invalidateCategoriesCache(): void {
    this.cache.invalidate('categories');
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
   * Get channel stats with caching (5 min TTL)
   */
  async getStats(): Promise<{
    total: number;
    healthy: number;
    unhealthy: number;
    live: number;
    vod: number;
  }> {
    const cacheKey = 'stats:all';
    const cached = this.cache.get<{
      total: number;
      healthy: number;
      unhealthy: number;
      live: number;
      vod: number;
    }>(cacheKey);
    if (cached) return cached;

    const [total, healthy, unhealthy, live, vod] = await Promise.all([
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }),
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_healthy', true),
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_healthy', false),
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('content_type', 'live'),
      supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('content_type', 'vod'),
    ]);

    const result = {
      total: total.count || 0,
      healthy: healthy.count || 0,
      unhealthy: unhealthy.count || 0,
      live: live.count || 0,
      vod: vod.count || 0,
    };

    this.cache.set(cacheKey, result, this.STATS_TTL);
    return result;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.invalidate();
    console.log('[IPTVService] All caches cleared');
  }
}

export const iptvService = new IPTVService();
