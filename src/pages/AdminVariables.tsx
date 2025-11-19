import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Variable, Plus, Trash2, Save, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface SystemVariable {
  id: string;
  name: string;
  value: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
}

const DEFAULT_VARIABLES: SystemVariable[] = [
  {
    id: '1',
    name: 'WHATSAPP_APPKEY',
    value: '',
    description: 'Chave de aplicativo da API WhatsApp',
    type: 'string',
  },
  {
    id: '2',
    name: 'WHATSAPP_AUTHKEY',
    value: '',
    description: 'Chave de autenticação da API WhatsApp',
    type: 'string',
  },
  {
    id: '3',
    name: 'SMARTONE_API_URL',
    value: '',
    description: 'URL base da API SmartOne',
    type: 'string',
  },
  {
    id: '4',
    name: 'AUTO_NOTIFICATION_HOUR',
    value: '10',
    description: 'Hora do dia para envio automático de notificações',
    type: 'number',
  },
];

export default function AdminVariables() {
  const navigate = useNavigate();
  const [variables, setVariables] = useState<SystemVariable[]>(() => {
    const stored = localStorage.getItem('system_variables');
    return stored ? JSON.parse(stored) : DEFAULT_VARIABLES;
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SystemVariable>>({});

  const handleEdit = (variable: SystemVariable) => {
    setEditingId(variable.id);
    setEditForm(variable);
  };

  const handleSave = (id: string) => {
    const updated = variables.map(v =>
      v.id === id ? { ...v, ...editForm } : v
    );
    setVariables(updated);
    localStorage.setItem('system_variables', JSON.stringify(updated));
    setEditingId(null);
    setEditForm({});
    toast.success('Variável atualizada!');
  };

  const handleDelete = (id: string) => {
    const updated = variables.filter(v => v.id !== id);
    setVariables(updated);
    localStorage.setItem('system_variables', JSON.stringify(updated));
    toast.success('Variável removida!');
  };

  const handleAdd = () => {
    const newVariable: SystemVariable = {
      id: crypto.randomUUID(),
      name: 'NOVA_VARIAVEL',
      value: '',
      description: 'Nova variável do sistema',
      type: 'string',
    };
    const updated = [...variables, newVariable];
    setVariables(updated);
    localStorage.setItem('system_variables', JSON.stringify(updated));
    toast.success('Nova variável adicionada!');
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copiado!');
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Variable className="h-8 w-8" />
                Variáveis do Sistema
              </h1>
              <p className="text-muted-foreground">
                Gerencie variáveis de configuração e ambiente
              </p>
            </div>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Variável
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Variáveis Configuradas</CardTitle>
            <CardDescription>
              Lista de todas as variáveis do sistema. Clique para editar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables.map((variable) => (
                  <TableRow key={variable.id}>
                    <TableCell>
                      {editingId === variable.id ? (
                        <Input
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="font-mono text-sm"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                            {variable.name}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(variable.name, variable.id)}
                          >
                            {copiedId === variable.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === variable.id ? (
                        <Input
                          type={variable.type === 'number' ? 'number' : 'text'}
                          value={editForm.value}
                          onChange={(e) =>
                            setEditForm({ ...editForm, value: e.target.value })
                          }
                          className="font-mono text-sm"
                        />
                      ) : (
                        <code className="text-xs text-muted-foreground">
                          {variable.value ? '••••••••' : '(vazio)'}
                        </code>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === variable.id ? (
                        <Input
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm({ ...editForm, description: e.target.value })
                          }
                          className="text-sm"
                        />
                      ) : (
                        <span className="text-sm">{variable.description}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{variable.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {editingId === variable.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleSave(variable.id)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEditForm({});
                              }}
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(variable)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(variable.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variáveis de Template</CardTitle>
            <CardDescription>
              Variáveis disponíveis para usar em templates de notificação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { var: '{{nome}}', desc: 'Nome do cliente' },
                { var: '{{telefone}}', desc: 'Telefone do cliente' },
                { var: '{{plano}}', desc: 'Plano contratado' },
                { var: '{{data_vencimento}}', desc: 'Data de vencimento' },
                { var: '{{valor}}', desc: 'Valor do plano' },
                { var: '{{dias_restantes}}', desc: 'Dias até o vencimento' },
              ].map((item) => (
                <div
                  key={item.var}
                  className="p-4 border rounded-lg flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                      {item.var}
                    </code>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.desc}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(item.var, item.var)}
                  >
                    {copiedId === item.var ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
