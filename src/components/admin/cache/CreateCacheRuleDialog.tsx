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
import { Loader2 } from 'lucide-react';

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Regra de Cache</DialogTitle>
          <DialogDescription>
            Configure uma nova regra de cache dinâmica
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome da Regra *</Label>
              <Input
                id="name"
                placeholder="Manifests HLS"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="match_type">Tipo de Match</Label>
              <Select
                value={formData.match_type}
                onValueChange={(v: any) => setFormData({ ...formData, match_type: v })}
              >
                <SelectTrigger id="match_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exato</SelectItem>
                  <SelectItem value="prefix">Prefixo</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="match_pattern">Padrão de Match *</Label>
            <Input
              id="match_pattern"
              placeholder="/stream/*.m3u8"
              value={formData.match_pattern}
              onChange={(e) => setFormData({ ...formData, match_pattern: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descreva o propósito desta regra"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ttl">TTL (segundos)</Label>
              <Input
                id="ttl"
                type="number"
                value={formData.ttl}
                onChange={(e) => setFormData({ ...formData, ttl: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="swr">Stale While Revalidate</Label>
              <Input
                id="swr"
                type="number"
                value={formData.stale_while_revalidate ?? ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setFormData({ ...formData, stale_while_revalidate: val ? parseInt(val) : undefined });
                }}
              />
            </div>

            <div>
              <Label htmlFor="sie">Stale If Error</Label>
              <Input
                id="sie"
                type="number"
                value={formData.stale_if_error ?? ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setFormData({ ...formData, stale_if_error: val ? parseInt(val) : undefined });
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Prioridade</Label>
              <Input
                id="priority"
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maior prioridade = aplicada primeiro
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Ativar regra imediatamente</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
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
