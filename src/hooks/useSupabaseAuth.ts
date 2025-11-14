import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export const useSupabaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAdminRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      
      return !!data;
    } catch (error) {
      console.error('Error in checkAdminRole:', error);
      return false;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      if (currentSession?.user) {
        const hasAdminRole = await checkAdminRole(currentSession.user.id);
        setIsAdmin(hasAdminRole);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setSession(null);
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [checkAdminRole]);

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          const hasAdminRole = await checkAdminRole(currentSession.user.id);
          setIsAdmin(hasAdminRole);
        } else {
          setIsAdmin(false);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [checkAuth, checkAdminRole]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    isAdmin,
    isAuthenticated: !!session,
    loading,
    logout,
    checkAuth,
  };
};
