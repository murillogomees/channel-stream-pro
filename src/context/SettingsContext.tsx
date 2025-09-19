import React, { createContext, useContext, ReactNode } from 'react';
import { useSettings, Settings } from '@/hooks/useSettings';

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  resetSettings: () => void;
  getToken: (path: string) => string;
  getColor: (colorKey: string) => string;
  getTypography: (element: keyof Settings['typography']) => any;
  getIcon: (iconKey: string) => string;
  getAsset: (assetKey: string) => string;
  loading: boolean;
  lastUpdated: Date | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const settingsHook = useSettings();

  return (
    <SettingsContext.Provider value={settingsHook}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettingsContext = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
};