import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Tv } from 'lucide-react';
import { toast } from 'sonner';
import { useClientes } from '@/hooks/useClientes';

export default function AppLogin() {
  const navigate = useNavigate();
  const { clientes } = useClientes();
  const [macAddress, setMacAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatMacAddress = (value: string): string => {
    const cleaned = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
    return formatted.substring(0, 17);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cliente = clientes.find(c => 
      c.macSmartOne?.toUpperCase() === macAddress.toUpperCase()
    );

    if (!cliente) {
      toast.error('MAC não encontrado');
      setIsLoading(false);
      return;
    }

    localStorage.setItem('app_session', JSON.stringify({
      type: 'client',
      clienteId: cliente.id,
      nome: cliente.nome,
      mac: macAddress,
    }));

    toast.success('Login realizado!');
    navigate('/app');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Tv className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-2xl font-bold">Acesso ao App</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>MAC Address</Label>
            <Input
              value={macAddress}
              onChange={(e) => setMacAddress(formatMacAddress(e.target.value))}
              maxLength={17}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
