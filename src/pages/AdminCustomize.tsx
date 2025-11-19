import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Palette, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AdminCustomize() {
  const navigate = useNavigate();
  const [colors, setColors] = useState({
    primary: '#0EA5E9',
    secondary: '#8B5CF6',
    accent: '#F59E0B',
    background: '#0A0A0B',
    foreground: '#FFFFFF',
  });

  const handleColorChange = (key: string, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Salvar no localStorage ou banco de dados
    localStorage.setItem('theme_colors', JSON.stringify(colors));
    toast.success('Cores personalizadas salvas!');
  };

  const handleReset = () => {
    const defaultColors = {
      primary: '#0EA5E9',
      secondary: '#8B5CF6',
      accent: '#F59E0B',
      background: '#0A0A0B',
      foreground: '#FFFFFF',
    };
    setColors(defaultColors);
    localStorage.setItem('theme_colors', JSON.stringify(defaultColors));
    toast.success('Cores redefinidas para o padrão!');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Palette className="h-8 w-8" />
              Customização
            </h1>
            <p className="text-muted-foreground">
              Personalize as cores e aparência do sistema
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cores do Sistema</CardTitle>
            <CardDescription>
              Defina as cores principais do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(colors).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key} className="capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id={key}
                      type="color"
                      value={value}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-20 h-10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={value}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="flex-1"
                      placeholder="#000000"
                    />
                  </div>
                  <div
                    className="h-12 rounded-md border"
                    style={{ backgroundColor: value }}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
              <Button onClick={handleReset} variant="outline">
                Redefinir Padrão
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
            <CardDescription>
              Veja como as cores aparecem nos componentes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button style={{ backgroundColor: colors.primary, color: colors.background }}>
                Botão Primary
              </Button>
              <Button variant="secondary" style={{ backgroundColor: colors.secondary, color: colors.background }}>
                Botão Secondary
              </Button>
              <Button variant="outline" style={{ borderColor: colors.accent, color: colors.accent }}>
                Botão Accent
              </Button>
            </div>

            <div className="p-4 rounded-lg border" style={{ backgroundColor: colors.background, color: colors.foreground }}>
              <p className="font-medium">Texto sobre Background</p>
              <p className="text-sm opacity-70">Este é um exemplo de texto com a cor foreground</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
