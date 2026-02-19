import { useMemo, memo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreVertical, MessageCircle, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SigmaClient } from "@/hooks/useSigmaClients";
import { ExpirationBadge } from "./ExpirationBadge";

interface SigmaTableProps {
  clients: SigmaClient[];
  loading: boolean;
  onSendReminder: (client: SigmaClient) => void;
}

const ClientRow = memo(function ClientRow({
  client,
  onSendReminder,
}: {
  client: SigmaClient;
  onSendReminder: (c: SigmaClient) => void;
}) {
  const formattedDate = useMemo(
    () => format(new Date(client.expiration_date), "dd/MM/yyyy", { locale: ptBR }),
    [client.expiration_date]
  );

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-sm">{client.full_name}</p>
        <p className="text-xs text-muted-foreground md:hidden">{formattedDate}</p>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="text-sm">{formattedDate}</span>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="text-sm font-mono">{client.phone || "—"}</span>
      </TableCell>
      <TableCell>
        <ExpirationBadge expirationDate={client.expiration_date} />
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onSendReminder(client)}
              disabled={!client.phone}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar Lembrete via WhatsApp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

export function SigmaTable({ clients, loading, onSendReminder }: SigmaTableProps) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhum cliente ativo encontrado</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome do Cliente</TableHead>
          <TableHead className="hidden md:table-cell">Data de Vencimento</TableHead>
          <TableHead className="hidden sm:table-cell">Telefone</TableHead>
          <TableHead className="w-12">Status</TableHead>
          <TableHead className="w-10">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <ClientRow key={client.id} client={client} onSendReminder={onSendReminder} />
        ))}
      </TableBody>
    </Table>
  );
}
