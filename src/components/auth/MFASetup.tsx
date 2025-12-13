/**
 * MFASetup Component - Enable/disable two-factor authentication
 */

import { useState } from 'react';
import { useMFA } from '@/hooks/useCustomAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  ShieldCheck, 
  ShieldOff, 
  Loader2,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export function MFASetup() {
  const { 
    loading, 
    mfaEnabled, 
    enrollmentData, 
    startEnrollment, 
    verifyEnrollment, 
    disableMFA 
  } = useMFA();
  
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopySecret = () => {
    if (enrollmentData?.secret) {
      navigator.clipboard.writeText(enrollmentData.secret);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Digite o código de 6 dígitos');
      return;
    }
    await verifyEnrollment(code);
    setCode('');
  };

  const handleDisable = async () => {
    if (disableCode.length !== 6) {
      toast.error('Digite o código de 6 dígitos');
      return;
    }
    await disableMFA(disableCode);
    setDisableCode('');
    setShowDisable(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${mfaEnabled ? 'bg-green-500/10' : 'bg-muted'}`}>
              {mfaEnabled ? (
                <ShieldCheck className="h-5 w-5 text-green-500" />
              ) : (
                <Shield className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Autenticação de Dois Fatores</CardTitle>
              <CardDescription>
                Adicione uma camada extra de segurança à sua conta
              </CardDescription>
            </div>
          </div>
          <Badge variant={mfaEnabled ? 'default' : 'secondary'}>
            {mfaEnabled ? 'Ativado' : 'Desativado'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mfaEnabled && !enrollmentData && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Use um aplicativo autenticador como Google Authenticator ou Authy para gerar códigos de verificação.
            </p>
            <Button onClick={startEnrollment} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Configurar MFA
            </Button>
          </div>
        )}

        {enrollmentData && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Escaneie o QR code com seu aplicativo autenticador:
              </p>
              
              {enrollmentData.qr_code && (
                <div className="flex justify-center mb-4">
                  <img 
                    src={enrollmentData.qr_code} 
                    alt="QR Code MFA" 
                    className="rounded-lg border p-2 bg-white"
                    width={200}
                    height={200}
                  />
                </div>
              )}

              <div className="flex items-center justify-center gap-2 mb-4">
                <code className="px-3 py-2 rounded bg-muted text-sm font-mono">
                  {enrollmentData.secret}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopySecret}
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Código de verificação</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="font-mono text-center text-lg tracking-widest"
                />
                <Button onClick={handleVerify} disabled={loading || code.length !== 6}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Verificar'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {mfaEnabled && !showDisable && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm">
                MFA está ativo. Sua conta está protegida.
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDisable(true)}
              className="text-destructive hover:text-destructive"
            >
              <ShieldOff className="h-4 w-4 mr-2" />
              Desativar
            </Button>
          </div>
        )}

        {mfaEnabled && showDisable && (
          <div className="space-y-4 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
            <p className="text-sm text-muted-foreground">
              Para desativar o MFA, insira um código do seu autenticador:
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                className="font-mono text-center text-lg tracking-widest"
              />
              <Button
                variant="destructive"
                onClick={handleDisable}
                disabled={loading || disableCode.length !== 6}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Desativar'
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDisable(false);
                  setDisableCode('');
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
