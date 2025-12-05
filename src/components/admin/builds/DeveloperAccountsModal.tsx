/**
 * DeveloperAccountsModal - Modal para configuração de credenciais de developer accounts
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Key,
  Shield,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Upload,
  FileKey,
  Smartphone,
  Apple,
  Tv,
  HelpCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeveloperAccount {
  platform: string;
  name: string;
  email: string;
  apiKey?: string;
  serviceAccountJson?: string;
  keystorePath?: string;
  keystorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
  teamId?: string;
  bundleId?: string;
  enabled: boolean;
  lastValidated?: Date;
}

const INITIAL_ACCOUNTS: Record<string, DeveloperAccount> = {
  google: {
    platform: 'google',
    name: 'Google Play Console',
    email: '',
    apiKey: '',
    serviceAccountJson: '',
    keystorePath: '',
    keystorePassword: '',
    keyAlias: '',
    keyPassword: '',
    enabled: false
  },
  apple: {
    platform: 'apple',
    name: 'Apple Developer',
    email: '',
    apiKey: '',
    teamId: '',
    bundleId: '',
    enabled: false
  },
  samsung: {
    platform: 'samsung',
    name: 'Samsung Seller Office',
    email: '',
    apiKey: '',
    enabled: false
  },
  lg: {
    platform: 'lg',
    name: 'LG Seller Lounge',
    email: '',
    apiKey: '',
    enabled: false
  }
};

interface DeveloperAccountsModalProps {
  trigger?: React.ReactNode;
}

export function DeveloperAccountsModal({ trigger }: DeveloperAccountsModalProps) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Record<string, DeveloperAccount>>(INITIAL_ACCOUNTS);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('google');
  const [isSaving, setIsSaving] = useState(false);

  const togglePassword = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const updateAccount = (platform: string, field: string, value: string | boolean) => {
    setAccounts(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simula salvamento (em produção, salvaria no Supabase secrets)
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Credenciais salvas com sucesso!');
      setOpen(false);
    } catch (error) {
      toast.error('Erro ao salvar credenciais');
    } finally {
      setIsSaving(false);
    }
  };

  const validateCredentials = async (platform: string) => {
    toast.info(`Validando credenciais ${accounts[platform].name}...`);
    // Simula validação
    await new Promise(resolve => setTimeout(resolve, 1500));
    setAccounts(prev => ({
      ...prev,
      [platform]: { ...prev[platform], lastValidated: new Date() }
    }));
    toast.success('Credenciais válidas!');
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'google': return <Smartphone className="h-5 w-5 text-green-500" />;
      case 'apple': return <Apple className="h-5 w-5 text-gray-400" />;
      case 'samsung': return <Tv className="h-5 w-5 text-blue-500" />;
      case 'lg': return <Tv className="h-5 w-5 text-red-500" />;
      default: return <Key className="h-5 w-5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Key className="h-4 w-4" />
            Credenciais
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Developer Accounts
          </DialogTitle>
          <DialogDescription>
            Configure as credenciais para deploy automático em cada loja
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="google" className="gap-2">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">Google</span>
            </TabsTrigger>
            <TabsTrigger value="apple" className="gap-2">
              <Apple className="h-4 w-4" />
              <span className="hidden sm:inline">Apple</span>
            </TabsTrigger>
            <TabsTrigger value="samsung" className="gap-2">
              <Tv className="h-4 w-4" />
              <span className="hidden sm:inline">Samsung</span>
            </TabsTrigger>
            <TabsTrigger value="lg" className="gap-2">
              <Tv className="h-4 w-4" />
              <span className="hidden sm:inline">LG</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4 pr-4">
            {/* Google Play */}
            <TabsContent value="google" className="space-y-4 mt-0">
              <Card className="border-green-500/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getPlatformIcon('google')}
                      <div>
                        <CardTitle className="text-base">Google Play Console</CardTitle>
                        <CardDescription>Configuração para Android</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={accounts.google.enabled}
                      onCheckedChange={(v) => updateAccount('google', 'enabled', v)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email da conta</Label>
                      <Input
                        type="email"
                        placeholder="developer@company.com"
                        value={accounts.google.email}
                        onChange={(e) => updateAccount('google', 'email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        Service Account JSON
                        <a 
                          href="https://developers.google.com/android-publisher/getting_started" 
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept=".json"
                          className="cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileKey className="h-4 w-4" />
                      Keystore Configuration
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Keystore Path</Label>
                        <Input
                          placeholder="android/app/release.keystore"
                          value={accounts.google.keystorePath}
                          onChange={(e) => updateAccount('google', 'keystorePath', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Key Alias</Label>
                        <Input
                          placeholder="iptvlink"
                          value={accounts.google.keyAlias}
                          onChange={(e) => updateAccount('google', 'keyAlias', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Keystore Password</Label>
                        <div className="relative">
                          <Input
                            type={showPasswords['keystorePassword'] ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={accounts.google.keystorePassword}
                            onChange={(e) => updateAccount('google', 'keystorePassword', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => togglePassword('keystorePassword')}
                          >
                            {showPasswords['keystorePassword'] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Key Password</Label>
                        <div className="relative">
                          <Input
                            type={showPasswords['keyPassword'] ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={accounts.google.keyPassword}
                            onChange={(e) => updateAccount('google', 'keyPassword', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => togglePassword('keyPassword')}
                          >
                            {showPasswords['keyPassword'] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {accounts.google.lastValidated ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Validado em {accounts.google.lastValidated.toLocaleDateString()}
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          Não validado
                        </>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => validateCredentials('google')}
                    >
                      Validar credenciais
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Apple */}
            <TabsContent value="apple" className="space-y-4 mt-0">
              <Card className="border-gray-500/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getPlatformIcon('apple')}
                      <div>
                        <CardTitle className="text-base">Apple Developer</CardTitle>
                        <CardDescription>Configuração para iOS/tvOS</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={accounts.apple.enabled}
                      onCheckedChange={(v) => updateAccount('apple', 'enabled', v)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Apple ID</Label>
                      <Input
                        type="email"
                        placeholder="developer@company.com"
                        value={accounts.apple.email}
                        onChange={(e) => updateAccount('apple', 'email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Team ID</Label>
                      <Input
                        placeholder="XXXXXXXXXX"
                        value={accounts.apple.teamId}
                        onChange={(e) => updateAccount('apple', 'teamId', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bundle ID</Label>
                      <Input
                        placeholder="app.lovable.iptvlink"
                        value={accounts.apple.bundleId}
                        onChange={(e) => updateAccount('apple', 'bundleId', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        App Store Connect API Key
                        <a 
                          href="https://developer.apple.com/documentation/appstoreconnectapi" 
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <HelpCircle className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </Label>
                      <Input
                        type="file"
                        accept=".p8"
                        className="cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {accounts.apple.lastValidated ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Validado em {accounts.apple.lastValidated.toLocaleDateString()}
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          Não validado
                        </>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => validateCredentials('apple')}
                    >
                      Validar credenciais
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Samsung */}
            <TabsContent value="samsung" className="space-y-4 mt-0">
              <Card className="border-blue-500/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getPlatformIcon('samsung')}
                      <div>
                        <CardTitle className="text-base">Samsung Seller Office</CardTitle>
                        <CardDescription>Configuração para Tizen TV</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={accounts.samsung.enabled}
                      onCheckedChange={(v) => updateAccount('samsung', 'enabled', v)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email Samsung Developer</Label>
                      <Input
                        type="email"
                        placeholder="developer@company.com"
                        value={accounts.samsung.email}
                        onChange={(e) => updateAccount('samsung', 'email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API Token</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords['samsungApi'] ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={accounts.samsung.apiKey}
                          onChange={(e) => updateAccount('samsung', 'apiKey', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => togglePassword('samsungApi')}
                        >
                          {showPasswords['samsungApi'] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <a
                    href="https://seller.samsungapps.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Acessar Samsung Seller Office
                  </a>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LG */}
            <TabsContent value="lg" className="space-y-4 mt-0">
              <Card className="border-red-500/30">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getPlatformIcon('lg')}
                      <div>
                        <CardTitle className="text-base">LG Seller Lounge</CardTitle>
                        <CardDescription>Configuração para WebOS TV</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={accounts.lg.enabled}
                      onCheckedChange={(v) => updateAccount('lg', 'enabled', v)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Email LG Developer</Label>
                      <Input
                        type="email"
                        placeholder="developer@company.com"
                        value={accounts.lg.email}
                        onChange={(e) => updateAccount('lg', 'email', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API Token</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords['lgApi'] ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={accounts.lg.apiKey}
                          onChange={(e) => updateAccount('lg', 'apiKey', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => togglePassword('lgApi')}
                        >
                          {showPasswords['lgApi'] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <a
                    href="https://seller.lgappstv.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Acessar LG Seller Lounge
                  </a>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Credenciais'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
