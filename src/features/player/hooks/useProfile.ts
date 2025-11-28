/**
 * useProfile - Hook for managing user profiles
 */

import { useState, useEffect, useCallback } from 'react';
import { profileService } from '../services/profileService';
import type { UserProfile, ProfileType } from '../types';

export function useProfile() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allProfiles, current] = await Promise.all([
        profileService.getProfiles(),
        profileService.getCurrentProfile(),
      ]);
      setProfiles(allProfiles);
      setCurrentProfile(current);
    } catch (error) {
      console.error('[useProfile] Error loading profiles:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const switchProfile = useCallback(async (profileId: string) => {
    profileService.setCurrentProfile(profileId);
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setCurrentProfile(profile);
    }
  }, [profiles]);

  const createProfile = useCallback(async (
    name: string,
    type: ProfileType = 'adult',
    avatarUrl?: string
  ) => {
    const newProfile = await profileService.createProfile(name, type, avatarUrl);
    if (newProfile) {
      setProfiles(prev => [...prev, newProfile]);
    }
    return newProfile;
  }, []);

  return {
    profiles,
    currentProfile,
    isLoading,
    switchProfile,
    createProfile,
    refresh: loadProfiles,
  };
}

export default useProfile;
