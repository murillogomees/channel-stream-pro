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
  adminPhones: [], // Telefones de administradores para alertas de vencimento
};

export function useWhatsAppConfig() {
  const [config, setConfig] = useState<WhatsAppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const stored = localStorage.getItem('whatsapp_config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const safe: WhatsAppConfig = {
          ...DEFAULT_CONFIG,
          ...parsed,
          sendHour: Number.isFinite(Number(parsed?.sendHour)) ? Number(parsed.sendHour) : DEFAULT_CONFIG.sendHour,
          daysToNotify: Array.isArray(parsed?.daysToNotify)
            ? parsed.daysToNotify.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
            : DEFAULT_CONFIG.daysToNotify,
          testContacts: Array.isArray(parsed?.testContacts) ? parsed.testContacts : [],
          adminPhones: Array.isArray(parsed?.adminPhones) ? parsed.adminPhones : [],
        };
        setConfig(safe);
        localStorage.setItem('whatsapp_config', JSON.stringify(safe));
      } catch (error) {
        console.error('Erro ao carregar configuração WhatsApp:', error);
      }
    }
  }, []);

  const saveConfig = (newConfig: Partial<WhatsAppConfig>) => {
    const merged = { ...config, ...newConfig } as Partial<WhatsAppConfig>;
    const updated: WhatsAppConfig = {
      ...DEFAULT_CONFIG,
      ...merged,
      sendHour: Number.isFinite(Number(merged.sendHour)) ? Number(merged.sendHour) : DEFAULT_CONFIG.sendHour,
      daysToNotify: Array.isArray(merged.daysToNotify)
        ? merged.daysToNotify.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : DEFAULT_CONFIG.daysToNotify,
      testContacts: Array.isArray(merged.testContacts) ? merged.testContacts as TestContact[] : [],
      adminPhones: Array.isArray(merged.adminPhones) ? merged.adminPhones : [],
    };
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
    const current = Array.isArray(config.testContacts) ? config.testContacts : [];
    const updated: WhatsAppConfig = {
      ...config,
      testContacts: [...current, newContact],
    };
    setConfig(updated);
    localStorage.setItem('whatsapp_config', JSON.stringify(updated));
    return newContact;
  };

  const removeTestContact = (id: string) => {
    const current = Array.isArray(config.testContacts) ? config.testContacts : [];
    const updated: WhatsAppConfig = {
      ...config,
      testContacts: current.filter(c => c.id !== id),
    };
    setConfig(updated);
    localStorage.setItem('whatsapp_config', JSON.stringify(updated));
  };

  const updateTestContact = (id: string, data: Partial<TestContact>) => {
    const current = Array.isArray(config.testContacts) ? config.testContacts : [];
    const updated: WhatsAppConfig = {
      ...config,
      testContacts: current.map(c =>
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
