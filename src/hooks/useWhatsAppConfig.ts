import { useState, useEffect } from 'react';
import { WhatsAppConfig, TestContact } from '@/types/whatsapp';
import { supabase } from '@/lib/supabase';

const DEFAULT_CONFIG: WhatsAppConfig = {
  appkey: '',
  authkey: '',
  enabled: false,
  autoSendEnabled: false,
  sendHour: 10,
  daysToNotify: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
  testPhoneNumber: '',
  testContacts: [],
  adminPhones: [],
};

export function useWhatsAppConfig() {
  const [config, setConfig] = useState<WhatsAppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // Load WhatsApp credentials from whatsapp_config table
      const { data: whatsappData, error: whatsappError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (whatsappError) throw whatsappError;

      // Load auto notification config from auto_notifications table
      const { data: autoData, error: autoError } = await supabase
        .from('auto_notifications')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (autoError) throw autoError;

      setConfig({
        appkey: whatsappData?.app_key || '',
        authkey: whatsappData?.auth_key || '',
        enabled: !!whatsappData?.app_key && !!whatsappData?.auth_key,
        autoSendEnabled: autoData?.is_active || false,
        sendHour: autoData?.delay_hours || 10,
        daysToNotify: DEFAULT_CONFIG.daysToNotify,
        testPhoneNumber: '',
        testContacts: [],
        adminPhones: [],
      });
    } catch (error) {
      console.error('Erro ao carregar configuração do WhatsApp:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: Partial<WhatsAppConfig>) => {
    try {
      // Save WhatsApp credentials if provided
      if (newConfig.appkey !== undefined || newConfig.authkey !== undefined) {
        const whatsappUpdate = {
          app_key: typeof newConfig.appkey === 'string' ? newConfig.appkey : config.appkey,
          auth_key: typeof newConfig.authkey === 'string' ? newConfig.authkey : config.authkey,
        };

        const { data: existing } = await supabase
          .from('whatsapp_config')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (existing) {
          await supabase.from('whatsapp_config').update(whatsappUpdate).eq('id', existing.id);
        } else {
          await supabase.from('whatsapp_config').insert([whatsappUpdate]);
        }
      }

      // Update local state
      setConfig({
        ...config,
        ...newConfig,
      });

      // Reload to ensure consistency
      await loadConfig();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      throw error;
    }
  };

  const addTestContact = (name: string, phone: string) => {
    const newContact: TestContact = {
      id: crypto.randomUUID(),
      name,
      phone,
      addedAt: new Date().toISOString(),
    };
    const updated: WhatsAppConfig = {
      ...config,
      testContacts: [...config.testContacts, newContact],
    };
    setConfig(updated);
    return newContact;
  };

  const removeTestContact = (id: string) => {
    const updated: WhatsAppConfig = {
      ...config,
      testContacts: config.testContacts.filter(c => c.id !== id),
    };
    setConfig(updated);
  };

  const updateTestContact = (id: string, data: Partial<TestContact>) => {
    const updated: WhatsAppConfig = {
      ...config,
      testContacts: config.testContacts.map(c =>
        c.id === id ? { ...c, ...data } : c
      ),
    };
    setConfig(updated);
  };

  return {
    config,
    loading,
    saveConfig,
    addTestContact,
    removeTestContact,
    updateTestContact,
  };
}
