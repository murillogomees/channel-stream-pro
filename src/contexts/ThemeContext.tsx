import { createContext, useContext, useEffect, useState, type FC, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Theme = 'dark' | 'light' | 'sepia' | 'high-contrast';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isSyncing: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get user from Supabase directly to avoid circular dependency with AuthContext
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('app-theme') as Theme;
    return stored || 'dark';
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Load theme from database when user logs in
  useEffect(() => {
    if (userId) {
      loadThemeFromDatabase(userId);
    }
  }, [userId]);

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
    } catch (error) {
      console.error('Error loading theme from database:', error);
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
      console.error('Error saving theme to database:', error);
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