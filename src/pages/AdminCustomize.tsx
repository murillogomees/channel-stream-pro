import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Download, Upload, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useSettingsContext } from "@/context/SettingsContext";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const AdminCustomize = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings, updateSettings, resetSettings, lastUpdated } = useSettingsContext();
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [jsonConfig, setJsonConfig] = useState("");
  const [loading, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/admin/login');
      return;
    }
    
    setJsonConfig(JSON.stringify(settings, null, 2));
  }, [navigate, settings, isAdmin, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const handleSave = () => {
    setSaving(true);
    try {
      const newSettings = JSON.parse(jsonConfig);
      updateSettings(newSettings);
      toast({
        title: "Configurações salvas",
        description: "As alterações foram aplicadas com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro no JSON",
        description: "Verifique a sintaxe do JSON e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Tem certeza que deseja restaurar as configurações padrão?")) {
      resetSettings();
      // Wait for settings to update before updating JSON
      setTimeout(() => {
        setJsonConfig(JSON.stringify(settings, null, 2));
      }, 100);
      toast({
        title: "Configurações restauradas",
        description: "As configurações foram restauradas para o padrão.",
      });
    }
  };

  const handleDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonConfig);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "settings.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setJsonConfig(content);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-gradient-primary">Personalizar Site</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuração Settings.json do Site</CardTitle>
            <CardDescription>
              Controle total do site através do settings.json. Inclui tema, tipografia, ícones, assets, 
              layout, componentes, textos, planos, thumbnails e todas as configurações da página inicial.
              Este arquivo tem precedência suprema sobre qualquer outro estilo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSave} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download Settings
              </Button>
              <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Settings
              </Button>
              <Button variant="destructive" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar Padrão
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".json"
                onChange={handleUpload}
                className="hidden"
              />
            </div>

            {lastUpdated && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-lg">
                <p className="text-sm">
                  ✅ Configurações aplicadas com sucesso em {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
            )}

            <Textarea
              value={jsonConfig}
              onChange={(e) => setJsonConfig(e.target.value)}
              placeholder="Configuração Settings.json do site..."
              className="min-h-[600px] font-mono text-sm"
            />

            <div className="bg-muted/20 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Estrutura do Settings.json:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li><strong>theme:</strong> Cores, gradientes e tokens (precedência suprema)</li>
                <li><strong>typography:</strong> Fontes, tamanhos, pesos e espaçamentos</li>
                <li><strong>assets:</strong> Logos, imagens hero, thumbnails e fallbacks</li>
                <li><strong>icons:</strong> Mapeamento de ícones por nome</li>
                <li><strong>layout:</strong> Container, grid, breakpoints responsivos</li>
                <li><strong>components:</strong> Configurações específicas de hero, cards, botões</li>
                <li><strong>movies.cards:</strong> Thumbnails e CTAs dos cards de filmes</li>
                <li><strong>accessibility:</strong> Contraste, motion e ARIA labels</li>
                <li><strong>i18n:</strong> Idioma padrão e strings localizadas</li>
                <li><strong>seo:</strong> Meta tags, OpenGraph e keywords</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCustomize;