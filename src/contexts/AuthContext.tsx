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
async function convertToUnifiedUser(user: User, accessToken?: string): Promise<UnifiedUser> {
  // Buscar profile e roles em paralelo com timeout
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), 5000)
  );

  // Fallback seguro: tenta extrair role do JWT (claim assinado) e, se não existir, de metadados.
  const getRoleFallback = (): AppRole | null => {
    // 1) JWT claims
    try {
      if (accessToken) {
        const parts = accessToken.split('.');
        if (parts.length === 3) {
          const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const pad = payload.length % 4;
          const padded = pad ? payload + '='.repeat(4 - pad) : payload;
          const json = JSON.parse(atob(padded));
          const claim = (json?.user_role || json?.role) as string | undefined;
          if (claim === 'master' || claim === 'admin' || claim === 'client') return claim;
        }
      }
    } catch {
      // ignore
    }

    // 2) Metadados (se houver)
    const metaRole = (user.app_metadata as any)?.user_role || (user.app_metadata as any)?.role;
    const metaRole2 = (user.user_metadata as any)?.user_role || (user.user_metadata as any)?.role;
    const r = (metaRole || metaRole2) as string | undefined;
    if (r === 'master' || r === 'admin' || r === 'client') return r;

    return null;
  };

  const pickRole = (roles: Array<{ role: AppRole | string }> | null | undefined): AppRole => {
    const list = (roles || [])
      .map((x) => (x?.role as string | undefined)?.toLowerCase())
      .filter(Boolean) as string[];

    if (list.includes('master')) return 'master';
    if (list.includes('admin')) return 'admin';
    if (list.includes('client')) return 'client';

    return getRoleFallback() || 'client';
  };

  try {
    const [{ data: profile, error: profileError }, { data: rolesData, error: rolesError }] =
      (await Promise.race([
        Promise.all([
          supabase
            .from('profiles')
            .select(
              'id,nome,email,contact_phone,origem_cadastro,created_at,updated_at,situacao,plano,data_vencimento,valor_pago,cliente_ativo'
            )
            .eq('id', user.id)
            .maybeSingle(),
          // Pode existir mais de 1 row em bases antigas; por isso NÃO usamos maybeSingle
          supabase.from('user_roles').select('role').eq('user_id', user.id),
        ]),
        timeoutPromise,
      ])) as [
        { data: any; error: any },
        { data: Array<{ role: AppRole }> | null; error: any },
      ];

    if (profileError) console.warn('[AuthContext] profiles fetch error:', profileError);
    if (rolesError) console.warn('[AuthContext] user_roles fetch error:', rolesError);

    const role: AppRole = pickRole(rolesData);

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
      hasValidAccess:
        role === 'master' || role === 'admin' || (profile?.cliente_ativo === true && !isExpired),
      isExpired: role === 'master' || role === 'admin' ? false : isExpired,
      daysRemaining: Math.max(0, daysRemaining),
      isTrial,
      clienteData: profile
        ? {
            id: profile.id,
            situacao: profile.situacao,
            plano: profile.plano,
            data_vencimento: profile.data_vencimento,
            valor_pago: profile.valor_pago,
            cliente_ativo: profile.cliente_ativo,
          }
        : undefined,
    };
  } catch (e) {
    // Fallback rápido se timeout ou erro
    const fallbackRole = getRoleFallback() || 'client';

    return {
      id: user.id,
      nome: user.email?.split('@')[0] || 'Usuário',
      email: user.email || '',
      telefone: undefined,
      telefone_whatsapp: undefined,
      origem_cadastro: undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      roles: [fallbackRole],
      isMaster: fallbackRole === 'master',
      isAdmin: fallbackRole === 'admin' || fallbackRole === 'master',
      isClient: fallbackRole === 'client',
      hasValidAccess: fallbackRole === 'admin' || fallbackRole === 'master',
      isExpired: false,
      daysRemaining: 0,
      isTrial: false,
      clienteData: undefined,
    };
  }
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

  /**
   * Força atualização dos dados do usuário
   */
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

  /**
   * Logout
   */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  useEffect(() => {
    // Safety timeout reduzido para 5s
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[AuthContext] Safety timeout triggered after 5s');
        setLoading(false);
      }
    }, 5000);

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
