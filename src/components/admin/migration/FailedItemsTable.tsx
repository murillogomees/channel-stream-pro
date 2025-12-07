import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, RotateCcw, Check, Download, Search, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FailedItem {
  id: number;
  job_id: string;
  item_table: string;
  item_id: string;
  source_url: string;
  error_message: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  resolved: boolean;
  created_at: string;
}

export function FailedItemsTable() {
  const [items, setItems] = useState<FailedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadFailedItems();
  }, []);

  const loadFailedItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('r2_migration_failed')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading failed items:', error);
      toast.error('Erro ao carregar itens com falha');
    } finally {
      setIsLoading(false);
    }
  };

  const retryItem = async (itemId: number) => {
    try {
      const { error } = await supabase
        .from('r2_migration_failed')
        .update({ 
          next_retry_at: new Date().toISOString(),
          retry_count: 0 
        })
        .eq('id', itemId);

      if (error) throw error;
      toast.success('Item agendado para retry');
      loadFailedItems();
    } catch (error) {
      console.error('Error retrying item:', error);
      toast.error('Erro ao agendar retry');
    }
  };

  const markResolved = async (itemId: number) => {
    try {
      const { error } = await supabase
        .from('r2_migration_failed')
        .update({ 
          resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq('id', itemId);

      if (error) throw error;
      toast.success('Item marcado como resolvido');
      loadFailedItems();
    } catch (error) {
      console.error('Error marking resolved:', error);
      toast.error('Erro ao marcar como resolvido');
    }
  };

  const retrySelected = async () => {
    if (selectedItems.size === 0) return;

    try {
      const { error } = await supabase
        .from('r2_migration_failed')
        .update({ 
          next_retry_at: new Date().toISOString(),
          retry_count: 0 
        })
        .in('id', Array.from(selectedItems));

      if (error) throw error;
      toast.success(`${selectedItems.size} itens agendados para retry`);
      setSelectedItems(new Set());
      loadFailedItems();
    } catch (error) {
      console.error('Error retrying items:', error);
      toast.error('Erro ao agendar retries');
    }
  };

  const exportToCsv = () => {
    const headers = ['ID', 'Tabela', 'Item ID', 'URL', 'Erro', 'Retries', 'Criado'];
    const rows = items.map(item => [
      item.id,
      item.item_table,
      item.item_id,
      item.source_url,
      item.error_message,
      item.retry_count,
      item.created_at
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `r2_migration_failed_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredItems = items.filter(item =>
    item.item_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.error_message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.item_table.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID, erro ou tabela..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <Button variant="outline" size="sm" onClick={retrySelected}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry {selectedItems.size} selecionados
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportToCsv}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadFailedItems}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {searchTerm ? 'Nenhum item encontrado' : 'Nenhum item com falha pendente'}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-input"
                  />
                </TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>Item ID</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="rounded border-input"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.item_table}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.item_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-destructive text-sm">
                    {item.error_message}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.retry_count >= item.max_retries ? 'destructive' : 'secondary'}>
                      {item.retry_count}/{item.max_retries}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { 
                      addSuffix: true, 
                      locale: ptBR 
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.source_url && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(item.source_url, '_blank')}
                          title="Abrir URL original"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => retryItem(item.id)}
                        title="Retry"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => markResolved(item.id)}
                        title="Marcar como resolvido"
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
