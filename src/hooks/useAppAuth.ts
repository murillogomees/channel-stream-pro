import { useState, useEffect, useCallback } from 'react';
import {
  getSession,
  checkSubscription,
  clearSession,
  type DeviceSession,
  type SubscriptionStatus
} from '@/services/activationService';

export function useAppAuth() {
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      setIsChecking(true);
      
      // Verificar sessão salva
      const savedSession = await getSession();
      
      if (!savedSession) {
        setSession(null);
        setSubscriptionStatus(null);
        setIsLoading(false);
        return false;
      }

      // Verificar status da assinatura
      const status = await checkSubscription();
      
      setSubscriptionStatus(status);
      
      if (status.active) {
        setSession(savedSession);
        setIsLoading(false);
        return true;
      } else {
        // Assinatura expirada ou inativa
        await clearSession();
        setSession(null);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setSession(null);
      setSubscriptionStatus(null);
      setIsLoading(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setSession(null);
    setSubscriptionStatus(null);
  }, []);

  // Verificar autenticação ao montar
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Verificar status periodicamente (a cada 5 minutos)
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      checkAuth();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [session, checkAuth]);

  return {
    session,
    subscriptionStatus,
    isAuthenticated: !!session && !!subscriptionStatus?.active,
    isLoading,
    isChecking,
    checkAuth,
    logout
  };
}
