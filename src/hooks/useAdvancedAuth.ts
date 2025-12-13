/**
 * Advanced Auth Hooks - Device Fingerprinting, Login Alerts, Passkeys, etc.
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react';
import { customAuthService } from '@/services/customAuthService';
import { toast } from 'sonner';

// ==========================================
// Device Management Hook
// ==========================================

export function useDeviceManagement() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.getDevices();
      if (error) throw error;
      setDevices(data?.devices || []);
    } catch (error: any) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const trustDevice = async (deviceId: string, days: number = 30) => {
    try {
      const { error } = await customAuthService.trustDevice(deviceId, days);
      if (error) throw error;
      toast.success('Dispositivo marcado como confiável');
      await fetchDevices();
    } catch (error: any) {
      toast.error(error.message || 'Falha ao marcar dispositivo');
    }
  };

  const removeDevice = async (deviceId: string) => {
    try {
      const { error } = await customAuthService.removeDevice(deviceId);
      if (error) throw error;
      toast.success('Dispositivo removido');
      await fetchDevices();
    } catch (error: any) {
      toast.error(error.message || 'Falha ao remover dispositivo');
    }
  };

  const getFingerprint = () => customAuthService.getDeviceFingerprint();

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
// Login Alerts Hook
// ==========================================

export function useLoginAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.getLoginAlerts();
      if (error) throw error;
      setAlerts(data?.alerts || []);
    } catch (error: any) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await customAuthService.acknowledgeAlert(alertId);
      if (error) throw error;
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (error: any) {
      toast.error(error.message || 'Falha ao confirmar alerta');
    }
  };

  const setPreferences = async (prefs: { email: boolean; whatsapp: boolean }) => {
    try {
      const { error } = await customAuthService.setAlertPreferences(prefs);
      if (error) throw error;
      toast.success('Preferências atualizadas');
    } catch (error: any) {
      toast.error(error.message || 'Falha ao atualizar preferências');
    }
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
    unreadCount: alerts.filter(a => !a.acknowledged_at).length,
  };
}

// ==========================================
// Passkeys Hook
// ==========================================

export function usePasskeys() {
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.getPasskeys();
      if (error) throw error;
      setPasskeys(data?.passkeys || []);
    } catch (error: any) {
      console.error('Failed to fetch passkeys:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const registerPasskey = async (deviceName?: string) => {
    if (!window.PublicKeyCredential) {
      toast.error('WebAuthn não é suportado neste navegador');
      return false;
    }

    setRegistering(true);
    try {
      // Get registration options from server
      const { data: optionsData, error: optionsError } = await customAuthService.startPasskeyRegistration();
      if (optionsError) throw optionsError;

      const options = optionsData?.options;
      if (!options) throw new Error('No registration options received');

      // Create credential
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge), c => c.charCodeAt(0)),
          user: {
            ...options.user,
            id: Uint8Array.from(atob(options.user.id), c => c.charCodeAt(0)),
          },
        },
      });

      if (!credential) throw new Error('Failed to create credential');

      // Send credential to server
      const { error } = await customAuthService.completePasskeyRegistration(credential, deviceName);
      if (error) throw error;

      toast.success('Passkey registrada com sucesso!');
      await fetchPasskeys();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Falha ao registrar passkey');
      return false;
    } finally {
      setRegistering(false);
    }
  };

  const removePasskey = async (passkeyId: string) => {
    try {
      const { error } = await customAuthService.removePasskey(passkeyId);
      if (error) throw error;
      toast.success('Passkey removida');
      await fetchPasskeys();
    } catch (error: any) {
      toast.error(error.message || 'Falha ao remover passkey');
    }
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
      const { error } = await customAuthService.requestEmailChange(newEmail);
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

  const confirmChange = async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.confirmEmailChange(token);
      if (error) throw error;
      toast.success('Email atualizado com sucesso!');
      return data?.user;
    } catch (error: any) {
      toast.error(error.message || 'Falha ao confirmar mudança de email');
      return null;
    } finally {
      setLoading(false);
    }
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
      const { error } = await customAuthService.requestPhoneVerification(phoneNumber);
      if (error) throw error;
      toast.success('Código enviado via WhatsApp');
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
      const { error } = await customAuthService.verifyPhone(phoneNumber, code);
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
    try {
      const { data } = await customAuthService.getAccountDeletionStatus();
      if (data) setStatus(data);
    } catch (error) {
      console.error('Failed to fetch deletion status:', error);
    }
  }, []);

  const requestDeletion = async (reason?: string) => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.requestAccountDeletion(reason);
      if (error) throw error;
      toast.success('Solicitação de exclusão registrada');
      setStatus({ pending: true, scheduled_at: data?.scheduled_at });
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
      const { error } = await customAuthService.cancelAccountDeletion();
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
