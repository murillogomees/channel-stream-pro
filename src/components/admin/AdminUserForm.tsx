/**
 * AdminUserForm - Formulário completo para criar/editar usuários
 * Inclui todos os campos da tabela profiles com máscaras e validações apropriadas
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
import { Eye, EyeOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';

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
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Informações Básicas */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 bg-primary rounded-full" />
          <h3 className="text-lg font-semibold">Informações Básicas</h3>
        </div>

        {isEdit && formData.id && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">ID do Usuário</Label>
            <Input value={formData.id} disabled className="bg-muted/50" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              value={formData.nome || ''}
              onChange={(e) => updateField('nome', e.target.value)}
              placeholder="Digite o nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <PhoneInput
              id="telefone"
              value={formData.telefone || ''}
              onChange={(value) => updateField('telefone', value)}
              mask="brazilian"
              placeholder="(11) 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone_whatsapp">WhatsApp</Label>
            <PhoneInput
              id="telefone_whatsapp"
              value={formData.telefone_whatsapp || ''}
              onChange={(value) => updateField('telefone_whatsapp', value)}
              mask="brazilian"
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Status e Situação */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 bg-blue-500 rounded-full" />
          <h3 className="text-lg font-semibold">Status e Situação</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cliente_ativo">Cliente Ativo</Label>
            <div className="flex items-center gap-2">
              <Switch
                id="cliente_ativo"
                checked={formData.cliente_ativo || false}
                onCheckedChange={(checked) => updateField('cliente_ativo', checked)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.cliente_ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="situacao">Situação</Label>
            <Select value={formData.situacao || ''} onValueChange={(value) => updateField('situacao', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Testando">Testando</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
                <SelectItem value="Follow-up">Follow-up</SelectItem>
                <SelectItem value="Lead Qualificado">Lead Qualificado</SelectItem>
                <SelectItem value="Oportunidade">Oportunidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="origem_cadastro">Como Conheceu?</Label>
            <Select value={formData.origem_cadastro || ''} onValueChange={(value) => updateField('origem_cadastro', value)}>
              <SelectTrigger>
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

      <Separator />

      {/* Plano e Pagamento */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 bg-green-500 rounded-full" />
          <h3 className="text-lg font-semibold">Plano e Pagamento</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="plano">Plano</Label>
            <Select value={formData.plano || ''} onValueChange={(value) => updateField('plano', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mensal">Mensal - R$ 30,00</SelectItem>
                <SelectItem value="Trimestral">Trimestral - R$ 79,90</SelectItem>
                <SelectItem value="Semestral">Semestral - R$ 149,90</SelectItem>
                <SelectItem value="Anual">Anual - R$ 279,90</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor_pago">Valor Pago (R$)</Label>
            <Input
              id="valor_pago"
              type="number"
              step="0.01"
              min="0"
              value={formData.valor_pago || ''}
              onChange={(e) => updateField('valor_pago', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="forma_ultimo_pagamento">Forma de Pagamento</Label>
            <Select value={formData.forma_ultimo_pagamento || ''} onValueChange={(value) => updateField('forma_ultimo_pagamento', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="TED">TED</SelectItem>
                <SelectItem value="Boleto">Boleto</SelectItem>
                <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="is_recorrente">Pagamento Recorrente</Label>
            <div className="flex items-center gap-2">
              <Switch
                id="is_recorrente"
                checked={formData.is_recorrente || false}
                onCheckedChange={(checked) => updateField('is_recorrente', checked)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.is_recorrente ? 'Sim' : 'Não'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Datas */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 bg-purple-500 rounded-full" />
          <h3 className="text-lg font-semibold">Datas Importantes</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Data de Contratação</Label>
            <DatePicker
              date={formData.data_contratacao ? parseISO(formData.data_contratacao) : undefined}
              onDateChange={(date) => updateField('data_contratacao', date ? format(date, 'yyyy-MM-dd') : '')}
              placeholder="Selecione a data"
            />
          </div>

          <div className="space-y-2">
            <Label>Data de Vencimento</Label>
            <DatePicker
              date={formData.data_vencimento ? parseISO(formData.data_vencimento) : undefined}
              onDateChange={(date) => updateField('data_vencimento', date ? format(date, 'yyyy-MM-dd') : '')}
              placeholder="Selecione a data"
            />
          </div>

          <div className="space-y-2">
            <Label>Último Pagamento</Label>
            <DatePicker
              date={formData.data_ultimo_pagamento ? parseISO(formData.data_ultimo_pagamento) : undefined}
              onDateChange={(date) => updateField('data_ultimo_pagamento', date ? format(date, 'yyyy-MM-dd') : '')}
              placeholder="Selecione a data"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Dispositivo e Acesso M3U */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 bg-orange-500 rounded-full" />
          <h3 className="text-lg font-semibold">Dispositivo e Acesso M3U</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dispositivo_contratado">Dispositivo Contratado</Label>
            <Select value={formData.dispositivo_contratado || ''} onValueChange={(value) => updateField('dispositivo_contratado', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o dispositivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SmartTV">Smart TV</SelectItem>
                <SelectItem value="TVBox">TV Box</SelectItem>
                <SelectItem value="Celular">Celular</SelectItem>
                <SelectItem value="Tablet">Tablet</SelectItem>
                <SelectItem value="Computador">Computador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mac_smart_one">Endereço MAC</Label>
            <Input
              id="mac_smart_one"
              value={formData.mac_smart_one || ''}
              onChange={(e) => updateField('mac_smart_one', formatMacAddress(e.target.value))}
              placeholder="XX:XX:XX:XX:XX:XX"
              maxLength={17}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="usuario_m3u">Usuário M3U</Label>
            <Input
              id="usuario_m3u"
              value={formData.usuario_m3u || ''}
              onChange={(e) => updateField('usuario_m3u', e.target.value)}
              placeholder="usuario_m3u"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha_m3u">Senha M3U</Label>
            <div className="relative">
              <Input
                id="senha_m3u"
                type={showM3UPassword ? 'text' : 'password'}
                value={formData.senha_m3u || ''}
                onChange={(e) => updateField('senha_m3u', e.target.value)}
                placeholder="senha_m3u"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowM3UPassword(!showM3UPassword)}
              >
                {showM3UPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Integração SmartOne (Readonly) */}
      {isEdit && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-1 bg-cyan-500 rounded-full" />
            <h3 className="text-lg font-semibold">Integração SmartOne</h3>
            <Badge variant="outline" className="ml-auto">Somente Leitura</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Playlist ID</Label>
              <Input
                value={formData.smartone_playlist_id || 'Não sincronizado'}
                disabled
                className="bg-muted/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Status de Sincronização</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={formData.smartone_status || 'nao_enviado'}
                  disabled
                  className="bg-muted/50 flex-1"
                />
                {formData.smartone_status === 'criado' && (
                  <Badge variant="default" className="bg-green-500">Sincronizado</Badge>
                )}
                {formData.smartone_status === 'erro' && (
                  <Badge variant="destructive">Erro</Badge>
                )}
              </div>
            </div>

            {formData.smartone_last_sync_at && (
              <div className="space-y-2 md:col-span-2">
                <Label className="text-muted-foreground">Última Sincronização</Label>
                <Input
                  value={format(parseISO(formData.smartone_last_sync_at), "dd/MM/yyyy 'às' HH:mm")}
                  disabled
                  className="bg-muted/50"
                />
              </div>
            )}

            {formData.smartone_raw_response && (
              <div className="space-y-2 md:col-span-2">
                <Label className="text-muted-foreground">Resposta da API</Label>
                <Textarea
                  value={formData.smartone_raw_response}
                  disabled
                  className="bg-muted/50 font-mono text-xs h-24"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {isEdit && <Separator />}

      {/* Segurança e Preferências */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1 bg-red-500 rounded-full" />
          <h3 className="text-lg font-semibold">Segurança e Preferências</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Tema do Sistema</Label>
            <Select value={formData.theme || 'system'} onValueChange={(value) => updateField('theme', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="totp_enabled">Autenticação de Dois Fatores (2FA)</Label>
            <div className="flex items-center gap-2">
              <Switch
                id="totp_enabled"
                checked={formData.totp_enabled || false}
                onCheckedChange={(checked) => updateField('totp_enabled', checked)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.totp_enabled ? 'Ativado' : 'Desativado'}
              </span>
              {formData.totp_verified_at && (
                <Badge variant="outline" className="ml-2">
                  Verificado em {format(parseISO(formData.totp_verified_at), 'dd/MM/yyyy')}
                </Badge>
              )}
            </div>
          </div>

          {isEdit && formData.totp_secret && (
            <div className="space-y-2 md:col-span-2">
              <Label className="text-muted-foreground">Secret 2FA (Apenas Admin)</Label>
              <Input
                value={formData.totp_secret}
                disabled
                className="bg-muted/50 font-mono text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Timestamps (readonly) */}
      {isEdit && (formData.created_at || formData.updated_at) && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-muted rounded-full" />
              <h3 className="text-lg font-semibold text-muted-foreground">Informações do Sistema</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.created_at && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Criado em</Label>
                  <Input
                    value={format(parseISO(formData.created_at), "dd/MM/yyyy 'às' HH:mm")}
                    disabled
                    className="bg-muted/50"
                  />
                </div>
              )}

              {formData.updated_at && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Última Atualização</Label>
                  <Input
                    value={format(parseISO(formData.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                    disabled
                    className="bg-muted/50"
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
