import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { smartoneAutoSyncService } from "@/services/smartoneAutoSyncService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { z } from "zod";

const cadastroSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  telefone: z.string().min(10, "Telefone inválido"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmarSenha: z.string(),
  telegram: z.string().optional(),
  macSmartOne: z.string().optional(),
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
      
      // Validar dados
      const validatedData = cadastroSchema.parse(formData);
      
      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.senha,
        options: {
          data: {
            nome: validatedData.nome,
            telefone: validatedData.telefone,
            telegram: validatedData.telegram,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Erro ao criar usuário");
      }

      // O trigger handle_new_user criará automaticamente o profile e a role 'user'
      
      // Criar registro de cliente
      const { data: clienteData, error: clienteError } = await (supabase as any)
        .from('clientes')
        .insert({
          user_id: authData.user.id,
          situacao: 'Lead',
          data_contratacao: new Date().toISOString(),
          plano: 'Mensal',
          valor_pago: 0,
          cliente_ativo: false,
          origem_cadastro: validatedData.origemCadastro,
          mac_smart_one: validatedData.macSmartOne?.toUpperCase() || null,
        })
        .select()
        .single();

      if (clienteError) throw clienteError;

      // Se forneceu MAC, sincronizar com SmartOne automaticamente
      if (validatedData.macSmartOne) {
        console.log('MAC fornecido, iniciando sincronização com SmartOne...');
        
        const syncResult = await smartoneAutoSyncService.syncAfterRegistration(
          authData.user.id,
          clienteData.id,
          {
            nome: validatedData.nome,
            telefone: validatedData.telefone,
            email: validatedData.email,
          },
          {
            mac_smart_one: validatedData.macSmartOne.toUpperCase(),
          }
        );

        if (syncResult.success) {
          toast({
            title: "Cadastro e ativação realizados!",
            description: "Seu acesso ao SmartOne IPTV foi ativado automaticamente.",
          });
        } else {
          toast({
            title: "Cadastro realizado",
            description: "Cadastro OK, mas houve um problema na ativação. Entre em contato com o suporte.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Cadastro realizado com sucesso!",
          description: "Verifique seu WhatsApp para receber as instruções de ativação.",
        });
      }

      navigate('/cadastro-sucesso');
      
    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao cadastrar",
          description: error.message || "Tente novamente mais tarde.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
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
            Preencha os dados abaixo para se cadastrar no sistema
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
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">WhatsApp *</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram">Telegram (opcional)</Label>
              <Input
                id="telegram"
                value={formData.telegram}
                onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                placeholder="@seuusuario"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="macSmartOne">Endereço MAC do SmartOne (opcional)</Label>
              <Input
                id="macSmartOne"
                value={formData.macSmartOne}
                onChange={(e) => setFormData({ ...formData, macSmartOne: e.target.value.toUpperCase() })}
                placeholder="00:1A:79:XX:XX:XX"
              />
              <p className="text-xs text-muted-foreground">
                Se você já tem o endereço MAC, informe agora para ativar automaticamente
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
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmarSenha">Confirmar Senha *</Label>
              <Input
                id="confirmarSenha"
                type="password"
                value={formData.confirmarSenha}
                onChange={(e) => setFormData({ ...formData, confirmarSenha: e.target.value })}
                placeholder="Digite a senha novamente"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="origem">Como conheceu nosso serviço? *</Label>
              <Select
                value={formData.origemCadastro}
                onValueChange={(value: any) => setFormData({ ...formData, origemCadastro: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Website">Website</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                "Cadastrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteCadastro;
