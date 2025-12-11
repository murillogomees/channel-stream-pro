/**
 * AdminUserForm - Enterprise-level User Management Form
 * Refactored: Consolidated phone fields, removed M3U/device fields, added role management
 */

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PhoneInput } from '@/components/ui/phone-input';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, MapPin, CreditCard, Calendar, Shield, Info, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserFormData {
  // Informações Básicas
  id?: string;
  nome: string;
  email: string;
  contact_phone: string;
  
  // Status e Situação
  cliente_ativo: boolean;
  situacao: string;
  origem_cadastro: string;
  
  // Plano e Pagamento
  plano: string;
  valor_pago: number;
  forma_ultimo_pagamento: string;
  is_recorrente: boolean;
  
  // Datas
  data_contratacao: string;
  data_vencimento: string;
  data_ultimo_pagamento: string;
  
  // Segurança e Preferências
  user_role?: 'client' | 'admin' | 'master';
  theme?: string;
  totp_enabled: boolean;
  totp_secret?: string;
  totp_verified_at?: string;
  
  // Timestamps (readonly)
  created_at?: string;
  updated_at?: string;
}

interface AdminUserFormProps {
  formData: Partial<UserFormData>;
  onChange: (data: Partial<UserFormData>) => void;
  isEdit?: boolean;
  currentUserRole?: 'client' | 'admin' | 'master';
  hideEmail?: boolean; // Oculta campo de email (quando já coletado em outro lugar)
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'secondary';
  badge?: string;
}

const SectionHeader = ({ icon, title, description, variant = 'primary', badge }: SectionHeaderProps) => {
  const variants = {
    primary: 'from-primary/10 to-primary/5 border-primary/20',
    success: 'from-success/10 to-success/5 border-success/20',
    warning: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
    info: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    secondary: 'from-muted/50 to-muted/20 border-border',
  };

  const iconColors = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-amber-500',
    info: 'text-blue-500',
    secondary: 'text-muted-foreground',
  };

  return (
    <div className={cn(
      "flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border bg-gradient-to-r",
      variants[variant]
    )}>
      <div className={cn("flex-shrink-0", iconColors[variant])}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm sm:text-base font-semibold tracking-tight">{title}</h3>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">{description}</p>
        )}
      </div>
    </div>
  );
};

