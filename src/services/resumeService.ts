/**
 * Resume Service
 * Uses watch_progress table with local storage fallback
 */

import { authCache } from '@/services/authCacheService';
import { supabase } from '@/lib/supabase';

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
  private saveDebounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.loadLocalCache();
  }

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

  private saveLocalCache(): void {
    try {
      const entries: Record<string, ResumeProgress> = {};
      
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

  private async getUserId(): Promise<string | null> {
    const cachedId = authCache.getUserId();
    if (cachedId) return cachedId;
    
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }

  /**
   * Save progress to database and local cache
   */
  async saveProgress(progress: ResumeProgress): Promise<void> {
    const key = progress.contentId;
    progress.updatedAt = new Date().toISOString();
    
    // Save to local cache first
    this.localCache.set(key, progress);
    this.saveLocalCache();

    // Try to save to database
    try {
      const userId = await this.getUserId();
      if (!userId) return;

      const { error } = await supabase
        .from('watch_progress')
        .upsert({
          user_id: userId,
          content_id: progress.contentId,
          content_type: progress.contentType,
          progress_seconds: progress.progressSeconds,
          duration_seconds: progress.durationSeconds,
          completed: progress.progressSeconds >= progress.durationSeconds * 0.95,
          last_watched_at: progress.updatedAt,
        }, {
          onConflict: 'user_id,content_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.warn('[ResumeService] Failed to save to DB:', error.message);
      }
    } catch (error) {
      console.warn('[ResumeService] Error saving to DB:', error);
    }
  }

  /**
   * Get progress from database or local cache
   */
  async getProgress(contentId: string): Promise<ResumeProgress | null> {
    // Check local cache first
    const localProgress = this.localCache.get(contentId);

    // Try database
    try {
      const userId = await this.getUserId();
      if (userId) {
        const { data, error } = await supabase
          .from('watch_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('content_id', contentId)
          .maybeSingle();

        if (!error && data) {
          const progress: ResumeProgress = {
            contentId: data.content_id,
            contentType: (data.content_type as ResumeProgress['contentType']) || 'movie',
            contentName: '',
            progressSeconds: data.progress_seconds || 0,
            durationSeconds: data.duration_seconds || 0,
            updatedAt: data.last_watched_at || data.updated_at,
          };

          // Update local cache
          this.localCache.set(contentId, progress);
          this.saveLocalCache();

          return progress;
        }
      }
    } catch (error) {
      console.warn('[ResumeService] Error getting from DB:', error);
    }

    return localProgress || null;
  }

  /**
   * Get all resume points (for continue watching)
   */
  async getAllProgress(limit = 20): Promise<ResumeProgress[]> {
    try {
      const userId = await this.getUserId();
      if (userId) {
        const { data, error } = await supabase
          .from('watch_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('completed', false)
          .gt('progress_seconds', 0)
          .order('last_watched_at', { ascending: false })
          .limit(limit);

        if (!error && data?.length) {
          return data.map(item => ({
            contentId: item.content_id,
            contentType: (item.content_type as ResumeProgress['contentType']) || 'movie',
            contentName: '',
            progressSeconds: item.progress_seconds || 0,
            durationSeconds: item.duration_seconds || 0,
            updatedAt: item.last_watched_at || item.updated_at,
          }));
        }
      }
    } catch (error) {
      console.warn('[ResumeService] Error getting all progress from DB:', error);
    }

    // Fallback to local cache
    return Array.from(this.localCache.values())
      .filter(p => p.progressSeconds > 0 && p.progressSeconds < p.durationSeconds * 0.95)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Clear progress for content
   */
  async clearProgress(contentId: string): Promise<void> {
    this.localCache.delete(contentId);
    this.saveLocalCache();

    try {
      const userId = await this.getUserId();
      if (userId) {
        await supabase
          .from('watch_progress')
          .delete()
          .eq('user_id', userId)
          .eq('content_id', contentId);
      }
    } catch (error) {
      console.warn('[ResumeService] Error clearing from DB:', error);
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
