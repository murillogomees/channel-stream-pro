import { useState, useEffect } from 'react';
import { Loader2, Smartphone, Ban, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface AppUser {
  id: string;
  device_id: string;
  activated_at: string;
  expires_at: string;
  status: 'active' | 'suspended' | 'expired' | 'trial';
  subscription_plans: {
    name: string;
  } | null;
}

export default function AdminAppUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('app_users')
        .select(`
          id,
          device_id,
          subscription_plan_id,
          activation_key_id,
          status,
          activated_at,
          expires_at,
          created_at,
          updated_at,
          subscription_plans (
            name
          )
        `)
        .order('activated_at', { ascending: false });

      if (error) throw error;

      setUsers((data || []) as AppUser[]);
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error('Erro ao carregar usuários', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspend = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ status: 'suspended' })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success('Usuário suspenso com sucesso!');
      loadUsers();
    } catch (error: any) {
      console.error('Error suspending user:', error);
      toast.error('Erro ao suspender usuário', {
        description: error.message
      });
    }
  };

  const handleActivate = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('app_users')
        .update({ status: 'active' })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success('Usuário reativado com sucesso!');
      loadUsers();
    } catch (error: any) {
      console.error('Error activating user:', error);
      toast.error('Erro ao reativar usuário', {
        description: error.message
      });
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (isExpired) {
      return (
        <Badge variant="destructive">
          Expirado
        </Badge>
      );
    }

    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      suspended: 'destructive',
      expired: 'destructive'
    };

    const labels: Record<string, string> = {
      active: 'Ativo',
      suspended: 'Suspenso',
      expired: 'Expirado'
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {labels[status]}
      </Badge>
    );
  };

  const getDaysRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const filteredUsers = users.filter(u => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'expired') return new Date(u.expires_at) < new Date();
    return u.status === filterStatus;
  });

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
            <h1 className="text-3xl font-bold">Usuários do Aplicativo</h1>
            <p className="text-muted-foreground">Gerencie os dispositivos ativados</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {users.filter(u => u.status === 'active' && new Date(u.expires_at) > new Date()).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Suspensos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {users.filter(u => u.status === 'suspended').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Expirados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {users.filter(u => new Date(u.expires_at) < new Date()).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dispositivos Ativados</CardTitle>
          <CardDescription>
            {filteredUsers.length} dispositivo(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device ID</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ativado em</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Dias Restantes</TableHead>
                <TableHead>Último Acesso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                      {user.device_id.substring(0, 20)}...
                    </div>
                  </TableCell>
                  <TableCell>{user.subscription_plans?.name}</TableCell>
                  <TableCell>{getStatusBadge(user.status, user.expires_at)}</TableCell>
                  <TableCell>{format(new Date(user.activated_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>{format(new Date(user.expires_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <span className={getDaysRemaining(user.expires_at) <= 7 ? 'text-red-600 font-semibold' : ''}>
                      {getDaysRemaining(user.expires_at)} dias
                    </span>
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.activated_at), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.status === 'active' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSuspend(user.id)}
                        title="Suspender"
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleActivate(user.id)}
                        title="Reativar"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
