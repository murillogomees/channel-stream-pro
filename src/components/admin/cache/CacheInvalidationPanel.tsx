import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { smartCacheService } from '@/services/smartCacheService';
import { Trash2, Loader2 } from 'lucide-react';

interface CacheInvalidationPanelProps {
  onInvalidate: () => void;
}

export function CacheInvalidationPanel({ onInvalidate }: CacheInvalidationPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pattern, setPattern] = useState('');
  const [type, setType] = useState<'pattern' | 'key' | 'tag' | 'all'>('key');
  const [scope, setScope] = useState('');

  const handleInvalidate = async () => {
    if (!pattern.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, informe um padrão para invalidação',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await smartCacheService.invalidateCache({
        pattern: pattern.trim(),
        type,
        scope: scope.trim() || undefined,
      });

      if (error) throw error;

      toast({
        title: 'Cache invalidado',
        description: `${data?.keys_invalidated || 0} chaves invalidadas com sucesso`,
      });

      // Reset form
      setPattern('');
      setScope('');
      onInvalidate();
    } catch (error: any) {
      toast({
        title: 'Erro ao invalidar cache',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="invalidation-type">Tipo de Invalidação</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger id="invalidation-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="key">Chave Exata</SelectItem>
              <SelectItem value="pattern">Padrão de URL</SelectItem>
              <SelectItem value="tag">Tag de Cache</SelectItem>
              <SelectItem value="all">Limpar Tudo</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {type === 'key' && 'Invalida apenas a chave de cache exata especificada'}
            {type === 'pattern' && 'Invalida todas as URLs que correspondem ao padrão'}
            {type === 'tag' && 'Invalida todas as URLs marcadas com a tag especificada'}
            {type === 'all' && '⚠️ Invalida TODO o cache - use com extrema cautela'}
          </p>
        </div>

        <div>
          <Label htmlFor="invalidation-pattern">Padrão</Label>
          <Input
            id="invalidation-pattern"
            placeholder={
              type === 'key' 
                ? 'https://example.com/api/data'
                : type === 'pattern'
                ? 'https://example.com/api/*'
                : type === 'tag'
                ? 'api-v1'
                : 'all'
            }
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            disabled={type === 'all'}
          />
        </div>

        <div>
          <Label htmlFor="invalidation-scope">Escopo (Opcional)</Label>
          <Input
            id="invalidation-scope"
            placeholder="global, user-specific, etc."
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          />
        </div>
      </div>

      <Button
        onClick={handleInvalidate}
        disabled={loading || !pattern.trim()}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Invalidando...
          </>
        ) : (
          <>
            <Trash2 className="w-4 h-4 mr-2" />
            Invalidar Cache
          </>
        )}
      </Button>

      <div className="rounded-lg bg-muted p-4">
        <h4 className="text-sm font-medium mb-2">⚠️ Atenção</h4>
        <p className="text-sm text-muted-foreground">
          A invalidação de cache remove conteúdo cacheado permanentemente. 
          Use com cuidado em ambientes de produção, pois pode causar aumento 
          temporário de carga nos servidores de origem.
        </p>
      </div>
    </div>
  );
}
