import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useClientes } from '@/hooks/useClientes';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { Cliente, SituacaoCliente, PlanoCliente } from '@/types/cliente';
import { sendWelcomeMessage } from '@/services/eventNotificationService';
import { sendClientUpdateMessage } from '@/services/clientUpdateNotificationService';
import { smartoneService } from '@/services/smartoneService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { DatePicker } from '@/components/ui/date-picker';
import { PhoneInput } from '@/components/ui/phone-input';
import { format, parseISO } from 'date-fns';

// Schema de validação com segurança contra XSS e injeção
const clienteSchema = z.object({
  nome: z.string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome muito longo')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras'),
  telefone: z.string()
    .trim()
    .min(10, 'Telefone deve ter no mínimo 10 dígitos')
    .max(20, 'Telefone muito longo')
    .regex(/^[\d\s\(\)\-\+]+$/, 'Telefone inválido'),
  telegram: z.string()
    .trim()
    .max(50, 'Telegram muito longo')
    .optional()
    .or(z.literal('')),
  email: z.string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo')
    .optional()
    .or(z.literal('')),
  situacao: z.enum(['Testando', 'Ativo', 'Devendo', 'Inativo', 'Lead']),
  dataContratacao: z.string().min(1, 'Data de contratação é obrigatória'),
  dataVencimento: z.string().min(1, 'Data de vencimento é obrigatória'),
  plano: z.enum(['Mensal', 'Trimestral', 'Semestral', 'Anual']),
  valorPago: z.number()
    .min(0, 'Valor não pode ser negativo')
    .max(999999.99, 'Valor muito alto'),
  dataUltimoPagamento: z.string().optional().or(z.literal('')),
  formaUltimoPagamento: z.string()
    .trim()
    .max(100, 'Forma de pagamento muito longa')
    .optional()
    .or(z.literal('')),
  macSmartOne: z.string()
    .trim()
    .max(100, 'MAC muito longo')
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^$/, 'MAC inválido. Use formato XX:XX:XX:XX:XX:XX')
    .optional()
    .or(z.literal('')),
  usuario: z.string()
    .trim()
    .max(100, 'Usuário muito longo')
    .optional()
    .or(z.literal('')),
  senha: z.string()
    .max(100, 'Senha muito longa')
    .optional()
    .or(z.literal('')),
  clienteAtivo: z.boolean().optional(),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

