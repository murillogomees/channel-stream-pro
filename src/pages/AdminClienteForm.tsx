// Admin Client Form - Client registration and editing
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useProfiles, UnifiedProfile } from '@/hooks/useProfiles';
import { useNotificationLogs } from '@/hooks/useNotificationLogs';
import { Cliente, SituacaoCliente, PlanoCliente } from '@/types/cliente';
import { UpdateNotificationHandler, EventNotificationHandler } from '@/services/notifications';
import { supabase } from '@/integrations/supabase/client';
import { activityLogService } from '@/services/activityLogService';
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
import { M3UListSelector } from '@/components/admin/M3UListSelector';
import { M3UListPreview } from '@/components/admin/M3UListPreview';

import { ArrowLeft, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { PhoneInput } from '@/components/ui/phone-input';
import { format, parseISO, addDays, addMonths, addYears } from 'date-fns';

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
  email: z.string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  senha: z.string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa')
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
  formaUltimoPagamento: z.enum(['Pix', 'TED', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', '']).optional(),
  macSmartOne: z.string()
    .trim()
    .max(100, 'MAC muito longo')
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^$/, 'MAC inválido. Use formato XX:XX:XX:XX:XX:XX')
    .optional()
    .or(z.literal('')),
  clienteAtivo: z.boolean().optional(),
  origemCadastro: z.enum(['Google Ads', 'Facebook', 'Instagram', 'Indicação', 'Website', 'Outro', '']).optional(),
  dispositivoContratado: z.enum([
    'smart_tv',
    'roku_tv', 
    'fire_stick',
    'android_tv',
    'celular_android',
    'celular_ios',
    'computador',
    'mac',
    'tablet_android',
    'tablet_ios',
    'chromecast',
    'apple_tv',
    'xbox',
    'playstation',
    ''
  ]).optional(),
});

type ClienteFormData = z.infer<typeof clienteSchema>;

