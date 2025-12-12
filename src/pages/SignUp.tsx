/**
 * PÁGINA DE CADASTRO DE NOVOS USUÁRIOS
 * @version 1.0.0
 * 
 * Cria automaticamente:
 * - auth.user
 * - profile
 * - cliente (3 dias trial)
 * - user_role = 'client'
 * - user_subscription = 'trial'
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus, Loader2, ArrowLeft, Check, Sparkles } from "lucide-react";
import { PasswordStrengthIndicator } from "@/components/auth/PasswordStrengthIndicator";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { customAuthService } from "@/services/customAuthService";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";

const signUpSchema = z.object({
  nome: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  telefone: z.string().min(10, "Telefone inválido").max(15, "Telefone inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string(),
  origem: z.string().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"]
});

const origensOptions = [
  { value: "Website", label: "Website" },
  { value: "Instagram", label: "Instagram" },
  { value: "Facebook", label: "Facebook" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Indicação", label: "Indicação de amigo" },
  { value: "Google", label: "Google" },
  { value: "Outro", label: "Outro" }
];

export default function SignUp() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    password: "",
    confirmPassword: "",
    origem: "Website"
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordStrong, setIsPasswordStrong] = useState(false);

  const handlePasswordStrengthChange = useCallback((isStrong: boolean) => {
    setIsPasswordStrong(isStrong);
  }, []);

  // Redirecionar se já autenticado
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/app/profile", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData(prev => ({ ...prev, telefone: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validar dados
      const validatedData = signUpSchema.parse(formData);
      
      console.log('[SignUp] Tentando cadastro com Custom Auth:', validatedData.email);
      
      // Usar Custom Auth Service (bypassa GoTrue)
      const { data, error } = await customAuthService.signUp(
        validatedData.email,
        validatedData.password,
        {
          nome: validatedData.nome,
          telefone: validatedData.telefone.replace(/\D/g, ''),
          origem_cadastro: validatedData.origem || 'Website'
        }
      );

      if (error) {
        console.error('[SignUp] Erro:', error.message);
        
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado. Tente fazer login.");
        } else {
          toast.error(error.message || "Erro ao criar conta");
        }
        return;
      }

      if (data?.user) {
        console.log('[SignUp] Sucesso! User ID:', data.user.id);
        
        toast.success(
          "Conta criada com sucesso! Bem-vindo ao sistema.",
          { duration: 5000 }
        );
        
        // Custom auth já cria session automaticamente
        navigate("/app/profile", { replace: true });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro ao criar conta. Tente novamente.");
        console.error("SignUp error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/20 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative bg-card/90 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl p-8 w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Criar Conta</h1>
          <p className="text-muted-foreground mt-2">
            Ganhe <span className="text-primary font-semibold">3 dias grátis</span> para testar!
          </p>
        </div>

        {/* Features */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 text-sm">
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-foreground/80">Acesso a todo o catálogo por 3 dias</span>
          </div>
          <div className="flex items-center gap-3 text-sm mt-2">
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-foreground/80">Sem cartão de crédito</span>
          </div>
          <div className="flex items-center gap-3 text-sm mt-2">
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-foreground/80">Cancele quando quiser</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome" className="text-sm font-medium text-foreground/80">
              Nome completo
            </Label>
            <Input
              id="nome"
              type="text"
              placeholder="Seu nome"
              value={formData.nome}
              onChange={e => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              disabled={isLoading}
              className="bg-background/50 border-border h-12 rounded-xl"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              disabled={isLoading}
              className="bg-background/50 border-border h-12 rounded-xl"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="telefone" className="text-sm font-medium text-foreground/80">
              WhatsApp
            </Label>
            <Input
              id="telefone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={formData.telefone}
              onChange={handlePhoneChange}
              disabled={isLoading}
              maxLength={15}
              className="bg-background/50 border-border h-12 rounded-xl"
            />
          </div>

          {/* Como conheceu */}
          <div className="space-y-2">
            <Label htmlFor="origem" className="text-sm font-medium text-foreground/80">
              Como conheceu a gente?
            </Label>
            <Select
              value={formData.origem}
              onValueChange={value => setFormData(prev => ({ ...prev, origem: value }))}
              disabled={isLoading}
            >
              <SelectTrigger className="bg-background/50 border-border h-12 rounded-xl">
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {origensOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Senha */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
              Senha
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                disabled={isLoading}
                className="bg-background/50 border-border h-12 rounded-xl pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <PasswordStrengthIndicator 
              password={formData.password} 
              onStrengthChange={handlePasswordStrengthChange}
            />
          </div>

          {/* Confirmar Senha */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground/80">
              Confirmar senha
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                disabled={isLoading}
                className="bg-background/50 border-border h-12 rounded-xl pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full h-12 rounded-xl text-base font-semibold mt-6"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Criando conta...
              </>
            ) : (
              <>
                <UserPlus className="w-5 h-5 mr-2" />
                Criar conta grátis
              </>
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            onClick={() => navigate("/login")}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Já tenho uma conta
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
