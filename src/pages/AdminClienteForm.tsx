import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocalAuth } from '@/hooks/useLocalAuth';
import { useClientes } from '@/hooks/useClientes';
import { Cliente, SituacaoCliente, PlanoCliente } from '@/types/cliente';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Schema de validação com segurança contra XSS e injeção
const clienteSchema = z.object({
  nome: z.string()
    .trim()
    .max(200, 'Nome muito longo')
    .transform(val => val.replace(/[<>"']/g, ''))
    .optional(),
  telefone: z.string()
    .trim()
    .max(20, 'Telefone muito longo')
    .transform(val => val.replace(/[^0-9+\-() ]/g, ''))
    .optional(),
  telegram: z.string()
    .trim()
    .max(50, 'Telegram muito longo')
    .transform(val => val.replace(/[<>"']/g, ''))
    .optional(),
  email: z.string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo')
    .transform(val => val.toLowerCase())
    .optional()
    .or(z.literal('')),
  situacao: z.enum(['Testando', 'Ativo', 'Devendo', 'Inativo', 'Lead']).optional(),
  dataContratacao: z.string().optional(),
  dataVencimento: z.string().optional(),
  plano: z.enum(['Mensal', 'Trimestral', 'Semestral', 'Anual']).optional(),
  valorPago: z.number()
    .min(0, 'Valor não pode ser negativo')
    .max(999999.99, 'Valor muito alto')
    .optional(),
  dataUltimoPagamento: z.string().optional(),
  formaUltimoPagamento: z.string()
    .trim()
    .max(100, 'Forma de pagamento muito longa')
    .transform(val => val.replace(/[<>"']/g, ''))
    .optional(),
  macSmartOne: z.string()
    .trim()
    .max(100, 'MAC muito longo')
    .transform(val => val.replace(/[^A-Fa-f0-9:-]/g, ''))
    .optional(),
  usuario: z.string()
    .trim()
    .max(100, 'Usuário muito longo')
    .transform(val => val.replace(/[<>"']/g, ''))
    .optional(),
  senha: z.string()
    .max(100, 'Senha muito longa')
    .optional(),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

export default function AdminClienteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, loading } = useLocalAuth();
  const { addCliente, updateCliente, getClienteById } = useClientes();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      valorPago: 0,
    },
  });

  useEffect(() => {
    if (id) {
      const cliente = getClienteById(id);
      if (cliente) {
        Object.entries(cliente).forEach(([key, value]) => {
          if (key !== 'id' && key !== 'dataCadastro' && key !== 'dataUltimaEdicao') {
            setValue(key as keyof ClienteFormData, value);
          }
        });
      }
    }
  }, [id, getClienteById, setValue]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/admin/login');
    return null;
  }

  const onSubmit = (data: ClienteFormData) => {
    const clienteData: Omit<Cliente, 'id' | 'dataCadastro' | 'dataUltimaEdicao'> = {
      nome: data.nome || '',
      telefone: data.telefone || '',
      telegram: data.telegram || '',
      email: data.email || '',
      situacao: (data.situacao || 'Lead') as SituacaoCliente,
      dataContratacao: data.dataContratacao || '',
      dataVencimento: data.dataVencimento || '',
      plano: (data.plano || 'Mensal') as PlanoCliente,
      valorPago: data.valorPago || 0,
      dataUltimoPagamento: data.dataUltimoPagamento || '',
      formaUltimoPagamento: data.formaUltimoPagamento || '',
      macSmartOne: data.macSmartOne || '',
      usuario: data.usuario || '',
      senha: data.senha || '',
    };

    if (id) {
      updateCliente(id, clienteData);
      toast({
        title: 'Cliente atualizado',
        description: 'As informações foram salvas com sucesso.',
      });
    } else {
      addCliente(clienteData);
      toast({
        title: 'Cliente cadastrado',
        description: 'O novo cliente foi adicionado com sucesso.',
      });
    }
    navigate('/admin/clientes');
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/clientes')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            {id ? 'Editar Cliente' : 'Novo Cliente'}
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>Informações do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" {...register('nome')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register('email')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" {...register('telefone')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram">Telegram</Label>
                  <Input id="telegram" {...register('telegram')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="situacao">Situação</Label>
                  <Select
                    onValueChange={(value) => setValue('situacao', value as any)}
                    value={watch('situacao')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Testando">Testando</SelectItem>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Devendo">Devendo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plano">Plano</Label>
                  <Select
                    onValueChange={(value) => setValue('plano', value as any)}
                    value={watch('plano')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Trimestral">Trimestral</SelectItem>
                      <SelectItem value="Semestral">Semestral</SelectItem>
                      <SelectItem value="Anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataContratacao">Data de Contratação</Label>
                  <Input id="dataContratacao" type="date" {...register('dataContratacao')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataVencimento">Data de Vencimento</Label>
                  <Input id="dataVencimento" type="date" {...register('dataVencimento')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorPago">Valor Pago</Label>
                  <Input
                    id="valorPago"
                    type="number"
                    step="0.01"
                    {...register('valorPago', { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataUltimoPagamento">Data do Último Pagamento</Label>
                  <Input id="dataUltimoPagamento" type="date" {...register('dataUltimoPagamento')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="formaUltimoPagamento">Forma do Último Pagamento</Label>
                  <Input id="formaUltimoPagamento" {...register('formaUltimoPagamento')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="macSmartOne">MAC SmartOne</Label>
                  <Input id="macSmartOne" {...register('macSmartOne')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="usuario">Usuário</Label>
                  <Input id="usuario" {...register('usuario')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <Input id="senha" type="password" {...register('senha')} />
                </div>
              </div>

              <div className="flex gap-4 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/clientes')}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {id ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
