/**
 * CONTEXTO UNIFICADO DE AUTENTICAÇÃO - Supabase GoTrue Native
 * @version 5.0.0
 * 
 * Usa autenticação nativa do Supabase GoTrue (Cloud)
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType, UnifiedUser, AppRole } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Converte Supabase User para UnifiedUser
 */
async function convertToUnifiedUser(user: User): Promise<UnifiedUser> {
  // Buscar profile e TODAS as roles do banco
  const [profileResult, rolesResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_roles').select('role').eq('user_id', user.id)
  ]);

  const profile = profileResult.data;
  const allRoles = (rolesResult.data || []).map(r => r.role as AppRole);
  
  // Prioridade: master > admin > client
  let role: AppRole = 'client';
  if (allRoles.includes('master')) {
    role = 'master';
  } else if (allRoles.includes('admin')) {
    role = 'admin';
  } else if (allRoles.includes('client')) {
    role = 'client';
  }
  
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Atualiza estado de autenticação
   */
  const updateAuthState = useCallback(async (currentSession: Session | null) => {
    if (currentSession?.user) {
      try {
        const unifiedUser = await convertToUnifiedUser(currentSession.user);
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

  /**
   * Força atualização dos dados do usuário
   */
  const refreshUser = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        const unifiedUser = await convertToUnifiedUser(currentSession.user);
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  useEffect(() => {
    // Safety timeout
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[AuthContext] Safety timeout triggered after 10s');
        setLoading(false);
      }
    }, 10000);

    // Listener de mudanças de autenticação - DEVE ser primeiro
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        
        
        // Usar setTimeout para evitar deadlock
        setTimeout(() => {
          updateAuthState(currentSession);
        }, 0);
      }
    );

    // Verificar sessão inicial
    supabase.auth.getSession()
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
