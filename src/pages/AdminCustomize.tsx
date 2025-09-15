import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Palette, Type, Image, Phone, Clock, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SiteConfig {
  [key: string]: any;
}

const AdminCustomize = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<SiteConfig>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadConfigurations();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      navigate('/admin/login');
      return;
    }

    const { data: adminData } = await supabase
      .from('admins')
      .select('*')
      .or(`id.eq.${user.id},email.eq.${user.email}`)
      .single();

    if (!adminData) {
      navigate('/admin/login');
      return;
    }
  };

  const loadConfigurations = async () => {
    try {
      const { data, error } = await supabase
        .from('site_configurations')
        .select('*');

      if (error) throw error;

      const configMap: SiteConfig = {};
      data?.forEach(config => {
        if (!configMap[config.section]) {
          configMap[config.section] = {};
        }
        configMap[config.section][config.key] = config.value;
      });

      setConfigs(configMap);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (section: string, key: string, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const saveConfigurations = async () => {
    setSaving(true);
    try {
      for (const section in configs) {
        for (const key in configs[section]) {
          await supabase
            .from('site_configurations')
            .upsert({
              section,
              key,
              value: configs[section][key]
            }, { onConflict: 'section,key' });
        }
      }

      toast({
        title: "Configurações salvas",
        description: "Todas as alterações foram aplicadas com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

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
          <Button onClick={saveConfigurations} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>

        <Tabs defaultValue="header" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="header">Header</TabsTrigger>
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="contact">Contato</TabsTrigger>
            <TabsTrigger value="theme">Tema</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
          </TabsList>

          {/* Header Configuration */}
          <TabsContent value="header" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Configurações do Header
                </CardTitle>
                <CardDescription>
                  Configure o logotipo, título e elementos do cabeçalho
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="logo-url">URL do Logotipo</Label>
                  <Input
                    id="logo-url"
                    value={configs.header?.logo?.url || ''}
                    onChange={(e) => updateConfig('header', 'logo', { ...configs.header?.logo, url: e.target.value })}
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
                <div>
                  <Label htmlFor="logo-alt">Texto Alternativo do Logo</Label>
                  <Input
                    id="logo-alt"
                    value={configs.header?.logo?.alt || ''}
                    onChange={(e) => updateConfig('header', 'logo', { ...configs.header?.logo, alt: e.target.value })}
                    placeholder="IPTV Premium"
                  />
                </div>
                <div>
                  <Label htmlFor="header-title">Título do Site</Label>
                  <Input
                    id="header-title"
                    value={configs.header?.title?.text || ''}
                    onChange={(e) => updateConfig('header', 'title', { ...configs.header?.title, text: e.target.value })}
                    placeholder="IPTV Premium"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hero Configuration */}
          <TabsContent value="hero" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Seção Hero
                </CardTitle>
                <CardDescription>
                  Configure o título principal e subtítulo da página inicial
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="hero-title">Título Principal</Label>
                  <Input
                    id="hero-title"
                    value={configs.hero?.title?.text || ''}
                    onChange={(e) => updateConfig('hero', 'title', { ...configs.hero?.title, text: e.target.value })}
                    placeholder="Entretenimento Premium em suas mãos"
                  />
                </div>
                <div>
                  <Label htmlFor="hero-subtitle">Subtítulo</Label>
                  <Textarea
                    id="hero-subtitle"
                    value={configs.hero?.subtitle?.text || ''}
                    onChange={(e) => updateConfig('hero', 'subtitle', { ...configs.hero?.subtitle, text: e.target.value })}
                    placeholder="Acesse milhares de canais, filmes e séries em alta definição..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="hero-bg">URL da Imagem de Fundo</Label>
                  <Input
                    id="hero-bg"
                    value={configs.hero?.background?.image || ''}
                    onChange={(e) => updateConfig('hero', 'background', { ...configs.hero?.background, image: e.target.value })}
                    placeholder="/src/assets/hero-bg.jpg"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Configuration */}
          <TabsContent value="plans" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Planos e Preços
                </CardTitle>
                <CardDescription>
                  Configure os planos, preços e características
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="plans-title">Título da Seção</Label>
                  <Input
                    id="plans-title"
                    value={configs.plans?.title?.text || ''}
                    onChange={(e) => updateConfig('plans', 'title', { ...configs.plans?.title, text: e.target.value })}
                    placeholder="Escolha seu Plano"
                  />
                </div>
                <div>
                  <Label>Configuração dos Planos (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(configs.plans?.plans || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateConfig('plans', 'plans', parsed);
                      } catch (error) {
                        // Invalid JSON, don't update
                      }
                    }}
                    placeholder="Configuração JSON dos planos..."
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Configuration */}
          <TabsContent value="contact" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Informações de Contato
                </CardTitle>
                <CardDescription>
                  Configure telefones, emails, endereço e horários
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone-primary">Telefone Principal</Label>
                    <Input
                      id="phone-primary"
                      value={configs.contact?.phones?.primary || ''}
                      onChange={(e) => updateConfig('contact', 'phones', { ...configs.contact?.phones, primary: e.target.value })}
                      placeholder="+55 11 99999-9999"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone-secondary">Telefone Secundário</Label>
                    <Input
                      id="phone-secondary"
                      value={configs.contact?.phones?.secondary || ''}
                      onChange={(e) => updateConfig('contact', 'phones', { ...configs.contact?.phones, secondary: e.target.value })}
                      placeholder="+55 11 88888-8888"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email-primary">Email Principal</Label>
                    <Input
                      id="email-primary"
                      value={configs.contact?.email?.primary || ''}
                      onChange={(e) => updateConfig('contact', 'email', { ...configs.contact?.email, primary: e.target.value })}
                      placeholder="contato@iptvpremium.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email-secondary">Email Secundário</Label>
                    <Input
                      id="email-secondary"
                      value={configs.contact?.email?.secondary || ''}
                      onChange={(e) => updateConfig('contact', 'email', { ...configs.contact?.email, secondary: e.target.value })}
                      placeholder="suporte@iptvpremium.com"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={configs.contact?.social?.whatsapp || ''}
                    onChange={(e) => updateConfig('contact', 'social', { ...configs.contact?.social, whatsapp: e.target.value })}
                    placeholder="+5511999999999"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hours-weekdays">Horário Semana</Label>
                    <Input
                      id="hours-weekdays"
                      value={configs.contact?.hours?.weekdays || ''}
                      onChange={(e) => updateConfig('contact', 'hours', { ...configs.contact?.hours, weekdays: e.target.value })}
                      placeholder="Segunda a Sexta: 8h às 18h"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hours-weekend">Horário Fim de Semana</Label>
                    <Input
                      id="hours-weekend"
                      value={configs.contact?.hours?.weekend || ''}
                      onChange={(e) => updateConfig('contact', 'hours', { ...configs.contact?.hours, weekend: e.target.value })}
                      placeholder="Sábado: 9h às 17h"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theme Configuration */}
          <TabsContent value="theme" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Cores e Fontes
                </CardTitle>
                <CardDescription>
                  Configure as cores principais e estilos de fonte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="color-primary">Cor Primária</Label>
                    <Input
                      id="color-primary"
                      value={configs.theme?.colors?.primary || ''}
                      onChange={(e) => updateConfig('theme', 'colors', { ...configs.theme?.colors, primary: e.target.value })}
                      placeholder="hsl(142, 76%, 36%)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="color-secondary">Cor Secundária</Label>
                    <Input
                      id="color-secondary"
                      value={configs.theme?.colors?.secondary || ''}
                      onChange={(e) => updateConfig('theme', 'colors', { ...configs.theme?.colors, secondary: e.target.value })}
                      placeholder="hsl(142, 76%, 20%)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="color-accent">Cor de Destaque</Label>
                    <Input
                      id="color-accent"
                      value={configs.theme?.colors?.accent || ''}
                      onChange={(e) => updateConfig('theme', 'colors', { ...configs.theme?.colors, accent: e.target.value })}
                      placeholder="hsl(142, 76%, 50%)"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Menu Configuration */}
          <TabsContent value="menu" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Menu de Navegação</CardTitle>
                <CardDescription>
                  Configure os itens do menu principal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div>
                  <Label>Itens do Menu (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(configs.header?.menu || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateConfig('header', 'menu', parsed);
                      } catch (error) {
                        // Invalid JSON, don't update
                      }
                    }}
                    placeholder="Configuração JSON do menu..."
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminCustomize;