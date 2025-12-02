import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { smartCacheService } from '@/services/smartCacheService';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface CacheBatchInvalidationProps {
  onInvalidate: () => void;
}

export function CacheBatchInvalidation({ onInvalidate }: CacheBatchInvalidationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState('');
  const [type, setType] = useState<'pattern' | 'key' | 'tag' | 'all'>('key');

  const handleBatchInvalidate = async () => {
    const patternList = patterns
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    if (patternList.length === 0) {
      toast({
        title: 'Erro',
        description: 'Por favor, informe ao menos um padrão',
        variant: 'destructive',
      });
      return;
    }

    if (patternList.length > 100) {
      toast({
        title: 'Erro',
        description: 'Máximo de 100 padrões por vez',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      // Process invalidations in parallel (max 5 at a time)
      const batchSize = 5;
      for (let i = 0; i < patternList.length; i += batchSize) {
        const batch = patternList.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (pattern) => {
            try {
              const { error } = await smartCacheService.invalidateCache({
                pattern,
                type,
                scope: 'batch',
              });
              
              if (error) throw error;
              successCount++;
            } catch (error) {
              console.error(`Failed to invalidate ${pattern}:`, error);
              errorCount++;
            }
          })
        );
      }

      toast({
        title: 'Invalidação em lote concluída',
        description: `✅ ${successCount} sucesso | ❌ ${errorCount} falhas`,
      });

      if (successCount > 0) {
        setPatterns('');
        onInvalidate();
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao processar lote',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const patternCount = patterns.split('\n').filter(p => p.trim().length > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invalidação em Lote</CardTitle>
        <CardDescription>
          Invalide múltiplos padrões de uma vez (máximo 100 por operação)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="batch-type">Tipo de Invalidação</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger id="batch-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="key">Chave Exata</SelectItem>
              <SelectItem value="pattern">Padrão de URL</SelectItem>
              <SelectItem value="tag">Tag de Cache</SelectItem>
              <SelectItem value="all">⚠️ Limpar Tudo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="batch-patterns">
            Padrões (um por linha)
            {patternCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                {patternCount} padrão{patternCount !== 1 ? 's' : ''}
              </span>
            )}
          </Label>
          <Textarea
            id="batch-patterns"
            placeholder={
              type === 'key'
                ? 'https://example.com/api/data/1\nhttps://example.com/api/data/2\n...'
                : type === 'pattern'
                ? 'https://example.com/api/*\nhttps://example.com/images/*\n...'
                : type === 'tag'
                ? 'api-v1\napi-v2\n...'
                : 'all'
            }
            value={patterns}
            onChange={(e) => setPatterns(e.target.value)}
            rows={8}
            className="font-mono text-sm"
            disabled={type === 'all'}
          />
          {type === 'all' && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Modo "Limpar Tudo" não requer padrões
            </p>
          )}
        </div>

        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-4 border border-amber-200 dark:border-amber-800">
          <h4 className="text-sm font-medium mb-2 text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            ⚠️ Atenção - Operação Crítica
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Invalidação em lote remove permanentemente o cache de múltiplas URLs. 
            Pode causar picos de carga nos servidores de origem. Use com cautela em produção.
          </p>
        </div>

        <Button
          onClick={handleBatchInvalidate}
          disabled={loading || (type !== 'all' && patternCount === 0) || patternCount > 100}
          className="w-full"
          variant={type === 'all' ? 'destructive' : 'default'}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Invalidando {patternCount} padrões...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              {type === 'all' 
                ? '⚠️ Limpar TODO o Cache' 
                : `Invalidar ${patternCount} Padrão${patternCount !== 1 ? 's' : ''}`
              }
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
