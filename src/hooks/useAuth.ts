import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

type UserRole = 'client' | 'admin' | null;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async (userId: string): Promise<UserRole> => {
    try {
      // 1) Verificar se é admin usando a função has_role (preferida)
      const { data: isAdmin, error: adminError } = await supabase
        .rpc('has_role', { _user_id: userId, _role: 'admin' });

      if (!adminError) {
        return isAdmin ? 'admin' : 'client';
      }

      // Se erro for relacionado a role inválida no JWT, mostrar erro claro e não assumir role
      if (adminError.code === '42704' || adminError.message?.includes('role') || adminError.code === '22023') {
        console.error('❌ JWT contém role inválida. Vá em Supabase → Authentication → Hooks e remova qualquer hook que seta claims.role para "admin".', adminError);
        return null; // Não assumir nenhum role
      }
      // Erro transitório do PostgREST (schema cache)
      if ((adminError as any)?.code === 'PGRST002' || adminError.message?.includes('schema cache')) {
        console.warn('PostgREST indisponível ao checar role (PGRST002). Tentando novamente...');
        return null; // sinaliza para retentar
      }

      console.warn('RPC has_role falhou, aplicando fallback via tabela user_roles:', adminError);

      // 2) Fallback seguro: consultar diretamente a tabela user_roles (RLS permite visualizar o próprio registro)
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles' as any)
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        if ((rolesError as any)?.code === 'PGRST002' || rolesError.message?.includes('schema cache')) {
          console.warn('PostgREST indisponível ao consultar user_roles (PGRST002). Retentativa necessária...');
          return null;
        }
        console.error('Erro ao consultar user_roles como fallback:', rolesError);
        return null;
      }

      const hasAdmin = roles?.some((r: any) => r.role === 'admin');
      const hasClient = roles?.some((r: any) => r.role === 'client');
      if (hasAdmin) return 'admin';
      if (hasClient) return 'client';
      return null;
    } catch (error: any) {
      if (error?.code === 'PGRST002' || error?.message?.includes('schema cache')) {
        console.warn('PostgREST indisponível ao checar role (PGRST002). Tentando novamente...');
        return null;
      }
      console.error('Error fetching user role:', error);
      return null;
    }
  }, []);

  const updateAuthState = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    
    if (currentSession?.user) {
      // 1) Preferir claim do JWT adicionada pelo hook (claims.user_role)
      const userRoleClaim = (currentSession.user.user_metadata as any)?.user_role as string | undefined;
      if (userRoleClaim === 'admin' || userRoleClaim === 'client') {
        setRole(userRoleClaim as UserRole);
        setLoading(false);
        return;
      }

      // 2) Fallback para RPC com pequenas retentativas em caso de indisponibilidade
      setLoading(true);
      const attempt = async (retries = 3): Promise<UserRole> => {
        const r = await fetchUserRole(currentSession.user!.id);
        if (r !== null) return r;
        if (retries <= 0) return null;
        await new Promise((res) => setTimeout(res, 700));
        return attempt(retries - 1);
      };

      const finalRole = await attempt();
      setRole(finalRole);
    } else {
      setRole(null);
    }
    
    setLoading(false);
  }, [fetchUserRole]);

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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return {
    user,
    session,
    role,
    isAuthenticated: !!session,
    isAdmin: role === 'admin',
    isClient: role === 'client',
    loading,
    signOut,
  };
};
