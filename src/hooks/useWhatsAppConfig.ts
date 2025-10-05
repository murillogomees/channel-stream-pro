import { useState, useEffect } from 'react';
import { WhatsAppConfig } from '@/types/whatsapp';

const DEFAULT_CONFIG: WhatsAppConfig = {
  appkey: '',
  authkey: '',
  enabled: false,
  autoSendEnabled: false,
  sendHour: 9,
  daysToNotify: [-5, -4, -3, -2, 0, 1, 2, 3, 4, 5],
};

export function useWhatsAppConfig() {
  const [config, setConfig] = useState<WhatsAppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const stored = localStorage.getItem('whatsapp_config');
    if (stored) {
      try {
        setConfig(JSON.parse(stored));
      } catch (error) {
        console.error('Erro ao carregar configuração WhatsApp:', error);
      }
    }
  }, []);

  const saveConfig = (newConfig: Partial<WhatsAppConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem('whatsapp_config', JSON.stringify(updated));
  };

  const isConfigured = () => {
    return config.appkey.length > 0 && config.authkey.length > 0;
  };

  return {
    config,
    saveConfig,
    isConfigured: isConfigured(),
  };
}
