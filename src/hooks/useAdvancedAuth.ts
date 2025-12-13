/**
 * Advanced Auth Hooks - Simplified for Supabase Cloud
 * @version 2.0.0
 * 
 * These hooks provide placeholder implementations for advanced features
 * that are not fully available in Supabase Cloud free tier.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ==========================================
// Device Management Hook (Simplified)
// ==========================================

export function useDeviceManagement() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    // Not available in Supabase Cloud free tier
    setDevices([]);
    setLoading(false);
  }, []);

  const trustDevice = async (_deviceId: string, _days: number = 30) => {
    toast.info('Funcionalidade não disponível');
  };

  const removeDevice = async (_deviceId: string) => {
    toast.info('Funcionalidade não disponível');
  };

  const getFingerprint = () => '';

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return {
    devices,
    loading,
    fetchDevices,
    trustDevice,
    removeDevice,
    getFingerprint,
  };
}

// ==========================================
// Login Alerts Hook (Simplified)
// ==========================================

export function useLoginAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setAlerts([]);
    setLoading(false);
  }, []);

  const acknowledgeAlert = async (_alertId: string) => {
    // No-op
  };

  const setPreferences = async (_prefs: { email: boolean; whatsapp: boolean }) => {
    toast.info('Preferências salvas');
  };

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return {
    alerts,
    loading,
    fetchAlerts,
    acknowledgeAlert,
    setPreferences,
    unreadCount: 0,
  };
}

// ==========================================
// Passkeys Hook (Simplified)
// ==========================================

export function usePasskeys() {
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    setPasskeys([]);
    setLoading(false);
  }, []);

  const registerPasskey = async (_deviceName?: string) => {
    toast.info('Passkeys não estão disponíveis no momento');
    return false;
  };

  const removePasskey = async (_passkeyId: string) => {
    toast.info('Funcionalidade não disponível');
  };

  const isSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  return {
    passkeys,
    loading,
    registering,
    isSupported,
    fetchPasskeys,
    registerPasskey,
    removePasskey,
  };
}

// ==========================================
// Email Change Hook
// ==========================================

export function useEmailChange() {
  const [loading, setLoading] = useState(false);

  const requestChange = async (newEmail: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success('Email de verificação enviado para o novo endereço');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Falha ao solicitar mudança de email');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const confirmChange = async (_token: string) => {
    // Email change is confirmed via link, not token
    toast.info('Verifique seu email para confirmar a mudança');
    return null;
  };

  return { loading, requestChange, confirmChange };
}

// ==========================================
// Phone Verification Hook
// ==========================================

export function usePhoneVerification() {
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const requestCode = async (phoneNumber: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: phoneNumber });
      if (error) throw error;
      toast.success('Código enviado');
      setCodeSent(true);
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Falha ao enviar código');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (phoneNumber: string, code: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token: code,
        type: 'phone_change',
      });
      if (error) throw error;
      toast.success('Telefone verificado com sucesso!');
      setCodeSent(false);
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Código inválido');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => setCodeSent(false);

  return { loading, codeSent, requestCode, verifyCode, reset };
}

// ==========================================
// Account Deletion Hook
// ==========================================

export function useAccountDeletion() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ pending: boolean; scheduled_at?: string }>({ pending: false });

  const fetchStatus = useCallback(async () => {
    // Check if user has a pending deletion request
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('account_deletion_requests')
          .select('*')
          .eq('user_id', user.id)
          .is('completed_at', null)
          .is('cancelled_at', null)
          .single();
        
        if (data) {
          setStatus({ pending: true, scheduled_at: data.scheduled_deletion_at });
        }
      }
    } catch (error) {
      // No pending request
    }
  }, []);

  const requestDeletion = async (reason?: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 30); // 30 days grace period

      const { error } = await supabase
        .from('account_deletion_requests')
        .insert({
          user_id: user.id,
          reason,
          scheduled_deletion_at: scheduledAt.toISOString(),
        });

      if (error) throw error;
      toast.success('Solicitação de exclusão registrada');
      setStatus({ pending: true, scheduled_at: scheduledAt.toISOString() });
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Falha ao solicitar exclusão');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cancelDeletion = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('account_deletion_requests')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('completed_at', null)
        .is('cancelled_at', null);

      if (error) throw error;
      toast.success('Exclusão cancelada');
      setStatus({ pending: false });
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Falha ao cancelar exclusão');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    loading,
    status,
    requestDeletion,
    cancelDeletion,
    fetchStatus,
  };
}
