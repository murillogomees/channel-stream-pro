import { useState, useEffect } from 'react';
import { Users, Plus, X, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  plano: string;
  situacao: string;
}

interface M3UClientManagerProps {
  listId: string;
  listName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function M3UClientManager({ listId, listName, open, onOpenChange, onUpdate }: M3UClientManagerProps) {
  const [linkedClients, setLinkedClients] = useState<Cliente[]>([]);
  const [availableClients, setAvailableClients] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchLinked, setSearchLinked] = useState('');
  const [searchAvailable, setSearchAvailable] = useState('');

  useEffect(() => {
    if (open) {
      loadClients();
    }
  }, [open, listId]);

  const loadClients = async () => {
    try {
      setIsLoading(true);

      // Buscar todos os clientes
      const { data: allClients, error: clientsError } = await supabase
        .from('clientes')
        .select('id, nome, telefone, plano, situacao')
        .order('nome');

      if (clientsError) throw clientsError;

      // Buscar vínculos ativos desta lista
      const { data: assignments, error: assignmentsError } = await supabase
        .from('client_m3u_lists')
        .select('client_id')
        .eq('m3u_list_id', listId)
        .eq('is_active', true);

      if (assignmentsError) throw assignmentsError;

      const linkedIds = new Set(assignments?.map(a => a.client_id) || []);

      // Separar clientes vinculados dos disponíveis
      const linked: Cliente[] = [];
      const available: Cliente[] = [];

      allClients?.forEach(client => {
        if (linkedIds.has(client.id)) {
          linked.push(client);
        } else {
          available.push(client);
        }
      });

      setLinkedClients(linked);
      setAvailableClients(available);
    } catch (error: any) {
      console.error('Error loading clients:', error);
      toast.error('Erro ao carregar clientes', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('client_m3u_lists')
        .insert({
          client_id: clientId,
          m3u_list_id: listId,
          is_active: true
        });

      if (error) throw error;

      toast.success('Cliente vinculado com sucesso!');
      await loadClients();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error adding client:', error);
      toast.error('Erro ao vincular cliente', {
        description: error.message
      });
    }
  };

  const handleRemoveClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('client_m3u_lists')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .eq('m3u_list_id', listId);

      if (error) throw error;

      toast.success('Cliente desvinculado com sucesso!');
      await loadClients();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error removing client:', error);
      toast.error('Erro ao desvincular cliente', {
        description: error.message
      });
    }
  };

  const filteredLinked = linkedClients.filter(c =>
    c.nome.toLowerCase().includes(searchLinked.toLowerCase()) ||
    c.telefone.includes(searchLinked)
  );

  const filteredAvailable = availableClients.filter(c =>
    c.nome.toLowerCase().includes(searchAvailable.toLowerCase()) ||
    c.telefone.includes(searchAvailable)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gerenciar Clientes - {listName}
          </DialogTitle>
          <DialogDescription>
            Adicione ou remova clientes vinculados a esta lista M3U
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Clientes Vinculados */}
            <div className="flex flex-col border rounded-lg p-4 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">
                  Vinculados ({filteredLinked.length})
                </h3>
              </div>
              
              <div className="relative mb-3">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar vinculados..."
                  value={searchLinked}
                  onChange={(e) => setSearchLinked(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>

              <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-2">
                  {filteredLinked.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum cliente vinculado
                    </p>
                  ) : (
                    filteredLinked.map(client => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{client.nome}</p>
                          <p className="text-xs text-muted-foreground">{client.telefone}</p>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {client.plano}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {client.situacao}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveClient(client.id)}
                          className="ml-2 h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Clientes Disponíveis */}
            <div className="flex flex-col border rounded-lg p-4 min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">
                  Disponíveis ({filteredAvailable.length})
                </h3>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar disponíveis..."
                  value={searchAvailable}
                  onChange={(e) => setSearchAvailable(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>

              <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-2">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum cliente disponível
                    </p>
                  ) : (
                    filteredAvailable.map(client => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{client.nome}</p>
                          <p className="text-xs text-muted-foreground">{client.telefone}</p>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {client.plano}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {client.situacao}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleAddClient(client.id)}
                          className="ml-2 h-8 w-8"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
