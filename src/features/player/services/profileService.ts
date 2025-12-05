/**
 * Profile Service - Manages user profiles with caching and deduplication
 */

import { supabase } from '@/integrations/supabase/client';
import type { UserProfile, ProfilePreferences, ProfileType } from '../types';

// Helper to convert DB profile to typed profile
function mapDbProfile(data: any): UserProfile {
  return {
    ...data,
    profile_type: data.profile_type as ProfileType,
    preferences: (data.preferences || {}) as ProfilePreferences,
  };
}

class ProfileService {
  private currentProfileId: string | null = null;
  
  // Cache for current profile to avoid redundant queries
  private cachedProfile: UserProfile | null = null;
  private profileCacheTimestamp: number = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds
  
  // Deduplication: prevent multiple simultaneous requests
  private profileLoadPromise: Promise<UserProfile | null> | null = null;

  /**
   * Get all profiles for current user
   */
  async getProfiles(): Promise<UserProfile[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });

    if (error) {
      console.error('[ProfileService] Error fetching profiles:', error);
      return [];
    }

    return (data || []).map(mapDbProfile);
  }

  /**
   * Get current active profile with caching and deduplication
   */
  async getCurrentProfile(): Promise<UserProfile | null> {
    // Return from cache if still valid
    if (this.cachedProfile && Date.now() - this.profileCacheTimestamp < this.CACHE_TTL) {
      return this.cachedProfile;
    }

    // Deduplicate simultaneous requests
    if (this.profileLoadPromise) {
      return this.profileLoadPromise;
    }

    this.profileLoadPromise = this._fetchCurrentProfile();
    
    try {
      const result = await this.profileLoadPromise;
      return result;
    } finally {
      this.profileLoadPromise = null;
    }
  }

  /**
   * Internal method to fetch current profile
   */
  private async _fetchCurrentProfile(): Promise<UserProfile | null> {
    // Check memory cache for ID
    if (this.currentProfileId) {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', this.currentProfileId)
        .single();
      
      if (data) {
        this.cachedProfile = mapDbProfile(data);
        this.profileCacheTimestamp = Date.now();
        return this.cachedProfile;
      }
    }

    // Check localStorage
    const storedId = localStorage.getItem('iptv_current_profile');
    if (storedId) {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', storedId)
        .single();
      
      if (data) {
        this.currentProfileId = data.id;
        this.cachedProfile = mapDbProfile(data);
        this.profileCacheTimestamp = Date.now();
        return this.cachedProfile;
      }
    }

    // Get default profile
    const profiles = await this.getProfiles();
    const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
    
    if (defaultProfile) {
      this.setCurrentProfile(defaultProfile.id);
      this.cachedProfile = defaultProfile;
      this.profileCacheTimestamp = Date.now();
      return defaultProfile;
    }

    return null;
  }

  /**
   * Set current active profile
   */
  setCurrentProfile(profileId: string): void {
    this.currentProfileId = profileId;
    localStorage.setItem('iptv_current_profile', profileId);
    // Invalidate cache to force reload on next getCurrentProfile
    this.cachedProfile = null;
    this.profileCacheTimestamp = 0;
  }

  /**
   * Invalidate cache (call when profile changes externally)
   */
  invalidateCache(): void {
    this.cachedProfile = null;
    this.profileCacheTimestamp = 0;
  }

  /**
   * Get cached profile ID without async call
   */
  getCachedProfileId(): string | null {
    return this.currentProfileId || localStorage.getItem('iptv_current_profile');
  }

  /**
   * Create a new profile
   */
  async createProfile(
    name: string,
    profileType: ProfileType = 'adult',
    avatarUrl?: string
  ): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        name,
        profile_type: profileType,
        avatar_url: avatarUrl,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[ProfileService] Error creating profile:', error);
      return null;
    }

    return mapDbProfile(data);
  }

  /**
   * Update profile
   */
  async updateProfile(
    profileId: string,
    updates: Partial<Pick<UserProfile, 'name' | 'avatar_url' | 'profile_type' | 'pin_code' | 'preferences'>>
  ): Promise<UserProfile | null> {
    const dbUpdates: any = { ...updates };
    if (updates.preferences) {
      dbUpdates.preferences = updates.preferences as any;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update(dbUpdates)
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      console.error('[ProfileService] Error updating profile:', error);
      return null;
    }

    // Invalidate cache if updating current profile
    if (this.currentProfileId === profileId) {
      this.invalidateCache();
    }

    return mapDbProfile(data);
  }

  /**
   * Delete profile
   */
  async deleteProfile(profileId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', profileId);

    if (error) {
      console.error('[ProfileService] Error deleting profile:', error);
      return false;
    }

    // Clear if it was current
    if (this.currentProfileId === profileId) {
      this.currentProfileId = null;
      localStorage.removeItem('iptv_current_profile');
      this.invalidateCache();
    }

    return true;
  }

  /**
   * Verify PIN code
   */
  async verifyPin(profileId: string, pin: string): Promise<boolean> {
    const { data } = await supabase
      .from('user_profiles')
      .select('pin_code')
      .eq('id', profileId)
      .single();

    return data?.pin_code === pin;
  }

  /**
   * Set profile as default
   */
  async setDefaultProfile(profileId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Remove default from all profiles
    await supabase
      .from('user_profiles')
      .update({ is_default: false })
      .eq('user_id', user.id);

    // Set new default
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_default: true })
      .eq('id', profileId);

    return !error;
  }
}

export const profileService = new ProfileService();
export default profileService;
