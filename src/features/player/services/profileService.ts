/**
 * Profile Service - Manages user profiles
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
   * Get current active profile
   */
  async getCurrentProfile(): Promise<UserProfile | null> {
    // Check memory cache
    if (this.currentProfileId) {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', this.currentProfileId)
        .single();
      
      if (data) return mapDbProfile(data);
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
        return mapDbProfile(data);
      }
    }

    // Get default profile
    const profiles = await this.getProfiles();
    const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
    
    if (defaultProfile) {
      this.setCurrentProfile(defaultProfile.id);
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
