import { useState, useEffect } from 'react';
import { TestContact } from '@/types/whatsapp';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppConfig {
  appkey: string;
  authkey: string;
  testContacts: TestContact[];
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  appkey: '',
  authkey: '',
  testContacts: [],
};

export function useWhatsAppConfig() {
  const [config, setConfig] = useState<WhatsAppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          appkey: data.appkey || '',
          authkey: data.authkey || '',
          testContacts: [],
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração do WhatsApp:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (newConfig: Partial<WhatsAppConfig>) => {
    try {
      const updated = {
        appkey: typeof newConfig.appkey === 'string' ? newConfig.appkey : config.appkey,
        authkey: typeof newConfig.authkey === 'string' ? newConfig.authkey : config.authkey,
      };

      // Check if config exists
      const { data: existing } = await supabase
        .from('whatsapp_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('whatsapp_config')
          .update(updated)
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('whatsapp_config')
          .insert(updated);
        
        if (error) throw error;
      }

      setConfig({
        ...updated,
        testContacts: config.testContacts,
      });
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      throw error;
    }
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
    isConfigured,
    addTestContact,
    removeTestContact,
    updateTestContact,
  };
}
