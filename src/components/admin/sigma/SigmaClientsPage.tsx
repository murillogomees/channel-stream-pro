import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Search, Plus, MoreHorizontal, Edit, Trash2, MessageCircle,
  Users, AlertTriangle, ChevronLeft, ChevronRight, Send, RefreshCw,
  ShieldAlert, ShieldCheck, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as clientService from "@/services/sigmaBlaze/sigmaClientsService";
import type { SigmaClient, ClientFilters } from "@/services/sigmaBlaze/sigmaClientsService";
import { StatusCircle } from "./StatusCircle";
import { RiskBadge } from "./RiskBadge";
import { ClientFormModal } from "./ClientFormModal";
import { ReminderModal } from "./ReminderModal";

export function SigmaClientsPage() {
  const [clients, setClients] = useState<SigmaClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<ClientFilters>({ page: 1, pageSize: 20 });
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<SigmaClient | null>(null);
  const [deleteClient, setDeleteClient] = useState<SigmaClient | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderClients, setReminderClients] = useState<SigmaClient[]>([]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const result = await clientService.getClients(filters);
      setClients(result.data);
      setTotalCount(result.count);
    } catch {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadClients(); }, [loadClients]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => ({ ...f, search: searchInput || undefined, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Risk scores (computed)
  const clientsWithRisk = useMemo(() => {
    return clients.map(c => ({
      ...c,
      risk: clientService.calculateRiskScore(c),
    }));
  }, [clients]);

  // Filter by risk on client side
  const filteredClients = useMemo(() => {
    if (!filters.riskLevel || filters.riskLevel === 'all') return clientsWithRisk;
    return clientsWithRisk.filter(c => clientService.getRiskLevel(c.risk.score) === filters.riskLevel);
  }, [clientsWithRisk, filters.riskLevel]);

  // Stats
  const stats = useMemo(() => {
    const high = clientsWithRisk.filter(c => clientService.getRiskLevel(c.risk.score) === 'high').length;
    const medium = clientsWithRisk.filter(c => clientService.getRiskLevel(c.risk.score) === 'medium').length;
    const low = clientsWithRisk.filter(c => clientService.getRiskLevel(c.risk.score) === 'low').length;
    return { high, medium, low, total: clientsWithRisk.length };
  }, [clientsWithRisk]);

  const totalPages = Math.ceil(totalCount / (filters.pageSize || 20));

  // Selection
  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selected.size === filteredClients.length) setSelected(new Set());
    else setSelected(new Set(filteredClients.map(c => c.id)));
  };

  // CRUD handlers
  async function handleSaveClient(data: Partial<SigmaClient>) {
    try {
      if (editingClient) {
        await clientService.updateClient(editingClient.id, data);
        toast.success("Cliente atualizado!");
      } else {
        await clientService.createClient(data);
        toast.success("Cliente criado!");
      }
      setEditingClient(null);
      loadClients();
    } catch {
      toast.error("Erro ao salvar");
    }
  }

  async function handleDelete() {
    if (!deleteClient) return;
    try {
      await clientService.softDeleteClient(deleteClient.id);
      toast.success("Cliente desativado");
      setDeleteClient(null);
      loadClients();
    } catch {
      toast.error("Erro ao desativar");
    }
  }

  function openReminderSingle(client: SigmaClient) {
    setReminderClients([client]);
    setReminderOpen(true);
  }

  function openReminderBulk() {
    const selectedClients = filteredClients.filter(c => selected.has(c.id));
    if (selectedClients.length === 0) { toast.error("Selecione clientes"); return; }
    setReminderClients(selectedClients);
    setReminderOpen(true);
  }

  function selectByFilter(type: 'high_risk' | 'expiring') {
    const ids = filteredClients
      .filter(c => {
        if (type === 'high_risk') return clientService.getRiskLevel(c.risk.score) === 'high';
        if (type === 'expiring') {
          const status = clientService.getExpirationStatus(c.expiration_date);
          return status.color === 'red' || status.color === 'yellow';
        }
        return false;
      })
      .map(c => c.id);
    setSelected(new Set(ids));
    toast.info(`${ids.length} clientes selecionados`);
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{stats.low}</p>
              <p className="text-xs text-muted-foreground">Risco Baixo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-400">
          <CardContent className="p-3 flex items-center gap-3">
            <Shield className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold">{stats.medium}</p>
              <p className="text-xs text-muted-foreground">Risco Médio</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.high}</p>
              <p className="text-xs text-muted-foreground">Risco Alto</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-xs text-muted-foreground">Total Ativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou WhatsApp..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filters.riskLevel || 'all'} onValueChange={v => setFilters(f => ({ ...f, riskLevel: v as any }))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="low">Baixo</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.expirationStatus || 'all'} onValueChange={v => setFilters(f => ({ ...f, expirationStatus: v as any, page: 1 }))}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Vencimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">Em dia (&gt;5d)</SelectItem>
                <SelectItem value="warning">Próximo (≤5d)</SelectItem>
                <SelectItem value="critical">Crítico (≤2d)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={() => { setEditingClient(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Novo
              </Button>
              <Button variant="outline" size="icon" onClick={loadClients}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <Badge variant="secondary">{selected.size} selecionado(s)</Badge>
              <Button size="sm" variant="default" onClick={openReminderBulk}>
                <Send className="h-3 w-3 mr-1" /> Enviar Cobrança
              </Button>
              <Button size="sm" variant="outline" onClick={() => selectByFilter('high_risk')}>
                <AlertTriangle className="h-3 w-3 mr-1" /> Selecionar Risco Alto
              </Button>
              <Button size="sm" variant="outline" onClick={() => selectByFilter('expiring')}>
                Selecionar Vencendo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === filteredClients.length && filteredClients.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                  <TableHead className="hidden sm:table-cell">WhatsApp</TableHead>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="hidden lg:table-cell">Último Lembrete</TableHead>
                  <TableHead className="w-10">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map(client => {
                  const riskLevel = clientService.getRiskLevel(client.risk.score);
                  return (
                    <TableRow
                      key={client.id}
                      className={cn(
                        riskLevel === 'high' && "bg-red-500/5",
                        client.status === 'expired' && "opacity-60"
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(client.id)}
                          onCheckedChange={() => toggleSelect(client.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{client.name}</p>
                          <p className="text-xs text-muted-foreground md:hidden">
                            {new Date(client.expiration_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{new Date(client.expiration_date).toLocaleDateString('pt-BR')}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm font-mono">{client.whatsapp}</span>
                      </TableCell>
                      <TableCell>
                        <StatusCircle expirationDate={client.expiration_date} />
                      </TableCell>
                      <TableCell>
                        <RiskBadge score={client.risk.score} reasons={client.risk.reasons} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {client.last_reminder_sent ? (
                          <span className="text-xs text-muted-foreground">
                            {new Date(client.last_reminder_sent).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openReminderSingle(client)}>
                              <MessageCircle className="h-4 w-4 mr-2" /> Enviar Lembrete
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingClient(client); setFormOpen(true); }}>
                              <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteClient(client)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Desativar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <p className="text-xs text-muted-foreground">
                Página {filters.page} de {totalPages} ({totalCount} clientes)
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  disabled={filters.page === 1}
                  onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  disabled={filters.page === totalPages}
                  onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ClientFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editingClient}
        onSave={handleSaveClient}
      />

      <ReminderModal
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        clients={reminderClients}
        onSent={loadClients}
      />

      <AlertDialog open={!!deleteClient} onOpenChange={() => setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente <strong>{deleteClient?.name}</strong> será marcado como inativo. Esta ação pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
