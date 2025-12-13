/**
 * useCustomAuth Hook - Complete auth hook for Custom Auth system
 * @version 1.0.0
 * 
 * Provides all authentication functionality as React hooks
 */

import { useState, useCallback, useEffect } from 'react';
import { customAuthService, CustomAuthSession, CustomAuthUser, UserSession } from '@/services/customAuthService';
import { toast } from 'sonner';

/**
 * Main authentication hook
 */
export function useCustomAuth() {
  const [user, setUser] = useState<CustomAuthUser | null>(customAuthService.currentUser);
  const [session, setSession] = useState<CustomAuthSession | null>(customAuthService.currentSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const { data: { subscription } } = customAuthService.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);
      setLoading(false);
    });

    // Initial session check
    customAuthService.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setUser(data?.session?.user || null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string, mfaCode?: string) => {
    const { data, error } = await customAuthService.signIn(email, password, { mfaCode });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email: string, password: string, userData?: Record<string, any>) => {
    const { data, error } = await customAuthService.signUp(email, password, userData);
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await customAuthService.signOut();
    if (error) throw error;
  }, []);

  const refreshUser = useCallback(async () => {
    const { data, error } = await customAuthService.getUser();
    if (!error && data?.user) {
      setUser(data.user);
    }
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };
}

/**
 * Password management hook
 */
export function usePasswordManagement() {
  const [loading, setLoading] = useState(false);

  const requestPasswordReset = useCallback(async (email: string, redirectTo?: string) => {
    setLoading(true);
    try {
      const { error } = await customAuthService.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast.success('Email de recuperação enviado');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string, token?: string) => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.updatePassword(newPassword, token);
      if (error) throw error;
      toast.success('Senha atualizada com sucesso');
      return data;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar senha');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    requestPasswordReset,
    updatePassword,
  };
}

/**
 * Session management hook
 */
export function useSessionManagement() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.getSessions();
      if (error) throw error;
      setSessions(data?.sessions || []);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar sessões');
    } finally {
      setLoading(false);
    }
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      const { error } = await customAuthService.revokeSession(sessionId);
      if (error) throw error;
      toast.success('Sessão encerrada');
      await fetchSessions();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao encerrar sessão');
    }
  }, [fetchSessions]);

  const revokeOtherSessions = useCallback(async () => {
    try {
      const { error } = await customAuthService.revokeOtherSessions();
      if (error) throw error;
      toast.success('Outras sessões encerradas');
      await fetchSessions();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao encerrar sessões');
    }
  }, [fetchSessions]);

  const signOutAll = useCallback(async () => {
    try {
      const { error } = await customAuthService.signOutAll();
      if (error) throw error;
      toast.success('Deslogado de todos os dispositivos');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao deslogar');
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    fetchSessions,
    revokeSession,
    revokeOtherSessions,
    signOutAll,
  };
}

/**
 * MFA management hook
 */
export function useMFA() {
  const [loading, setLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(customAuthService.currentUser?.mfa_enabled || false);
  const [enrollmentData, setEnrollmentData] = useState<{ secret: string; qr_code: string } | null>(null);

  const startEnrollment = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.enrollMFA();
      if (error) throw error;
      setEnrollmentData(data);
      return data;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao iniciar MFA');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyEnrollment = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const { error } = await customAuthService.verifyMFAEnrollment(code);
      if (error) throw error;
      setMfaEnabled(true);
      setEnrollmentData(null);
      toast.success('MFA ativado com sucesso');
    } catch (error: any) {
      toast.error(error.message || 'Código inválido');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const disableMFA = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const { error } = await customAuthService.disableMFA(code);
      if (error) throw error;
      setMfaEnabled(false);
      toast.success('MFA desativado');
    } catch (error: any) {
      toast.error(error.message || 'Código inválido');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    mfaEnabled,
    enrollmentData,
    startEnrollment,
    verifyEnrollment,
    disableMFA,
  };
}

/**
 * Email verification hook
 */
export function useEmailVerification() {
  const [loading, setLoading] = useState(false);

  const resendVerification = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const { error } = await customAuthService.resendVerificationEmail(email);
      if (error) throw error;
      toast.success('Email de verificação enviado');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const { data, error } = await customAuthService.verifyEmail(token);
      if (error) throw error;
      toast.success('Email verificado com sucesso');
      return data;
    } catch (error: any) {
      toast.error(error.message || 'Token inválido');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    resendVerification,
    verifyEmail,
  };
}
