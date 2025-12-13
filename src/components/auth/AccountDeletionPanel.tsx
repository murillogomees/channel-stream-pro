/**
 * AccountDeletionPanel Component - LGPD compliant account deletion
 */

import { useState } from 'react';
import { useAccountDeletion } from '@/hooks/useAdvancedAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Trash2, 
  Loader2, 
  AlertTriangle, 
  XCircle,
  Calendar,
  Shield
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function AccountDeletionPanel() {
  const { loading, status, requestDeletion, cancelDeletion } = useAccountDeletion();
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleRequestDeletion = async () => {
    if (!confirmed) return;
    const success = await requestDeletion(reason || undefined);
    if (success) {
      setShowConfirm(false);
      setReason('');
      setConfirmed(false);
    }
  };

  if (status.pending && status.scheduled_at) {
    const scheduledDate = new Date(status.scheduled_at);
    
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Exclusão Agendada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium">Sua conta será excluída</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Data programada: <strong>{format(scheduledDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(scheduledDate, { locale: ptBR, addSuffix: true })}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <h4 className="font-medium text-sm mb-2">O que acontecerá:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Todos os seus dados pessoais serão removidos</li>
              <li>• Seu histórico de atividades será apagado</li>
              <li>• Suas configurações serão perdidas permanentemente</li>
              <li>• Esta ação não pode ser desfeita</li>
            </ul>
          </div>

          <Button 
            variant="outline" 
            onClick={cancelDeletion} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Cancelando...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Exclusão
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Excluir Conta
        </CardTitle>
        <CardDescription>
          Solicite a exclusão permanente da sua conta (LGPD)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showConfirm ? (
          <>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Seus direitos LGPD</p>
                  <p className="text-muted-foreground">
                    De acordo com a Lei Geral de Proteção de Dados, você tem o direito de solicitar a exclusão dos seus dados pessoais.
                  </p>
                </div>
              </div>
            </div>

            <Button 
              variant="destructive" 
              onClick={() => setShowConfirm(true)}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Solicitar Exclusão
            </Button>
          </>
        ) : (
          <>
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Atenção!</p>
                  <p className="text-sm text-muted-foreground">
                    Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos após o período de carência.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da exclusão (opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Conte-nos por que você deseja excluir sua conta..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox 
                id="confirm-deletion" 
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(!!checked)}
              />
              <Label htmlFor="confirm-deletion" className="text-sm leading-tight">
                Eu entendo que esta ação é irreversível e que todos os meus dados serão permanentemente excluídos.
              </Label>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={handleRequestDeletion}
                disabled={loading || !confirmed}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Confirmar Exclusão
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