export function AdminUserForm({ formData, onChange, isEdit = false, currentUserRole = 'client', hideEmail = false }: AdminUserFormProps) {
  const updateField = (field: keyof UserFormData, value: any) => {
    onChange({ ...formData, [field]: value });
  };

  // Master pode atribuir qualquer role, admin só pode atribuir client
  // Se currentUserRole não for passado, assume client e não mostra o campo
  const canEditRole = currentUserRole === 'master' || currentUserRole === 'admin';
  const canAssignAdmin = currentUserRole === 'master';
  const canAssignMaster = currentUserRole === 'master';

  console.log('[AdminUserForm] currentUserRole:', currentUserRole, 'canEditRole:', canEditRole);

  return (
    <div className="space-y-4 sm:space-y-6 py-2">
      {/* ID do Usuário (apenas em modo edição) */}
      {isEdit && formData.id && (
        <div className="bg-muted/30 border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">
                ID do Usuário
              </Label>
              <p className="text-sm font-mono text-foreground truncate">{formData.id}</p>
            </div>
          </div>
        </div>
      )}

      {/* Seção 1: Informações Básicas */}
      <div className="space-y-4">
        <SectionHeader
          icon={<User className="h-5 w-5" />}
          title="Informações Básicas"
          description="Dados principais de identificação do usuário"
          variant="primary"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome" className="text-sm font-medium flex items-center gap-2">
              Nome Completo
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nome"
              value={formData.nome || ''}
              onChange={(e) => updateField('nome', e.target.value)}
              placeholder="Digite o nome completo"
              className="transition-all focus:ring-2 focus:ring-primary/20 h-11 sm:h-12"
            />
          </div>

          {!hideEmail && (
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                Email
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="email@exemplo.com"
                className="transition-all focus:ring-2 focus:ring-primary/20 h-11 sm:h-12"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="contact_phone" className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-success" />
              Telefone / WhatsApp
            </Label>
            <PhoneInput
              id="contact_phone"
              value={formData.contact_phone || ''}
              onChange={(value) => updateField('contact_phone', value)}
              mask="brazilian"
              placeholder="(11) 99999-9999"
              className="transition-all focus:ring-2 focus:ring-success/20 h-11 sm:h-12"
            />
            <p className="text-xs text-muted-foreground mt-1">
              💡 Número principal para contato e notificações WhatsApp
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="origem_cadastro" className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Como Conheceu?
            </Label>
            <Select value={formData.origem_cadastro || ''} onValueChange={(value) => updateField('origem_cadastro', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-primary/20 h-11 sm:h-12">
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Indicação">Indicação</SelectItem>
                <SelectItem value="Instagram">Instagram</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
                <SelectItem value="Google">Google</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Seção 2: Status e Situação */}
      <div className="space-y-4">
        <SectionHeader
          icon={<CheckCircle2 className="h-5 w-5" />}
          title="Status e Situação"
          description="Status atual do cliente no sistema"
          variant="success"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label htmlFor="cliente_ativo" className="text-sm font-medium">
              Cliente Ativo
            </Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card h-11 sm:h-12">
              <Switch
                id="cliente_ativo"
                checked={formData.cliente_ativo || false}
                onCheckedChange={(checked) => updateField('cliente_ativo', checked)}
              />
              <span className={cn(
                "text-sm font-medium transition-colors",
                formData.cliente_ativo ? "text-success" : "text-muted-foreground"
              )}>
                {formData.cliente_ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="situacao" className="text-sm font-medium">
              Situação
            </Label>
            <Select value={formData.situacao || ''} onValueChange={(value) => updateField('situacao', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-success/20 h-11 sm:h-12">
                <SelectValue placeholder="Selecione a situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Testando">🧪 Testando</SelectItem>
                <SelectItem value="Ativo">✅ Ativo</SelectItem>
                <SelectItem value="Inativo">⏸️ Inativo</SelectItem>
                <SelectItem value="Follow-up">📞 Follow-up</SelectItem>
                <SelectItem value="Lead Qualificado">🎯 Lead Qualificado</SelectItem>
                <SelectItem value="Oportunidade">💎 Oportunidade</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Seção 3: Plano e Pagamento */}
      <div className="space-y-4">
        <SectionHeader
          icon={<CreditCard className="h-5 w-5" />}
          title="Plano e Pagamento"
          description="Informações de assinatura e valores"
          variant="info"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label htmlFor="plano" className="text-sm font-medium">
              Plano de Assinatura
            </Label>
            <Select value={formData.plano || ''} onValueChange={(value) => updateField('plano', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-blue-500/20 h-11 sm:h-12">
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mensal">📅 Mensal - R$ 30,00</SelectItem>
                <SelectItem value="Trimestral">📆 Trimestral - R$ 79,90</SelectItem>
                <SelectItem value="Semestral">🗓️ Semestral - R$ 149,90</SelectItem>
                <SelectItem value="Anual">📋 Anual - R$ 279,90</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor_pago" className="text-sm font-medium">
              Valor Pago (R$)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
                <Input
                  id="valor_pago"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                value={formData.valor_pago || ''}
                onChange={(e) => updateField('valor_pago', parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="pl-10 transition-all focus:ring-2 focus:ring-blue-500/20 h-11 sm:h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="forma_ultimo_pagamento" className="text-sm font-medium">
              Forma de Pagamento
            </Label>
            <Select value={formData.forma_ultimo_pagamento || ''} onValueChange={(value) => updateField('forma_ultimo_pagamento', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-blue-500/20 h-11 sm:h-12">
                <SelectValue placeholder="Forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">💳 PIX</SelectItem>
                <SelectItem value="TED">🏦 TED</SelectItem>
                <SelectItem value="Boleto">📄 Boleto</SelectItem>
                <SelectItem value="Cartão de Crédito">💳 Cartão de Crédito</SelectItem>
                <SelectItem value="Cartão de Débito">💳 Cartão de Débito</SelectItem>
                <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="is_recorrente" className="text-sm font-medium">
              Recorrente
            </Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card h-11 sm:h-12">
              <Switch
                id="is_recorrente"
                checked={formData.is_recorrente || false}
                onCheckedChange={(checked) => updateField('is_recorrente', checked)}
              />
              <span className={cn(
                "text-sm font-medium transition-colors",
                formData.is_recorrente ? "text-success" : "text-muted-foreground"
              )}>
                {formData.is_recorrente ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Seção 4: Datas Importantes */}
      <div className="space-y-4">
        <SectionHeader
          icon={<Calendar className="h-5 w-5" />}
          title="Datas Importantes"
          description="Controle de prazos e vencimentos"
          variant="warning"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data de Contratação</Label>
            <DatePicker
              date={formData.data_contratacao && formData.data_contratacao.trim() ? parseISO(formData.data_contratacao) : undefined}
              onDateChange={(date) => updateField('data_contratacao', date ? format(date, 'yyyy-MM-dd') : '')}
              placeholder="Selecione a data"
              className="transition-all focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Data de Vencimento</Label>
            <DatePicker
              date={formData.data_vencimento && formData.data_vencimento.trim() ? parseISO(formData.data_vencimento) : undefined}
              onDateChange={(date) => updateField('data_vencimento', date ? format(date, 'yyyy-MM-dd') : '')}
              placeholder="Selecione a data"
              className="transition-all focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Último Pagamento</Label>
            <DatePicker
              date={formData.data_ultimo_pagamento && formData.data_ultimo_pagamento.trim() ? parseISO(formData.data_ultimo_pagamento) : undefined}
              onDateChange={(date) => updateField('data_ultimo_pagamento', date ? format(date, 'yyyy-MM-dd') : '')}
              placeholder="Selecione a data"
              className="transition-all focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Seção 5: Segurança e Preferências */}
      <div className="space-y-4">
        <SectionHeader
          icon={<Shield className="h-5 w-5" />}
          title="Segurança e Preferências"
          description="Configurações de acesso e permissões"
          variant="secondary"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {canEditRole && (
            <div className="space-y-2">
              <Label htmlFor="user_role" className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                Função do Usuário
                {canAssignMaster && (
                  <Badge variant="outline" className="text-xs">Master</Badge>
                )}
              </Label>
              {(() => {
                console.log('[AdminUserForm] Rendering role select - formData.user_role:', formData.user_role);
                return null;
              })()}
              <Select 
                value={formData.user_role || 'client'} 
                onValueChange={(value: 'client' | 'admin' | 'master') => {
                  console.log('[AdminUserForm] Role changed to:', value);
                  updateField('user_role', value);
                }}
              >
                <SelectTrigger className="transition-all focus:ring-2 focus:ring-primary/20 h-11 sm:h-12">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">👤 Cliente</SelectItem>
                  {canAssignAdmin && (
                    <SelectItem value="admin">🔧 Administrador</SelectItem>
                  )}
                  {canAssignMaster && (
                    <SelectItem value="master">👑 Master</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                ⚠️ Alteração de função requer auditoria
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="theme" className="text-sm font-medium">
              Tema de Interface
            </Label>
            <Select value={formData.theme || 'system'} onValueChange={(value) => updateField('theme', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-primary/20 h-12">
                <SelectValue placeholder="Selecione o tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">☀️ Claro</SelectItem>
                <SelectItem value="dark">🌙 Escuro</SelectItem>
                <SelectItem value="system">💻 Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="totp_enabled" className="text-sm font-medium">
              Autenticação 2FA
            </Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card h-12">
              <Switch
                id="totp_enabled"
                checked={formData.totp_enabled || false}
                onCheckedChange={(checked) => updateField('totp_enabled', checked)}
              />
              <span className={cn(
                "text-sm font-medium transition-colors",
                formData.totp_enabled ? "text-success" : "text-muted-foreground"
              )}>
                {formData.totp_enabled ? '🔒 Ativado' : '🔓 Desativado'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Seção 6: Informações do Sistema (Somente Leitura) */}
      {isEdit && (formData.created_at || formData.updated_at) && (
        <>
          <Separator className="my-6" />
          <div className="space-y-4">
            <SectionHeader
              icon={<Info className="h-5 w-5" />}
              title="Informações do Sistema"
              description="Dados de auditoria e controle"
              variant="secondary"
              badge="Somente Leitura"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-2">
              {formData.created_at && formData.created_at.trim() && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Data de Criação</Label>
                  <Input
                    value={format(parseISO(formData.created_at), "dd/MM/yyyy 'às' HH:mm")}
                    disabled
                    className="bg-muted/50 border-muted h-12"
                  />
                </div>
              )}

              {formData.updated_at && formData.updated_at.trim() && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Última Atualização</Label>
                  <Input
                    value={format(parseISO(formData.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                    disabled
                    className="bg-muted/50 border-muted h-12"
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
