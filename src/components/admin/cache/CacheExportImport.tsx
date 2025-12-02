import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { smartCacheService } from '@/services/smartCacheService';
import { Download, Upload, FileJson } from 'lucide-react';

export function CacheExportImport() {
  const { toast } = useToast();
  const [importData, setImportData] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const { data: rules, error } = await smartCacheService.listRules();
      
      if (error) throw error;

      const exportData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        rules: rules || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cache-rules-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Exportação concluída',
        description: `${rules?.length || 0} regras exportadas com sucesso`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao exportar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importData.trim()) {
      toast({
        title: 'Erro',
        description: 'Cole o JSON de exportação para importar',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const data = JSON.parse(importData);

      if (!data.rules || !Array.isArray(data.rules)) {
        throw new Error('Formato de arquivo inválido');
      }

      let imported = 0;
      let errors = 0;

      for (const rule of data.rules) {
        try {
          await smartCacheService.createRule({
            name: `${rule.name} (Importado)`,
            match_pattern: rule.match_pattern,
            match_type: rule.match_type || 'exact',
            ttl: rule.ttl,
            priority: rule.priority,
            enabled: false, // Import as disabled for safety
            description: rule.description,
          });
          imported++;
        } catch (error) {
          console.error('Failed to import rule:', error);
          errors++;
        }
      }

      toast({
        title: 'Importação concluída',
        description: `✅ ${imported} regras importadas | ❌ ${errors} erros`,
      });

      setImportData('');
    } catch (error: any) {
      toast({
        title: 'Erro ao importar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Exportar Regras
          </CardTitle>
          <CardDescription>
            Baixe todas as regras de cache em formato JSON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <FileJson className="w-8 h-8 mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              As regras serão exportadas com todas as configurações (TTL, padrões, prioridade, etc.)
            </p>
          </div>
          <Button onClick={handleExport} disabled={loading} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Exportar Todas as Regras
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Regras
          </CardTitle>
          <CardDescription>
            Cole o JSON exportado para restaurar regras
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder='{"version": "1.0", "rules": [...]}'
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
          <Button onClick={handleImport} disabled={loading} className="w-full">
            <Upload className="w-4 h-4 mr-2" />
            Importar Regras
          </Button>
          <p className="text-xs text-muted-foreground">
            ⚠️ Regras importadas são desativadas por padrão por segurança
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
