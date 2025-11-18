import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { M3UListSelector } from '@/components/admin/M3UListSelector';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  situacao: string;
  plano: string;
}

interface M3UList {
  id: string;
  name: string;
  file_url: string;
  status: string;
  plan_type?: string;
  is_default?: boolean;
}

interface ClientM3UAssignment {
  id: string;
  assigned_at: string;
  is_active: boolean;
  m3u_lists: M3UList;
}

export default function AdminClientM3U() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [assignments, setAssignments] = useState<ClientM3UAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadClientData();
      loadAssignments();
    }
  }, [id]);

  const loadClientData = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, telefone, situacao, plano')
        .eq('id', id)
        .single();

      if (error) throw error;
      setCliente(data);
    } catch (error: any) {
      console.error('Error loading client:', error);
      toast.error('Erro ao carregar dados do cliente');
    }
  };

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('client_m3u_lists')
        .select(`
          id,
          assigned_at,
          is_active,
          m3u_lists (
            id,
            name,
            file_url,
            status,
            plan_type,
            is_default
          )
        `)
        .eq('client_id', id)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      setAssignments(data as any || []);
    } catch (error: any) {
      console.error('Error loading assignments:', error);
      toast.error('Erro ao carregar listas M3U');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLists = async () => {
    if (selectedLists.length === 0) {
      toast.error('Selecione pelo menos uma lista M3U');
      return;
    }

    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // Buscar atribuições existentes
      const { data: existingAssignments } = await supabase
        .from('client_m3u_lists')
        .select('m3u_list_id, id')
        .eq('client_id', id);
      
      const existingListIds = new Set(existingAssignments?.map(a => a.m3u_list_id) || []);
      
      // Separar listas novas das já existentes
      const newListIds = selectedLists.filter(listId => !existingListIds.has(listId));
      const reactivateIds = selectedLists.filter(listId => existingListIds.has(listId));
      
      // Inserir novas atribuições
      if (newListIds.length > 0) {
        const newAssignments = newListIds.map(listId => ({
          client_id: id,
          m3u_list_id: listId,
          assigned_by: user?.id,
          is_active: true,
        }));

        const { error: insertError } = await supabase
          .from('client_m3u_lists')
          .insert(newAssignments);

        if (insertError) throw insertError;
      }
      
      // Reativar atribuições existentes
      if (reactivateIds.length > 0) {
        const { error: updateError } = await supabase
          .from('client_m3u_lists')
          .update({ is_active: true })
          .eq('client_id', id)
          .in('m3u_list_id', reactivateIds);
        
        if (updateError) throw updateError;
      }

      toast.success(`${selectedLists.length} lista(s) adicionada(s) com sucesso`);
      setShowAddDialog(false);
      setSelectedLists([]);
      loadAssignments();
    } catch (error: any) {
      console.error('Error adding lists:', error);
      toast.error('Erro ao adicionar listas M3U');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveList = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('client_m3u_lists')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Lista removida com sucesso');
      setDeleteId(null);
      loadAssignments();
    } catch (error: any) {
      console.error('Error removing list:', error);
      toast.error('Erro ao remover lista');
    }
  };

  const getPlanTypeBadge = (planType?: string) => {
    const colors = {
      teste: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      basico: 'bg-green-500/10 text-green-500 border-green-500/20',
      premium: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    };
    
    return colors[planType as keyof typeof colors] || colors.teste;
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/clientes')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Gerenciar Listas M3U</h1>
          {cliente && (
            <p className="text-muted-foreground mt-1">
              Cliente: {cliente.nome} • {cliente.situacao} • {cliente.plano}
            </p>
          )}
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Listas
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listas M3U Atribuídas</CardTitle>
          <CardDescription>
            Gerencie as listas M3U disponíveis para este cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Nenhuma lista M3U atribuída a este cliente
              </p>
              <Button variant="outline" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeira Lista
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-all"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{assignment.m3u_lists.name}</span>
                      {assignment.m3u_lists.is_default && (
                        <Badge variant="outline" className="text-xs">
                          Padrão
                        </Badge>
                      )}
                      <Badge className={getPlanTypeBadge(assignment.m3u_lists.plan_type)}>
                        {assignment.m3u_lists.plan_type || 'teste'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ExternalLink className="h-3 w-3" />
                      <a 
                        href={assignment.m3u_lists.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors line-clamp-1"
                      >
                        {assignment.m3u_lists.file_url}
                      </a>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Atribuída em {new Date(assignment.assigned_at).toLocaleDateString('pt-BR')}
                      </span>
                      <Badge 
                        variant={assignment.m3u_lists.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {assignment.m3u_lists.status === 'active' ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(assignment.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Lists Dialog */}
      {showAddDialog && (
        <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Adicionar Listas M3U</AlertDialogTitle>
              <AlertDialogDescription>
                Selecione as listas M3U que deseja atribuir a este cliente
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="py-4">
              <M3UListSelector
                selectedLists={selectedLists}
                onChange={setSelectedLists}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAddLists}
                disabled={isSaving || selectedLists.length === 0}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Adicionar {selectedLists.length > 0 && `(${selectedLists.length})`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Lista M3U</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta lista M3U do cliente?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleRemoveList(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
