import { useState, useEffect } from 'react';
import settingsData from '@/data/settings.json';

export type Settings = typeof settingsData;

// Token resolver for references like $theme.colors.primary
const resolveToken = (value: string, settings: Settings): string => {
  if (typeof value !== 'string' || !value.startsWith('$')) {
    return value;
  }
  
  const path = value.substring(1).split('.');
  let current: any = settings;
  
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      console.warn(`Token reference not found: ${value}`);
      return value; // Return original if path not found
    }
  }
  
  return typeof current === 'string' ? current : value;
};

// Apply CSS variables from settings to document root
const applyCSSVariables = (settings: Settings) => {
  const root = document.documentElement;
  
  // Apply color tokens to match index.css structure
  Object.entries(settings.theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  
  // Apply gradients
  Object.entries(settings.theme.gradients).forEach(([key, value]) => {
    root.style.setProperty(`--gradient-${key}`, resolveToken(value, settings));
  });
  
  // Apply typography
  root.style.setProperty('--font-family-base', settings.typography.fontFamily);
  
  // Apply layout tokens
  root.style.setProperty('--container-max-width', settings.layout.container.maxWidth);
  root.style.setProperty('--container-padding', settings.layout.container.padding);
  
  // Force a repaint to ensure changes are applied
  root.style.display = 'none';
  root.offsetHeight; // Trigger reflow
  root.style.display = '';
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(settingsData);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const updateSettings = (newSettings: Settings) => {
    // Always allow updates from admin panel
    setSettings(newSettings);
    applyCSSVariables(newSettings);
    
    // Save to localStorage
    localStorage.setItem('settings', JSON.stringify(newSettings));
    setLastUpdated(new Date());
    
    console.log('Settings updated and applied:', newSettings);
  };

  const resetSettings = () => {
    setSettings(settingsData);
    applyCSSVariables(settingsData);
    localStorage.removeItem('settings');
    setLastUpdated(new Date());
    console.log('Settings reset to default');
  };

  const getToken = (path: string): string => {
    return resolveToken(`$${path}`, settings);
  };

  const getColor = (colorKey: string): string => {
    return settings.theme.colors[colorKey as keyof typeof settings.theme.colors] || colorKey;
  };

  const getTypography = (element: keyof typeof settings.typography) => {
    return settings.typography[element];
  };

  const getIcon = (iconKey: string): string => {
    return settings.icons[iconKey as keyof typeof settings.icons] || iconKey;
  };

  const getAsset = (assetKey: string): string => {
    const asset = settings.assets[assetKey as keyof typeof settings.assets];
    return asset || settings.assets.fallback;
  };

  useEffect(() => {
    // Load from localStorage if available
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        applyCSSVariables(parsed);
        console.log('Loaded settings from localStorage:', parsed);
        return;
      } catch (error) {
        console.error('Error loading saved settings:', error);
      }
    }
    
    // Apply default settings on mount
    applyCSSVariables(settingsData);
    console.log('Applied default settings:', settingsData);
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    getToken,
    getColor,
    getTypography,
    getIcon,
    getAsset,
    loading,
    lastUpdated
  };
};