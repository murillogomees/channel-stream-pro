/**
 * PwaManifestPreview - Preview e download do manifest.json
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileJson, 
  Download, 
  Copy, 
  Check, 
  Code,
  Eye
} from 'lucide-react';
import type { ManifestJson } from './types';
import { toast } from 'sonner';

interface PwaManifestPreviewProps {
  manifest: ManifestJson | null;
  serviceWorkerCode: string;
}

export function PwaManifestPreview({ manifest, serviceWorkerCode }: PwaManifestPreviewProps) {
  const [copied, setCopied] = useState<'manifest' | 'sw' | null>(null);
  const [activeTab, setActiveTab] = useState('manifest');

  const manifestJson = manifest ? JSON.stringify(manifest, null, 2) : '';

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = (type: 'manifest' | 'sw') => {
    const content = type === 'manifest' ? manifestJson : serviceWorkerCode;
    navigator.clipboard.writeText(content);
    setCopied(type);
    toast.success('Copiado para a área de transferência');
  };

  const handleDownload = (type: 'manifest' | 'sw') => {
    const content = type === 'manifest' ? manifestJson : serviceWorkerCode;
    const filename = type === 'manifest' ? 'manifest.json' : 'sw.js';
    const mimeType = type === 'manifest' ? 'application/json' : 'application/javascript';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`${filename} baixado`);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileJson className="h-4 w-4" />
          Arquivos Gerados
        </CardTitle>
        <CardDescription>
          Preview dos arquivos manifest.json e sw.js gerados automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="manifest" className="gap-2">
                <FileJson className="h-4 w-4" />
                manifest.json
              </TabsTrigger>
              <TabsTrigger value="sw" className="gap-2">
                <Code className="h-4 w-4" />
                sw.js
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(activeTab as 'manifest' | 'sw')}
              >
                {copied === activeTab ? (
                  <Check className="h-4 w-4 mr-1" />
                ) : (
                  <Copy className="h-4 w-4 mr-1" />
                )}
                Copiar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(activeTab as 'manifest' | 'sw')}
              >
                <Download className="h-4 w-4 mr-1" />
                Baixar
              </Button>
            </div>
          </div>

          <TabsContent value="manifest" className="mt-0">
            <ScrollArea className="h-[400px] rounded-lg border bg-muted/30 p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {manifestJson || '// Nenhuma configuração disponível'}
              </pre>
            </ScrollArea>

            {manifest && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline">
                  {manifest.icons.length} ícone(s)
                </Badge>
                <Badge variant="outline">
                  Display: {manifest.display}
                </Badge>
                <Badge variant="outline">
                  {manifest.categories.length} categoria(s)
                </Badge>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sw" className="mt-0">
            <ScrollArea className="h-[400px] rounded-lg border bg-muted/30 p-4">
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {serviceWorkerCode || '// Nenhuma configuração disponível'}
              </pre>
            </ScrollArea>

            <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-start gap-2">
                <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Nota:</p>
                  <p>
                    Este código é uma prévia. O Service Worker real é gerado pelo Vite PWA plugin 
                    durante o build com configurações otimizadas para produção.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
