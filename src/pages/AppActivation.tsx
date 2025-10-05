import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Key, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { validateActivationKey, activateDevice } from '@/services/activationService';

export default function AppActivation() {
  const navigate = useNavigate();
  const [activationKey, setActivationKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const formatActivationKey = (value: string) => {
    // Remove tudo que não for alfanumérico
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Adiciona hífens a cada 4 caracteres
    const parts = [];
    for (let i = 0; i < cleaned.length && i < 16; i += 4) {
      parts.push(cleaned.substring(i, i + 4));
    }
    
    return parts.join('-');
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatActivationKey(e.target.value);
    setActivationKey(formatted);
  };

  const handleValidate = async () => {
    if (activationKey.replace(/-/g, '').length !== 16) {
      toast.error('Chave inválida', {
        description: 'A chave de ativação deve ter 16 caracteres'
      });
      return;
    }

    setIsValidating(true);

    try {
      const result = await validateActivationKey(activationKey);
      
      if (result.success) {
        toast.success('Chave válida!', {
          description: 'Sua chave de ativação está correta. Clique em "Ativar" para continuar.'
        });
      } else {
        toast.error('Chave inválida', {
          description: result.error || 'Esta chave de ativação não é válida'
        });
      }
    } catch (error) {
      toast.error('Erro', {
        description: 'Ocorreu um erro ao validar a chave'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleActivate = async () => {
    if (activationKey.replace(/-/g, '').length !== 16) {
      toast.error('Chave inválida', {
        description: 'A chave de ativação deve ter 16 caracteres'
      });
      return;
    }

    setIsActivating(true);

    try {
      const result = await activateDevice(activationKey);
      
      if (result.success && result.session) {
        toast.success('Dispositivo ativado!', {
          description: 'Seu dispositivo foi ativado com sucesso.'
        });
        
        // Redirecionar para a página principal
        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else {
        toast.error('Erro na ativação', {
          description: result.error || 'Não foi possível ativar o dispositivo'
        });
      }
    } catch (error) {
      toast.error('Erro', {
        description: 'Ocorreu um erro ao ativar o dispositivo'
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Ativar Dispositivo</CardTitle>
            <CardDescription className="mt-2">
              Insira sua chave de ativação para começar a usar o aplicativo
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Chave de Ativação</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={activationKey}
                onChange={handleKeyChange}
                maxLength={19}
                className="pl-10 text-center font-mono text-lg tracking-wider"
                disabled={isValidating || isActivating}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Digite os 16 caracteres da sua chave de ativação
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleValidate}
              disabled={isValidating || isActivating || activationKey.replace(/-/g, '').length !== 16}
            >
              {isValidating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Validar
            </Button>
            
            <Button
              className="flex-1"
              onClick={handleActivate}
              disabled={isValidating || isActivating || activationKey.replace(/-/g, '').length !== 16}
            >
              {isActivating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ativar
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Não tem uma chave de ativação?{' '}
              <a href="/" className="text-primary hover:underline">
                Entre em contato
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
