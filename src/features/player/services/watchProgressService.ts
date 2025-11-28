/**
 * Watch Progress Service - Tracks viewing progress
 */

import { supabase } from '@/integrations/supabase/client';
import { profileService } from './profileService';
import type { WatchProgress, WatchHistoryItem, ContentType } from '../types';

class WatchProgressService {
  /**
   * Update watch progress for content
   */
  async updateProgress(
    contentId: string,
    contentType: ContentType,
    contentName: string,
    progressSeconds: number,
    durationSeconds: number,
    options?: {
      contentLogo?: string;
      contentCategory?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<WatchProgress | null> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return null;

    const { data, error } = await supabase.rpc('update_watch_progress', {
      p_profile_id: profile.id,
      p_content_id: contentId,
      p_content_type: contentType,
      p_content_name: contentName,
      p_content_logo: options?.contentLogo || null,
      p_content_category: options?.contentCategory || null,
      p_progress_seconds: progressSeconds,
      p_duration_seconds: durationSeconds,
      p_metadata: options?.metadata || {},
    });

    if (error) {
      console.error('[WatchProgressService] Error updating progress:', error);
      return null;
    }

    return data as WatchProgress;
  }

  /**
   * Get continue watching list
   */
  async getContinueWatching(limit = 20): Promise<WatchProgress[]> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return [];

    const { data, error } = await supabase.rpc('get_continue_watching', {
      p_profile_id: profile.id,
      p_limit: limit,
    });

    if (error) {
      console.error('[WatchProgressService] Error getting continue watching:', error);
      return [];
    }

    return data as WatchProgress[];
  }

  /**
   * Get progress for specific content
   */
  async getProgress(contentId: string): Promise<WatchProgress | null> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return null;

    const { data, error } = await supabase
      .from('watch_progress')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('content_id', contentId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[WatchProgressService] Error getting progress:', error);
    }

    return data as WatchProgress | null;
  }

  /**
   * Mark content as completed
   */
  async markCompleted(contentId: string): Promise<boolean> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return false;

    const { error } = await supabase
      .from('watch_progress')
      .update({ completed: true })
      .eq('profile_id', profile.id)
      .eq('content_id', contentId);

    return !error;
  }

  /**
   * Remove from continue watching
   */
  async removeFromContinueWatching(contentId: string): Promise<boolean> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return false;

    const { error } = await supabase
      .from('watch_progress')
      .delete()
      .eq('profile_id', profile.id)
      .eq('content_id', contentId);

    return !error;
  }

  /**
   * Add to watch history
   */
  async addToHistory(
    contentId: string,
    contentType: ContentType,
    contentName: string,
    durationSeconds: number,
    options?: {
      contentLogo?: string;
      contentCategory?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<boolean> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return false;

    const { error } = await supabase
      .from('watch_history')
      .insert({
        profile_id: profile.id,
        content_id: contentId,
        content_type: contentType,
        content_name: contentName,
        content_logo: options?.contentLogo,
        content_category: options?.contentCategory,
        duration_seconds: durationSeconds,
        metadata: options?.metadata || {},
      });

    if (error) {
      console.error('[WatchProgressService] Error adding to history:', error);
      return false;
    }

    return true;
  }

  /**
   * Get watch history
   */
  async getHistory(limit = 50): Promise<WatchHistoryItem[]> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('watch_history')
      .select('*')
      .eq('profile_id', profile.id)
      .order('watched_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[WatchProgressService] Error getting history:', error);
      return [];
    }

    return data as WatchHistoryItem[];
  }

  /**
   * Clear watch history
   */
  async clearHistory(): Promise<boolean> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return false;

    const { error } = await supabase
      .from('watch_history')
      .delete()
      .eq('profile_id', profile.id);

    return !error;
  }
}

export const watchProgressService = new WatchProgressService();
export default watchProgressService;
