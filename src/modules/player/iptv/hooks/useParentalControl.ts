/**
 * Parental Control Hook
 * 
 * PIN-based access control for adult content
 */

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'iptv-parental-control';
const PIN_HASH_KEY = 'iptv-parental-pin';
const SESSION_KEY = 'iptv-parental-session';
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

export interface ParentalControlState {
  isEnabled: boolean;
  isUnlocked: boolean;
  blockedCategories: string[];
  ageRating: number; // 0, 10, 12, 14, 16, 18
}

interface ParentalControlConfig {
  enabled: boolean;
  blockedCategories: string[];
  ageRating: number;
}

// Simple hash function for PIN (not cryptographically secure, but good enough for local storage)
function hashPin(pin: string): string {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

export function useParentalControl() {
  const [state, setState] = useState<ParentalControlState>({
    isEnabled: false,
    isUnlocked: false,
    blockedCategories: ['adult', 'xxx', '+18', 'adulto'],
    ageRating: 18,
  });

  // Load settings on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const session = sessionStorage.getItem(SESSION_KEY);
      
      if (stored) {
        const config: ParentalControlConfig = JSON.parse(stored);
        const isUnlocked = session ? Date.now() < parseInt(session) : false;
        
        setState({
          isEnabled: config.enabled,
          isUnlocked,
          blockedCategories: config.blockedCategories,
          ageRating: config.ageRating,
        });
      }
    } catch (e) {
      console.warn('[ParentalControl] Error loading settings:', e);
    }
  }, []);

  // Save config
  const saveConfig = useCallback((config: ParentalControlConfig) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('[ParentalControl] Error saving settings:', e);
    }
  }, []);

  // Set PIN
  const setPin = useCallback((pin: string): boolean => {
    if (pin.length < 4) return false;
    
    try {
      localStorage.setItem(PIN_HASH_KEY, hashPin(pin));
      return true;
    } catch (e) {
      console.warn('[ParentalControl] Error saving PIN:', e);
      return false;
    }
  }, []);

  // Verify PIN
  const verifyPin = useCallback((pin: string): boolean => {
    try {
      const storedHash = localStorage.getItem(PIN_HASH_KEY);
      if (!storedHash) return false;
      
      const isValid = hashPin(pin) === storedHash;
      
      if (isValid) {
        // Set session
        const expiresAt = Date.now() + SESSION_DURATION;
        sessionStorage.setItem(SESSION_KEY, expiresAt.toString());
        setState(s => ({ ...s, isUnlocked: true }));
      }
      
      return isValid;
    } catch (e) {
      console.warn('[ParentalControl] Error verifying PIN:', e);
      return false;
    }
  }, []);

  // Lock (end session)
  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setState(s => ({ ...s, isUnlocked: false }));
  }, []);

  // Enable/disable parental control
  const setEnabled = useCallback((enabled: boolean) => {
    setState(s => {
      const newState = { ...s, isEnabled: enabled };
      saveConfig({
        enabled: newState.isEnabled,
        blockedCategories: newState.blockedCategories,
        ageRating: newState.ageRating,
      });
      return newState;
    });
  }, [saveConfig]);

  // Set age rating
  const setAgeRating = useCallback((rating: number) => {
    setState(s => {
      const newState = { ...s, ageRating: rating };
      saveConfig({
        enabled: newState.isEnabled,
        blockedCategories: newState.blockedCategories,
        ageRating: newState.ageRating,
      });
      return newState;
    });
  }, [saveConfig]);

  // Set blocked categories
  const setBlockedCategories = useCallback((categories: string[]) => {
    setState(s => {
      const newState = { ...s, blockedCategories: categories };
      saveConfig({
        enabled: newState.isEnabled,
        blockedCategories: newState.blockedCategories,
        ageRating: newState.ageRating,
      });
      return newState;
    });
  }, [saveConfig]);

  // Check if content is blocked
  const isContentBlocked = useCallback((categoryName: string, contentRating?: number): boolean => {
    if (!state.isEnabled) return false;
    if (state.isUnlocked) return false;

    // Check category
    const lowerCategory = categoryName.toLowerCase();
    for (const blocked of state.blockedCategories) {
      if (lowerCategory.includes(blocked.toLowerCase())) {
        return true;
      }
    }

    // Check age rating
    if (contentRating && contentRating > state.ageRating) {
      return true;
    }

    return false;
  }, [state]);

  // Check if PIN is set
  const hasPinSet = useCallback((): boolean => {
    return !!localStorage.getItem(PIN_HASH_KEY);
  }, []);

  // Reset PIN (requires current PIN)
  const resetPin = useCallback((currentPin: string, newPin: string): boolean => {
    if (!verifyPin(currentPin)) return false;
    return setPin(newPin);
  }, [verifyPin, setPin]);

  return {
    state,
    setPin,
    verifyPin,
    lock,
    setEnabled,
    setAgeRating,
    setBlockedCategories,
    isContentBlocked,
    hasPinSet,
    resetPin,
  };
}

export default useParentalControl;
