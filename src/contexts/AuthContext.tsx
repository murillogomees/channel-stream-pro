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
  const withTimeout = <T,>(promise: PromiseLike<T>, ms: number): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    );
    return Promise.race([Promise.resolve(promise), timeoutPromise]);
  };

  // Fallback seguro: tenta extrair role do JWT (claim assinado)
  const getRoleFromJwt = (token?: string): AppRole | null => {
    try {
      if (token) {
        const parts = token.split('.');
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
    return null;
  };

  const getRoleFallback = (): AppRole | null => {
    // 1) JWT claims
    const jwtRole = getRoleFromJwt(accessToken);
    if (jwtRole) return jwtRole;

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
    // 1) ROLE — Primeiro tentar refresh do token para obter JWT atualizado com role do hook
    let role: AppRole = getRoleFallback() || 'client';

    // Se JWT diz 'client', tentar refresh para pegar token atualizado do custom_access_token_hook
    if (role === 'client') {
      try {
        console.log('[AuthContext] JWT role is client, attempting token refresh...');
        const { data: refreshData } = await withTimeout(
          supabase.auth.refreshSession(),
          5000
        );
        if (refreshData?.session?.access_token) {
          const refreshedRole = getRoleFromJwt(refreshData.session.access_token);
          if (refreshedRole) {
            console.log('[AuthContext] Refreshed JWT role:', refreshedRole);
            role = refreshedRole;
            // Update the access token for later use
            accessToken = refreshData.session.access_token;
          }
        }
      } catch (e) {
        console.warn('[AuthContext] Token refresh failed:', e);
      }
    }

    const resolveRoleViaRpc = async (): Promise<AppRole | null> => {
      try {
        console.log('[AuthContext] Resolving role via RPC for user:', user.id);

        // Primeiro: is_admin_or_master (não depende de enum, tende a ser mais robusto)
        const { data: isAdminOrMaster, error: errAdmMaster } = await withTimeout(
          supabase.rpc('is_admin_or_master', { check_user_id: user.id }),
          7000
        );
        console.log('[AuthContext] RPC is_admin_or_master:', { isAdminOrMaster, error: errAdmMaster?.message });

        if (isAdminOrMaster === true) {
          // Se é admin/master, tentar diferenciar master
          const { data: isMaster, error: errMaster } = await withTimeout(
            supabase.rpc('has_role', { check_user_id: user.id, check_role: 'master' }),
            7000
          );
          console.log('[AuthContext] RPC has_role(master):', { isMaster, error: errMaster?.message });
          if (isMaster === true) return 'master';

          return 'admin';
        }

        // Se não é admin/master, confirmar client
        const { data: isClient, error: errClient } = await withTimeout(
          supabase.rpc('has_role', { check_user_id: user.id, check_role: 'client' }),
          7000
        );
        console.log('[AuthContext] RPC has_role(client):', { isClient, error: errClient?.message });
        if (isClient === true) return 'client';

      } catch (e) {
        console.warn('[AuthContext] Role RPC resolution failed:', e);
      }
      return null;
    };

    // Só tentar RPC/DB se JWT não resolveu como master/admin
    if (role === 'client') {
      const rpcRole = await resolveRoleViaRpc();
      if (rpcRole) {
        role = rpcRole;
        console.log('[AuthContext] Role resolved via RPC:', role);
      } else {
        // Fallback: query direta na tabela
        try {
          const { data: rolesData, error: rolesError } = await withTimeout(
            supabase.from('user_roles').select('role').eq('user_id', user.id),
            8000
          );
          console.log('[AuthContext] user_roles query:', { rolesData, error: rolesError?.message });

          if (!rolesError && rolesData && rolesData.length > 0) {
            role = pickRole(rolesData as Array<{ role: AppRole }>);
            console.log('[AuthContext] Role resolved via table:', role);
          }
        } catch (e) {
          console.warn('[AuthContext] user_roles fetch timeout/error:', e);
        }
      }
    } else {
      console.log('[AuthContext] Role already resolved from JWT:', role);
    }

    console.log('[AuthContext] Final role for', user.email, ':', role);
    // 2) Profile (melhor esforço)
    let profile: any = null;
    try {
      const { data, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select(
            'id,nome,email,contact_phone,origem_cadastro,created_at,updated_at,situacao,plano,data_vencimento,valor_pago,cliente_ativo'
          )
          .eq('id', user.id)
          .maybeSingle(),
        5000
      );
      if (profileError) console.warn('[AuthContext] profiles fetch error:', profileError);
      profile = data;
    } catch (e) {
      console.warn('[AuthContext] profiles fetch timeout/error:', e);
    }
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
    let isMounted = true;
    let authResolved = false;
    
    // Safety timeout aumentado para 12s (RPC pode demorar)
    const safetyTimeout = setTimeout(() => {
      if (loading && isMounted && !authResolved) {
        console.warn('[AuthContext] Safety timeout triggered after 12s - forcing login redirect');
        setUser(null);
        setSession(null);
        setLoading(false);
      }
    }, 12000);

    // Listener de mudanças de autenticação - DEVE ser primeiro
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!isMounted) return;
        
        console.log('[AuthContext] Auth event:', event);
        
        // Usar setTimeout para evitar deadlock
        setTimeout(() => {
          if (isMounted) {
            authResolved = true;
            updateAuthState(currentSession);
          }
        }, 0);
      }
    );

    // Verificar sessão inicial
    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (isMounted) {
          authResolved = true;
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
    hasValidAccess: user?.hasValidAccess || isAdmin, // master/admin sempre válido
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
