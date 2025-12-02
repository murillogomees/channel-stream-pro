/**
 * AdminUserForm - Enterprise-level User Management Form
 * Completely redesigned with modern UI/UX patterns and visual hierarchy
 */

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PhoneInput } from '@/components/ui/phone-input';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, User, Mail, Phone, MapPin, CreditCard, Calendar, Tv, Shield, Info, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UserFormData {
  // Informações Básicas
  id?: string;
  nome: string;
  email: string;
  telefone: string;
  telefone_whatsapp: string;
  
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
  
  // Dispositivo e M3U
  dispositivo_contratado: string;
  mac_smart_one: string;
  usuario_m3u: string;
  senha_m3u: string;
  
  // SmartOne (readonly)
  smartone_playlist_id?: string;
  smartone_status?: string;
  smartone_last_sync_at?: string;
  smartone_raw_response?: string;
  
  // Segurança
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
      "flex items-center gap-4 p-4 rounded-lg border bg-gradient-to-r",
      variants[variant]
    )}>
      <div className={cn("flex-shrink-0", iconColors[variant])}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
};

export function AdminUserForm({ formData, onChange, isEdit = false }: AdminUserFormProps) {
  const [showM3UPassword, setShowM3UPassword] = useState(false);

  const updateField = (field: keyof UserFormData, value: any) => {
    onChange({ ...formData, [field]: value });
  };

  const formatMacAddress = (value: string) => {
    // Remove tudo que não é hexadecimal
    const cleaned = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    // Adiciona os dois pontos a cada 2 caracteres
    const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
    return formatted.substring(0, 17); // Máximo XX:XX:XX:XX:XX:XX
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-2">
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
              className="transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>

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
              className="transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone" className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Telefone
            </Label>
            <PhoneInput
              id="telefone"
              value={formData.telefone || ''}
              onChange={(value) => updateField('telefone', value)}
              mask="brazilian"
              placeholder="(11) 99999-9999"
              className="transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone_whatsapp" className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-success" />
              WhatsApp
            </Label>
            <PhoneInput
              id="telefone_whatsapp"
              value={formData.telefone_whatsapp || ''}
              onChange={(value) => updateField('telefone_whatsapp', value)}
              mask="brazilian"
              placeholder="(11) 99999-9999"
              className="transition-all focus:ring-2 focus:ring-success/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="origem_cadastro" className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Como Conheceu?
            </Label>
            <Select value={formData.origem_cadastro || ''} onValueChange={(value) => updateField('origem_cadastro', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-primary/20">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-2">
          <div className="space-y-2">
            <Label htmlFor="cliente_ativo" className="text-sm font-medium">
              Cliente Ativo
            </Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
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
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-success/20">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-2">
          <div className="space-y-2">
            <Label htmlFor="plano" className="text-sm font-medium">
              Plano de Assinatura
            </Label>
            <Select value={formData.plano || ''} onValueChange={(value) => updateField('plano', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-blue-500/20">
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
                value={formData.valor_pago || ''}
                onChange={(e) => updateField('valor_pago', parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="pl-10 transition-all focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="forma_ultimo_pagamento" className="text-sm font-medium">
              Forma de Pagamento
            </Label>
            <Select value={formData.forma_ultimo_pagamento || ''} onValueChange={(value) => updateField('forma_ultimo_pagamento', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-blue-500/20">
                <SelectValue placeholder="Selecione a forma de pagamento" />
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
              Pagamento Recorrente
            </Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Switch
                id="is_recorrente"
                checked={formData.is_recorrente || false}
                onCheckedChange={(checked) => updateField('is_recorrente', checked)}
              />
              <span className={cn(
                "text-sm font-medium transition-colors",
                formData.is_recorrente ? "text-success" : "text-muted-foreground"
              )}>
                {formData.is_recorrente ? '✅ Sim' : '❌ Não'}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pl-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data de Contratação</Label>
            <DatePicker
              date={formData.data_contratacao ? parseISO(formData.data_contratacao) : undefined}
              onDateChange={(date) => updateField('data_contratacao', date ? format(date, 'yyyy-MM-dd') : '')}
              placeholder="Selecione a data"
              className="transition-all focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Data de Vencimento</Label>
            <DatePicker
              date={formData.data_vencimento ? parseISO(formData.data_vencimento) : undefined}
              onDateChange={(date) => updateField('data_vencimento', date ? format(date, 'yyyy-MM-dd') : '')}
              placeholder="Selecione a data"
              className="transition-all focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Último Pagamento</Label>
            <DatePicker
              date={formData.data_ultimo_pagamento ? parseISO(formData.data_ultimo_pagamento) : undefined}
              onDateChange={(date) => updateField('data_ultimo_pagamento', date ? format(date, 'yyyy-MM-dd') : '')}
              placeholder="Selecione a data"
              className="transition-all focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Seção 5: Dispositivo e Acesso M3U */}
      <div className="space-y-4">
        <SectionHeader
          icon={<Tv className="h-5 w-5" />}
          title="Dispositivo e Acesso M3U"
          description="Configurações de streaming e dispositivos"
          variant="info"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-2">
          <div className="space-y-2">
            <Label htmlFor="dispositivo_contratado" className="text-sm font-medium">
              Dispositivo Contratado
            </Label>
            <Select value={formData.dispositivo_contratado || ''} onValueChange={(value) => updateField('dispositivo_contratado', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-blue-500/20">
                <SelectValue placeholder="Selecione o dispositivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SmartTV">📺 Smart TV</SelectItem>
                <SelectItem value="TVBox">📦 TV Box</SelectItem>
                <SelectItem value="Celular">📱 Celular</SelectItem>
                <SelectItem value="Tablet">📋 Tablet</SelectItem>
                <SelectItem value="Computador">💻 Computador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mac_smart_one" className="text-sm font-medium">
              Endereço MAC
            </Label>
            <Input
              id="mac_smart_one"
              value={formData.mac_smart_one || ''}
              onChange={(e) => updateField('mac_smart_one', formatMacAddress(e.target.value))}
              placeholder="XX:XX:XX:XX:XX:XX"
              maxLength={17}
              className="font-mono transition-all focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="usuario_m3u" className="text-sm font-medium">
              Usuário M3U
            </Label>
            <Input
              id="usuario_m3u"
              value={formData.usuario_m3u || ''}
              onChange={(e) => updateField('usuario_m3u', e.target.value)}
              placeholder="usuario_m3u"
              className="font-mono transition-all focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha_m3u" className="text-sm font-medium">
              Senha M3U
            </Label>
            <div className="relative">
              <Input
                id="senha_m3u"
                type={showM3UPassword ? 'text' : 'password'}
                value={formData.senha_m3u || ''}
                onChange={(e) => updateField('senha_m3u', e.target.value)}
                placeholder="senha_m3u"
                className="pr-10 font-mono transition-all focus:ring-2 focus:ring-blue-500/20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full hover:bg-transparent"
                onClick={() => setShowM3UPassword(!showM3UPassword)}
              >
                {showM3UPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Seção 6: Integração SmartOne (Somente Leitura em modo de edição) */}
      {isEdit && formData.smartone_playlist_id && (
        <>
          <Separator className="my-6" />
          <div className="space-y-4">
            <SectionHeader
              icon={<Tv className="h-5 w-5" />}
              title="Integração SmartOne"
              description="Dados de sincronização com SmartOne IPTV"
              variant="secondary"
              badge="Somente Leitura"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-2">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Playlist ID</Label>
                <Input
                  value={formData.smartone_playlist_id || 'Não sincronizado'}
                  disabled
                  className="bg-muted/50 border-muted"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Status de Sincronização</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={formData.smartone_status || 'nao_enviado'}
                    disabled
                    className="flex-1 bg-muted/50 border-muted"
                  />
                  {formData.smartone_status === 'criado' && (
                    <Badge className="bg-success/20 text-success border-success/30">
                      Sincronizado
                    </Badge>
                  )}
                  {formData.smartone_status === 'erro' && (
                    <Badge variant="destructive">Erro</Badge>
                  )}
                </div>
              </div>

              {formData.smartone_last_sync_at && (
                <div className="space-y-2 lg:col-span-2">
                  <Label className="text-sm text-muted-foreground">Última Sincronização</Label>
                  <Input
                    value={format(parseISO(formData.smartone_last_sync_at), "dd/MM/yyyy 'às' HH:mm")}
                    disabled
                    className="bg-muted/50 border-muted"
                  />
                </div>
              )}

              {formData.smartone_raw_response && (
                <div className="space-y-2 lg:col-span-2">
                  <Label className="text-sm text-muted-foreground">Resposta da API</Label>
                  <Textarea
                    value={formData.smartone_raw_response}
                    disabled
                    className="bg-muted/50 border-muted font-mono text-xs h-24 resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Separator className="my-6" />

      {/* Seção 7: Segurança e Preferências */}
      <div className="space-y-4">
        <SectionHeader
          icon={<Shield className="h-5 w-5" />}
          title="Segurança e Preferências"
          description="Configurações de segurança e personalização"
          variant="warning"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-2">
          <div className="space-y-2">
            <Label htmlFor="theme" className="text-sm font-medium">
              Tema do Sistema
            </Label>
            <Select value={formData.theme || 'system'} onValueChange={(value) => updateField('theme', value)}>
              <SelectTrigger className="transition-all focus:ring-2 focus:ring-amber-500/20">
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
              Autenticação de Dois Fatores (2FA)
            </Label>
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
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
              {formData.totp_verified_at && (
                <Badge variant="outline" className="ml-auto text-xs">
                  Verificado em {format(parseISO(formData.totp_verified_at), 'dd/MM/yyyy')}
                </Badge>
              )}
            </div>
          </div>

          {isEdit && formData.totp_secret && (
            <div className="space-y-2 lg:col-span-2">
              <Label className="text-sm text-muted-foreground">Secret 2FA (Apenas Admin)</Label>
              <Input
                value={formData.totp_secret}
                disabled
                className="bg-muted/50 border-muted font-mono text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Seção 8: Informações do Sistema (Somente em modo de edição) */}
      {isEdit && (formData.created_at || formData.updated_at) && (
        <>
          <Separator className="my-6" />
          <div className="space-y-4">
            <SectionHeader
              icon={<Clock className="h-5 w-5" />}
              title="Informações do Sistema"
              description="Timestamps e metadados do sistema"
              variant="secondary"
              badge="Somente Leitura"
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-2">
              {formData.created_at && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Criado em</Label>
                  <Input
                    value={format(parseISO(formData.created_at), "dd/MM/yyyy 'às' HH:mm")}
                    disabled
                    className="bg-muted/50 border-muted"
                  />
                </div>
              )}

              {formData.updated_at && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Última Atualização</Label>
                  <Input
                    value={format(parseISO(formData.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                    disabled
                    className="bg-muted/50 border-muted"
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