export default function AdminClienteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profiles, updateProfile, loading: loadingProfiles } = useProfiles();
  const { addLog } = useNotificationLogs();
  const [enviarWhatsApp, setEnviarWhatsApp] = useState(!id);
  const [clienteOriginal, setClienteOriginal] = useState<UnifiedProfile | null>(null);
  const isInitialLoad = useRef(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedM3ULists, setSelectedM3ULists] = useState<string[]>([]);
  const [allM3ULists, setAllM3ULists] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingAuthUser, setHasExistingAuthUser] = useState(false);

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
      clienteAtivo: !id, // true para novo cliente, false para edição
    },
  });

  useEffect(() => {
    const loadCliente = async () => {
      if (id) {
        try {
          const { data, error } = await (supabase as any)
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

          if (error) throw error;

          if (data) {
            // Mapear campos do banco para UnifiedProfile
            const cliente: UnifiedProfile = {
              id: data.id,
              nome: data.nome,
              email: data.email || '',
              telefone: data.telefone || '',
              telefone_whatsapp: data.telefone_whatsapp,
              origem_cadastro: data.origem_cadastro,
              created_at: data.created_at || '',
              updated_at: data.updated_at || '',
              situacao: data.situacao,
              plano: data.plano,
              data_vencimento: data.data_vencimento,
              data_contratacao: data.data_contratacao,
              valor_pago: data.valor_pago,
              data_ultimo_pagamento: data.data_ultimo_pagamento,
              forma_ultimo_pagamento: data.forma_ultimo_pagamento,
              mac_smart_one: data.mac_smart_one,
              cliente_ativo: data.cliente_ativo,
              is_recorrente: data.is_recorrente,
              dispositivo_contratado: data.dispositivo_contratado,
            };

            setClienteOriginal(cliente);
            
            // Preencher os campos do formulário
            setValue('nome', cliente.nome);
            setValue('telefone', cliente.telefone);
            setValue('email', cliente.email);
            setValue('situacao', cliente.situacao as any || 'Testando');
            setValue('dataContratacao', cliente.data_contratacao || cliente.created_at);
            setValue('dataVencimento', cliente.data_vencimento || '');
            setValue('plano', cliente.plano as any || 'Mensal');
            setValue('valorPago', cliente.valor_pago || 0);
            setValue('dataUltimoPagamento', cliente.data_ultimo_pagamento || '');
            setValue('formaUltimoPagamento', cliente.forma_ultimo_pagamento as any || '');
            setValue('macSmartOne', cliente.mac_smart_one || '');
            setValue('clienteAtivo', cliente.cliente_ativo ?? false);
            setValue('origemCadastro', cliente.origem_cadastro as any || '');
            setValue('dispositivoContratado', cliente.dispositivo_contratado as any || '');

            // Buscar M3U lists atribuídas ao cliente
            const { data: m3uAssignments } = await supabase
              .from('client_m3u_lists')
              .select('m3u_list_id')
              .eq('client_id', id)
              .eq('is_active', true);

            if (m3uAssignments) {
              setSelectedM3ULists(m3uAssignments.map(a => a.m3u_list_id));
            }

            // Verificar se cliente já tem usuário de autenticação
            if (data.user_id) {
              setHasExistingAuthUser(true);
              console.log('Cliente já possui conta de acesso:', data.user_id);
            }
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

  // Cálculo automático de data de vencimento e pagamento
  useEffect(() => {
    const dataContratacao = watch('dataContratacao');
    const situacao = watch('situacao');
    const plano = watch('plano');

    if (dataContratacao && situacao) {
      const dataContrato = parseISO(dataContratacao);
      let dataVencimento: Date;

      if (situacao === 'Testando') {
        // 15 dias após data de contratação para modo teste
        dataVencimento = addDays(dataContrato, 15);
        setValue('dataVencimento', format(dataVencimento, 'yyyy-MM-dd'));
        // Data de pagamento igual à data de contratação para modo teste
        setValue('dataUltimoPagamento', dataContratacao);
      } else if (situacao === 'Ativo' && plano) {
        // Calcular baseado no plano
        switch (plano) {
          case 'Mensal':
            dataVencimento = addMonths(dataContrato, 1);
            break;
          case 'Trimestral':
            dataVencimento = addMonths(dataContrato, 3);
            break;
          case 'Semestral':
            dataVencimento = addMonths(dataContrato, 6);
            break;
          case 'Anual':
            dataVencimento = addYears(dataContrato, 1);
            break;
          default:
            dataVencimento = addMonths(dataContrato, 1);
        }
        setValue('dataVencimento', format(dataVencimento, 'yyyy-MM-dd'));
      }
    }
  }, [watch('dataContratacao'), watch('situacao'), watch('plano'), setValue]);

  // Detectar mudanças importantes e ativar notificação WhatsApp automaticamente
  useEffect(() => {
    // Só aplicar lógica para edição (quando há clienteOriginal)
    if (!clienteOriginal || isInitialLoad.current) {
      return;
    }

    const situacaoAtual = watch('situacao');
    const planoAtual = watch('plano');
    const dataVencimentoAtual = watch('dataVencimento');

    // Verificar se houve mudanças relevantes
    const mudouSituacao = situacaoAtual !== clienteOriginal.situacao;
    const mudouPlano = planoAtual !== clienteOriginal.plano;
    const mudouVencimento = dataVencimentoAtual !== clienteOriginal.data_vencimento;
    
    // Ativação de assinatura (saiu de Testando)
    const ativouAssinatura = clienteOriginal.situacao === 'Testando' && situacaoAtual === 'Ativo';

    // Habilitar notificação automaticamente se houver mudanças relevantes
    if (mudouSituacao || mudouPlano || mudouVencimento || ativouAssinatura) {
      setEnviarWhatsApp(true);
    }
  }, [watch('situacao'), watch('plano'), watch('dataVencimento'), clienteOriginal]);

  // Marcar que a carga inicial terminou após o cliente ser carregado
  useEffect(() => {
    if (clienteOriginal && isInitialLoad.current) {
      // Usar setTimeout para garantir que os valores foram setados
      const timer = setTimeout(() => {
        isInitialLoad.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [clienteOriginal]);

  if (loadingProfiles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const onSubmit = async (data: ClienteFormData) => {
    // Prevenir múltiplos submits
    if (isSubmitting) {
      console.log('Já está processando um submit, ignorando...');
      return;
    }

    // Validar senha obrigatória para novos clientes
    if (!id && data.email && !data.senha) {
      toast({
        title: 'Senha obrigatória',
        description: 'Para criar uma conta de acesso, informe a senha do cliente.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Sanitizar dados antes de salvar
    const sanitizeString = (str: string) => str.replace(/[<>"']/g, '');
    const sanitizePhone = (str: string) => str.replace(/[^0-9+\-() ]/g, '');
    const sanitizeMac = (str: string) => str.replace(/[^A-Fa-f0-9:-]/g, '');
    
    const clienteData: Omit<Cliente, 'id' | 'dataCadastro' | 'dataUltimaEdicao'> = {
      nome: sanitizeString(data.nome || ''),
      telefone: sanitizePhone(data.telefone || ''),
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
      origemCadastro: data.origemCadastro as any || null,
      dispositivoContratado: data.dispositivoContratado as any || undefined,
    };

    let clientId: string;
    
    if (id) {
      await updateProfile(id, clienteData as any);
      clientId = id;
      
      // Registrar atividade de atualização
      await activityLogService.logActivity(
        'client_updated',
        `Cliente ${clienteData.nome} foi atualizado`,
        'cliente',
        id,
        { nome: clienteData.nome, telefone: clienteData.telefone }
      );
      
      toast({
        title: 'Cliente atualizado',
        description: 'As informações foram salvas com sucesso.',
      });

      // Atualizar atribuições de M3U lists para cliente existente
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Primeiro, desativar todas as atribuições existentes
        const { error: deactivateError } = await supabase
          .from('client_m3u_lists')
          .update({ is_active: false })
          .eq('client_id', id);

        if (deactivateError) throw deactivateError;

        // Depois, inserir ou reativar as atribuições selecionadas
        if (selectedM3ULists.length > 0) {
          const newAssignments = selectedM3ULists.map(listId => ({
            client_id: id,
            m3u_list_id: listId,
            assigned_by: user.id,
            is_active: true,
          }));

          const { error: m3uError } = await supabase
            .from('client_m3u_lists')
            .upsert(newAssignments, {
              onConflict: 'client_id,m3u_list_id',
              ignoreDuplicates: false,
            });

          if (m3uError) throw m3uError;

          console.log('M3U lists atualizadas:', selectedM3ULists.length);
        }
      } catch (error) {
        console.error('Error updating M3U lists:', error);
        toast({
          title: "Erro ao atualizar listas",
          description: "Cliente atualizado, mas houve erro ao atualizar listas M3U",
          variant: "destructive",
        });
      }

      // Enviar mensagem de atualização se checkbox estiver marcado (ANTES de mostrar modal)
      if (enviarWhatsApp && clienteOriginal) {
        try {
          const clienteAtualizado: Cliente = {
            ...clienteData,
            id: id,
            dataCadastro: clienteOriginal.created_at,
            dataUltimaEdicao: new Date().toISOString(),
          };

          const updateHandler = new UpdateNotificationHandler();
          const enviado = await updateHandler.sendUpdateNotification(
            clienteAtualizado,
            {
              ...clienteAtualizado,
              dataCadastro: clienteOriginal.created_at,
              dataUltimaEdicao: clienteOriginal.updated_at,
            } as Cliente,
            addLog
          );
          
          if (enviado) {
            // Registrar atividade de notificação enviada
            await activityLogService.logActivity(
              'notification_sent',
              `Mensagem de atualização enviada para ${clienteData.nome}`,
              'cliente',
              id,
              { tipo: 'atualizacao', telefone: clienteData.telefone }
            );
            
            toast({
              title: 'Mensagem enviada',
              description: `WhatsApp de atualização enviado para ${clienteData.nome}`,
            });
          }
        } catch (error) {
          console.error('Erro ao enviar mensagem de atualização:', error);
          toast({
            title: 'Erro ao enviar WhatsApp',
            description: error instanceof Error ? error.message : 'Erro desconhecido',
            variant: 'destructive',
          });
        }
      }
    } else {
      // Insert new client directly into Supabase
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error('User not authenticated');

        let authUserId: string | null = null;

        // Se tem email e senha, criar usuário de autenticação para o cliente
        if (clienteData.email && data.senha) {
          console.log('Criando usuário de autenticação para o cliente...');
          
          // Usar a edge function para criar o usuário (admin pode criar usuários)
          const { data: createUserResult, error: createUserError } = await supabase.functions.invoke('create-admin-user', {
            body: {
              email: clienteData.email,
              password: data.senha,
              nome: clienteData.nome,
              telefone: clienteData.telefone,
              role: 'client' // Sempre cliente
            }
          });

          if (createUserError) {
            console.error('Erro ao criar usuário:', createUserError);
            // Se o erro for de usuário já existente, continuar sem criar auth user
            toast({
              title: 'Aviso',
              description: 'Este email já está registrado. O cliente será criado sem nova conta de acesso.',
              variant: 'default',
            });
          } else if (createUserResult?.error) {
            // Erro retornado no body da resposta
            console.error('Erro no resultado:', createUserResult.error);
            if (createUserResult.code === 'EMAIL_EXISTS') {
              toast({
                title: 'Aviso',
                description: 'Este email já está registrado no sistema.',
                variant: 'default',
              });
            } else {
              toast({
                title: 'Erro ao criar conta',
                description: createUserResult.details || createUserResult.error,
                variant: 'destructive',
              });
            }
          } else if (createUserResult?.user?.id) {
            authUserId = createUserResult.user.id;
            console.log('Usuário de autenticação criado:', authUserId);
            
            toast({
              title: 'Conta de acesso criada',
              description: `Login: ${clienteData.email}`,
            });
          }
        }

        const { data: newClientData, error: insertError } = await supabase
          .from('clientes')
          .insert({
            nome: clienteData.nome,
            telefone: clienteData.telefone,
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
            origem_cadastro: clienteData.origemCadastro || null,
            dispositivo_contratado: clienteData.dispositivoContratado || null,
            data_cadastro: new Date().toISOString(),
            data_ultima_edicao: new Date().toISOString(),
            user_id: authUserId // Vincular ao usuário de autenticação se criado
          })
          .select()
          .single();

          if (insertError) throw insertError;
          if (!newClientData) throw new Error('Failed to create client');

          clientId = newClientData.id;
          
          console.log('Cliente criado com sucesso:', clientId, authUserId ? '(com conta de acesso)' : '(sem conta de acesso)');

          // Registrar atividade de criação
          await activityLogService.logActivity(
            'client_created',
            `Novo cliente ${clienteData.nome} foi cadastrado${authUserId ? ' com conta de acesso' : ''}`,
            'cliente',
            clientId,
            { nome: clienteData.nome, telefone: clienteData.telefone, plano: clienteData.plano, hasAuthUser: !!authUserId }
          );

          toast({
            title: 'Cliente cadastrado',
            description: authUserId 
              ? `Cliente criado com acesso ao sistema. Login: ${clienteData.email}`
              : 'O novo cliente foi adicionado com sucesso.',
          });

        // Save M3U list assignments for new clients
        if (selectedM3ULists.length > 0) {
          try {
            const newAssignments = selectedM3ULists.map(listId => ({
              client_id: clientId,
              m3u_list_id: listId,
              assigned_by: currentUser?.id,
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

        // Enviar mensagem de boas-vindas via WhatsApp ANTES de mostrar o modal
        if (enviarWhatsApp) {
          // Pegar telefone diretamente do formulário (não do clienteData que pode estar desatualizado)
          const telefoneAtual = watch('telefone') || data.telefone || clienteData.telefone;
          
          console.log('========================================');
          console.log('INICIANDO ENVIO DE MENSAGEM DE BOAS-VINDAS');
          console.log('Cliente:', clienteData.nome);
          console.log('Telefone do form (watch):', watch('telefone'));
          console.log('Telefone do data:', data.telefone);
          console.log('Telefone do clienteData:', clienteData.telefone);
          console.log('Telefone FINAL usado:', telefoneAtual);
          console.log('Situação:', clienteData.situacao);
          console.log('========================================');

          // Validar se há telefone
          if (!telefoneAtual || telefoneAtual.trim() === '') {
            console.error('❌ ERRO: Telefone está vazio! Não é possível enviar WhatsApp.');
            toast({
              title: 'Erro ao enviar WhatsApp',
              description: 'O campo telefone está vazio. Preencha o telefone antes de enviar.',
              variant: 'destructive',
            });
            setIsSubmitting(false);
            return;
          }
          
          try {
            // Usar telefone diretamente do input do formulário
            const clienteCompleto: Cliente = {
              ...clienteData,
              telefone: telefoneAtual, // Garantir que usa o telefone do formulário
              id: clientId,
              dataCadastro: new Date().toISOString(),
              dataUltimaEdicao: new Date().toISOString(),
            };

            console.log('Cliente completo criado:', {
              id: clienteCompleto.id,
              nome: clienteCompleto.nome,
              telefone: clienteCompleto.telefone,
              situacao: clienteCompleto.situacao
            });

            // Enviar boas-vindas diretamente
            console.log('Criando instância do EventNotificationHandler...');
            
            const eventHandler = new EventNotificationHandler();
            console.log('EventHandler criado, chamando sendWelcomeToNewClient...');
            
            const sent = await eventHandler.sendWelcomeToNewClient(clienteCompleto, addLog);
            
            console.log('========================================');
            console.log('RESULTADO DO ENVIO:', sent);
            console.log('========================================');
            
            if (sent) {
              // Registrar atividade de notificação enviada
              await activityLogService.logActivity(
                'notification_sent',
                `Mensagem de boas-vindas enviada para ${clienteData.nome}`,
                'cliente',
                clientId,
                { tipo: 'boas_vindas', telefone: clienteData.telefone }
              );
              
              toast({
                title: 'Mensagem enviada',
                description: `WhatsApp de boas-vindas enviado para ${clienteData.nome}`,
              });
            } else {
              console.warn('========================================');
              console.warn('MENSAGEM NÃO FOI ENVIADA');
              console.warn('Verifique:');
              console.warn('1. Configuração do WhatsApp');
              console.warn('2. Templates disponíveis');
              console.warn('3. Logs acima para detalhes');
              console.warn('========================================');
              
              // Registrar falha na notificação
              await activityLogService.logActivity(
                'notification_failed',
                `Falha ao enviar mensagem de boas-vindas para ${clienteData.nome}`,
                'cliente',
                clientId,
                { tipo: 'boas_vindas', telefone: clienteData.telefone, motivo: 'verificar_configuracao' }
              );
              
              toast({
                title: 'Aviso',
                description: 'Cliente cadastrado, mas mensagem não foi enviada. Verifique a configuração do WhatsApp.',
                variant: 'default',
              });
            }
          } catch (error) {
            console.error('========================================');
            console.error('ERRO CAPTURADO NO CATCH:');
            console.error('Tipo:', error);
            console.error('Mensagem:', error instanceof Error ? error.message : 'Erro desconhecido');
            console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
            console.error('========================================');
            
            // Registrar erro no log de atividades
            await activityLogService.logActivity(
              'notification_error',
              `Erro ao enviar mensagem de boas-vindas para ${clienteData.nome}`,
              'cliente',
              clientId,
              { 
                tipo: 'boas_vindas', 
                telefone: clienteData.telefone, 
                erro: error instanceof Error ? error.message : String(error)
              }
            );
            
            toast({
              title: 'Erro ao enviar WhatsApp',
              description: error instanceof Error ? error.message : 'Erro desconhecido',
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.error('Error creating client:', error);
        toast({
          title: "Erro ao criar cliente",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
    }
    
    navigate('/admin/usuarios');
    } catch (error) {
      console.error('Erro no submit:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao processar',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin/usuarios')}
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
                  <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                  <Input id="email" type="email" {...register('email')} placeholder="cliente@email.com" />
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  {hasExistingAuthUser ? (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <UserPlus className="h-3 w-3" />
                      Cliente já possui conta de acesso ao sistema
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Este email será usado para login do cliente</p>
                  )}
                </div>

                {/* Alerta para cliente sem conta de acesso */}
                {id && !hasExistingAuthUser && (
                  <div className="col-span-full p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <UserPlus className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-medium text-amber-600">Cliente sem conta de acesso</p>
                        <p className="text-sm text-muted-foreground">
                          Este cliente ainda não possui login no sistema. Defina uma senha abaixo para criar a conta de acesso.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Campo de senha - apenas para novos clientes ou se não tem auth user */}
                {(!id || !hasExistingAuthUser) && (
                  <div className="space-y-2">
                    <Label htmlFor="senha">
                      Senha de Acesso {!id && <span className="text-destructive">*</span>}
                    </Label>
                    <div className="relative">
                      <Input 
                        id="senha" 
                        type={showPassword ? 'text' : 'password'}
                        {...register('senha')} 
                        placeholder="Mínimo 6 caracteres"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.senha && <p className="text-sm text-destructive">{errors.senha.message}</p>}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <UserPlus className="h-3 w-3" />
                      {id ? 'Criar conta de acesso para este cliente' : 'Senha para o cliente acessar o app/sistema'}
                    </p>
                  </div>
                )}

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
                  <Label htmlFor="origemCadastro">Como conheceu o sistema</Label>
                  <Select
                    onValueChange={(value) => setValue('origemCadastro', value === "0" ? undefined : value as any)}
                    value={watch('origemCadastro') || "0"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" disabled>Selecione uma opção</SelectItem>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Indicação">Indicação</SelectItem>
                      <SelectItem value="Website">Website</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dispositivoContratado">Dispositivo Contratado</Label>
                  <Select
                    onValueChange={(value) => setValue('dispositivoContratado', value === "0" ? undefined : value as any)}
                    value={watch('dispositivoContratado') || "0"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dispositivo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="0" disabled>Selecione o dispositivo</SelectItem>
                      <SelectItem value="smart_tv">Smart TV</SelectItem>
                      <SelectItem value="roku_tv">Roku TV</SelectItem>
                      <SelectItem value="fire_stick">Fire Stick</SelectItem>
                      <SelectItem value="android_tv">Android TV</SelectItem>
                      <SelectItem value="celular_android">Celular Android</SelectItem>
                      <SelectItem value="celular_ios">Celular iOS (iPhone)</SelectItem>
                      <SelectItem value="computador">Computador</SelectItem>
                      <SelectItem value="mac">Mac</SelectItem>
                      <SelectItem value="tablet_android">Tablet Android</SelectItem>
                      <SelectItem value="tablet_ios">Tablet iOS (iPad)</SelectItem>
                      <SelectItem value="chromecast">Chromecast</SelectItem>
                      <SelectItem value="apple_tv">Apple TV</SelectItem>
                      <SelectItem value="xbox">Xbox</SelectItem>
                      <SelectItem value="playstation">PlayStation</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="dataUltimoPagamento">Data do Último Pagamento</Label>
                  <DatePicker
                    date={watch('dataUltimoPagamento') ? parseISO(watch('dataUltimoPagamento')) : undefined}
                    onDateChange={(date) => setValue('dataUltimoPagamento', date ? format(date, 'yyyy-MM-dd') : '')}
                    placeholder="Selecione a data do último pagamento"
                    disableFuture
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="valorPago">Valor Pago (R$)</Label>
                  <Input
                    id="valorPago"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register('valorPago', { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="formaUltimoPagamento">Forma do Último Pagamento</Label>
                  <Select
                    onValueChange={(value) => setValue('formaUltimoPagamento', value as any)}
                    value={watch('formaUltimoPagamento') || ''}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="TED">TED</SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                      <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                      <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="macSmartOne">MAC Address <span className="text-muted-foreground font-normal text-sm">(Opcional)</span></Label>
                  <Input id="macSmartOne" placeholder="XX:XX:XX:XX:XX:XX" {...register('macSmartOne')} />
                </div>
              </div>

              <div className="space-y-3 p-4 bg-muted/20 rounded-lg border border-border">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Listas M3U <span className="text-muted-foreground font-normal text-sm">(Opcional)</span></Label>
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

              <div className="flex items-center space-x-3 p-4 rounded-lg border transition-all duration-200"
                style={{
                  backgroundColor: enviarWhatsApp ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--muted) / 0.3)',
                  borderColor: enviarWhatsApp ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--border))'
                }}
              >
                <Switch
                  id="enviarWhatsApp"
                  checked={enviarWhatsApp}
                  onCheckedChange={setEnviarWhatsApp}
                />
                <div className="flex-1">
                  <Label 
                    htmlFor="enviarWhatsApp" 
                    className="text-sm font-medium cursor-pointer"
                  >
                    {id 
                      ? 'Enviar mensagem de atualização ao cliente via WhatsApp'
                      : 'Enviar mensagem de boas-vindas ao cliente via WhatsApp'
                    }
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {enviarWhatsApp 
                      ? '✓ Notificação será enviada ao salvar'
                      : 'Nenhuma notificação será enviada'
                    }
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/usuarios')}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? 'Salvando...' : id ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
