/**
 * Resume Service - Local Storage Only
 * Simplified version without non-existent database tables
 */

import { authCache } from '@/services/authCacheService';
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
   * Save progress (local only)
   */
  async saveProgress(progress: ResumeProgress): Promise<void> {
    const key = progress.contentId;
    
    progress.updatedAt = new Date().toISOString();
    this.localCache.set(key, progress);
    this.saveLocalCache();
  }

  /**
   * Get progress (local only)
   */
  async getProgress(contentId: string): Promise<ResumeProgress | null> {
    const localProgress = this.localCache.get(contentId);
    if (localProgress) {
      return localProgress;
    }
    return null;
  }

  /**
   * Get all resume points (for continue watching)
   */
  async getAllProgress(limit = 20): Promise<ResumeProgress[]> {
    return Array.from(this.localCache.values())
      .filter(p => p.progressSeconds > 0 && p.progressSeconds < p.durationSeconds * 0.95)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  /**
   * Sync to server (placeholder)
   */
  async syncToServer(): Promise<void> {
    console.log('[ResumeService] Sync to server not available');
  }

  /**
   * Clear progress for content
   */
  async clearProgress(contentId: string): Promise<void> {
    this.localCache.delete(contentId);
    this.saveLocalCache();
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
