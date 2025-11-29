import { createContext, useContext, useEffect, useState, type FC, type ReactNode } from '@/lib/react-shim';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Theme = 'dark' | 'light' | 'sepia' | 'high-contrast';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isSyncing: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('app-theme') as Theme;
    return stored || 'dark';
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Load theme from database when user logs in
  useEffect(() => {
    if (user?.id) {
      loadThemeFromDatabase();
    }
  }, [user?.id]);

  const loadThemeFromDatabase = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', user?.id)
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
    if (!user?.id) return;

    try {
      setIsSyncing(true);
      const { error } = await supabase
        .from('profiles')
        .update({ theme: newTheme })
        .eq('id', user.id);

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