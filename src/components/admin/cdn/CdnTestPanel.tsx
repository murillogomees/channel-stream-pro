/**
 * CDN Test Panel
 * 
 * Interactive panel for testing CDN Worker integration
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Terminal,
  Zap
} from 'lucide-react';
import { testCdnIntegration, CdnTestResult } from '@/utils/cdnTesting';
import { toast } from 'sonner';

export function CdnTestPanel() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<CdnTestResult[]>([]);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runTests = async () => {
    setTesting(true);
    setResults([]);
    
    try {
      toast.info('Executando testes de integração CDN...');
      const testResults = await testCdnIntegration();
      setResults(testResults);
      setLastRun(new Date());
      
      const allPassed = testResults.every(r => r.success);
      if (allPassed) {
        toast.success('Todos os testes passaram! ✓');
      } else {
        const failedCount = testResults.filter(r => !r.success).length;
        toast.error(`${failedCount} teste(s) falharam`);
      }
    } catch (error) {
      console.error('[CDN Test] Test suite failed:', error);
      toast.error('Falha ao executar testes');
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success 
      ? <CheckCircle className="h-4 w-4 text-green-500" />
      : <XCircle className="h-4 w-4 text-red-500" />;
  };

  const getStatusBadge = (success: boolean) => {
    return success
      ? <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Passou</Badge>
      : <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Falhou</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Testes de Integração CDN
            </CardTitle>
            <CardDescription>
              Valide a configuração e conectividade do CDN Worker
            </CardDescription>
          </div>
          <Button onClick={runTests} disabled={testing}>
            {testing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Executar Testes
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Last Run Info */}
        {lastRun && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-sm text-muted-foreground">
              Última execução
            </span>
            <span className="text-sm font-medium">
              {lastRun.toLocaleTimeString('pt-BR')}
            </span>
          </div>
        )}

        {/* Test Results */}
        {results.length > 0 && (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {results.map((result, index) => (
                <Card key={index} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.success)}
                        <h4 className="font-semibold">{result.stage}</h4>
                      </div>
                      {getStatusBadge(result.success)}
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">
                      {result.details}
                    </p>

                    {result.error && (
                      <div className="mt-2 p-2 rounded bg-red-500/10 text-red-500 text-xs font-mono">
                        {result.error}
                      </div>
                    )}

                    {result.data && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Ver dados
                        </summary>
                        <pre className="mt-2 p-2 rounded bg-muted text-xs overflow-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Console Hint */}
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">
                Teste via Console
              </p>
              <p className="text-muted-foreground">
                Abra o console do navegador e execute: <code className="px-1 py-0.5 rounded bg-muted">window.testCdn()</code>
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        {results.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Resultado Geral</span>
              <div className="flex items-center gap-2">
                {results.every(r => r.success) ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-semibold text-green-500">
                      {results.length}/{results.length} Passou
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                      {results.filter(r => r.success).length}/{results.length} Passou
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CdnTestPanel;
