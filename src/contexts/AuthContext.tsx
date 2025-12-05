/**
 * CONTEXTO UNIFICADO DE AUTENTICAÇÃO
 * @version 3.0.0
 * 
 * Gerencia autenticação e autorização usando:
 * - Supabase Auth para identidade
 * - public.profiles para dados de perfil
 * - public.user_roles para permissões
 * - public.clientes para dados de cliente e vencimento
 * - public.user_subscriptions para status de assinatura
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType, UnifiedUser, AppRole, SubscriptionStatusType } from '@/types/auth';
import { authLoggingService } from '@/services/authLoggingService';
import { authCache } from '@/services/authCacheService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Calcula status de acesso baseado nos dados do cliente
 */
function calculateAccessStatus(clienteData: any, subscriptionData: any): {
  hasValidAccess: boolean;
  isExpired: boolean;
  daysRemaining: number;
  isTrial: boolean;
} {
  const now = new Date();
  
  // Verificar subscription status
  const isTrial = subscriptionData?.status === 'trial';
  const subscriptionActive = ['trial', 'active'].includes(subscriptionData?.status);
  
  // Verificar vencimento pelo cliente
  let daysRemaining = 0;
  let isExpired = false;
  
  if (clienteData?.data_vencimento) {
    const vencimento = new Date(clienteData.data_vencimento);
    const diffTime = vencimento.getTime() - now.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isExpired = daysRemaining < 0;
  }
  
  // Acesso válido = cliente ativo + não vencido + subscription ok
  const hasValidAccess = 
    clienteData?.cliente_ativo === true && 
    !isExpired && 
    subscriptionActive;
  
  return {
    hasValidAccess,
    isExpired,
    daysRemaining: Math.max(0, daysRemaining),
    isTrial
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<{ userId: string; data: UnifiedUser; timestamp: number } | null>(null);

  /**
   * Busca dados completos do usuário: perfil + roles + cliente + subscription
   */
  const fetchUserData = useCallback(async (userId: string): Promise<UnifiedUser | null> => {
    try {
      // Fazer queries em paralelo
      const [profileResult, rolesResult, clienteResult, subscriptionResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('clientes').select('id, situacao, plano, data_vencimento, valor_pago, cliente_ativo').eq('user_id', userId).maybeSingle(),
        supabase.from('user_subscriptions').select('id, status, current_period_start, current_period_end, trial_end, cancel_at_period_end, mercado_pago_subscription_id').eq('user_id', userId).maybeSingle()
      ]);

      if (profileResult.error) {
        console.error('[AuthContext] Erro ao buscar perfil:', profileResult.error);
        return null;
      }

      const profile = profileResult.data;
      const roles: AppRole[] = (rolesResult.data || []).map((r) => r.role as AppRole);
      const clienteData = clienteResult.data;
      const subscriptionData = subscriptionResult.data;

      // Calcular status de acesso
      const accessStatus = calculateAccessStatus(clienteData, subscriptionData);

      // Montar objeto unificado
      const unifiedUser: UnifiedUser = {
        ...profile,
        roles,
        isMaster: roles.includes('master'),
        isAdmin: roles.includes('admin') || roles.includes('master'),
        isClient: roles.includes('client'),
        // Status de acesso
        hasValidAccess: accessStatus.hasValidAccess,
        isExpired: accessStatus.isExpired,
        daysRemaining: accessStatus.daysRemaining,
        isTrial: accessStatus.isTrial,
        // Dados de cliente
        clienteData: clienteData ? {
          id: clienteData.id,
          situacao: clienteData.situacao,
          plano: clienteData.plano,
          data_vencimento: clienteData.data_vencimento,
          valor_pago: clienteData.valor_pago,
          cliente_ativo: clienteData.cliente_ativo,
        } : undefined,
        // Dados de subscription
        subscriptionData: subscriptionData ? {
          id: subscriptionData.id,
          status: subscriptionData.status as SubscriptionStatusType,
          current_period_start: subscriptionData.current_period_start,
          current_period_end: subscriptionData.current_period_end,
          trial_end: subscriptionData.trial_end,
          cancel_at_period_end: subscriptionData.cancel_at_period_end,
          mercado_pago_subscription_id: subscriptionData.mercado_pago_subscription_id,
        } : undefined
      };

      return unifiedUser;
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return null;
    }
  }, []);

  /**
   * Atualiza estado de autenticação (otimizado - libera loading ANTES de buscar dados extras)
   */
  const updateAuthState = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    
    if (currentSession?.user) {
      // Verificar se token está válido antes de continuar
      const tokenExpiry = currentSession.expires_at;
      if (tokenExpiry) {
        const expiresAt = new Date(tokenExpiry * 1000);
        const now = new Date();
        
        // Se token expira em menos de 1 minuto, forçar refresh
        if (expiresAt.getTime() - now.getTime() < 60000) {
          console.log('[AuthContext] Token próximo de expirar, forçando refresh...');
          try {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
              console.error('[AuthContext] Erro ao fazer refresh:', error);
              // Se refresh falhar, fazer logout
              await supabase.auth.signOut();
              setUser(null);
              setSession(null);
              setLoading(false);
              return;
            }
            if (data.session) {
              currentSession = data.session;
              setSession(data.session);
            }
          } catch (error) {
            console.error('[AuthContext] Erro crítico no refresh:', error);
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setLoading(false);
            return;
          }
        }
      }
      
      // CRÍTICO: Liberar loading IMEDIATAMENTE com dados básicos do session
      const basicUser: UnifiedUser = {
        id: currentSession.user.id,
        nome: currentSession.user.user_metadata?.nome || currentSession.user.email?.split('@')[0] || 'Usuário',
        email: currentSession.user.email || '',
        roles: [],
        isAdmin: false,
        isMaster: false,
        isClient: true, // Assume client por padrão
        hasValidAccess: true, // Assume válido até carregar
        isExpired: false,
        daysRemaining: 0,
        isTrial: false,
        created_at: currentSession.user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setUser(basicUser);
      setLoading(false); // LIBERA A UI IMEDIATAMENTE
      
      // Buscar dados completos em background
      try {
        const userData = await fetchUserData(currentSession.user.id);
        if (userData) {
          setUser(userData);
          
          // Registrar login de forma assíncrona
          authLoggingService.logLogin(
            currentSession.user.id,
            userData.email || currentSession.user.email || ''
          ).catch(() => {});
        }
      } catch (error) {
        console.error('[AuthContext] Erro ao buscar dados extras:', error);
      }
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [fetchUserData]);

  /**
   * Força atualização dos dados do usuário (invalida cache)
   */
  const refreshUser = useCallback(async () => {
    if (session?.user) {
      cacheRef.current = null;
      const userData = await fetchUserData(session.user.id);
      setUser(userData);
    }
  }, [session, fetchUserData]);

  /**
   * Logout (limpa cache e remember me)
   */
  const signOut = useCallback(async () => {
    if (user) {
      await authLoggingService.logLogout(user.id, user.email || '').catch(console.error);
    }
    
    cacheRef.current = null;
    authCache.clear(); // Limpa cache global
    localStorage.removeItem('iptv_remember_me');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [user]);

  // Sincronizar AuthContext com authCache global
  useEffect(() => {
    authCache.setAuthState(user, session);
  }, [user, session]);

  useEffect(() => {
    const REMEMBER_ME_KEY = 'iptv_remember_me';
    
    // Timeout de segurança
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[AuthContext] Safety timeout triggered');
        setLoading(false);
      }
    }, 5000);

    // Verificar remember me
    const checkRememberMe = () => {
      const stored = localStorage.getItem(REMEMBER_ME_KEY);
      if (stored) {
        try {
          const { expires } = JSON.parse(stored);
          if (Date.now() > expires) {
            localStorage.removeItem(REMEMBER_ME_KEY);
            supabase.auth.signOut();
            return true;
          }
        } catch {
          localStorage.removeItem(REMEMBER_ME_KEY);
        }
      }
      return false;
    };

    // Listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // Se sessão foi invalidada ou expirou, limpar estado
        if (event === 'TOKEN_REFRESHED' && !currentSession) {
          console.warn('[AuthContext] Token refresh falhou, limpando sessão');
          setUser(null);
          setSession(null);
          setLoading(false);
          return;
        }
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setLoading(false);
          return;
        }
        setTimeout(() => {
          updateAuthState(currentSession);
        }, 0);
      }
    );

    // Verificar sessão inicial
    supabase.auth.getSession()
      .then(({ data: { session: currentSession }, error }) => {
        // Se houver erro de sessão (expirada, revogada, etc), limpar e continuar
        if (error) {
          console.warn('[AuthContext] Sessão inválida, limpando:', error.message);
          supabase.auth.signOut().catch(() => {});
          setUser(null);
          setSession(null);
          setLoading(false);
          return;
        }
        if (currentSession && checkRememberMe()) return;
        updateAuthState(currentSession);
      })
      .catch((error) => {
        console.error('[AuthContext] Erro ao obter sessão:', error);
        // Limpar sessão corrompida
        supabase.auth.signOut().catch(() => {});
        setUser(null);
        setSession(null);
        setLoading(false);
      });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateAuthState]); // Remove 'loading' to prevent re-run loops

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
