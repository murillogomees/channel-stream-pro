import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle, Download, Info, Search, Settings, Tv } from "lucide-react";
import { z } from "zod";
import { validateBrazilianPhone } from "@/utils/phoneValidator";

// Importar imagens do tutorial
import img01 from "@/assets/tutorial/01-app-store-search.png";
import img02 from "@/assets/tutorial/02-app-install.png";
import img03 from "@/assets/tutorial/03-app-home.png";
import img04 from "@/assets/tutorial/04-settings-menu.png";
import img05 from "@/assets/tutorial/05-mac-address.png";

const prospectoSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  celular: z.string().trim().min(1, "Celular é obrigatório"),
  mac: z.string()
    .trim()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "MAC Address inválido (ex: 12:34:56:78:9A:BC)"),
});

const Tutorial = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    celular: "",
    mac: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpar erro do campo quando usuário digita
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validar telefone brasileiro
    const phoneValidation = validateBrazilianPhone(formData.celular);
    if (!phoneValidation.isValid) {
      setErrors({ celular: phoneValidation.error || "Número inválido" });
      return;
    }

    // Validar outros campos
    try {
      prospectoSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
        return;
      }
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("prospectos").insert({
        nome: formData.nome,
        email: formData.email,
        celular: phoneValidation.formatted || formData.celular,
        mac: formData.mac.toUpperCase(),
        status: "aguardando_validacao",
      });

      if (error) throw error;

      toast({
        title: "Cadastro enviado! 🎉",
        description: "Aguarde a validação do seu acesso. Em breve você receberá um e-mail de confirmação.",
      });

      // Resetar formulário
      setFormData({ nome: "", email: "", celular: "", mac: "" });
    } catch (error: any) {
      console.error("Erro ao enviar cadastro:", error);
      toast({
        title: "Erro ao enviar cadastro",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tutorial de Instalação</h1>
            <p className="text-sm text-muted-foreground">SmartOne IPTV na sua Smart TV</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs defaultValue="texto" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="texto">📝 Tutorial em Texto</TabsTrigger>
            <TabsTrigger value="imagens">🖼️ Tutorial com Imagens</TabsTrigger>
          </TabsList>

          {/* Tutorial em Texto */}
          <TabsContent value="texto">
            <Card>
              <CardHeader>
                <CardTitle>Como instalar o SmartOne IPTV e encontrar seu MAC Address</CardTitle>
                <CardDescription>Siga os passos abaixo para configurar seu acesso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Abra a loja de aplicativos da sua Smart TV</h3>
                      <p className="text-muted-foreground">
                        Procure pelo ícone da loja no menu principal da sua TV (Google Play Store, LG Content Store, Samsung Apps, etc.)
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Pesquise por "SmartOne IPTV"</h3>
                      <p className="text-muted-foreground">Use a barra de busca da loja e digite exatamente "SmartOne IPTV"</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Clique em Instalar / Download</h3>
                      <p className="text-muted-foreground">Aguarde o download e instalação automática do aplicativo</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      4
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Abra o aplicativo</h3>
                      <p className="text-muted-foreground">Após a instalação, clique em "Abrir" ou encontre o app no menu de aplicativos</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      5
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Vá até Settings (Configurações)</h3>
                      <p className="text-muted-foreground">No menu principal do app, procure e clique em "Settings" ou "Configurações"</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      6
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Entre na seção "Info"</h3>
                      <p className="text-muted-foreground">Dentro de Settings, procure e clique na opção "Info" ou "Informações"</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      7
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Localize o MAC Address</h3>
                      <p className="text-muted-foreground">
                        Você verá uma sequência como: <code className="bg-muted px-2 py-1 rounded">12:34:56:78:9A:BC</code>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      8
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Copie ou anote o MAC Address</h3>
                      <p className="text-muted-foreground">
                        Anote exatamente como aparece na tela, incluindo os dois-pontos (:) ou hífens (-)
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                      9
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Preencha o formulário abaixo</h3>
                      <p className="text-muted-foreground">Role a página para baixo e complete o cadastro com seus dados e o MAC Address</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tutorial com Imagens */}
          <TabsContent value="imagens">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Search className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle>Passo 1: Busque o App</CardTitle>
                      <CardDescription>Abra a loja e pesquise "SmartOne IPTV"</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <img src={img01} alt="Buscar SmartOne IPTV na loja" className="w-full rounded-lg shadow-lg" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Download className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle>Passo 2: Instale o Aplicativo</CardTitle>
                      <CardDescription>Clique em "Instalar" ou "Download"</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <img src={img02} alt="Instalar SmartOne IPTV" className="w-full rounded-lg shadow-lg" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Tv className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle>Passo 3: Abra o App</CardTitle>
                      <CardDescription>Tela inicial do SmartOne IPTV</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <img src={img03} alt="Tela inicial SmartOne IPTV" className="w-full rounded-lg shadow-lg" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Settings className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle>Passo 4: Acesse Settings</CardTitle>
                      <CardDescription>Vá até o menu de configurações</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <img src={img04} alt="Menu Settings" className="w-full rounded-lg shadow-lg" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Info className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle>Passo 5: Localize o MAC Address</CardTitle>
                      <CardDescription>Na seção "Info", copie o MAC Address destacado</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <img src={img05} alt="MAC Address na tela Info" className="w-full rounded-lg shadow-lg" />
                  <div className="mt-4 p-4 bg-primary/10 border-l-4 border-primary rounded">
                    <p className="text-sm font-medium">
                      ⚠️ <strong>Importante:</strong> Anote ou fotografe o MAC Address exatamente como aparece na tela!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Formulário de Cadastro */}
        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              Complete seu Cadastro
            </CardTitle>
            <CardDescription>Preencha os dados abaixo para liberar seu acesso ao IPTV LINK</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    placeholder="João Silva"
                    value={formData.nome}
                    onChange={(e) => handleInputChange("nome", e.target.value)}
                    className={errors.nome ? "border-destructive" : ""}
                  />
                  {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="joao@exemplo.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="celular">Celular (WhatsApp) *</Label>
                  <Input
                    id="celular"
                    placeholder="5561996975924"
                    value={formData.celular}
                    onChange={(e) => handleInputChange("celular", e.target.value.replace(/\D/g, ""))}
                    className={errors.celular ? "border-destructive" : ""}
                  />
                  {errors.celular && <p className="text-sm text-destructive">{errors.celular}</p>}
                  <p className="text-xs text-muted-foreground">Formato: 55 + DDD + número (ex: 5561996975924)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mac">MAC Address *</Label>
                  <Input
                    id="mac"
                    placeholder="12:34:56:78:9A:BC"
                    value={formData.mac}
                    onChange={(e) => handleInputChange("mac", e.target.value.toUpperCase())}
                    className={errors.mac ? "border-destructive" : ""}
                  />
                  {errors.mac && <p className="text-sm text-destructive">{errors.mac}</p>}
                  <p className="text-xs text-muted-foreground">Formato: XX:XX:XX:XX:XX:XX</p>
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar e Continuar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Tutorial;
