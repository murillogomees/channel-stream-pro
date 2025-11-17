import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Shield, Check, X, QrCode, Key } from 'lucide-react';
import { twoFactorAuthService } from '@/services/twoFactorAuthService';
import { toast } from 'sonner';

export default function Admin2FASettings() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [qrCodeURL, setQrCodeURL] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationToken, setVerificationToken] = useState('');
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    check2FAStatus();
  }, [user, navigate]);

  const check2FAStatus = async () => {
    if (!user) return;
    
    setLoading(true);
    const enabled = await twoFactorAuthService.is2FAEnabled(user.id);
    setIs2FAEnabled(enabled);
    setLoading(false);
  };

  const handleGenerateSecret = async () => {
    setLoading(true);
    try {
      const result = await twoFactorAuthService.generateSecret();
      
      if (result) {
        setQrCodeURL(result.qrCodeDataURL);
        setSecret(result.secret);
        setShowSetup(true);
        toast.success('QR Code gerado com sucesso!');
      } else {
        toast.error('Erro ao gerar QR Code');
      }
    } catch (error) {
      console.error('Erro ao gerar secret:', error);
      toast.error('Erro ao configurar 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndEnable = async () => {
    if (verificationToken.length !== 6) {
      toast.error('Token deve ter 6 dígitos');
      return;
    }

    setLoading(true);
    try {
      const result = await twoFactorAuthService.verifyToken(verificationToken, true);
      
      if (result && result.valid) {
        toast.success('2FA ativado com sucesso!');
        setIs2FAEnabled(true);
        setShowSetup(false);
        setQrCodeURL('');
        setSecret('');
        setVerificationToken('');
        await refreshUser();
      } else {
        toast.error('Token inválido. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      toast.error('Erro ao verificar token');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!user) return;
    
    if (!confirm('Tem certeza que deseja desabilitar a autenticação de dois fatores?')) {
      return;
    }

    setLoading(true);
    try {
      const success = await twoFactorAuthService.disable2FA(user.id);
      
      if (success) {
        toast.success('2FA desabilitado com sucesso');
        setIs2FAEnabled(false);
        setShowSetup(false);
        await refreshUser();
      } else {
        toast.error('Erro ao desabilitar 2FA');
      }
    } catch (error) {
      console.error('Erro ao desabilitar 2FA:', error);
      toast.error('Erro ao desabilitar 2FA');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !qrCodeURL) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/perfil')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold">Autenticação de Dois Fatores (2FA)</h1>
        <p className="text-muted-foreground mt-2">
          Aumente a segurança da sua conta com autenticação em duas etapas
        </p>
      </div>

      {/* Status Atual */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Status do 2FA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Autenticação de Dois Fatores</p>
              <p className="text-sm text-muted-foreground">
                {is2FAEnabled 
                  ? 'Sua conta está protegida com 2FA' 
                  : 'Adicione uma camada extra de segurança'}
              </p>
            </div>
            <Badge variant={is2FAEnabled ? 'default' : 'secondary'} className="text-lg px-4 py-2">
              {is2FAEnabled ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Ativado
                </>
              ) : (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Desativado
                </>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {!is2FAEnabled && !showSetup && (
        <Card>
          <CardHeader>
            <CardTitle>Configurar 2FA</CardTitle>
            <CardDescription>
              Proteja sua conta com autenticação de dois fatores usando um aplicativo autenticador
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Você precisará de um aplicativo autenticador como Google Authenticator, 
                Microsoft Authenticator, ou Authy instalado no seu smartphone.
              </AlertDescription>
            </Alert>

            <Button onClick={handleGenerateSecret} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  Gerar QR Code
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {showSetup && !is2FAEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Configure seu Aplicativo Autenticador</CardTitle>
            <CardDescription>
              Escaneie o QR Code com seu aplicativo autenticador
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* QR Code */}
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-4 rounded-lg">
                <img src={qrCodeURL} alt="QR Code 2FA" className="w-64 h-64" />
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Ou digite manualmente o código:
                </p>
                <div className="flex items-center gap-2 justify-center">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
                    {secret}
                  </code>
                </div>
              </div>
            </div>

            {/* Verificação */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="token">Digite o código de 6 dígitos do app</Label>
                <Input
                  id="token"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={verificationToken}
                  onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleVerifyAndEnable} 
                  disabled={loading || verificationToken.length !== 6}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    'Verificar e Ativar'
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowSetup(false);
                    setQrCodeURL('');
                    setSecret('');
                    setVerificationToken('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {is2FAEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Desabilitar 2FA</CardTitle>
            <CardDescription>
              Remover autenticação de dois fatores da sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Atenção: Desabilitar o 2FA reduzirá a segurança da sua conta.
              </AlertDescription>
            </Alert>

            <Button 
              variant="destructive" 
              onClick={handleDisable2FA}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desabilitando...
                </>
              ) : (
                'Desabilitar 2FA'
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
