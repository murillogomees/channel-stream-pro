import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, RotateCcw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTemplates } from '@/hooks/useTemplates';
import { WhatsappTemplate } from '@/types/whatsapp';
import { toast } from 'sonner';

export default function AdminTemplates() {
  const navigate = useNavigate();
  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetToDefaults,
    extractVariables,
  } = useTemplates();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsappTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    daysBeforeDue: 0,
    type: 'local' as 'local' | 'botbot',
  });

  const handleOpenDialog = (template?: WhatsappTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        message: template.message,
        daysBeforeDue: template.daysBeforeDue || 0,
        type: template.type,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        message: '',
        daysBeforeDue: 0,
        type: 'local',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.message.trim()) {
      toast.error('Preencha nome e mensagem');
      return;
    }

    const variables = extractVariables(formData.message);

    if (editingTemplate) {
      updateTemplate(editingTemplate.id, {
        ...formData,
        variables,
      });
      toast.success('Template atualizado com sucesso!');
    } else {
      addTemplate({
        ...formData,
        variables,
      });
      toast.success('Template criado com sucesso!');
    }

    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (templateToDelete) {
      deleteTemplate(templateToDelete);
      toast.success('Template excluído com sucesso!');
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleReset = () => {
    resetToDefaults();
    toast.success('Templates restaurados para padrão!');
    setResetDialogOpen(false);
  };

  const getDaysLabel = (days: number | undefined) => {
    if (days === undefined) return 'N/A';
    if (days < 0) return `${Math.abs(days)} dias antes`;
    if (days === 0) return 'Dia do vencimento';
    return `${days} dias depois`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Templates de Mensagens
              </h1>
              <p className="text-muted-foreground">
                Gerencie os modelos de notificação WhatsApp
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setResetDialogOpen(true)}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Padrão
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Variáveis Disponíveis</CardTitle>
            <CardDescription>
              Use estas variáveis nas mensagens entre chaves, ex: {'{nome}'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <code className="bg-muted px-2 py-1 rounded">{'{nome}'}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <code className="bg-muted px-2 py-1 rounded">{'{dataVencimento}'}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <code className="bg-muted px-2 py-1 rounded">{'{linkPagamento}'}</code>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <code className="bg-muted px-2 py-1 rounded">{'{plano}'}</code>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Templates Cadastrados ({templates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum template cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>{getDaysLabel(template.daysBeforeDue)}</TableCell>
                      <TableCell className="max-w-md truncate">{template.message}</TableCell>
                      <TableCell>
                        <span className="capitalize">{template.type}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(template)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTemplateToDelete(template.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
            <DialogDescription>
              Configure o modelo de mensagem para notificações automáticas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Template</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Lembrete 3 dias antes"
              />
            </div>

            <div>
              <Label htmlFor="daysBeforeDue">Dias em relação ao vencimento</Label>
              <Input
                id="daysBeforeDue"
                type="number"
                value={formData.daysBeforeDue}
                onChange={(e) =>
                  setFormData({ ...formData, daysBeforeDue: parseInt(e.target.value) })
                }
                placeholder="0 = dia do vencimento, -3 = 3 dias antes, 5 = 5 dias depois"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valores negativos: antes do vencimento | 0: dia do vencimento | Positivos: após vencimento
              </p>
            </div>

            <div>
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Olá {nome}! Seu plano vence em {dataVencimento}..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use variáveis: {'{nome}'}, {'{dataVencimento}'}, {'{linkPagamento}'}, {'{plano}'}
              </p>
            </div>

            {formData.message && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Variáveis detectadas:</p>
                <div className="flex flex-wrap gap-2">
                  {extractVariables(formData.message).map((v) => (
                    <code key={v} className="bg-background px-2 py-1 rounded text-xs">
                      {v}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingTemplate ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar Templates Padrão</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá substituir todos os templates atuais pelos templates padrão do sistema.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
