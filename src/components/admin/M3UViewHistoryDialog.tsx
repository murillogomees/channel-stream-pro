import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, Edit, Download } from 'lucide-react';
import { M3UViewHistory } from '@/hooks/useM3UViewHistory';

interface M3UViewHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listName: string;
  history: M3UViewHistory[];
  isLoading: boolean;
}

const viewTypeIcons = {
  view: Eye,
  edit: Edit,
  export: Download
};

const viewTypeLabels = {
  view: 'Visualização',
  edit: 'Edição',
  export: 'Exportação'
};

export function M3UViewHistoryDialog({
  open,
  onOpenChange,
  listName,
  history,
  isLoading
}: M3UViewHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Visualizações</DialogTitle>
          <DialogDescription>
            Lista: <strong>{listName}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma visualização registrada para esta lista
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Data/Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((item) => {
                const Icon = viewTypeIcons[item.view_type];
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.admin_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Icon className="h-3 w-3" />
                        {viewTypeLabels[item.view_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.viewed_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
