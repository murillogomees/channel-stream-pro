/**
 * CustomCheckoutBuilder - Construtor de página de checkout personalizada
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Palette, Type, Image, CreditCard, Shield, 
  Eye, Save, RefreshCw, ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface CheckoutConfig {
  companyName: string;
  logo: string;
  primaryColor: string;
  backgroundColor: string;
  showTestimonials: boolean;
  showGuarantee: boolean;
  guaranteeText: string;
  showSecurityBadges: boolean;
  customCss: string;
  successMessage: string;
  redirectAfterSuccess: string;
}

export function CustomCheckoutBuilder() {
  const [config, setConfig] = useState<CheckoutConfig>({
    companyName: "IPTV Link",
    logo: "",
    primaryColor: "#7c3aed",
    backgroundColor: "#0f0f23",
    showTestimonials: true,
    showGuarantee: true,
    guaranteeText: "7 dias de garantia incondicional",
    showSecurityBadges: true,
    customCss: "",
    successMessage: "Pagamento confirmado! Sua assinatura está ativa.",
    redirectAfterSuccess: "/app/player"
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Save to database
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configurações */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Aparência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input
                value={config.companyName}
                onChange={(e) => setConfig(prev => ({ ...prev, companyName: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>URL do Logo</Label>
              <Input
                placeholder="https://..."
                value={config.logo}
                onChange={(e) => setConfig(prev => ({ ...prev, logo: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor Principal</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={config.primaryColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cor de Fundo</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={config.backgroundColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, backgroundColor: e.target.value }))}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={config.backgroundColor}
                    onChange={(e) => setConfig(prev => ({ ...prev, backgroundColor: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Elementos de Confiança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Mostrar Depoimentos</Label>
                <p className="text-xs text-muted-foreground">Exibe avaliações de clientes</p>
              </div>
              <Switch
                checked={config.showTestimonials}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showTestimonials: checked }))}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Mostrar Garantia</Label>
                <p className="text-xs text-muted-foreground">Badge de garantia de devolução</p>
              </div>
              <Switch
                checked={config.showGuarantee}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showGuarantee: checked }))}
              />
            </div>

            {config.showGuarantee && (
              <div className="space-y-2">
                <Label>Texto da Garantia</Label>
                <Input
                  value={config.guaranteeText}
                  onChange={(e) => setConfig(prev => ({ ...prev, guaranteeText: e.target.value }))}
                />
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Selos de Segurança</Label>
                <p className="text-xs text-muted-foreground">Mercado Pago, SSL, etc</p>
              </div>
              <Switch
                checked={config.showSecurityBadges}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showSecurityBadges: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Pós-Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mensagem de Sucesso</Label>
              <Textarea
                value={config.successMessage}
                onChange={(e) => setConfig(prev => ({ ...prev, successMessage: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Redirecionar Após Sucesso</Label>
              <Input
                value={config.redirectAfterSuccess}
                onChange={(e) => setConfig(prev => ({ ...prev, redirectAfterSuccess: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CSS Customizado</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder=".checkout-container { ... }"
              value={config.customCss}
              onChange={(e) => setConfig(prev => ({ ...prev, customCss: e.target.value }))}
              className="font-mono text-sm h-32"
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Configurações
          </Button>
          <Button variant="outline" asChild>
            <a href="/checkout" target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-2" />
              Visualizar
            </a>
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Preview</h3>
          <Badge variant="outline">
            <ExternalLink className="h-3 w-3 mr-1" />
            /checkout
          </Badge>
        </div>

        <Card 
          className="overflow-hidden"
          style={{ backgroundColor: config.backgroundColor }}
        >
          <div className="p-6 min-h-[500px]">
            {/* Header Preview */}
            <div className="text-center mb-6">
              {config.logo ? (
                <img src={config.logo} alt="Logo" className="h-12 mx-auto mb-4" />
              ) : (
                <div 
                  className="h-12 w-12 rounded-lg mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
              )}
              <h2 className="text-xl font-bold text-white">{config.companyName}</h2>
              <p className="text-sm text-white/60">Escolha seu plano</p>
            </div>

            {/* Plan Card Preview */}
            <div 
              className="p-4 rounded-lg border-2 mb-4"
              style={{ borderColor: config.primaryColor, backgroundColor: `${config.primaryColor}10` }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-medium">Plano Mensal</span>
                <Badge style={{ backgroundColor: config.primaryColor }}>Popular</Badge>
              </div>
              <div className="text-2xl font-bold text-white">R$ 29,90<span className="text-sm font-normal">/mês</span></div>
            </div>

            {/* Security Badges Preview */}
            {config.showSecurityBadges && (
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="flex items-center gap-1 text-white/60 text-xs">
                  <Shield className="h-4 w-4" />
                  <span>Pagamento Seguro</span>
                </div>
                <div className="flex items-center gap-1 text-white/60 text-xs">
                  <CreditCard className="h-4 w-4" />
                  <span>Mercado Pago</span>
                </div>
              </div>
            )}

            {/* Guarantee Preview */}
            {config.showGuarantee && (
              <div className="text-center p-3 bg-green-500/10 rounded-lg mb-4">
                <p className="text-green-400 text-sm">✓ {config.guaranteeText}</p>
              </div>
            )}

            {/* CTA Button Preview */}
            <Button 
              className="w-full"
              style={{ backgroundColor: config.primaryColor }}
            >
              Assinar Agora
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default CustomCheckoutBuilder;
