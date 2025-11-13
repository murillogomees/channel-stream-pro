import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Edit, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface TemplateVariable {
  id: string;
  nome: string;
  descricao: string;
  valor_padrao: string;
  tipo: "texto" | "numero" | "data" | "booleano";
  origem: "manual" | "plano" | "cliente" | "pagamento" | "sistema";
  campo_origem?: string;
  ativo: boolean;
}

const AdminVariables = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [variables, setVariables] = useState<TemplateVariable[]>([
    {
      id: "1",
      nome: "nome",
      descricao: "Nome do cliente",
      valor_padrao: "",
      tipo: "texto",
      origem: "cliente",
      campo_origem: "nome",
      ativo: true
    },
    {
      id: "2",
      nome: "plano",
      descricao: "Nome do plano contratado",
      valor_padrao: "",
      tipo: "texto",
      origem: "plano",
      campo_origem: "nome",
      ativo: true
    },
    {
      id: "3",
      nome: "valor",
      descricao: "Valor da mensalidade",
      valor_padrao: "R$ 0,00",
      tipo: "texto",
      origem: "plano",
      campo_origem: "valor",
      ativo: true
    },
    {
      id: "4",
      nome: "dias_restantes",
      descricao: "Dias restantes até o vencimento",
      valor_padrao: "0",
      tipo: "numero",
      origem: "sistema",
      campo_origem: "dias_ate_vencimento",
      ativo: true
    }
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<TemplateVariable>>({
    nome: "",
    descricao: "",
    valor_padrao: "",
    tipo: "texto",
    origem: "manual",
    campo_origem: "",
    ativo: true
  });

  const handleAdd = () => {
    if (!formData.nome || !formData.descricao) {
      toast({
        title: "Erro",
        description: "Nome e descrição são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const newVariable: TemplateVariable = {
      id: Date.now().toString(),
      nome: formData.nome!,
      descricao: formData.descricao!,
      valor_padrao: formData.valor_padrao || "",
      tipo: formData.tipo || "texto",
      origem: formData.origem || "manual",
      campo_origem: formData.campo_origem,
      ativo: formData.ativo ?? true
    };

    setVariables([...variables, newVariable]);
    setShowAddForm(false);
    setFormData({
      nome: "",
      descricao: "",
      valor_padrao: "",
      tipo: "texto",
      origem: "manual",
      campo_origem: "",
      ativo: true
    });

    toast({
      title: "Sucesso",
      description: "Variável criada com sucesso"
    });
  };

  const handleEdit = (variable: TemplateVariable) => {
    setEditingId(variable.id);
    setFormData(variable);
  };

  const handleSave = () => {
    if (!formData.nome || !formData.descricao) {
      toast({
        title: "Erro",
        description: "Nome e descrição são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setVariables(variables.map(v => 
      v.id === editingId 
        ? { ...v, ...formData } as TemplateVariable
        : v
    ));
    setEditingId(null);
    setFormData({
      nome: "",
      descricao: "",
      valor_padrao: "",
      tipo: "texto",
      origem: "manual",
      campo_origem: "",
      ativo: true
    });

    toast({
      title: "Sucesso",
      description: "Variável atualizada com sucesso"
    });
  };

  const handleDelete = (id: string) => {
    setVariables(variables.filter(v => v.id !== id));
    toast({
      title: "Sucesso",
      description: "Variável removida com sucesso"
    });
  };

  const handleToggleActive = (id: string) => {
    setVariables(variables.map(v => 
      v.id === id ? { ...v, ativo: !v.ativo } : v
    ));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Variáveis de Templates</h1>
              <p className="text-muted-foreground">
                Gerencie as variáveis disponíveis para uso nos templates de mensagens
              </p>
            </div>
          </div>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Variável
          </Button>
        </div>

        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Nova Variável</CardTitle>
              <CardDescription>
                Crie uma nova variável personalizada para usar nos templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Variável *</Label>
                  <Input
                    id="nome"
                    placeholder="ex: nome_cliente"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="texto">Texto</SelectItem>
                      <SelectItem value="numero">Número</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="booleano">Booleano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Textarea
                  id="descricao"
                  placeholder="Descreva o propósito desta variável"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origem">Origem dos Dados</Label>
                  <Select
                    value={formData.origem}
                    onValueChange={(value: any) => setFormData({ ...formData, origem: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="plano">Plano</SelectItem>
                      <SelectItem value="pagamento">Pagamento</SelectItem>
                      <SelectItem value="sistema">Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campo_origem">Campo de Origem</Label>
                  <Input
                    id="campo_origem"
                    placeholder="ex: nome, valor, data_vencimento"
                    value={formData.campo_origem || ""}
                    onChange={(e) => setFormData({ ...formData, campo_origem: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor_padrao">Valor Padrão</Label>
                <Input
                  id="valor_padrao"
                  placeholder="Valor usado quando não há dado disponível"
                  value={formData.valor_padrao}
                  onChange={(e) => setFormData({ ...formData, valor_padrao: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleAdd}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Variável
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Variáveis Cadastradas</CardTitle>
            <CardDescription>
              Use estas variáveis nos templates com a sintaxe {`{{nome_variavel}}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Valor Padrão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables.map((variable) => (
                  <TableRow key={variable.id}>
                    <TableCell className="font-mono">{`{{${variable.nome}}}`}</TableCell>
                    <TableCell>{variable.descricao}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{variable.tipo}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{variable.origem}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {variable.valor_padrao || "-"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={variable.ativo}
                        onCheckedChange={() => handleToggleActive(variable.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(variable)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(variable.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {editingId && (
          <Card>
            <CardHeader>
              <CardTitle>Editar Variável</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-nome">Nome da Variável *</Label>
                  <Input
                    id="edit-nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-tipo">Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="texto">Texto</SelectItem>
                      <SelectItem value="numero">Número</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="booleano">Booleano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-descricao">Descrição *</Label>
                <Textarea
                  id="edit-descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-origem">Origem dos Dados</Label>
                  <Select
                    value={formData.origem}
                    onValueChange={(value: any) => setFormData({ ...formData, origem: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="plano">Plano</SelectItem>
                      <SelectItem value="pagamento">Pagamento</SelectItem>
                      <SelectItem value="sistema">Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-campo_origem">Campo de Origem</Label>
                  <Input
                    id="edit-campo_origem"
                    value={formData.campo_origem || ""}
                    onChange={(e) => setFormData({ ...formData, campo_origem: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-valor_padrao">Valor Padrão</Label>
                <Input
                  id="edit-valor_padrao"
                  value={formData.valor_padrao}
                  onChange={(e) => setFormData({ ...formData, valor_padrao: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingId(null)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminVariables;
