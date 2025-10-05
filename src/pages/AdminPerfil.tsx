import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Mail, Lock, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { hashPassword, validateEmail, validatePassword, sanitizeInput } from "@/lib/auth";
import adminsData from "@/data/admins.json";

const AdminPerfil = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, loading, logout } = useLocalAuth();
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    if (currentUser) {
      setNome(currentUser.nome);
      setEmail(currentUser.email);
    }
  }, [currentUser]);

  const handleSaveProfile = async () => {
    try {
      setSaving(true);

      // Validar nome
      const sanitizedNome = sanitizeInput(nome);
      if (!sanitizedNome || sanitizedNome.length < 3) {
        toast({
          title: "Erro de validação",
          description: "Nome deve ter pelo menos 3 caracteres.",
          variant: "destructive",
        });
        return;
      }

      // Validar email
      const sanitizedEmail = sanitizeInput(email);
      if (!validateEmail(sanitizedEmail)) {
        toast({
          title: "Erro de validação",
          description: "Email inválido.",
          variant: "destructive",
        });
        return;
      }

      // Se alterando senha, validar
      let newPasswordHash = currentUser?.passwordHash;
      if (novaSenha || confirmarSenha || senhaAtual) {
        if (!senhaAtual) {
          toast({
            title: "Erro de validação",
            description: "Informe a senha atual para alterá-la.",
            variant: "destructive",
          });
          return;
        }

        // Verificar senha atual
        const { verifyPassword } = await import('@/lib/auth');
        const senhaAtualValida = await verifyPassword(senhaAtual, currentUser?.passwordHash || '');
        if (!senhaAtualValida) {
          toast({
            title: "Erro de validação",
            description: "Senha atual incorreta.",
            variant: "destructive",
          });
          return;
        }

        if (!novaSenha || !confirmarSenha) {
          toast({
            title: "Erro de validação",
            description: "Preencha a nova senha e confirmação.",
            variant: "destructive",
          });
          return;
        }

        if (novaSenha !== confirmarSenha) {
          toast({
            title: "Erro de validação",
            description: "As senhas não coincidem.",
            variant: "destructive",
          });
          return;
        }

        const passwordValidation = validatePassword(novaSenha);
        if (!passwordValidation.valid) {
          toast({
            title: "Erro de validação",
            description: passwordValidation.error,
            variant: "destructive",
          });
          return;
        }

        newPasswordHash = await hashPassword(novaSenha);
      }

      // Atualizar dados no localStorage
      const updatedAdmins = adminsData.map(admin => {
        if (admin.id === currentUser?.id) {
          return {
            ...admin,
            nome: sanitizedNome,
            email: sanitizedEmail,
            passwordHash: newPasswordHash,
          };
        }
        return admin;
      });

      localStorage.setItem('admins_data', JSON.stringify(updatedAdmins));

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso. Faça login novamente.",
      });

      // Logout e redirecionar para login
      setTimeout(() => {
        logout();
        navigate('/admin/login');
      }, 1500);

    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao atualizar o perfil.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-2xl">
        <div className="mb-8">
          <Button variant="outline" onClick={() => navigate('/admin/dashboard')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gradient-primary">Meu Perfil</h1>
          <p className="text-muted-foreground mt-2">Gerencie suas informações pessoais</p>
        </div>

        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Atualize seu nome, email e senha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="nome" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome Completo
              </Label>
              <Input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Alterar Senha
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Deixe em branco se não desejar alterar a senha
              </p>
            </div>

            {/* Senha Atual */}
            <div className="space-y-2">
              <Label htmlFor="senhaAtual">Senha Atual</Label>
              <Input
                id="senhaAtual"
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="Digite sua senha atual"
              />
            </div>

            {/* Nova Senha */}
            <div className="space-y-2">
              <Label htmlFor="novaSenha">Nova Senha</Label>
              <Input
                id="novaSenha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Digite a nova senha"
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres, 1 maiúscula, 1 minúscula e 1 número
              </p>
            </div>

            {/* Confirmar Senha */}
            <div className="space-y-2">
              <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
              <Input
                id="confirmarSenha"
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Confirme a nova senha"
              />
            </div>

            {/* Botão Salvar */}
            <div className="pt-4">
              <Button 
                onClick={handleSaveProfile} 
                disabled={saving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPerfil;
