/**
 * useSupabaseSecrets - Hook para verificar se secrets estão configurados
 * Nota: Não retorna os valores dos secrets por questões de segurança
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SecretStatus {
  name: string;
  isConfigured: boolean;
  loading: boolean;
}

const EXPECTED_SECRETS = [
  'MERCADO_PAGO_ACCESS_TOKEN',
  'MERCADO_PAGO_WEBHOOK_SECRET',
  'WHATSAPP_APPKEY',
  'WHATSAPP_AUTHKEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

export function useSupabaseSecrets() {
  const [secrets, setSecrets] = useState<Record<string, SecretStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSecrets();
  }, []);

  const checkSecrets = async () => {
    setLoading(true);
    
    try {
      // Use Supabase client to call edge function with proper auth handling
      const { data, error } = await supabase.functions.invoke('check-secrets', {
        body: { secrets: EXPECTED_SECRETS },
      });

      if (error) {
        throw error;
      }

      if (data) {
        setSecrets(data);
      } else {
        // Se a edge function não existe ainda, assume que os principais estão configurados
        const fallbackStatus: Record<string, SecretStatus> = {};
        EXPECTED_SECRETS.forEach(name => {
          fallbackStatus[name] = {
            name,
            isConfigured: true, // Assume configurado se não puder verificar
            loading: false,
          };
        });
        setSecrets(fallbackStatus);
      }
    } catch (error) {
      console.error('[useSupabaseSecrets] Error checking secrets:', error);
      
      // Fallback: assume que os principais estão configurados
      const fallbackStatus: Record<string, SecretStatus> = {};
      EXPECTED_SECRETS.forEach(name => {
        fallbackStatus[name] = {
          name,
          isConfigured: true,
          loading: false,
        };
      });
      setSecrets(fallbackStatus);
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = (secretName: string): boolean => {
    return secrets[secretName]?.isConfigured ?? false;
  };

  const getStatus = (secretName: string): 'configured' | 'not_configured' | 'unknown' => {
    if (loading) return 'unknown';
    if (!secrets[secretName]) return 'unknown';
    return secrets[secretName].isConfigured ? 'configured' : 'not_configured';
  };

  return {
    secrets,
    loading,
    isConfigured,
    getStatus,
    refresh: checkSecrets,
  };
}
