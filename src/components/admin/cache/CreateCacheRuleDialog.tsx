import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { smartCacheService, CreateCacheRuleParams } from '@/services/smartCacheService';
import { Loader2, Settings, Clock, Zap } from 'lucide-react';
import { FormSection, FormFieldGroup, DialogBody } from '@/components/ui/form-section';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface CreateCacheRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateCacheRuleDialog({ open, onOpenChange, onSuccess }: CreateCacheRuleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateCacheRuleParams>({
    name: '',
    description: '',
    match_pattern: '',
    match_type: 'prefix',
    ttl: 3600,
    stale_while_revalidate: 60,
    stale_if_error: 86400,
    priority: 0,
    enabled: true,
  });

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.match_pattern.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome e padrão são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await smartCacheService.createRule(formData);
      if (error) throw error;

      toast({
        title: 'Regra criada',
        description: 'Nova regra de cache criada com sucesso',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar regra',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            <Settings className="h-5 w-5" />
            Nova Regra de Cache
          </DialogTitle>
          <DialogDescription>
            Configure uma nova regra de cache dinâmica
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Informações Básicas */}
          <div className="space-y-4">
            <FormSection
              icon={<Settings className="h-5 w-5" />}
              title="Informações Básicas"
              description="Nome e configuração de match"
              variant="primary"
            />
            <FormFieldGroup columns={2}>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Nome da Regra <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Manifests HLS"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-12 transition-all focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="match_type" className="text-sm font-medium">
                  Tipo de Match
                </Label>
                <Select
                  value={formData.match_type}
                  onValueChange={(v: any) => setFormData({ ...formData, match_type: v })}
                >
                  <SelectTrigger id="match_type" className="h-12 transition-all focus:ring-2 focus:ring-primary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exato</SelectItem>
                    <SelectItem value="prefix">Prefixo</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FormFieldGroup>

            <div className="space-y-2 pl-2">
              <Label htmlFor="match_pattern" className="text-sm font-medium">
                Padrão de Match <span className="text-destructive">*</span>
              </Label>
              <Input
                id="match_pattern"
                placeholder="/stream/*.m3u8"
                value={formData.match_pattern}
                onChange={(e) => setFormData({ ...formData, match_pattern: e.target.value })}
                className="h-12 transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2 pl-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Descrição
              </Label>
              <Textarea
                id="description"
                placeholder="Descreva o propósito desta regra"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[80px] transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Configurações de Tempo */}
          <div className="space-y-4">
            <FormSection
              icon={<Clock className="h-5 w-5" />}
              title="Configurações de Tempo"
              description="TTL e comportamento de cache"
              variant="info"
            />
            <FormFieldGroup columns={3}>
              <div className="space-y-2">
                <Label htmlFor="ttl" className="text-sm font-medium">
                  TTL (segundos)
                </Label>
                <Input
                  id="ttl"
                  type="number"
                  value={formData.ttl}
                  onChange={(e) => setFormData({ ...formData, ttl: parseInt(e.target.value) })}
                  className="h-12 transition-all focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="swr" className="text-sm font-medium">
                  Stale While Revalidate
                </Label>
                <Input
                  id="swr"
                  type="number"
                  value={formData.stale_while_revalidate ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setFormData({ ...formData, stale_while_revalidate: val ? parseInt(val) : undefined });
                  }}
                  className="h-12 transition-all focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sie" className="text-sm font-medium">
                  Stale If Error
                </Label>
                <Input
                  id="sie"
                  type="number"
                  value={formData.stale_if_error ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setFormData({ ...formData, stale_if_error: val ? parseInt(val) : undefined });
                  }}
                  className="h-12 transition-all focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </FormFieldGroup>
          </div>

          <Separator className="my-6" />

          {/* Configurações Avançadas */}
          <div className="space-y-4">
            <FormSection
              icon={<Zap className="h-5 w-5" />}
              title="Configurações Avançadas"
              description="Prioridade e ativação"
              variant="secondary"
            />
            <FormFieldGroup columns={2}>
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-sm font-medium">
                  Prioridade
                </Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="h-12 transition-all focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Maior prioridade = aplicada primeiro
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Ativar Regra
                </Label>
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card h-12">
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    formData.enabled ? "text-success" : "text-muted-foreground"
                  )}>
                    {formData.enabled ? '✅ Ativa' : '❌ Inativa'}
                  </span>
                </div>
              </div>
            </FormFieldGroup>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-12">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="h-12">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Regra'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
