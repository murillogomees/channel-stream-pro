import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AffiliateConfigItem {
  id: string;
  config_key: string;
  config_value: any;
  description: string;
  updated_at: string;
}

export interface AffiliateConfigValues {
  min_withdrawal_amount: number;
  withdrawal_cooldown_days: number;
  max_withdrawals_per_month: number;
  auto_confirm_referrals: { enabled: boolean; delay_hours: number };
  fraud_detection_enabled: boolean;
  recurring_commission_enabled: { enabled: boolean; percentage: number };
  cookie_duration_days: number;
}

const defaultConfig: AffiliateConfigValues = {
  min_withdrawal_amount: 50,
  withdrawal_cooldown_days: 7,
  max_withdrawals_per_month: 4,
  auto_confirm_referrals: { enabled: false, delay_hours: 24 },
  fraud_detection_enabled: true,
  recurring_commission_enabled: { enabled: true, percentage: 5 },
  cookie_duration_days: 30
};

export function useAffiliateConfig() {
  const [configItems, setConfigItems] = useState<AffiliateConfigItem[]>([]);
  const [config, setConfig] = useState<AffiliateConfigValues>(defaultConfig);
  const [loading, setLoading] = useState(true);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliate_config')
        .select('*')
        .order('config_key');

      if (error) throw error;
      
      setConfigItems(data || []);

      const parsed = { ...defaultConfig };
      (data || []).forEach(item => {
        let value: Record<string, any> = {};
        if (typeof item.config_value === 'string') {
          try { value = JSON.parse(item.config_value); } catch { value = { value: item.config_value }; }
        } else if (item.config_value && typeof item.config_value === 'object') {
          value = item.config_value as Record<string, any>;
        }
        switch (item.config_key) {
          case 'min_withdrawal_amount':
            parsed.min_withdrawal_amount = value?.value || 50;
            break;
          case 'withdrawal_cooldown_days':
            parsed.withdrawal_cooldown_days = value?.value || 7;
            break;
          case 'max_withdrawals_per_month':
            parsed.max_withdrawals_per_month = value?.value || 4;
            break;
          case 'auto_confirm_referrals':
            parsed.auto_confirm_referrals = {
              enabled: value?.enabled ?? false,
              delay_hours: value?.delay_hours ?? 24
            };
            break;
          case 'fraud_detection_enabled':
            parsed.fraud_detection_enabled = value?.enabled ?? true;
            break;
          case 'recurring_commission_enabled':
            parsed.recurring_commission_enabled = {
              enabled: value?.enabled ?? true,
              percentage: value?.percentage ?? 5
            };
            break;
          case 'cookie_duration_days':
            parsed.cookie_duration_days = value?.value || 30;
            break;
        }
      });

      setConfig(parsed);
    } catch (error: any) {
      console.error('Error fetching config:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from('affiliate_config')
        .update({ 
          config_value: typeof value === 'object' ? value : { value },
          updated_at: new Date().toISOString()
        })
        .eq('config_key', key);

      if (error) throw error;
      
      await fetchConfig();
      toast.success('Configuração atualizada');
    } catch (error: any) {
      console.error('Error updating config:', error);
      toast.error('Erro ao atualizar configuração');
      throw error;
    }
  };

  const updateMultipleConfigs = async (updates: Record<string, any>) => {
    try {
      const promises = Object.entries(updates).map(([key, value]) =>
        supabase
          .from('affiliate_config')
          .update({ 
            config_value: typeof value === 'object' ? value : { value },
            updated_at: new Date().toISOString()
          })
          .eq('config_key', key)
      );

      await Promise.all(promises);
      await fetchConfig();
      toast.success('Configurações atualizadas');
    } catch (error: any) {
      console.error('Error updating configs:', error);
      toast.error('Erro ao atualizar configurações');
      throw error;
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    configItems,
    loading,
    fetchConfig,
    updateConfig,
    updateMultipleConfigs
  };
}
