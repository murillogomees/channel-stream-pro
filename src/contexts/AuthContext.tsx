/**
 * CONTEXTO UNIFICADO DE AUTENTICAÇÃO - Simplificado
 * @version 6.0.0
 * 
 * Resolução de role rápida: JWT > query direta > fallback
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType, UnifiedUser, AppRole } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Extrai role do JWT token */
function getRoleFromJwt(token?: string): AppRole | null {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payload.length % 4;
    const padded = pad ? payload + '='.repeat(4 - pad) : payload;
    const json = JSON.parse(atob(padded));
    const claim = json?.user_role || json?.role;
    if (claim === 'master' || claim === 'admin' || claim === 'client') return claim;
  } catch { /* ignore */ }
  return null;
}

/** Converte Supabase User para UnifiedUser - RÁPIDO */
async function convertToUnifiedUser(user: User, accessToken?: string): Promise<UnifiedUser> {
  // 1) Tentar JWT primeiro (instantâneo)
  let role: AppRole = getRoleFromJwt(accessToken) || 'client';
  
  // 2) Se JWT diz 'client', fazer UMA query direta rápida na tabela user_roles
  // A policy "Users can view own roles" permite isso sem recursão
  if (role === 'client') {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .abortSignal(controller.signal)
        .maybeSingle();
      
      clearTimeout(timeout);
      
      if (!error && data?.role) {
        const r = (data.role as string).toLowerCase();
        if (r === 'master' || r === 'admin' || r === 'client') {
          role = r as AppRole;
        }
      }
      console.log('[AuthContext] Role from DB:', role);
    } catch (e) {
      console.warn('[AuthContext] Role query failed, using JWT fallback:', role);
    }
  } else {
    console.log('[AuthContext] Role from JWT:', role);
  }

  // 3) Profile (melhor esforço, não bloqueia)
  let profile: any = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const { data } = await supabase
      .from('profiles')
      .select('id,nome,email,contact_phone,origem_cadastro,created_at,updated_at,situacao,plano,data_vencimento,valor_pago,cliente_ativo')
      .eq('id', user.id)
      .abortSignal(controller.signal)
      .maybeSingle();
    
    clearTimeout(timeout);
    profile = data;
  } catch { /* profile is optional */ }

  // Calcular status de acesso
  let daysRemaining = 0;
  let isExpired = false;
  const isTrial = profile?.situacao === 'Testando';

  if (profile?.data_vencimento) {
    const vencimento = new Date(profile.data_vencimento);
    const diffTime = vencimento.getTime() - Date.now();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    isExpired = daysRemaining < 0;
  }

  console.log('[AuthContext] Final role for', user.email, ':', role);

  return {
    id: user.id,
    nome: profile?.nome || user.email?.split('@')[0] || 'Usuário',
    email: user.email || '',
    telefone: profile?.contact_phone,
    telefone_whatsapp: profile?.contact_phone,
    origem_cadastro: profile?.origem_cadastro,
    created_at: profile?.created_at || new Date().toISOString(),
    updated_at: profile?.updated_at || new Date().toISOString(),
    roles: [role],
    isMaster: role === 'master',
    isAdmin: role === 'admin' || role === 'master',
    isClient: role === 'client',
    hasValidAccess: role === 'master' || role === 'admin' || (profile?.cliente_ativo === true && !isExpired),
    isExpired: role === 'master' || role === 'admin' ? false : isExpired,
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const updateAuthState = useCallback(async (currentSession: Session | null) => {
    if (currentSession?.user) {
      try {
        const unifiedUser = await convertToUnifiedUser(
          currentSession.user,
          currentSession.access_token
        );
        setUser(unifiedUser);
        setSession(currentSession);
      } catch (e) {
        console.error('[AuthContext] Error converting user:', e);
        setUser(null);
        setSession(null);
      }
    } else {
      setUser(null);
      setSession(null);
    }
    setLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        const unifiedUser = await convertToUnifiedUser(
          currentSession.user,
          currentSession.access_token
        );
        setUser(unifiedUser);
      }
    } catch (e) {
      console.error('[AuthContext] Error refreshing user:', e);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let resolved = false;

    // Safety timeout - 15s max
    const safetyTimeout = setTimeout(() => {
      if (loading && isMounted && !resolved) {
        console.warn('[AuthContext] Safety timeout - setting loading false');
        setLoading(false);
      }
    }, 15000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;
        console.log('[AuthContext] Auth event:', event);
        setTimeout(() => {
          if (isMounted) {
            resolved = true;
            updateAuthState(currentSession);
          }
        }, 0);
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (isMounted) {
          resolved = true;
          updateAuthState(currentSession);
        }
      })
      .catch((error) => {
        console.error('[AuthContext] Error getting session:', error);
        if (isMounted) {
          setUser(null);
          setSession(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [updateAuthState]);

  const roles = user?.roles || [];
  const isMaster = roles.includes('master') || user?.isMaster === true;
  const isAdmin = isMaster || roles.includes('admin') || user?.isAdmin === true;
  const isClient = !isAdmin && roles.includes('client');

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    isAdmin,
    isMaster,
    isClient,
    hasValidAccess: user?.hasValidAccess || isAdmin,
    isExpired: user?.isExpired || false,
    isTrial: user?.isTrial || false,
    daysRemaining: user?.daysRemaining || 0,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
