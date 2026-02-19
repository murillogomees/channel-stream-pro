import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, Users, AlertTriangle,
} from "lucide-react";
import { useSigmaClients, type SigmaClient } from "@/hooks/useSigmaClients";
import { SigmaTable } from "./SigmaTable";
import { WhatsAppReminderModal } from "./WhatsAppReminderModal";

export function SigmaClientsPage() {
  const {
    clients, loading, error, filters, setFilters,
    stats, total, totalPages, refresh,
  } = useSigmaClients();

  const [searchInput, setSearchInput] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderClients, setReminderClients] = useState<SigmaClient[]>([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, setFilters]);

  function openReminder(client: SigmaClient) {
    setReminderClients([client]);
    setReminderOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3 flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{stats.green}</p>
              <p className="text-xs text-muted-foreground">Plano ativo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-400">
          <CardContent className="p-3 flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
            <div>
              <p className="text-2xl font-bold">{stats.yellow}</p>
              <p className="text-xs text-muted-foreground">Próximo do vencimento</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.red}</p>
              <p className="text-xs text-muted-foreground">Vencendo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">Total Ativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou username..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={filters.expiration}
              onValueChange={(v) => setFilters((f) => ({ ...f, expiration: v as any, page: 1 }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Vencimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="green">🟢 Verde (&gt;7d)</SelectItem>
                <SelectItem value="yellow">🟡 Amarelo (≤7d)</SelectItem>
                <SelectItem value="red">🔴 Vermelho (≤2d)</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {error && (
            <div className="mt-2 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Erro ao carregar: {error}
              <Button size="sm" variant="ghost" onClick={refresh}>Tentar novamente</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <SigmaTable clients={clients} loading={loading} onSendReminder={openReminder} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <p className="text-xs text-muted-foreground">
                Página {filters.page} de {totalPages} ({total} clientes)
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  disabled={filters.page === 1}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  disabled={filters.page >= totalPages}
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Reminder Modal */}
      <WhatsAppReminderModal
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        clients={reminderClients}
        onSent={refresh}
      />
    </div>
  );
}
