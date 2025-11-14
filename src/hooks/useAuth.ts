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
      // Usar a função has_role para verificar se é admin
      const { data: isAdmin, error: adminError } = await supabase
        .rpc('has_role', { _user_id: userId, _role: 'admin' });
      
      if (adminError) {
        console.error('Error checking admin role:', adminError);
        return 'client';
      }
      
      return isAdmin ? 'admin' : 'client';
    } catch (error) {
      console.error('Error fetching user role:', error);
      return 'client';
    }
  }, []);

  const updateAuthState = useCallback(async (currentSession: Session | null) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    
    if (currentSession?.user) {
      const userRole = await fetchUserRole(currentSession.user.id);
      setRole(userRole);
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
