/**
 * ThemeContext - Gerenciamento de tema
 * @version 2.0.0
 * 
 * OTIMIZADO: Usa AuthContext para evitar requisições duplicadas
 */

import { createContext, useContext, useEffect, useState, type FC, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export type Theme = 'dark' | 'light' | 'sepia' | 'high-contrast';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isSyncing: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Armazenar userId globalmente para evitar loop com AuthContext
let cachedUserId: string | null = null;
let authSubscription: (() => void) | null = null;

export const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('app-theme') as Theme;
    return stored || 'dark';
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [userId, setUserId] = useState<string | null>(cachedUserId);
  const [hasLoadedFromDb, setHasLoadedFromDb] = useState(false);

  // Sincronizar com auth state apenas uma vez
  useEffect(() => {
    // Evitar múltiplas subscrições
    if (authSubscription) return;
    
    // Listener único para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const newUserId = session?.user?.id || null;
      if (newUserId !== cachedUserId) {
        cachedUserId = newUserId;
        setUserId(newUserId);
        setHasLoadedFromDb(false); // Reset para recarregar tema
      }
    });
    
    authSubscription = () => subscription.unsubscribe();
    
    // Apenas verificar sessão inicial se não temos userId
    if (!cachedUserId) {
      supabase.auth.getSession().then(({ data }) => {
        const newUserId = data.session?.user?.id || null;
        if (newUserId !== cachedUserId) {
          cachedUserId = newUserId;
          setUserId(newUserId);
        }
      });
    }
    
    return () => {
      // Não limpar subscription global - manter ativa
    };
  }, []);

  // Carregar tema do banco apenas uma vez por usuário
  useEffect(() => {
    if (userId && !hasLoadedFromDb) {
      loadThemeFromDatabase(userId);
    }
  }, [userId, hasLoadedFromDb]);

  const loadThemeFromDatabase = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', uid)
        .single();

      if (error) throw error;

      if (data?.theme) {
        setThemeState(data.theme as Theme);
        localStorage.setItem('app-theme', data.theme);
      }
      setHasLoadedFromDb(true);
    } catch (error) {
      console.error('[ThemeContext] Error loading theme:', error);
      setHasLoadedFromDb(true); // Marcar como carregado mesmo em erro
    }
  };

  const saveThemeToDatabase = async (newTheme: Theme) => {
    if (!userId) return;

    try {
      setIsSyncing(true);
      const { error } = await supabase
        .from('profiles')
        .update({ theme: newTheme })
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      console.error('[ThemeContext] Error saving theme:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Remove todas as classes de tema
    document.documentElement.classList.remove('dark', 'light', 'sepia', 'high-contrast');
    
    // Adiciona a classe do tema atual
    document.documentElement.classList.add(theme);
    
    // Salva no localStorage
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    saveThemeToDatabase(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isSyncing }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
