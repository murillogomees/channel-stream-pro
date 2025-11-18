import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useClientes } from '@/hooks/useClientes';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { Cliente, SituacaoCliente, PlanoCliente } from '@/types/cliente';
import { UpdateNotificationHandler } from '@/services/notifications';
import { smartoneService } from '@/services/smartoneService';
import { supabase } from '@/integrations/supabase/client';
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
import { M3UListSelector } from '@/components/admin/M3UListSelector';
import { M3UListPreview } from '@/components/admin/M3UListPreview';
import { SmartOneValidationAlert } from '@/components/admin/SmartOneValidationAlert';

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
  const [selectedM3ULists, setSelectedM3ULists] = useState<string[]>([]);
  const [allM3ULists, setAllM3ULists] = useState<any[]>([]);
  const [smartoneValidation, setSmartoneValidation] = useState<{
    errors: string[];
    warnings: string[];
  }>({ errors: [], warnings: [] });

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
    const loadCliente = async () => {
      if (id) {
        try {
          const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', id)
            .single();

          if (error) throw error;

          if (data) {
            // Mapear campos do banco (snake_case) para o formato do formulário (camelCase)
            const cliente: Cliente = {
              id: data.id,
              nome: data.nome,
              telefone: data.telefone,
              telegram: data.telegram || '',
              email: data.email || '',
              situacao: data.situacao as SituacaoCliente,
              dataContratacao: data.data_contratacao || '',
              dataVencimento: data.data_vencimento || '',
              plano: data.plano as PlanoCliente,
              valorPago: data.valor_pago || 0,
              dataUltimoPagamento: data.data_ultimo_pagamento || '',
              formaUltimoPagamento: data.forma_ultimo_pagamento || '',
              macSmartOne: data.mac_smart_one || '',
              dataCadastro: data.data_cadastro || '',
              dataUltimaEdicao: data.data_ultima_edicao || '',
              clienteAtivo: data.cliente_ativo ?? false,
              smartone_status: data.smartone_status,
              smartone_playlist_id: data.smartone_playlist_id,
              smartone_raw_response: data.smartone_raw_response,
              smartone_last_sync_at: data.smartone_last_sync_at,
              origemCadastro: data.origem_cadastro,
            };

            setClienteOriginal(cliente);
            
            // Preencher os campos do formulário
            Object.entries(cliente).forEach(([key, value]) => {
              if (key !== 'id' && key !== 'dataCadastro' && key !== 'dataUltimaEdicao') {
                setValue(key as keyof ClienteFormData, value, { shouldValidate: false });
              }
            });
          }
        } catch (error) {
          console.error('Erro ao carregar cliente:', error);
          toast({
            title: 'Erro',
            description: 'Não foi possível carregar os dados do cliente.',
            variant: 'destructive',
          });
        }
      }
    };

    loadCliente();
  }, [id, setValue, toast]);

  // Validação SmartOne em tempo real
  useEffect(() => {
    const validateSmartOneFields = async () => {
      const macSmartOne = watch('macSmartOne');
      const nome = watch('nome');

      // Se MAC não está preenchido, não validar
      if (!macSmartOne) {
        setSmartoneValidation({ errors: [], warnings: [] });
        return;
      }

      // Criar objeto cliente temporário para validação
      const tempCliente: Partial<Cliente> = {
        macSmartOne: macSmartOne || '',
        nome: nome || '',
      } as any;

      const validation = await smartoneService.validateClientForSync(tempCliente as Cliente);
      setSmartoneValidation({
        errors: validation.errors,
        warnings: validation.warnings,
      });
    };

    validateSmartOneFields();
  }, [watch('macSmartOne'), watch('nome')]);

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
      clienteAtivo: data.clienteAtivo ?? false,
      smartone_status: 'nao_enviado',
    };

    let clientId: string;
    
    if (id) {
      updateCliente(id, clienteData);
      clientId = id;
      toast({
        title: 'Cliente atualizado',
        description: 'As informações foram salvas com sucesso.',
      });

      // Verificar se MAC foi alterado ou adicionado
      const macChanged = clienteOriginal && 
        clienteOriginal.macSmartOne !== clienteData.macSmartOne &&
        clienteData.macSmartOne;

      if (macChanged) {
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

          const updateHandler = new UpdateNotificationHandler();
          const enviado = await updateHandler.sendUpdateNotification(
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
      // Insert new client directly into Supabase
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data: newClientData, error: insertError } = await supabase
          .from('clientes')
          .insert({
            nome: clienteData.nome,
            telefone: clienteData.telefone,
            telegram: clienteData.telegram || null,
            email: clienteData.email || null,
            situacao: clienteData.situacao,
            data_contratacao: clienteData.dataContratacao || null,
            data_vencimento: clienteData.dataVencimento || null,
            plano: clienteData.plano,
            valor_pago: clienteData.valorPago || null,
            data_ultimo_pagamento: clienteData.dataUltimoPagamento || null,
            forma_ultimo_pagamento: clienteData.formaUltimoPagamento || null,
            mac_smart_one: clienteData.macSmartOne || null,
            cliente_ativo: clienteData.clienteAtivo,
            smartone_status: 'nao_enviado',
            data_cadastro: new Date().toISOString(),
            data_ultima_edicao: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError) throw insertError;
        if (!newClientData) throw new Error('Failed to create client');

        clientId = newClientData.id;

        // Also update local context
        const novoCliente = addCliente(clienteData);
        
        toast({
          title: 'Cliente cadastrado',
          description: 'O novo cliente foi adicionado com sucesso.',
        });

        // Save M3U list assignments for new clients
        if (selectedM3ULists.length > 0) {
          try {
            const newAssignments = selectedM3ULists.map(listId => ({
              client_id: clientId,
              m3u_list_id: listId,
              assigned_by: user?.id,
              is_active: true,
            }));

            const { error: m3uError } = await supabase
              .from('client_m3u_lists')
              .insert(newAssignments);

            if (m3uError) throw m3uError;

            toast({
              title: "Listas atribuídas",
              description: `${selectedM3ULists.length} lista(s) M3U atribuída(s) com sucesso`,
            });
          } catch (error) {
            console.error('Error assigning M3U lists:', error);
            toast({
              title: "Erro ao atribuir listas",
              description: "Cliente criado, mas houve erro ao atribuir listas M3U",
              variant: "destructive",
            });
          }
        }

        // Se tem MAC, sincronizar com SmartOne
        if (clienteData.macSmartOne) {
          // Validação preventiva
          const clienteCompleto: Cliente = {
            ...clienteData,
            id: clientId,
            dataCadastro: new Date().toISOString(),
            dataUltimaEdicao: new Date().toISOString(),
          };

          const validation = await smartoneService.validateClientForSync(clienteCompleto);

          // Mostrar avisos se houver
          if (validation.warnings.length > 0) {
            toast({
              title: "Avisos de Validação",
              description: validation.warnings.join('\n'),
              variant: "default",
            });
          }

          // Se houver erros, não sincronizar
          if (!validation.valid) {
            toast({
              title: "Erro de Validação",
              description: validation.errors.join('\n'),
              variant: "destructive",
            });
            
            navigate("/admin/clientes");
            return;
          }

          // Prosseguir com sincronização
          setIsSyncingSmartone(true);
          toast({
            title: "Sincronizando com SmartOne",
            description: "Criando playlist no SmartOne IPTV...",
          });

          const result = await smartoneService.syncPlaylistForClient(
            clienteCompleto,
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

      // Boas-vindas serão enviadas automaticamente pelo EventNotificationHandler
      if (enviarWhatsApp) {
        console.log('Boas-vindas serão enviadas automaticamente pelo sistema');
      }
      } catch (error) {
        console.error('Error creating client:', error);
        toast({
          title: "Erro ao criar cliente",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
        return;
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

                {/* Validação SmartOne em tempo real */}
                {watch('macSmartOne') && (
                  <div className="col-span-2">
                    <SmartOneValidationAlert 
                      errors={smartoneValidation.errors}
                      warnings={smartoneValidation.warnings}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 p-4 bg-muted/20 rounded-lg border border-border">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Listas M3U</Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione uma ou mais listas M3U que serão atribuídas a este cliente
                  </p>
                </div>
                <M3UListSelector 
                  selectedLists={selectedM3ULists}
                  onChange={setSelectedM3ULists}
                  onListsLoaded={setAllM3ULists}
                />
              </div>

              {!id && selectedM3ULists.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Preview das Listas Selecionadas</Label>
                  <M3UListPreview 
                    selectedLists={selectedM3ULists}
                    allLists={allM3ULists}
                  />
                </div>
              )}

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