export default function AdminClienteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading } = useAuth();
  const { addCliente, updateCliente, getClienteById } = useClientes();
  const { addLog } = useNotificationLogs();
  const [enviarWhatsApp, setEnviarWhatsApp] = useState(true);
  const [clienteOriginal, setClienteOriginal] = useState<Cliente | null>(null);
  const [isSyncingSmartone, setIsSyncingSmartone] = useState(false);

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
      clienteAtivo: false,
    },
  });

  useEffect(() => {
    if (id) {
      const cliente = getClienteById(id);
      if (cliente) {
        setClienteOriginal(cliente);
        Object.entries(cliente).forEach(([key, value]) => {
          if (key !== 'id' && key !== 'dataCadastro' && key !== 'dataUltimaEdicao') {
            setValue(key as keyof ClienteFormData, value, { shouldValidate: false });
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
    navigate('/auth');
    return null;
  }

  const onSubmit = async (data: ClienteFormData) => {
    // Sanitizar dados antes de salvar
    const sanitizeString = (str: string) => str.replace(/[<>"']/g, '');
    const sanitizePhone = (str: string) => str.replace(/[^0-9+\-() ]/g, '');
    const sanitizeMac = (str: string) => str.replace(/[^A-Fa-f0-9:-]/g, '');
    
    // Gerar credenciais M3U automaticamente se não existirem
    let usuario = sanitizeString(data.usuario || '');
    let senha = data.senha || '';
    
    if (!usuario || !senha) {
      const timestamp = Date.now();
      usuario = `user_${timestamp}`;
      senha = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    const clienteData: Omit<Cliente, 'id' | 'dataCadastro' | 'dataUltimaEdicao'> = {
      nome: sanitizeString(data.nome || ''),
      telefone: sanitizePhone(data.telefone || ''),
      telegram: sanitizeString(data.telegram || ''),
      email: (data.email || '').toLowerCase(),
      situacao: (data.situacao || 'Lead') as SituacaoCliente,
      dataContratacao: data.dataContratacao || '',
      dataVencimento: data.dataVencimento || '',
      plano: (data.plano || 'Mensal') as PlanoCliente,
      valorPago: data.valorPago || 0,
      dataUltimoPagamento: data.dataUltimoPagamento || '',
      formaUltimoPagamento: sanitizeString(data.formaUltimoPagamento || ''),
      macSmartOne: sanitizeMac(data.macSmartOne || ''),
      usuario: usuario,
      senha: senha,
      clienteAtivo: data.clienteAtivo ?? false,
      smartone_status: 'nao_enviado',
    };

    if (id) {
      updateCliente(id, clienteData);
      toast({
        title: 'Cliente atualizado',
        description: 'As informações foram salvas com sucesso.',
      });

      // Verificar se MAC foi alterado ou adicionado
      const macChanged = clienteOriginal && 
        clienteOriginal.macSmartOne !== clienteData.macSmartOne &&
        clienteData.macSmartOne;

      if (macChanged && clienteData.usuario && clienteData.senha) {
        setIsSyncingSmartone(true);
        toast({
          title: "Sincronizando com SmartOne",
          description: "Criando playlist no SmartOne IPTV...",
        });

        const clienteAtualizado: Cliente = {
          ...clienteData,
          id: id,
          dataCadastro: clienteOriginal.dataCadastro,
          dataUltimaEdicao: new Date().toISOString(),
        };

        const result = await smartoneService.syncPlaylistForClient(
          clienteAtualizado,
          updateCliente
        );

        setIsSyncingSmartone(false);

        if (result.success) {
          toast({
            title: "SmartOne sincronizado",
            description: "Playlist criada com sucesso no SmartOne IPTV.",
          });
        } else {
          toast({
            title: "Erro ao sincronizar SmartOne",
            description: result.error || "Não foi possível criar a playlist no SmartOne.",
            variant: "destructive",
          });
        }
      }

      // Enviar mensagem de atualização se checkbox estiver marcado
      if (enviarWhatsApp && clienteOriginal) {
        try {
          const clienteAtualizado: Cliente = {
            ...clienteData,
            id: id,
            dataCadastro: clienteOriginal.dataCadastro,
            dataUltimaEdicao: new Date().toISOString(),
          };

          const enviado = await sendClientUpdateMessage(
            clienteAtualizado,
            clienteOriginal,
            addLog
          );
          
          if (enviado) {
            toast({
              title: 'Mensagem enviada',
              description: `WhatsApp de atualização enviado para ${clienteData.nome}`,
            });
          }
        } catch (error) {
          console.error('Erro ao enviar mensagem de atualização:', error);
        }
      }
    } else {
      const novoCliente = addCliente(clienteData);
      toast({
        title: 'Cliente cadastrado',
        description: 'O novo cliente foi adicionado com sucesso.',
      });

      // Se tem MAC, usuário e senha, sincronizar com SmartOne
      if (clienteData.macSmartOne && clienteData.usuario && clienteData.senha) {
        setIsSyncingSmartone(true);
        toast({
          title: "Sincronizando com SmartOne",
          description: "Criando playlist no SmartOne IPTV...",
        });

        const result = await smartoneService.syncPlaylistForClient(
          novoCliente,
          updateCliente
        );

        setIsSyncingSmartone(false);

        if (result.success) {
          toast({
            title: "SmartOne sincronizado",
            description: "Playlist criada com sucesso no SmartOne IPTV.",
          });
        } else {
          toast({
            title: "Erro ao sincronizar SmartOne",
            description: result.error || "Não foi possível criar a playlist no SmartOne.",
            variant: "destructive",
          });
        }
      }

      // Enviar mensagem de boas-vindas se checkbox estiver marcado
      if (enviarWhatsApp) {
        try {
          const clienteCompleto: Cliente = {
            ...clienteData,
            id: novoCliente.id,
            dataCadastro: novoCliente.dataCadastro,
            dataUltimaEdicao: novoCliente.dataUltimaEdicao,
          };

          const enviado = await sendWelcomeMessage(clienteCompleto, addLog);
          
          if (enviado) {
            toast({
              title: 'Mensagem de boas-vindas enviada',
              description: `WhatsApp enviado para ${clienteData.nome}`,
            });
          }
        } catch (error) {
          console.error('Erro ao enviar mensagem de boas-vindas:', error);
          toast({
            title: 'Aviso',
            description: 'Cliente cadastrado, mas houve erro ao enviar mensagem de boas-vindas.',
            variant: 'destructive',
          });
        }
      }
    }
    navigate('/admin/clientes');
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/clientes')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {id ? 'Editar Cliente' : 'Novo Cliente'}
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Informações do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                  <PhoneInput
                    id="telefone"
                    value={watch('telefone')}
                    onChange={(value) => setValue('telefone', value)}
                    mask="brazilian"
                    placeholder="(11) 99999-9999"
                  />
                  {errors.telefone && <p className="text-sm text-destructive">{errors.telefone.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram">Telegram</Label>
                  <Input id="telegram" {...register('telegram')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="situacao">Situação</Label>
                  <Select
                    onValueChange={(value) => setValue('situacao', value === "0" ? undefined : value as any)}
                    value={watch('situacao') || "0"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" disabled>Selecione uma opção</SelectItem>
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
                    onValueChange={(value) => setValue('plano', value === "0" ? undefined : value as any)}
                    value={watch('plano') || "0"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" disabled>Selecione uma opção</SelectItem>
                      <SelectItem value="Mensal">Mensal</SelectItem>
                      <SelectItem value="Trimestral">Trimestral</SelectItem>
                      <SelectItem value="Semestral">Semestral</SelectItem>
                      <SelectItem value="Anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataContratacao">Data de Contratação</Label>
                  <DatePicker
                    date={watch('dataContratacao') ? parseISO(watch('dataContratacao')) : undefined}
                    onDateChange={(date) => setValue('dataContratacao', date ? format(date, 'yyyy-MM-dd') : '')}
                    placeholder="Selecione a data de contratação"
                    disableFuture
                  />
                  {errors.dataContratacao && <p className="text-sm text-destructive">{errors.dataContratacao.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataVencimento">Data de Vencimento</Label>
                  <DatePicker
                    date={watch('dataVencimento') ? parseISO(watch('dataVencimento')) : undefined}
                    onDateChange={(date) => setValue('dataVencimento', date ? format(date, 'yyyy-MM-dd') : '')}
                    placeholder="Selecione a data de vencimento"
                  />
                  {errors.dataVencimento && <p className="text-sm text-destructive">{errors.dataVencimento.message}</p>}
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
                  <DatePicker
                    date={watch('dataUltimoPagamento') ? parseISO(watch('dataUltimoPagamento')) : undefined}
                    onDateChange={(date) => setValue('dataUltimoPagamento', date ? format(date, 'yyyy-MM-dd') : '')}
                    placeholder="Selecione a data do último pagamento"
                    disableFuture
                  />
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

              <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg border border-border">
                <Switch
                  id="clienteAtivo"
                  checked={watch('clienteAtivo') ?? false}
                  onCheckedChange={(checked) => setValue('clienteAtivo', checked)}
                />
                <div className="flex-1">
                  <Label 
                    htmlFor="clienteAtivo" 
                    className="text-sm font-medium cursor-pointer"
                  >
                    Cliente Ativo
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Indica se o cliente está atualmente usando os serviços
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg border border-border">
                <Checkbox
                  id="enviarWhatsApp"
                  checked={enviarWhatsApp}
                  onCheckedChange={(checked) => setEnviarWhatsApp(checked as boolean)}
                />
                <Label 
                  htmlFor="enviarWhatsApp" 
                  className="text-sm font-normal cursor-pointer"
                >
                  {id 
                    ? 'Enviar mensagem de atualização ao cliente via WhatsApp'
                    : 'Enviar mensagem de boas-vindas ao cliente via WhatsApp'
                  }
                </Label>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/clientes')}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSyncingSmartone} className="w-full sm:w-auto">
                  {isSyncingSmartone ? 'Sincronizando...' : id ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
