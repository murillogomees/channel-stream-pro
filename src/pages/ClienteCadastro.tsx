import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { isCompromisedPasswordError, getCompromisedPasswordMessage, generatePasswordSuggestions } from "@/utils/passwordSecurity";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { PhoneInput } from "@/components/ui/phone-input";

const cadastroSchema = z.object({
  nome: z.string().trim().min(3, "Nome deve ter no mínimo 3 caracteres").max(200, "Nome muito longo"),
  telefone: z.string().trim().min(10, "Telefone inválido").max(15, "Telefone inválido"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100, "Senha muito longa"),
  confirmarSenha: z.string(),
  telegram: z.string().trim().max(100).optional(),
  macSmartOne: z.string().trim().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "Formato de MAC inválido (ex: AA:BB:CC:DD:EE:FF)").optional().or(z.literal('')),
  origemCadastro: z.enum(['Google Ads', 'Facebook', 'Instagram', 'Indicação', 'Website', 'Outro']),
}).refine((data) => data.senha === data.confirmarSenha, {
  message: "As senhas não coincidem",
  path: ["confirmarSenha"],
});

type CadastroFormData = z.infer<typeof cadastroSchema>;

const ClienteCadastro = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CadastroFormData>({
    nome: "",
    telefone: "",
    email: "",
    senha: "",
    confirmarSenha: "",
    telegram: "",
    macSmartOne: "",
    origemCadastro: "Website",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      // Step 1: Validate form data
      const validated = cadastroSchema.parse(formData);
      
      console.log('[ClienteCadastro] Starting registration for:', validated.email);
      
      // Step 2: Create user via edge function with HIBP validation
      console.log('[ClienteCadastro] Calling validate-password-signup edge function');
      
      const { data: signupData, error: functionError } = await supabase.functions.invoke('validate-password-signup', {
        body: {
          email: validated.email,
          password: validated.senha,
          nome: validated.nome,
          telefone: validated.telefone,
        }
      });

      if (functionError) {
        console.error('[ClienteCadastro] Edge function error:', functionError);
        throw new Error(functionError.message || 'Erro ao processar cadastro');
      }

      if (signupData?.error) {
        // Tratamento específico para senha comprometida
        if (signupData.code === 'auth/compromised_password') {
          const suggestions = generatePasswordSuggestions();
          toast({
            title: "Senha comprometida",
            description: signupData.error,
            variant: "destructive",
          });
          toast({
            title: "Sugestões de senha forte",
            description: `Experimente uma destas: ${suggestions[0]}, ${suggestions[1]}`,
          });
          setLoading(false);
          return;
        }
        throw new Error(signupData.error);
      }

      if (!signupData?.user) {
        throw new Error('Falha ao criar usuário. Tente novamente.');
      }

      console.log('[ClienteCadastro] User created:', signupData.user.id);

      // Autenticar com a sessão criada pela edge function
      if (signupData?.session) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: signupData.session.access_token,
          refresh_token: signupData.session.refresh_token
        });

        if (setSessionError) {
          console.error('[ClienteCadastro] Error setting session:', setSessionError);
        }
      }

      // Step 3: Wait briefly for trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 4: Create cliente record linked to user profile
      const clienteData = {
        user_id: signupData.user.id,
        nome: validated.nome,
        telefone: validated.telefone,
        email: validated.email,
        telegram: validated.telegram || null,
        mac_smart_one: validated.macSmartOne ? validated.macSmartOne.toUpperCase() : null,
        origem_cadastro: validated.origemCadastro as any,
        situacao: 'Testando' as any,
        plano: 'Mensal' as any,
        valor_pago: 0,
        cliente_ativo: false,
      };

      const { data: cliente, error: clienteError } = await (supabase as any)
        .from('clientes')
        .insert(clienteData)
        .select()
        .single();

      if (clienteError) {
        console.error('[ClienteCadastro] Cliente insert error:', clienteError);
        
        throw new Error('Erro ao criar registro de cliente. Tente novamente.');
      }

      console.log('[ClienteCadastro] Cliente created:', cliente.id);

      // Step 5: Optional SmartOne sync if MAC provided
      if (validated.macSmartOne) {
        console.log('[ClienteCadastro] MAC provided, triggering SmartOne sync');
        
        try {
          const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-new-client', {
            body: {
              user_id: signupData.user.id,
              cliente_id: cliente.id,
              nome: validated.nome,
              telefone: validated.telefone,
              email: validated.email,
              mac_smart_one: validated.macSmartOne.toUpperCase(),
            },
          });

          if (syncError) {
            console.error('[ClienteCadastro] SmartOne sync error:', syncError);
            toast({
              title: "Cadastro realizado com ressalvas",
              description: "Seu cadastro foi criado, mas a sincronização com SmartOne falhou. Entre em contato com o suporte.",
              variant: "destructive",
            });
          } else if (syncData?.success) {
            console.log('[ClienteCadastro] SmartOne sync successful');
            toast({
              title: "Cadastro e ativação realizados!",
              description: "Seu acesso ao SmartOne IPTV foi ativado. Verifique seu WhatsApp para as credenciais.",
            });
          } else {
            toast({
              title: "Cadastro realizado",
              description: "Cadastro criado, mas houve um problema na ativação automática. Nossa equipe entrará em contato.",
              variant: "destructive",
            });
          }
        } catch (syncException) {
          console.error('[ClienteCadastro] SmartOne sync exception:', syncException);
          toast({
            title: "Cadastro realizado",
            description: "Seu cadastro foi criado. Nossa equipe entrará em contato para ativação.",
          });
        }
      } else {
        toast({
          title: "Cadastro realizado com sucesso!",
          description: "Verifique seu email para confirmar sua conta. Nossa equipe entrará em contato em breve.",
        });
      }

      // Navigate to success page
      navigate('/cadastro-sucesso');
      
    } catch (error: any) {
      console.error('[ClienteCadastro] Registration error:', error);
      
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast({
          title: "Erro de validação",
          description: `${firstError.path.join('.')}: ${firstError.message}`,
          variant: "destructive",
        });
      } else if (error.message?.includes('User already registered')) {
        toast({
          title: "Email já cadastrado",
          description: "Este email já está em uso. Faça login ou use outro email.",
          variant: "destructive",
        });
      } else if (error.message?.includes('duplicate key value')) {
        toast({
          title: "Cadastro duplicado",
          description: "Já existe um cadastro com estes dados. Faça login ou entre em contato.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao cadastrar",
          description: error.message || "Ocorreu um erro. Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatMacAddress = (value: string): string => {
    const cleaned = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
    return formatted.substring(0, 17);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tutorial')}
            className="mb-4 w-fit"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <CardTitle>Cadastro de Cliente</CardTitle>
          <CardDescription>
            Preencha os dados abaixo para se cadastrar no sistema IPTV Link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="João Silva"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="seu@email.com"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">WhatsApp * (com DDD)</Label>
              <PhoneInput
                id="telefone"
                value={formData.telefone}
                onChange={(value) => setFormData({ ...formData, telefone: value })}
                mask="brazilian"
                placeholder="(11) 99999-9999"
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">
                Número do WhatsApp para contato e envio de credenciais
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram">Telegram (opcional)</Label>
              <Input
                id="telegram"
                value={formData.telegram}
                onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                placeholder="@seuusuario"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="macSmartOne">MAC Address do SmartOne (opcional)</Label>
              <Input
                id="macSmartOne"
                value={formData.macSmartOne}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  macSmartOne: formatMacAddress(e.target.value) 
                })}
                placeholder="AA:BB:CC:DD:EE:FF"
                maxLength={17}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Se você já possui o MAC, o sistema ativará automaticamente
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha *</Label>
              <Input
                id="senha"
                type="password"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                disabled={loading}
                required
              />
              <PasswordStrengthIndicator password={formData.senha} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmarSenha">Confirmar Senha *</Label>
              <Input
                id="confirmarSenha"
                type="password"
                value={formData.confirmarSenha}
                onChange={(e) => setFormData({ ...formData, confirmarSenha: e.target.value })}
                placeholder="Repita sua senha"
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origemCadastro">Como conheceu nossos serviços? *</Label>
              <Select
                value={formData.origemCadastro}
                onValueChange={(value) => setFormData({ 
                  ...formData, 
                  origemCadastro: value as CadastroFormData['origemCadastro']
                })}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Website">Website</SelectItem>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                'Cadastrar'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao se cadastrar, você concorda com nossos termos de serviço
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteCadastro;
