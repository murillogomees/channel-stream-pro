import { Moon, Sun, FileText, Contrast, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useTheme, Theme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const themes: { value: Theme; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'dark',
    label: 'Escuro',
    icon: <Moon className="h-5 w-5" />,
    description: 'Tema escuro padrão com contraste balanceado'
  },
  {
    value: 'light',
    label: 'Claro',
    icon: <Sun className="h-5 w-5" />,
    description: 'Tema claro para ambientes bem iluminados'
  },
  {
    value: 'sepia',
    label: 'Sepia',
    icon: <FileText className="h-5 w-5" />,
    description: 'Tons sépia para reduzir fadiga visual'
  },
  {
    value: 'high-contrast',
    label: 'Alto Contraste',
    icon: <Contrast className="h-5 w-5" />,
    description: 'Contraste máximo para melhor acessibilidade'
  },
];

export const ThemeSelector = () => {
  const { theme, setTheme, isSyncing } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Tema da Interface
          {isSyncing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
        <CardDescription>
          Escolha o tema visual que melhor se adapta ao seu ambiente e preferências. Suas preferências são sincronizadas entre dispositivos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {themes.map((themeOption) => (
            <button
              key={themeOption.value}
              onClick={() => setTheme(themeOption.value)}
              className={`
                relative flex flex-col items-start gap-3 p-4 rounded-lg border-2 transition-all duration-300
                ${
                  theme === themeOption.value
                    ? 'border-primary bg-primary/5 shadow-glow'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              <div className="flex items-center gap-3 w-full">
                <div
                  className={`
                    p-2 rounded-lg transition-colors
                    ${theme === themeOption.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                  `}
                >
                  {themeOption.icon}
                </div>
                <div className="flex-1 text-left">
                  <Label className="text-base font-semibold cursor-pointer">
                    {themeOption.label}
                  </Label>
                </div>
                {theme === themeOption.value && (
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <p className="text-sm text-muted-foreground text-left">
                {themeOption.description}
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
