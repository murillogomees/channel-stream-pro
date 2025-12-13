/**
 * PasskeyManager Component - WebAuthn/Passkey management
 */

import { useState } from 'react';
import { usePasskeys } from '@/hooks/useAdvancedAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Fingerprint, 
  Plus, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Smartphone,
  Key
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function PasskeyManager() {
  const { passkeys, loading, registering, isSupported, registerPasskey, removePasskey } = usePasskeys();
  const [showRegister, setShowRegister] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRegister = async () => {
    const success = await registerPasskey(deviceName || undefined);
    if (success) {
      setShowRegister(false);
      setDeviceName('');
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    await removePasskey(id);
    setRemovingId(null);
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Passkeys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-medium text-sm">Não suportado</p>
              <p className="text-xs text-muted-foreground">
                Seu navegador não suporta WebAuthn/Passkeys. Tente usar Chrome, Safari ou Edge.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5" />
              Passkeys
            </CardTitle>
            <CardDescription>
              Login biométrico seguro com Face ID, Touch ID ou Windows Hello
            </CardDescription>
          </div>
          {passkeys.length > 0 && !showRegister && (
            <Button onClick={() => setShowRegister(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Banner */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-3">
            <Key className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Login sem senha</p>
              <p className="text-muted-foreground">
                Passkeys usam biometria (impressão digital, reconhecimento facial) para login seguro e rápido.
              </p>
            </div>
          </div>
        </div>

        {/* Register Form */}
        {showRegister && (
          <div className="p-4 rounded-lg border bg-muted/30">
            <h4 className="font-medium mb-3">Registrar Nova Passkey</h4>
            <div className="space-y-3">
              <div>
                <Label htmlFor="device-name">Nome do Dispositivo (opcional)</Label>
                <Input
                  id="device-name"
                  placeholder="Ex: MacBook Pro, iPhone 15..."
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleRegister} 
                  disabled={registering}
                  className="flex-1"
                >
                  {registering ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Fingerprint className="h-4 w-4 mr-2" />
                      Registrar Passkey
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowRegister(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Passkeys List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : passkeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Fingerprint className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-4">Nenhuma passkey registrada</p>
            {!showRegister && (
              <Button onClick={() => setShowRegister(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar Primeira Passkey
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {passkeys.map((passkey) => (
              <div
                key={passkey.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${passkey.is_active ? 'bg-green-500/10' : 'bg-muted'}`}>
                    <Smartphone className={`h-4 w-4 ${passkey.is_active ? 'text-green-500' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {passkey.device_name || 'Passkey'}
                      </span>
                      {passkey.is_active && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Criada em {format(new Date(passkey.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      {passkey.last_used_at && (
                        <> • Último uso: {format(new Date(passkey.last_used_at), "dd/MM/yyyy", { locale: ptBR })}</>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(passkey.id)}
                  disabled={removingId === passkey.id}
                  className="text-destructive hover:text-destructive"
                >
                  {removingId === passkey.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
