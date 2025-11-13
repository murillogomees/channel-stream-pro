import { useState, useEffect } from 'react';
import { WhatsAppConfig, TestContact } from '@/types/whatsapp';

const DEFAULT_CONFIG: WhatsAppConfig = {
  appkey: '',
  authkey: '',
  enabled: false,
  autoSendEnabled: false,
  sendHour: 10,
  daysToNotify: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
  testPhoneNumber: '5561996975924',
  testContacts: [],
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

  const addTestContact = (name: string, phone: string) => {
    const newContact: TestContact = {
      id: crypto.randomUUID(),
      name,
      phone,
      addedAt: new Date().toISOString(),
    };
    const updated = {
      ...config,
      testContacts: [...config.testContacts, newContact],
    };
    setConfig(updated);
    localStorage.setItem('whatsapp_config', JSON.stringify(updated));
    return newContact;
  };

  const removeTestContact = (id: string) => {
    const updated = {
      ...config,
      testContacts: config.testContacts.filter(c => c.id !== id),
    };
    setConfig(updated);
    localStorage.setItem('whatsapp_config', JSON.stringify(updated));
  };

  const updateTestContact = (id: string, data: Partial<TestContact>) => {
    const updated = {
      ...config,
      testContacts: config.testContacts.map(c =>
        c.id === id ? { ...c, ...data } : c
      ),
    };
    setConfig(updated);
    localStorage.setItem('whatsapp_config', JSON.stringify(updated));
  };

  return {
    config,
    saveConfig,
    isConfigured: isConfigured(),
    addTestContact,
    removeTestContact,
    updateTestContact,
  };
}
