/**
 * Favorites Service - Manages user favorites and watchlist
 */

import { supabase } from '@/integrations/supabase/client';
import { profileService } from './profileService';
import type { FavoriteItem, WatchlistItem, ContentType } from '../types';

class FavoritesService {
  private favoritesCache: Set<string> = new Set();
  private watchlistCache: Set<string> = new Set();
  private initialized = false;

  /**
   * Initialize cache
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const profile = await profileService.getCurrentProfile();
    if (!profile) return;

    // Load favorites
    const { data: favorites } = await supabase
      .from('user_favorites')
      .select('content_id')
      .eq('profile_id', profile.id);

    if (favorites) {
      this.favoritesCache = new Set(favorites.map(f => f.content_id));
    }

    // Load watchlist
    const { data: watchlist } = await supabase
      .from('user_watchlist')
      .select('content_id')
      .eq('profile_id', profile.id);

    if (watchlist) {
      this.watchlistCache = new Set(watchlist.map(w => w.content_id));
    }

    this.initialized = true;
  }

  /**
   * Check if content is favorite
   */
  isFavorite(contentId: string): boolean {
    return this.favoritesCache.has(contentId);
  }

  /**
   * Check if content is in watchlist
   */
  isInWatchlist(contentId: string): boolean {
    return this.watchlistCache.has(contentId);
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(
    contentId: string,
    contentType: ContentType,
    contentName: string,
    options?: {
      contentLogo?: string;
      contentCategory?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<boolean> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return false;

    const isFav = this.isFavorite(contentId);

    if (isFav) {
      // Remove from favorites
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('profile_id', profile.id)
        .eq('content_id', contentId);

      if (!error) {
        this.favoritesCache.delete(contentId);
        return true;
      }
    } else {
      // Add to favorites
      const { error } = await supabase
        .from('user_favorites')
        .insert({
          profile_id: profile.id,
          content_id: contentId,
          content_type: contentType,
          content_name: contentName,
          content_logo: options?.contentLogo,
          content_category: options?.contentCategory,
          metadata: options?.metadata || {},
        });

      if (!error) {
        this.favoritesCache.add(contentId);
        return true;
      }
    }

    return false;
  }

  /**
   * Get all favorites
   */
  async getFavorites(): Promise<FavoriteItem[]> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('user_favorites')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FavoritesService] Error getting favorites:', error);
      return [];
    }

    return data as FavoriteItem[];
  }

  /**
   * Toggle watchlist status
   */
  async toggleWatchlist(
    contentId: string,
    contentType: ContentType,
    contentName: string,
    options?: {
      contentLogo?: string;
      contentCategory?: string;
      tmdbId?: string;
      imdbRating?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<boolean> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return false;

    const isInList = this.isInWatchlist(contentId);

    if (isInList) {
      // Remove from watchlist
      const { error } = await supabase
        .from('user_watchlist')
        .delete()
        .eq('profile_id', profile.id)
        .eq('content_id', contentId);

      if (!error) {
        this.watchlistCache.delete(contentId);
        return true;
      }
    } else {
      // Add to watchlist
      const { error } = await supabase
        .from('user_watchlist')
        .insert({
          profile_id: profile.id,
          content_id: contentId,
          content_type: contentType,
          content_name: contentName,
          content_logo: options?.contentLogo,
          content_category: options?.contentCategory,
          tmdb_id: options?.tmdbId,
          imdb_rating: options?.imdbRating,
          metadata: options?.metadata || {},
        });

      if (!error) {
        this.watchlistCache.add(contentId);
        return true;
      }
    }

    return false;
  }

  /**
   * Get watchlist
   */
  async getWatchlist(): Promise<WatchlistItem[]> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('user_watchlist')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FavoritesService] Error getting watchlist:', error);
      return [];
    }

    return data as WatchlistItem[];
  }

  /**
   * Reset cache (on profile switch)
   */
  resetCache(): void {
    this.favoritesCache.clear();
    this.watchlistCache.clear();
    this.initialized = false;
  }
}

export const favoritesService = new FavoritesService();
export default favoritesService;
