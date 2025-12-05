/**
 * ViewerProfileContext - Provides shared profile state to avoid redundant queries
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { profileService } from '@/features/player/services/profileService';
import type { UserProfile } from '@/features/player/types';

interface ViewerProfileContextType {
  profile: UserProfile | null;
  profileId: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setProfile: (profile: UserProfile) => void;
}

const ViewerProfileContext = createContext<ViewerProfileContextType>({
  profile: null,
  profileId: null,
  isLoading: true,
  error: null,
  refresh: async () => {},
  setProfile: () => {},
});

export function ViewerProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const currentProfile = await profileService.getCurrentProfile();
      setProfileState(currentProfile);
    } catch (err) {
      console.error('[ViewerProfileContext] Error loading profile:', err);
      setError(err instanceof Error ? err : new Error('Failed to load profile'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const setProfile = useCallback((newProfile: UserProfile) => {
    setProfileState(newProfile);
    profileService.setCurrentProfile(newProfile.id);
  }, []);

  const value = useMemo(() => ({
    profile,
    profileId: profile?.id || null,
    isLoading,
    error,
    refresh: loadProfile,
    setProfile,
  }), [profile, isLoading, error, loadProfile, setProfile]);

  return (
    <ViewerProfileContext.Provider value={value}>
      {children}
    </ViewerProfileContext.Provider>
  );
}

/**
 * Hook to access viewer profile from context
 * Use this instead of calling profileService.getCurrentProfile() directly
 */
export function useViewerProfile(): ViewerProfileContextType {
  const context = useContext(ViewerProfileContext);
  if (!context) {
    throw new Error('useViewerProfile must be used within ViewerProfileProvider');
  }
  return context;
}

export default ViewerProfileContext;
