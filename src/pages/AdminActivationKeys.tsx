import { useState, useEffect } from 'react';
import { Plus, Download, Copy, Loader2, CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface ActivationKey {
  id: string;
  key: string;
  status: 'available' | 'used' | 'expired';
  subscription_plan_id: string;
  used_at: string | null;
  created_at: string;
  subscription_plans: {
    name: string;
  } | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
}

export default function AdminActivationKeys() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [formData, setFormData] = useState({
    subscription_plan_id: '',
    quantity: 1
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const [keysResult, plansResult] = await Promise.all([
        supabase
          .from('activation_keys')
          .select('*, subscription_plans(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('subscription_plans')
          .select('id, name')
          .eq('active', true)
      ]);

      if (keysResult.error) throw keysResult.error;
      if (plansResult.error) throw plansResult.error;

      setKeys((keysResult.data || []) as ActivationKey[]);
      setPlans(plansResult.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);

      const { data, error } = await supabase.rpc('generate_activation_keys', {
        plan_id: formData.subscription_plan_id,
        quantity: formData.quantity
      });

      if (error) throw error;

      toast.success(`${formData.quantity} chave(s) gerada(s) com sucesso!`);
      setIsDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error generating keys:', error);
      toast.error('Erro ao gerar chaves', {
        description: error.message
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Chave copiada!');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Chave', 'Plano', 'Status', 'Data de Criação', 'Data de Uso'].join(','),
      ...filteredKeys.map(k => [
        k.key,
        k.subscription_plans?.name || '',
        k.status,
        format(new Date(k.created_at), 'dd/MM/yyyy HH:mm'),
        k.used_at ? format(new Date(k.used_at), 'dd/MM/yyyy HH:mm') : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activation_keys_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('CSV exportado com sucesso!');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <Clock className="w-4 h-4" />;
      case 'used':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'expired':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      available: 'default',
      used: 'secondary',
      expired: 'destructive'
    };

    const labels: Record<string, string> = {
      available: 'Disponível',
      used: 'Usado',
      expired: 'Expirado'
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {getStatusIcon(status)}
        <span className="ml-1">{labels[status]}</span>
      </Badge>
    );
  };

  const filteredKeys = keys.filter(k => 
    filterStatus === 'all' || k.status === filterStatus
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Chaves de Ativação</h1>
            <p className="text-muted-foreground">Gerencie as chaves de ativação do aplicativo</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Gerar Chaves
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{keys.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {keys.filter(k => k.status === 'available').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Usadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {keys.filter(k => k.status === 'used').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Expiradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {keys.filter(k => k.status === 'expired').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Chaves Cadastradas</CardTitle>
              <CardDescription>
                {filteredKeys.length} chave(s) encontrada(s)
              </CardDescription>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="available">Disponíveis</SelectItem>
                <SelectItem value="used">Usadas</SelectItem>
                <SelectItem value="expired">Expiradas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chave</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Usado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-mono">{key.key}</TableCell>
                  <TableCell>{key.subscription_plans?.name}</TableCell>
                  <TableCell>{getStatusBadge(key.status)}</TableCell>
                  <TableCell>{format(new Date(key.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>
                    {key.used_at ? format(new Date(key.used_at), 'dd/MM/yyyy HH:mm') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyKey(key.key)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Gerar Chaves de Ativação</DialogTitle>
            <DialogDescription>
              Crie novas chaves de ativação para um plano específico
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="plan">Plano de Assinatura</Label>
              <Select
                value={formData.subscription_plan_id}
                onValueChange={(value) => setFormData({ ...formData, subscription_plan_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                max="100"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">
                Máximo: 100 chaves por vez
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleGenerate} 
              disabled={isGenerating || !formData.subscription_plan_id}
            >
              {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
