import { useState, useEffect } from 'react';
import siteConfigData from '@/data/site-config.json';

export type SiteConfig = typeof siteConfigData;

export const useSiteConfig = () => {
  const [config, setConfig] = useState<SiteConfig>(siteConfigData);
  const [loading, setLoading] = useState(false);

  const updateConfig = (newConfig: SiteConfig) => {
    setConfig(newConfig);
    // In a real implementation, this would save to a file or API
    localStorage.setItem('siteConfig', JSON.stringify(newConfig));
  };

  const resetConfig = () => {
    setConfig(siteConfigData);
    localStorage.removeItem('siteConfig');
  };

  useEffect(() => {
    // Load from localStorage if available
    const savedConfig = localStorage.getItem('siteConfig');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Error loading saved config:', error);
      }
    }
  }, []);

  return {
    config,
    updateConfig,
    resetConfig,
    loading
  };
};