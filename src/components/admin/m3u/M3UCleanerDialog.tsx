import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Sparkles, Link, FileText, Upload, Settings, ChevronDown,
  Loader2, Download, Cloud, CheckCircle, AlertTriangle, XCircle, Info
} from 'lucide-react';
import { useCleanM3U, CleanM3UOptions, CleanM3UResult } from '@/hooks/useCleanM3U';

interface M3UCleanerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUrl?: string;
  initialContent?: string;
  onCleanComplete?: (result: CleanM3UResult) => void;
  mode?: 'dialog' | 'embedded';
}

export function M3UCleanerDialog({
  open,
  onOpenChange,
  initialUrl = '',
  initialContent = '',
  onCleanComplete,
  mode = 'dialog',
}: M3UCleanerDialogProps) {
  const {
    isCleaning,
    progress,
    lastResult,
    error,
    cleanFromUrl,
    cleanFromContent,
    cleanFromFile,
    downloadCleanedM3U,
    reset,
  } = useCleanM3U();

  const [inputTab, setInputTab] = useState<'url' | 'content' | 'file'>('url');
  const [url, setUrl] = useState(initialUrl);
  const [content, setContent] = useState(initialContent);
  const [showOptions, setShowOptions] = useState(false);

  const [options, setOptions] = useState<CleanM3UOptions>({
    skipProbe: true, // Skip probe by default for performance
    maxChannels: 5000,
    probeTimeoutMs: 4000,
    concurrency: 10,
    save: false,
    retentionDays: 30,
  });

  const handleClean = async () => {
    let result: CleanM3UResult | null = null;

    if (inputTab === 'url' && url.trim()) {
      result = await cleanFromUrl(url.trim(), options);
    } else if (inputTab === 'content' && content.trim()) {
      result = await cleanFromContent(content.trim(), options);
    }

    if (result && onCleanComplete) {
      onCleanComplete(result);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await cleanFromFile(file, options);
    if (result && onCleanComplete) {
      onCleanComplete(result);
    }
  };

  const handleUsePlaylist = () => {
    if (lastResult && onCleanComplete) {
      onCleanComplete(lastResult);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  // Check if error is about file size
  const isFileTooLargeError = error?.includes('too large') || error?.includes('muito grande');

  const renderSizeError = () => (
    <Alert variant="destructive" className="mt-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Playlist muito grande</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>Esta playlist excede o limite de 20MB para limpeza direta.</p>
        <p className="text-sm">
          <strong>Solução:</strong> Use o sistema de <strong>Sincronização M3U</strong> na aba "Sincronização" 
          que processa playlists grandes em lotes, sem limites de tamanho.
        </p>
      </AlertDescription>
    </Alert>
  );

  const renderStats = () => {
    if (!lastResult) return null;
    const { stats } = lastResult;
    const approvalRate = stats.inChannels > 0
      ? ((stats.cleanedChannels / stats.inChannels) * 100).toFixed(1)
      : '0';

    return (
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="Entrada"
            value={stats.inChannels}
            icon={<FileText className="w-4 h-4 text-muted-foreground" />}
          />
          <StatCard
            label="Únicos"
            value={stats.uniqueChannels}
            icon={<CheckCircle className="w-4 h-4 text-blue-500" />}
          />
          <StatCard
            label="Limpos"
            value={stats.cleanedChannels}
            icon={<CheckCircle className="w-4 h-4 text-green-500" />}
          />
          <StatCard
            label="Quarentena"
            value={stats.quarantinedCount}
            icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Taxa de aprovação</span>
            <span className="font-medium">{approvalRate}%</span>
          </div>
          <Progress value={parseFloat(approvalRate)} className="h-2" />
        </div>

        {stats.quarantinedCount > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  Quarentena ({stats.quarantinedCount} canais)
                </span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-[200px] mt-2 rounded-md border p-2">
                <div className="space-y-2">
                  {Object.entries(groupQuarantineByReason(stats.quarantined)).map(([reason, items]) => (
                    <div key={reason} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getReasonLabel(reason)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{items.length} canais</span>
                      </div>
                      {items.slice(0, 5).map((item, i) => (
                        <div key={i} className="text-xs text-muted-foreground pl-4 truncate">
                          {item.title || item.url}
                        </div>
                      ))}
                      {items.length > 5 && (
                        <div className="text-xs text-muted-foreground pl-4">
                          ... e mais {items.length - 5} canais
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="text-xs text-muted-foreground">
          Processado em {(stats.processingTimeMs / 1000).toFixed(2)}s
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleUsePlaylist} className="flex-1">
            Usar Esta Playlist
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadCleanedM3U(lastResult)}
          >
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
          {lastResult.storageUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={lastResult.storageUrl} target="_blank" rel="noopener noreferrer">
                <Cloud className="w-4 h-4 mr-1" />
                CDN
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  };

  const dialogContent = (
    <div className="space-y-4">
      <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as typeof inputTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="url" className="gap-1">
            <Link className="w-4 h-4" /> URL
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1">
            <FileText className="w-4 h-4" /> Conteúdo
          </TabsTrigger>
          <TabsTrigger value="file" className="gap-1">
            <Upload className="w-4 h-4" /> Arquivo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-2">
          <Label>URL da playlist M3U</Label>
          <Input
            placeholder="https://exemplo.com/playlist.m3u"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </TabsContent>

        <TabsContent value="content" className="space-y-2">
          <Label>Conteúdo M3U</Label>
          <Textarea
            placeholder="#EXTM3U&#10;#EXTINF:-1,Canal 1&#10;http://..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-[150px] font-mono text-xs"
          />
        </TabsContent>

        <TabsContent value="file" className="space-y-2">
          <Label>Arquivo M3U</Label>
          <Input
            type="file"
            accept=".m3u,.m3u8,text/plain"
            onChange={handleFileChange}
          />
        </TabsContent>
      </Tabs>

      <Collapsible open={showOptions} onOpenChange={setShowOptions}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Opções Avançadas
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Pular validação de URLs</Label>
              <p className="text-xs text-muted-foreground">Mais rápido, mas não verifica URLs</p>
            </div>
            <Switch
              checked={options.skipProbe}
              onCheckedChange={(v) => setOptions({ ...options, skipProbe: v })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Salvar no CDN</Label>
              <p className="text-xs text-muted-foreground">Persistir playlist limpa no R2</p>
            </div>
            <Switch
              checked={options.save}
              onCheckedChange={(v) => setOptions({ ...options, save: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Máx. canais</Label>
              <Input
                type="number"
                value={options.maxChannels}
                onChange={(e) => setOptions({ ...options, maxChannels: parseInt(e.target.value) || 2000 })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Concorrência</Label>
              <Input
                type="number"
                value={options.concurrency}
                onChange={(e) => setOptions({ ...options, concurrency: parseInt(e.target.value) || 10 })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Timeout (ms)</Label>
              <Input
                type="number"
                value={options.probeTimeoutMs}
                onChange={(e) => setOptions({ ...options, probeTimeoutMs: parseInt(e.target.value) || 4000 })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Retenção (dias)</Label>
              <Input
                type="number"
                value={options.retentionDays}
                onChange={(e) => setOptions({ ...options, retentionDays: parseInt(e.target.value) || 30 })}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {isCleaning && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{progress.message}</span>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </div>
      )}

      {isFileTooLargeError && renderSizeError()}

      {error && !isFileTooLargeError && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isCleaning && !lastResult && !error && (
        <Button
          onClick={handleClean}
          disabled={
            isCleaning ||
            (inputTab === 'url' && !url.trim()) ||
            (inputTab === 'content' && !content.trim())
          }
          className="w-full gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Limpar & Analisar
        </Button>
      )}

      {error && (
        <Button variant="outline" onClick={reset} className="w-full">
          Tentar novamente
        </Button>
      )}

      {renderStats()}
    </div>
  );

  if (mode === 'embedded') {
    return dialogContent;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Limpar Playlist M3U
          </DialogTitle>
          <DialogDescription>
            Sanitize, valide e otimize sua playlist M3U
          </DialogDescription>
        </DialogHeader>
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50 border">
      {icon}
      <span className="text-xl font-bold mt-1">{value.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function groupQuarantineByReason(quarantined: Array<{ url: string; title: string; reason: string }>) {
  return quarantined.reduce((acc, item) => {
    if (!acc[item.reason]) acc[item.reason] = [];
    acc[item.reason].push(item);
    return acc;
  }, {} as Record<string, typeof quarantined>);
}

function getReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    'probe-failed': 'URL inacessível',
    'invalid-url': 'URL inválida',
    'unsupported-protocol': 'Protocolo não suportado',
    'duplicate': 'Duplicado',
    'parse-error': 'Erro de parsing',
  };
  return labels[reason] || reason;
}
