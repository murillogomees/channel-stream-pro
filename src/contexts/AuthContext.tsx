/**
 * CONTEXTO UNIFICADO DE AUTENTICAÇÃO
 * 
 * Gerencia autenticação e autorização usando:
 * - Supabase Auth para identidade
 * - public.profiles para dados de perfil
 * - public.user_roles para permissões
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType, UnifiedUser, AppRole } from '@/types/auth';
import { authLoggingService } from '@/services/authLoggingService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UnifiedUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<{ userId: string; data: UnifiedUser; timestamp: number } | null>(null);

  /**
   * Busca dados completos do usuário: perfil + roles + dados de cliente
   */
  const fetchUserData = useCallback(async (userId: string): Promise<UnifiedUser | null> => {
    try {
      // Fazer queries em paralelo (3 ao invés de 5+)
      const [profileResult, rolesResult, clienteResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase.from('clientes').select('id, situacao, plano, data_vencimento, valor_pago, cliente_ativo, mac_smart_one').eq('user_id', userId).maybeSingle()
      ]);

      if (profileResult.error) {
        console.error('[AuthContext] Erro ao buscar perfil:', profileResult.error);
        return null;
      }

      const profile = profileResult.data;
      const roles: AppRole[] = (rolesResult.data || []).map((r) => r.role as AppRole);
      const clienteData = clienteResult.data;

      // Montar objeto unificado
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
        } : undefined
      };

      return unifiedUser;
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return null;
    }
  }, []);

  /**
   * Atualiza estado de autenticação (com debounce para evitar chamadas repetidas)
   */
  const updateAuthState = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    
    if (currentSession?.user) {
      const userData = await fetchUserData(currentSession.user.id);
      setUser(userData);
      
      // Registrar login de forma assíncrona (não bloqueia UI)
      if (userData) {
        authLoggingService.logLogin(
          currentSession.user.id,
          userData.email || currentSession.user.email || ''
        ).catch(console.error);
      }
    } else {
      setUser(null);
    }
    
    setLoading(false);
  }, [fetchUserData]);

  /**
   * Força atualização dos dados do usuário (invalida cache)
   */
  const refreshUser = useCallback(async () => {
    if (session?.user) {
      cacheRef.current = null; // Invalidar cache
      const userData = await fetchUserData(session.user.id);
      setUser(userData);
    }
  }, [session, fetchUserData]);

  /**
   * Logout (limpa cache)
   */
  const signOut = useCallback(async () => {
    // Registrar logout antes de fazer signOut
    if (user) {
      await authLoggingService.logLogout(user.id, user.email || '').catch(console.error);
    }
    
    cacheRef.current = null; // Limpar cache
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
