/**
 * CONTEXTO UNIFICADO DE AUTENTICAÇÃO
 * @version 2.0.4
 * @cache-bust 2025-11-29-v10
 * 
 * Gerencia autenticação e autorização usando:
 * - Supabase Auth para identidade
 * - public.profiles para dados de perfil
 * - public.user_roles para permissões
 */

import * as React from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType, UnifiedUser, AppRole } from '@/types/auth';
import { authLoggingService } from '@/services/authLoggingService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
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
   * Atualiza estado de autenticação (otimizado - libera loading ANTES de buscar dados extras)
   */
  const updateAuthState = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    
    if (currentSession?.user) {
      // CRÍTICO: Liberar loading IMEDIATAMENTE com dados básicos do session
      // Isso evita tela branca enquanto busca dados do perfil
      const basicUser: UnifiedUser = {
        id: currentSession.user.id,
        nome: currentSession.user.user_metadata?.nome || currentSession.user.email?.split('@')[0] || 'Usuário',
        email: currentSession.user.email || '',
        roles: [],
        isAdmin: false,
        isSuperAdmin: false,
        isClient: false,
        created_at: currentSession.user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setUser(basicUser);
      setLoading(false); // LIBERA A UI IMEDIATAMENTE
      
      // Buscar dados completos em background (não bloqueia a UI)
      try {
        const userData = await fetchUserData(currentSession.user.id);
        if (userData) {
          setUser(userData);
          
          // Registrar login de forma assíncrona (fire and forget)
          authLoggingService.logLogin(
            currentSession.user.id,
            userData.email || currentSession.user.email || ''
          ).catch(() => {}); // Silenciar erros de log
        }
      } catch (error) {
        console.error('[AuthContext] Erro ao buscar dados extras:', error);
        // Mantém o basicUser - não limpa o usuário
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
      cacheRef.current = null; // Invalidar cache
      const userData = await fetchUserData(session.user.id);
      setUser(userData);
    }
  }, [session, fetchUserData]);

  /**
   * Logout (limpa cache e remember me)
   */
  const signOut = useCallback(async () => {
    // Registrar logout antes de fazer signOut
    if (user) {
      await authLoggingService.logLogout(user.id, user.email || '').catch(console.error);
    }
    
    cacheRef.current = null; // Limpar cache
    localStorage.removeItem('iptv_remember_me'); // Limpar remember me
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [user]);

  useEffect(() => {
    const REMEMBER_ME_KEY = 'iptv_remember_me';
    
    // Timeout de segurança para evitar loading infinito
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('[AuthContext] Safety timeout triggered - forcing loading to false');
        setLoading(false);
      }
    }, 5000);

    // Verificar se "continuar conectado" expirou
    const checkRememberMe = () => {
      const stored = localStorage.getItem(REMEMBER_ME_KEY);
      if (stored) {
        try {
          const { expires } = JSON.parse(stored);
          if (Date.now() > expires) {
            console.log('[AuthContext] Remember me expirado, fazendo logout...');
            localStorage.removeItem(REMEMBER_ME_KEY);
            supabase.auth.signOut();
            return true; // Session expired
          }
        } catch {
          localStorage.removeItem(REMEMBER_ME_KEY);
        }
      }
      return false;
    };

    // Configurar listener de mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        // Usar setTimeout para evitar deadlock
        setTimeout(() => {
          // Se não tem remember me e está logado, verificar se deve sair
          if (currentSession && !localStorage.getItem(REMEMBER_ME_KEY)) {
            // Usuário não marcou "continuar conectado" - sessão normal
          }
          updateAuthState(currentSession);
        }, 0);
      }
    );

    // Verificar sessão inicial
    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        // Verificar remember me antes de carregar sessão
        if (currentSession && checkRememberMe()) {
          return; // Don't update auth state, logout in progress
        }
        updateAuthState(currentSession);
      })
      .catch((error) => {
        console.error('[AuthContext] Erro ao obter sessão:', error);
        setLoading(false);
      });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [updateAuthState, loading]);

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