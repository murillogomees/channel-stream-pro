/**
 * useCustomAuth Hook - Wrapper for Supabase GoTrue
 * @version 2.0.0
 * 
 * Simplified auth hooks using native Supabase auth
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { toast } from 'sonner';

/**
 * Main authentication hook
 */
export function useCustomAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);
      setLoading(false);
    });

    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setUser(data?.session?.user || null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email: string, password: string, userData?: Record<string, any>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const refreshUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Email de recuperação enviado');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar email');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha atualizada com sucesso');
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
 * Session management hook - simplified for Supabase Cloud
 */
export function useSessionManagement() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    // Supabase Cloud doesn't expose session list in free tier
    setSessions([]);
  }, []);

  const revokeSession = useCallback(async (_sessionId: string) => {
    // No-op for Cloud
    toast.info('Funcionalidade não disponível');
  }, []);

  const revokeOtherSessions = useCallback(async () => {
    // Sign out from all other sessions by refreshing token
    toast.info('Outras sessões serão encerradas automaticamente');
  }, []);

  const signOutAll = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Deslogado de todos os dispositivos');
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
 * MFA management hook - uses Supabase MFA
 */
export function useMFA() {
  const [loading, setLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<{ secret: string; qr_code: string } | null>(null);

  const startEnrollment = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      
      setEnrollmentData({
        secret: data.totp.secret,
        qr_code: data.totp.qr_code,
      });
      return { secret: data.totp.secret, qr_code: data.totp.qr_code };
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
      // Get the factor ID from the enrollment
      const { data: factorsList } = await supabase.auth.mfa.listFactors();
      const factor = factorsList?.totp?.[0];
      
      if (!factor) {
        throw new Error('No MFA factor found');
      }

      const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (!challenge) throw new Error('Failed to create challenge');

      const { error } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code,
      });
      
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

  const disableMFA = useCallback(async (_code: string) => {
    setLoading(true);
    try {
      const { data: factorsList } = await supabase.auth.mfa.listFactors();
      const factor = factorsList?.totp?.[0];
      
      if (factor) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
      
      setMfaEnabled(false);
      toast.success('MFA desativado');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao desativar MFA');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check MFA status on mount
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setMfaEnabled(!!data?.totp?.length);
    });
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
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
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
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });
      if (error) throw error;
      toast.success('Email verificado com sucesso');
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
