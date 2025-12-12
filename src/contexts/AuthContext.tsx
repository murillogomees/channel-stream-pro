/**
 * CONTEXTO UNIFICADO DE AUTENTICAÇÃO - Custom Auth Wrapper
 * @version 4.0.0
 * 
 * Bypassa GoTrue completamente, usando autenticação direta via Edge Function
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { customAuthService, CustomAuthSession, CustomAuthUser } from '@/services/customAuthService';
import { AuthContextType, UnifiedUser, AppRole, SubscriptionStatusType } from '@/types/auth';
import { authLoggingService } from '@/services/authLoggingService';
import { authCache } from '@/services/authCacheService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Converte CustomAuthUser para UnifiedUser
 */
function convertToUnifiedUser(customUser: CustomAuthUser): UnifiedUser {
  const profile = customUser.profile as any;
  const role = customUser.role as AppRole;
  
  // Calcular status de acesso
  let daysRemaining = 0;
  let isExpired = false;
  let isTrial = profile?.situacao === 'Testando';
  
  if (profile?.data_vencimento) {
    const vencimento = new Date(profile.data_vencimento);
    const now = new Date();
    const diffTime = vencimento.getTime() - now.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isExpired = daysRemaining < 0;
  }
  
  const hasValidAccess = profile?.cliente_ativo === true && !isExpired;

  return {
    id: customUser.id,
    nome: profile?.nome || customUser.email?.split('@')[0] || 'Usuário',
    email: customUser.email,
    telefone: profile?.contact_phone,
    telefone_whatsapp: profile?.contact_phone,
    origem_cadastro: profile?.origem_cadastro,
    created_at: profile?.created_at || new Date().toISOString(),
    updated_at: profile?.updated_at || new Date().toISOString(),
    roles: [role],
    isMaster: role === 'master',
    isAdmin: role === 'admin' || role === 'master',
    isClient: role === 'client',
    hasValidAccess,
    isExpired,
    daysRemaining: Math.max(0, daysRemaining),
    isTrial,
    clienteData: profile ? {
      id: profile.id,
      situacao: profile.situacao,
      plano: profile.plano,
      data_vencimento: profile.data_vencimento,
      valor_pago: profile.valor_pago,
      cliente_ativo: profile.cliente_ativo,
    } : undefined,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [session, setSession] = useState<CustomAuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Atualiza estado de autenticação
   */
  const updateAuthState = useCallback(async (currentSession: CustomAuthSession | null) => {
    if (currentSession?.user) {
      const unifiedUser = convertToUnifiedUser(currentSession.user);
      setUser(unifiedUser);
      setSession(currentSession);
      
      // Log login
      authLoggingService.logLogin(
        currentSession.user.id,
        currentSession.user.email
      ).catch(() => {});
    } else {
      setUser(null);
      setSession(null);
    }
    setLoading(false);
  }, []);

  /**
   * Força atualização dos dados do usuário
   */
  const refreshUser = useCallback(async () => {
    try {
      const { data, error } = await customAuthService.getUser();
      if (data?.user && !error) {
        const unifiedUser = convertToUnifiedUser(data.user);
        setUser(unifiedUser);
      }
    } catch (e) {
      console.error('[AuthContext] Error refreshing user:', e);
    }
  }, []);

  /**
   * Logout
   */
  const signOut = useCallback(async () => {
    if (user) {
      await authLoggingService.logLogout(user.id, user.email || '').catch(console.error);
    }
    
    authCache.clear();
    localStorage.removeItem('iptv_remember_me');
    await customAuthService.signOut();
    setUser(null);
    setSession(null);
  }, [user]);

  // Sincronizar com authCache global
  useEffect(() => {
    authCache.setAuthState(user, session as any);
  }, [user, session]);

  useEffect(() => {
    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[AuthContext] Safety timeout triggered after 10s');
        setLoading(false);
      }
    }, 10000);

    // Listener de mudanças de autenticação
    const { data: { subscription } } = customAuthService.onAuthStateChange(
      (event, currentSession) => {
        console.log('[AuthContext] Auth event:', event);
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setLoading(false);
          return;
        }
        updateAuthState(currentSession);
      }
    );

    // Verificar sessão inicial
    customAuthService.getSession()
      .then(({ data: { session: currentSession } }) => {
        updateAuthState(currentSession);
      })
      .catch((error) => {
        console.error('[AuthContext] Error getting session:', error);
        setUser(null);
        setSession(null);
        setLoading(false);
      });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [updateAuthState]);

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    isAdmin: user?.isAdmin || false,
    isMaster: user?.isMaster || false,
    isClient: user?.isClient || false,
    hasValidAccess: user?.hasValidAccess || false,
    isExpired: user?.isExpired || false,
    isTrial: user?.isTrial || false,
    daysRemaining: user?.daysRemaining || 0,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook para acessar contexto de autenticação
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
