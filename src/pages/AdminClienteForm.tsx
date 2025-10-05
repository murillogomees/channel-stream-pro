import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useClientes } from '@/hooks/useClientes';
import { Cliente } from '@/types/cliente';
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
import { Switch } from '@/components/ui/switch';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const clienteSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  telefone: z.string().min(10, 'Telefone inválido'),
  telegram: z.string(),
  email: z.string().email('Email inválido'),
  situacao: z.enum(['Testando', 'Ativo', 'Devendo', 'Inativo', 'Lead']),
  dataContratacao: z.string(),
  periodoValidade: z.boolean(),
  dataVencimento: z.string(),
  plano: z.enum(['Mensal', 'Trimestral', 'Semestral', 'Anual']),
  valorPago: z.number().min(0),
  dataUltimoPagamento: z.string(),
  formaUltimoPagamento: z.string(),
  macSmartOne: z.string(),
  usuario: z.string().min(3),
  senha: z.string().min(6),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

export default function AdminClienteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading } = useAdminAuth();
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
      periodoValidade: true,
      valorPago: 0,
    },
  });

  const periodoValidade = watch('periodoValidade');

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

  if (!isAdmin) {
    navigate('/admin/login');
    return null;
  }

  const onSubmit = (data: ClienteFormData) => {
    const clienteData: Omit<Cliente, 'id' | 'dataCadastro' | 'dataUltimaEdicao'> = {
      nome: data.nome,
      telefone: data.telefone,
      telegram: data.telegram,
      email: data.email,
      situacao: data.situacao,
      dataContratacao: data.dataContratacao,
      periodoValidade: data.periodoValidade,
      dataVencimento: data.dataVencimento,
      plano: data.plano,
      valorPago: data.valorPago,
      dataUltimoPagamento: data.dataUltimoPagamento,
      formaUltimoPagamento: data.formaUltimoPagamento,
      macSmartOne: data.macSmartOne,
      usuario: data.usuario,
      senha: data.senha,
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
                  <Label htmlFor="nome">Nome *</Label>
                  <Input id="nome" {...register('nome')} />
                  {errors.nome && (
                    <p className="text-sm text-destructive">{errors.nome.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" {...register('email')} />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input id="telefone" {...register('telefone')} />
                  {errors.telefone && (
                    <p className="text-sm text-destructive">{errors.telefone.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram">Telegram</Label>
                  <Input id="telegram" {...register('telegram')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="situacao">Situação *</Label>
                  <Select
                    onValueChange={(value) => setValue('situacao', value as any)}
                    defaultValue={watch('situacao')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a situação" />
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
                  <Label htmlFor="plano">Plano *</Label>
                  <Select
                    onValueChange={(value) => setValue('plano', value as any)}
                    defaultValue={watch('plano')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o plano" />
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
                  <Label htmlFor="dataContratacao">Data de Contratação *</Label>
                  <Input id="dataContratacao" type="date" {...register('dataContratacao')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periodoValidade" className="flex items-center gap-2">
                    Período de Validade
                    <Switch
                      checked={periodoValidade}
                      onCheckedChange={(checked) => setValue('periodoValidade', checked)}
                    />
                  </Label>
                </div>

                {periodoValidade && (
                  <div className="space-y-2">
                    <Label htmlFor="dataVencimento">Data de Vencimento</Label>
                    <Input id="dataVencimento" type="date" {...register('dataVencimento')} />
                  </div>
                )}

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
                  <Label htmlFor="usuario">Usuário *</Label>
                  <Input id="usuario" {...register('usuario')} />
                  {errors.usuario && (
                    <p className="text-sm text-destructive">{errors.usuario.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha">Senha *</Label>
                  <Input id="senha" type="password" {...register('senha')} />
                  {errors.senha && (
                    <p className="text-sm text-destructive">{errors.senha.message}</p>
                  )}
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
