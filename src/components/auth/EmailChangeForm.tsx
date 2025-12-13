/**
 * EmailChangeForm Component - Request and confirm email change
 */

import { useState } from 'react';
import { useEmailChange } from '@/hooks/useAdvancedAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface EmailChangeFormProps {
  currentEmail?: string;
}

export function EmailChangeForm({ currentEmail }: EmailChangeFormProps) {
  const { loading, requestChange } = useEmailChange();
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newEmail !== confirmEmail) {
      setError('Os emails não coincidem');
      return;
    }

    if (newEmail === currentEmail) {
      setError('O novo email deve ser diferente do atual');
      return;
    }

    const success = await requestChange(newEmail);
    if (success) {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Email de verificação enviado!</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Enviamos um link de confirmação para <strong>{newEmail}</strong>.
                Clique no link para concluir a alteração.
              </p>
            </div>
            <Button variant="outline" onClick={() => setSent(false)}>
              Alterar outro email
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Alterar Email
        </CardTitle>
        <CardDescription>
          Altere o email associado à sua conta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {currentEmail && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Email atual: <strong>{currentEmail}</strong>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-email">Novo Email</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="novo@email.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-email">Confirmar Novo Email</Label>
            <Input
              id="confirm-email"
              type="email"
              placeholder="novo@email.com"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || !newEmail || !confirmEmail}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enviando...
              </>
            ) : (
              'Solicitar Alteração'
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Você precisará verificar o novo email antes que a alteração seja concluída.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
