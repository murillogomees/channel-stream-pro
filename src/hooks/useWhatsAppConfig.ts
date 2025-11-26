import { useState, useEffect } from 'react';
import { WhatsAppConfig, TestContact } from '@/types/whatsapp';
import { supabase } from '@/integrations/supabase/client';

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
      // Load WhatsApp credentials
      const { data: whatsappData, error: whatsappError } = await supabase
        .from('whatsapp_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (whatsappError) throw whatsappError;

      // Load auto notification config
      const { data: autoData, error: autoError } = await supabase
        .from('auto_notification_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (autoError) throw autoError;

      // Load admin phones
      const { data: adminPhonesData, error: adminPhonesError } = await supabase
        .from('admin_phones')
        .select('phone')
        .eq('active', true);

      if (adminPhonesError) throw adminPhonesError;

      setConfig({
        appkey: whatsappData?.appkey || '',
        authkey: whatsappData?.authkey || '',
        enabled: !!whatsappData?.appkey && !!whatsappData?.authkey,
        autoSendEnabled: autoData?.enabled || false,
        sendHour: autoData?.send_hour || 10,
        daysToNotify: autoData?.days_to_notify || DEFAULT_CONFIG.daysToNotify,
        testPhoneNumber: autoData?.test_phone_number || '',
        testContacts: [],
        adminPhones: adminPhonesData?.map(p => p.phone) || [],
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
          appkey: typeof newConfig.appkey === 'string' ? newConfig.appkey : config.appkey,
          authkey: typeof newConfig.authkey === 'string' ? newConfig.authkey : config.authkey,
        };

        const { data: existing } = await supabase
          .from('whatsapp_config')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (existing) {
          await supabase.from('whatsapp_config').update(whatsappUpdate).eq('id', existing.id);
        } else {
          await supabase.from('whatsapp_config').insert(whatsappUpdate);
        }
      }

      // Save auto notification config if provided
      if (
        newConfig.autoSendEnabled !== undefined || 
        newConfig.sendHour !== undefined || 
        newConfig.testPhoneNumber !== undefined ||
        newConfig.daysToNotify !== undefined
      ) {
        const autoUpdate: any = {
          enabled: newConfig.autoSendEnabled !== undefined ? newConfig.autoSendEnabled : config.autoSendEnabled,
          send_hour: newConfig.sendHour !== undefined ? newConfig.sendHour : config.sendHour,
          test_phone_number: newConfig.testPhoneNumber !== undefined ? newConfig.testPhoneNumber : config.testPhoneNumber,
          days_to_notify: newConfig.daysToNotify !== undefined ? newConfig.daysToNotify : config.daysToNotify,
        };

        const { data: existing } = await supabase
          .from('auto_notification_config')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (existing) {
          await supabase.from('auto_notification_config').update(autoUpdate).eq('id', existing.id);
        } else {
          await supabase.from('auto_notification_config').insert(autoUpdate);
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
