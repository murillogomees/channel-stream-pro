/**
 * CONTEXTO UNIFICADO DE AUTENTICAÇÃO
 * 
 * Gerencia autenticação e autorização usando:
 * - Supabase Auth para identidade
 * - public.profiles para dados de perfil
 * - public.user_roles para permissões
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType, UnifiedUser, AppRole } from '@/types/auth';
import { authLoggingService } from '@/services/authLoggingService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Busca dados completos do usuário: perfil + roles + dados de cliente
   */
  const fetchUserData = useCallback(async (userId: string): Promise<UnifiedUser | null> => {
    try {
      console.log('[AuthContext] Buscando dados do usuário:', userId);
      
      // 1. Buscar perfil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('[AuthContext] Erro ao buscar perfil:', profileError);
        return null;
      }
      
      console.log('[AuthContext] Perfil encontrado:', profile);

      // 2. Buscar roles com fallback robusto (RLS-safe)
      let roles: AppRole[] = [];
      try {
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (rolesError) {
          console.warn('[AuthContext] Erro ao buscar roles via tabela, tentando fallback RPC:', rolesError);
        } else {
          roles = (rolesData || []).map((r) => r.role as AppRole);
        }
      } catch (e) {
        console.warn('[AuthContext] Exceção ao buscar roles via tabela, tentando fallback RPC:', e);
      }

      // Fallback: usar RPC has_role (SECURITY DEFINER) para ignorar RLS
      try {
        const [{ data: isAdminRpc }, { data: isClientRpc }] = await Promise.all([
          supabase.rpc('has_role', { _user_id: userId, _role: 'admin' as any }),
          supabase.rpc('has_role', { _user_id: userId, _role: 'client' as any }),
        ]);

        if (isAdminRpc) roles = Array.from(new Set([...roles, 'admin' as AppRole]));
        if (isClientRpc) roles = Array.from(new Set([...roles, 'client' as AppRole]));
      } catch (e) {
        console.warn('[AuthContext] Fallback RPC has_role falhou:', e);
      }

      console.log('[AuthContext] Roles finais:', roles);

      // 3. Buscar dados de cliente (se existir)
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // 4. Montar objeto unificado
      const unifiedUser: UnifiedUser = {
        ...profile,
        roles,
        isAdmin: roles.includes('admin') || roles.includes('super_admin'),
        isSuperAdmin: roles.includes('super_admin'),
        isClient: roles.includes('client'),
        clienteData: clienteData ? {
          id: clienteData.id,
          situacao: clienteData.situacao,
          plano: clienteData.plano,
          data_vencimento: clienteData.data_vencimento,
          valor_pago: clienteData.valor_pago,
          cliente_ativo: clienteData.cliente_ativo,
          mac_smart_one: clienteData.mac_smart_one,
          usuario_m3u: clienteData.usuario_m3u,
          senha_m3u: clienteData.senha_m3u,
        } : undefined
      };

      console.log('[AuthContext] Usuário unificado criado:', {
        email: unifiedUser.email,
        roles: unifiedUser.roles,
        isAdmin: unifiedUser.isAdmin,
        isSuperAdmin: unifiedUser.isSuperAdmin,
        isClient: unifiedUser.isClient
      });

      return unifiedUser;
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return null;
    }
  }, []);

  /**
   * Atualiza estado de autenticação
   */
  const updateAuthState = useCallback(async (currentSession: Session | null) => {
    console.log('[AuthContext] Atualizando estado de autenticação:', {
      hasSession: !!currentSession,
      userId: currentSession?.user?.id
    });
    
    setSession(currentSession);
    
    if (currentSession?.user) {
      const userData = await fetchUserData(currentSession.user.id);
      console.log('[AuthContext] Dados do usuário carregados:', !!userData);
      setUser(userData);
      
      // Registrar login
      if (userData) {
        setTimeout(() => {
          authLoggingService.logLogin(
            currentSession.user.id,
            userData.email || currentSession.user.email || ''
          );
        }, 0);
      }
    } else {
      console.log('[AuthContext] Sem sessão, limpando usuário');
      setUser(null);
    }
    
    setLoading(false);
  }, [fetchUserData]);

  /**
   * Força atualização dos dados do usuário
   */
  const refreshUser = useCallback(async () => {
    if (session?.user) {
      const userData = await fetchUserData(session.user.id);
      setUser(userData);
    }
  }, [session, fetchUserData]);

  /**
   * Logout
   */
  const signOut = useCallback(async () => {
    // Registrar logout antes de fazer signOut
    if (user) {
      await authLoggingService.logLogout(user.id, user.email || '');
    }
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [user]);

  useEffect(() => {
    // Configurar listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        // Usar setTimeout para evitar deadlock
        setTimeout(() => {
          updateAuthState(currentSession);
        }, 0);
      }
    );

    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      updateAuthState(currentSession);
    });

    return () => subscription.unsubscribe();
  }, [updateAuthState]);

  const value: AuthContextType = {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    isAdmin: user?.isAdmin || false,
    isSuperAdmin: user?.isSuperAdmin || false,
    isClient: user?.isClient || false,
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
