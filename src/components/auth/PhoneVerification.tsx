/**
 * PhoneVerification Component - Verify phone via WhatsApp
 */

import { useState } from 'react';
import { usePhoneVerification } from '@/hooks/useAdvancedAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Phone, Loader2, CheckCircle2, MessageCircle } from 'lucide-react';
import InputOTP from 'react-input-mask';

interface PhoneVerificationProps {
  currentPhone?: string;
  isVerified?: boolean;
  onVerified?: () => void;
}

export function PhoneVerification({ currentPhone, isVerified, onVerified }: PhoneVerificationProps) {
  const { loading, codeSent, requestCode, verifyCode, reset } = usePhoneVerification();
  const [phone, setPhone] = useState(currentPhone || '');
  const [code, setCode] = useState('');

  const handleRequestCode = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return;
    }
    await requestCode(cleanPhone);
  };

  const handleVerify = async () => {
    if (code.length < 6) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const success = await verifyCode(cleanPhone, code);
    if (success) {
      setCode('');
      onVerified?.();
    }
  };

  if (isVerified && currentPhone) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Telefone Verificado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium text-sm">{currentPhone}</p>
              <p className="text-xs text-muted-foreground">Verificado via WhatsApp</p>
            </div>
            <Badge variant="secondary" className="ml-auto">Verificado</Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Verificação por WhatsApp
        </CardTitle>
        <CardDescription>
          Verifique seu número de telefone para receber alertas de segurança
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!codeSent ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="phone">Número de Telefone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enviaremos um código de 6 dígitos via WhatsApp
              </p>
            </div>
            <Button 
              onClick={handleRequestCode} 
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Enviar Código
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-center">
                Código enviado para <strong>{phone}</strong>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Código de Verificação</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleVerify} 
                disabled={loading || code.length < 6}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Verificar
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={reset}>
                Voltar
              </Button>
            </div>
            <Button 
              variant="ghost" 
              onClick={handleRequestCode} 
              disabled={loading}
              className="w-full"
            >
              Reenviar código
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
