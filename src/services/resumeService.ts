/**
 * Resume Service - Server-side + Local Fallback
 * 
 * Handles watch progress persistence with:
 * - Server-side storage for authenticated users
 * - Local storage fallback for guests or offline
 */

import { supabase } from '@/integrations/supabase/client';

const LOCAL_STORAGE_KEY = 'iptv_resume_progress';
const MAX_LOCAL_ENTRIES = 100;

export interface ResumeProgress {
  contentId: string;
  contentType: 'live' | 'movie' | 'series' | 'episode';
  contentName: string;
  progressSeconds: number;
  durationSeconds: number;
  updatedAt: string;
  metadata?: Record<string, any>;
}

interface LocalProgressStore {
  entries: Record<string, ResumeProgress>;
  lastSync: string | null;
}

class ResumeService {
  private localCache: Map<string, ResumeProgress> = new Map();
  private pendingSaves: Set<string> = new Set();
  private saveDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.loadLocalCache();
  }

  /**
   * Load local cache from localStorage
   */
  private loadLocalCache(): void {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const data: LocalProgressStore = JSON.parse(stored);
        Object.entries(data.entries || {}).forEach(([key, value]) => {
          this.localCache.set(key, value);
        });
        console.log('[ResumeService] Loaded', this.localCache.size, 'local entries');
      }
    } catch (error) {
      console.warn('[ResumeService] Error loading local cache:', error);
    }
  }

  /**
   * Save local cache to localStorage
   */
  private saveLocalCache(): void {
    try {
      const entries: Record<string, ResumeProgress> = {};
      
      // Keep only most recent entries
      const sortedEntries = Array.from(this.localCache.entries())
        .sort((a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime())
        .slice(0, MAX_LOCAL_ENTRIES);
      
      sortedEntries.forEach(([key, value]) => {
        entries[key] = value;
      });

      const store: LocalProgressStore = {
        entries,
        lastSync: new Date().toISOString(),
      };

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      console.warn('[ResumeService] Error saving local cache:', error);
    }
  }

  /**
   * Get current user ID
   */
  private async getUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  /**
   * Get profile ID for current user
   */
  private async getProfileId(): Promise<string | null> {
    const userId = await this.getUserId();
    if (!userId) return null;

    const { data } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single();

    return data?.id || null;
  }

  /**
   * Save progress (server + local fallback)
   */
  async saveProgress(progress: ResumeProgress): Promise<void> {
    const key = progress.contentId;
    
    // Update local cache immediately
    progress.updatedAt = new Date().toISOString();
    this.localCache.set(key, progress);
    this.saveLocalCache();

    // Debounce server save
    if (this.saveDebounceTimers.has(key)) {
      clearTimeout(this.saveDebounceTimers.get(key)!);
    }

    this.saveDebounceTimers.set(key, setTimeout(async () => {
      await this.saveToServer(progress);
      this.saveDebounceTimers.delete(key);
    }, 5000)); // Save to server after 5 seconds of inactivity
  }

  /**
   * Save progress to server
   */
  private async saveToServer(progress: ResumeProgress): Promise<boolean> {
    const profileId = await this.getProfileId();
    
    if (!profileId) {
      console.log('[ResumeService] No profile, using local only');
      return false;
    }

    try {
      const { error } = await supabase.rpc('update_watch_progress', {
        p_profile_id: profileId,
        p_content_id: progress.contentId,
        p_content_type: progress.contentType,
        p_content_name: progress.contentName,
        p_content_logo: progress.metadata?.logo || null,
        p_content_category: progress.metadata?.category || null,
        p_progress_seconds: progress.progressSeconds,
        p_duration_seconds: progress.durationSeconds,
        p_metadata: progress.metadata || {},
      });

      if (error) {
        console.warn('[ResumeService] Server save failed:', error);
        return false;
      }

      console.log('[ResumeService] Saved to server:', progress.contentId);
      return true;
    } catch (error) {
      console.warn('[ResumeService] Server save error:', error);
      return false;
    }
  }

  /**
   * Get progress (server + local fallback)
   */
  async getProgress(contentId: string): Promise<ResumeProgress | null> {
    // Try server first for auth users
    const serverProgress = await this.getFromServer(contentId);
    
    if (serverProgress) {
      // Update local cache with server data
      this.localCache.set(contentId, serverProgress);
      this.saveLocalCache();
      return serverProgress;
    }

    // Fall back to local cache
    const localProgress = this.localCache.get(contentId);
    if (localProgress) {
      console.log('[ResumeService] Using local progress for:', contentId);
      return localProgress;
    }

    return null;
  }

  /**
   * Get progress from server
   */
  private async getFromServer(contentId: string): Promise<ResumeProgress | null> {
    const profileId = await this.getProfileId();
    if (!profileId) return null;

    try {
      const { data, error } = await supabase
        .from('watch_progress')
        .select('*')
        .eq('profile_id', profileId)
        .eq('content_id', contentId)
        .single();

      if (error || !data) return null;

      return {
        contentId: data.content_id,
        contentType: data.content_type as ResumeProgress['contentType'],
        contentName: data.content_name,
        progressSeconds: data.progress_seconds,
        durationSeconds: data.duration_seconds,
        updatedAt: data.updated_at,
        metadata: {
          logo: data.content_logo,
          category: data.content_category,
          ...(typeof data.metadata === 'object' && data.metadata !== null ? data.metadata : {}),
        },
      };
    } catch (error) {
      console.warn('[ResumeService] Server get error:', error);
      return null;
    }
  }

  /**
   * Get all resume points (for continue watching)
   */
  async getAllProgress(limit = 20): Promise<ResumeProgress[]> {
    // Try server first
    const profileId = await this.getProfileId();
    
    if (profileId) {
      try {
        const { data, error } = await supabase.rpc('get_continue_watching', {
          p_profile_id: profileId,
          p_limit: limit,
        });

        if (!error && data?.length > 0) {
          return data.map((item: any) => ({
            contentId: item.content_id,
            contentType: item.content_type,
            contentName: item.content_name,
            progressSeconds: item.progress_seconds,
            durationSeconds: item.duration_seconds,
            updatedAt: item.updated_at,
            metadata: {
              logo: item.content_logo,
              category: item.content_category,
            },
          }));
        }
      } catch (error) {
        console.warn('[ResumeService] Server get all error:', error);
      }
    }

    // Fall back to local cache
    return Array.from(this.localCache.values())
      .filter(p => p.progressSeconds > 0 && p.progressSeconds < p.durationSeconds * 0.95)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Sync local progress to server (call when user logs in)
   */
  async syncToServer(): Promise<void> {
    const profileId = await this.getProfileId();
    if (!profileId) return;

    console.log('[ResumeService] Syncing local progress to server...');
    
    const localEntries = Array.from(this.localCache.values());
    
    for (const progress of localEntries) {
      await this.saveToServer(progress);
    }

    console.log('[ResumeService] Synced', localEntries.length, 'entries');
  }

  /**
   * Clear progress for content
   */
  async clearProgress(contentId: string): Promise<void> {
    this.localCache.delete(contentId);
    this.saveLocalCache();

    const profileId = await this.getProfileId();
    if (profileId) {
      await supabase
        .from('watch_progress')
        .delete()
        .eq('profile_id', profileId)
        .eq('content_id', contentId);
    }
  }

  /**
   * Clear all local progress
   */
  clearLocalProgress(): void {
    this.localCache.clear();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}

export const resumeService = new ResumeService();
export default resumeService;
