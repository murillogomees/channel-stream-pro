import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from "@/integrations/supabase/client";
import { smartoneAutoSyncService } from "@/services/smartoneAutoSyncService";
import { smartoneService } from "@/services/smartoneService";
import { Cliente } from "@/types/cliente";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, ShieldAlert, Activity } from "lucide-react";

interface ClienteComPerfil {
  id: string;
  user_id: string;
  mac_smart_one: string;
  smartone_status: string;
  smartone_last_sync_at: string;
  profiles: {
    nome: string;
    telefone: string;
    email: string;
  };
}

const AdminSmartOneSync = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clientes, setClientes] = useState<ClienteComPerfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [validationDialog, setValidationDialog] = useState<{
    open: boolean;
    cliente: ClienteComPerfil | null;
    errors: string[];
    warnings: string[];
  }>({
    open: false,
    cliente: null,
    errors: [],
    warnings: [],
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [isAdmin, authLoading, navigate]);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('clientes')
        .select(`
          id,
          user_id,
          mac_smart_one,
          smartone_status,
          smartone_last_sync_at,
          profiles:user_id (
            nome,
            telefone,
            email
          )
        `)
        .not('mac_smart_one', 'is', null)
        .order('smartone_last_sync_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar clientes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadClientes();
    }
  }, [isAdmin]);

  const handleSync = async (cliente: ClienteComPerfil) => {
    try {
      // Converter para formato Cliente para validação
      const clienteParaValidar: Cliente = {
        id: cliente.id,
        nome: cliente.profiles.nome,
        telefone: cliente.profiles.telefone,
        email: cliente.profiles.email,
        macSmartOne: cliente.mac_smart_one,
        smartone_status: cliente.smartone_status as any,
        smartone_last_sync_at: cliente.smartone_last_sync_at,
      } as Cliente;

      // Validação preventiva
      const validation = await smartoneService.validateClientForSync(clienteParaValidar);

      // Se houver erros ou avisos, mostrar diálogo
      if (!validation.valid || validation.warnings.length > 0) {
        setValidationDialog({
          open: true,
          cliente,
          errors: validation.errors,
          warnings: validation.warnings,
        });
        return;
      }

      // Se passou na validação, prosseguir com sync
      await performSync(cliente);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const performSync = async (cliente: ClienteComPerfil) => {
    try {
      setSyncing(cliente.id);
      
      const result = await smartoneAutoSyncService.syncClient({
        user_id: cliente.user_id,
        cliente_id: cliente.id,
        nome: cliente.profiles.nome,
        telefone: cliente.profiles.telefone,
        email: cliente.profiles.email,
        mac_smart_one: cliente.mac_smart_one,
      });

      if (result.success) {
        toast({
          title: "Sincronização realizada",
          description: `Cliente ${cliente.profiles.nome} sincronizado com sucesso!`,
        });
      } else {
        toast({
          title: "Erro na sincronização",
          description: result.error || "Erro desconhecido",
          variant: "destructive",
        });
      }

      await loadClientes();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'criado':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Sincronizado</Badge>;
      case 'erro':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      case 'pendente':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" /> Não Enviado</Badge>;
    }
  };

  const filteredClientes = clientes
    .filter(c => c.profiles !== null)
    .filter(c =>
      c.profiles.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.profiles.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mac_smart_one.toLowerCase().includes(searchTerm.toLowerCase())
    );

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
          <Button 
            variant="outline"
            onClick={() => navigate('/admin/smartone-test')}
          >
            <Activity className="h-4 w-4 mr-2" />
            Teste de Conectividade
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gerenciamento de Sincronização SmartOne</CardTitle>
            <CardDescription>
              Sincronize manualmente clientes com o SmartOne IPTV
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-4">
              <Input
                placeholder="Buscar por nome, email ou MAC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Button onClick={loadClientes} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>MAC Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Sinc.</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClientes.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">{cliente.profiles.nome}</TableCell>
                        <TableCell>{cliente.profiles.email}</TableCell>
                        <TableCell className="font-mono text-sm">{cliente.mac_smart_one}</TableCell>
                        <TableCell>{getStatusBadge(cliente.smartone_status)}</TableCell>
                        <TableCell>
                          {cliente.smartone_last_sync_at
                            ? new Date(cliente.smartone_last_sync_at).toLocaleString('pt-BR')
                            : 'Nunca'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSync(cliente)}
                            disabled={syncing === cliente.id}
                          >
                            {syncing === cliente.id ? (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                Sincronizando...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Sincronizar
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Dialog de Validação */}
        <AlertDialog open={validationDialog.open} onOpenChange={(open) => setValidationDialog({ ...validationDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-yellow-500" />
                Validação de Sincronização
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                {validationDialog.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-semibold text-destructive">⚠️ Erros encontrados:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {validationDialog.errors.map((error, index) => (
                        <li key={index} className="text-destructive">{error}</li>
                      ))}
                    </ul>
                    <p className="text-sm text-muted-foreground mt-2">
                      Corrija os erros acima antes de sincronizar.
                    </p>
                  </div>
                )}

                {validationDialog.warnings.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-semibold text-yellow-600">⚡ Avisos:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {validationDialog.warnings.map((warning, index) => (
                        <li key={index} className="text-yellow-600">{warning}</li>
                      ))}
                    </ul>
                    {validationDialog.errors.length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Você pode prosseguir, mas recomendamos revisar os avisos acima.
                      </p>
                    )}
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setValidationDialog({ open: false, cliente: null, errors: [], warnings: [] })}>
                Cancelar
              </AlertDialogCancel>
              {validationDialog.errors.length === 0 && validationDialog.cliente && (
                <AlertDialogAction onClick={async () => {
                  setValidationDialog({ open: false, cliente: null, errors: [], warnings: [] });
                  await performSync(validationDialog.cliente!);
                }}>
                  Prosseguir mesmo assim
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default AdminSmartOneSync;
