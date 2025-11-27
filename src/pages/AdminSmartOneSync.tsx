import { useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from "@/integrations/supabase/client";
import { smartoneService } from "@/services/smartoneService";
import { Cliente } from "@/types/cliente";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle, ShieldAlert, Activity, Wifi, Copy } from "lucide-react";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [clientes, setClientes] = useState<ClienteComPerfil[]>([]);
  const [smartonePlaylists, setSmartOnePlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
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
    loadClientes();
    loadSmartOnePlaylists();
    
    // Real-time subscription for cliente changes
    const channel = supabase
      .channel('clientes-sync-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clientes',
          filter: 'mac_smart_one=not.is.null'
        },
        (payload) => {
          console.log('🔄 Real-time update received:', payload);
          loadClientes();
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      loadClientes();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

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
      setLastUpdate(new Date());
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

  const loadSmartOnePlaylists = async () => {
    try {
      setLoadingPlaylists(true);
      const result = await smartoneService.listPlaylists();
      
      if (result.success) {
        setSmartOnePlaylists(result.playlists || []);
        toast({
          title: "Playlists carregadas",
          description: `${result.playlists?.length || 0} playlists encontradas no SmartOne`,
        });
      } else {
        // Mensagem específica para bloqueio do Cloudflare
        if (result.error?.includes('bloqueando requisições automáticas')) {
          toast({
            title: "SmartOne bloqueou a requisição",
            description: "O SmartOne está protegendo contra bots. Acesse o painel SmartOne manualmente para visualizar as playlists.",
            variant: "destructive",
            duration: 8000,
          });
        } else {
          toast({
            title: "Erro ao carregar playlists",
            description: result.error,
            variant: "destructive",
          });
        }
        setSmartOnePlaylists([]);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
      setSmartOnePlaylists([]);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const testAlternativeEndpoints = async () => {
    setLoadingPlaylists(true);
    try {
      const { data, error } = await supabase.functions.invoke('smartone-list-playlists-alt');

      if (error) {
        toast({
          title: "Erro ao testar endpoints",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.success) {
        setSmartOnePlaylists(data.playlists || []);
        toast({
          title: "✅ Endpoint alternativo funcionou!",
          description: `${data.working_endpoint} retornou ${data.playlists?.length || 0} playlists`,
          duration: 10000,
        });
      } else {
        toast({
          title: "Nenhum endpoint funcionou",
          description: data.recommendation || "Todos os endpoints foram bloqueados",
          variant: "destructive",
          duration: 10000,
        });
        console.log('Resultados dos testes:', data.all_results);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao testar endpoints",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingPlaylists(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadClientes();
      loadSmartOnePlaylists();
      
      // Real-time subscription for cliente changes
      const channel = supabase
        .channel('clientes-sync-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clientes',
            filter: 'mac_smart_one=not.is.null'
          },
          (payload) => {
            console.log('🔄 Real-time update received:', payload);
            loadClientes(); // Reload the list on any change
          }
        )
        .subscribe();

      // Periodic refresh every 30 seconds
      const interval = setInterval(() => {
        loadClientes();
      }, 30000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
  }, []);

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
      
      // Buscar lista M3U padrão
      const { data: defaultM3U } = await supabase
        .from('m3u_lists')
        .select('name, file_url')
        .eq('is_default', true)
        .eq('status', 'active')
        .maybeSingle();
      
      if (!defaultM3U) {
        throw new Error('Nenhuma lista M3U padrão configurada');
      }
      
      const playlistName = `${cliente.profiles.nome} - ${defaultM3U.name}`;
      
      // Formatar dados para copiar
      const dadosParaCopiar = `═══════════════════════════════════════
📋 DADOS PARA SMARTONE IPTV
═══════════════════════════════════════

Cliente: ${cliente.profiles.nome}
MAC Address: ${cliente.mac_smart_one}
Nome da Playlist: ${playlistName}
URL da Playlist: ${defaultM3U.file_url}

═══════════════════════════════════════
📝 INSTRUÇÕES:
1. Acesse o painel SmartOne
2. Vá em "Add Playlist" > aba "XtreamCodes"
3. Cole os dados acima nos campos correspondentes
4. Clique em "Add Playlist"
═══════════════════════════════════════`;

      // Copiar para clipboard
      await navigator.clipboard.writeText(dadosParaCopiar);
      
      toast({
        title: "✅ Dados copiados!",
        description: "Cole no painel SmartOne para criar a playlist",
        duration: 8000,
      });

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sincronização SmartOne</h2>
          <p className="text-muted-foreground">Gerencie sincronização de playlists</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Tabela de Playlists do SmartOne */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Playlists Cadastradas no SmartOne</CardTitle>
                  <CardDescription>
                    Playlists registradas diretamente no sistema SmartOne IPTV
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={loadSmartOnePlaylists} 
                    variant="outline"
                    disabled={loadingPlaylists}
                    size="sm"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingPlaylists ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                  <Button 
                    onClick={testAlternativeEndpoints}
                    disabled={loadingPlaylists}
                    size="sm"
                    variant="secondary"
                  >
                    <Wifi className={`h-4 w-4 mr-2 ${loadingPlaylists ? 'animate-spin' : ''}`} />
                    Testar Endpoints
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Limitação de Acesso Automático
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      O SmartOne IPTV protege seu painel contra requisições automáticas (bots). 
                      Para visualizar as playlists cadastradas, acesse o painel administrativo do SmartOne manualmente.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 border-amber-300 dark:border-amber-700"
                      onClick={() => window.open('https://smartone-iptv.com/client/login/', '_blank')}
                    >
                      <Wifi className="h-4 w-4 mr-2" />
                      Acessar Painel SmartOne
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>MAC Address</TableHead>
                      <TableHead>URL M3U</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Criação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPlaylists ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          <RefreshCw className="h-4 w-4 animate-spin inline mr-2" />
                          Carregando playlists...
                        </TableCell>
                      </TableRow>
                    ) : smartonePlaylists.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          <div className="flex flex-col items-center gap-2">
                            <XCircle className="h-8 w-8 text-muted-foreground/50" />
                            <p>Não foi possível carregar as playlists automaticamente</p>
                            <p className="text-xs">Acesse o painel SmartOne manualmente usando o botão acima</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      smartonePlaylists.map((playlist) => (
                        <TableRow key={playlist.id || playlist.playlist_id}>
                          <TableCell className="font-medium">{playlist.nome || playlist.name}</TableCell>
                          <TableCell className="font-mono text-sm">{playlist.mac || playlist.mac_address}</TableCell>
                          <TableCell className="text-xs truncate max-w-xs">
                            {playlist.m3u_url || playlist.url}
                          </TableCell>
                          <TableCell>
                            <Badge variant={playlist.active ? "default" : "secondary"}>
                              {playlist.active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {playlist.created_at 
                              ? new Date(playlist.created_at).toLocaleDateString('pt-BR')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Clientes Locais */}
          <Card>
            <CardHeader>
              <CardTitle>Clientes Locais com MAC Cadastrado</CardTitle>
              <CardDescription>
                Clientes cadastrados localmente que precisam ser sincronizados com o SmartOne
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
                              variant="secondary"
                            >
                              {syncing === cliente.id ? (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copiando...
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copiar Dados
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
        </div>

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
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Dados
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
