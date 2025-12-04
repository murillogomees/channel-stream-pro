import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sparkles, Loader2, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, Trash2, Eye, Settings, Undo2, Zap, Filter,
  History, Download, Play, Pause, RotateCcw, Lightbulb
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
interface CleanConfig {
  preset: 'conservative' | 'aggressive' | 'custom';
  remove_empty_lines: boolean;
  keep_protocols: string[];
  dedupe_by: 'url' | 'title' | 'both' | 'none';
  strip_emojis: boolean;
  title_cleanup: Array<{ type: 'regex'; pattern: string; replace: string }>;
  group_actions: Array<{ group: string; action: 'keep' | 'remove' }>;
  healthcheck: {
    enabled: boolean;
    method: 'HEAD' | 'GET';
    timeout: number;
    concurrency: number;
  };
  batchSize: number;
}

interface CleanStats {
  totalEntries: number;
  validEntries: number;
  duplicatesRemoved: number;
  invalidUrlsRemoved: number;
  emptyTitlesRemoved: number;
  protocolFiltered: number;
  groupFiltered: number;
  healthCheckFailed: number;
  processingTimeMs: number;
}

interface CleanJob {
  id: string;
  source_id: string;
  config: CleanConfig;
  stats: CleanStats | null;
  status: 'pending' | 'analyzing' | 'preview' | 'executing' | 'completed' | 'failed' | 'cancelled';
  preview_path: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

interface Suggestion {
  id: string;
  type: 'dedupe' | 'protocol' | 'emoji' | 'group' | 'empty';
  message: string;
  action: () => void;
  impact: number;
}

interface PreviewEntry {
  original: { title: string; url: string; group?: string };
  cleaned: { title: string; url: string; group?: string } | null;
  action: 'keep' | 'remove' | 'modify';
  reason?: string;
}

interface M3UCleanPipelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  sourceName: string;
  sourceKey: string;
  entriesCount: number;
  onComplete?: () => void;
}

const DEFAULT_CONFIG: CleanConfig = {
  preset: 'conservative',
  remove_empty_lines: true,
  keep_protocols: ['http', 'https'],
  dedupe_by: 'url',
  strip_emojis: false,
  title_cleanup: [],
  group_actions: [],
  healthcheck: {
    enabled: false,
    method: 'HEAD',
    timeout: 3000,
    concurrency: 10,
  },
  batchSize: 1000,
};

const PRESETS: Record<string, Partial<CleanConfig>> = {
  conservative: {
    remove_empty_lines: true,
    keep_protocols: ['http', 'https'],
    dedupe_by: 'url',
    strip_emojis: false,
    healthcheck: { enabled: false, method: 'HEAD', timeout: 3000, concurrency: 10 },
  },
  aggressive: {
    remove_empty_lines: true,
    keep_protocols: ['http', 'https'],
    dedupe_by: 'both',
    strip_emojis: true,
    healthcheck: { enabled: true, method: 'HEAD', timeout: 3000, concurrency: 20 },
  },
};

export function M3UCleanPipeline({
  open,
  onOpenChange,
  sourceId,
  sourceName,
  sourceKey,
  entriesCount,
  onComplete,
}: M3UCleanPipelineProps) {
  const [tab, setTab] = useState<'config' | 'suggestions' | 'preview' | 'history'>('config');
  const [config, setConfig] = useState<CleanConfig>(DEFAULT_CONFIG);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<CleanStats | null>(null);
  const [preview, setPreview] = useState<PreviewEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [jobs, setJobs] = useState<CleanJob[]>([]);
  const [currentJob, setCurrentJob] = useState<CleanJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  // Load job history
  useEffect(() => {
    if (open && sourceId) {
      loadJobHistory();
      analyzeSource();
    }
  }, [open, sourceId]);

  const loadJobHistory = async () => {
    const { data } = await supabase
      .from('m3u_clean_jobs')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) {
      setJobs(data as unknown as CleanJob[]);
    }
  };

  const analyzeSource = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('m3u-clean-advanced', {
        body: { 
          action: 'analyze', 
          sourceId,
          sampleSize: 5000 
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      // Generate suggestions from analysis
      const newSuggestions: Suggestion[] = [];
      
      if (data.analysis.duplicateUrls > 0) {
        newSuggestions.push({
          id: 'dedupe-url',
          type: 'dedupe',
          message: `${data.analysis.duplicateUrls.toLocaleString()} URLs duplicadas detectadas`,
          action: () => setConfig(c => ({ ...c, dedupe_by: 'url' })),
          impact: data.analysis.duplicateUrls,
        });
      }

      if (data.analysis.emptyTitles > 0) {
        newSuggestions.push({
          id: 'empty-titles',
          type: 'empty',
          message: `${data.analysis.emptyTitles.toLocaleString()} títulos vazios`,
          action: () => setConfig(c => ({ ...c, remove_empty_lines: true })),
          impact: data.analysis.emptyTitles,
        });
      }

      if (data.analysis.emojiCount > data.analysis.sampleSize * 0.1) {
        newSuggestions.push({
          id: 'strip-emojis',
          type: 'emoji',
          message: `${Math.round((data.analysis.emojiCount / data.analysis.sampleSize) * 100)}% dos títulos contêm emojis`,
          action: () => setConfig(c => ({ ...c, strip_emojis: true })),
          impact: data.analysis.emojiCount,
        });
      }

      if (data.analysis.groups) {
        setGroups(Object.keys(data.analysis.groups));
      }

      setSuggestions(newSuggestions);
      
      if (newSuggestions.length > 0) {
        setTab('suggestions');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na análise';
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePreview = async () => {
    setIsAnalyzing(true);
    setError(null);
    setProgress(0);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('m3u-clean-advanced', {
        body: { 
          action: 'preview', 
          sourceId,
          config,
          previewSize: 100 
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setPreview(data.preview || []);
      setStats(data.stats);
      setTab('preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro no preview';
      setError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setProgress(0);

    try {
      // Execute clean via Edge Function
      const response = await supabase.functions.invoke(
        `clean-sync-entries?sourceId=${sourceId}&apply=true`
      );

      if (response.error) throw response.error;
      if (response.data.error) throw new Error(response.data.error);

      setStats(response.data.stats);
      setProgress(100);
      
      toast.success(`Limpeza concluída: ${response.data.stats.validEntries.toLocaleString()} entradas válidas`);
      
      if (onComplete) {
        onComplete();
      }

      loadJobHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na execução';
      setError(message);
      toast.error(message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUndo = async (jobId: string) => {
    toast.info('Funcionalidade de undo em desenvolvimento');
    // TODO: Implement version restore from storage backup
  };

  const applyPreset = (presetName: 'conservative' | 'aggressive') => {
    setConfig(c => ({
      ...c,
      ...PRESETS[presetName],
      preset: presetName,
    }));
  };

  const handleClose = () => {
    setTab('config');
    setStats(null);
    setPreview([]);
    setSuggestions([]);
    setError(null);
    setProgress(0);
    onOpenChange(false);
  };

  const totalImpact = suggestions.reduce((acc, s) => acc + s.impact, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Pipeline de Limpeza M3U
          </DialogTitle>
          <DialogDescription>
            Limpe e valide <strong>{sourceName}</strong> ({entriesCount.toLocaleString()} entradas)
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="config" className="gap-1">
              <Settings className="w-4 h-4" /> Config
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-1">
              <Lightbulb className="w-4 h-4" /> Sugestões
              {suggestions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {suggestions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="w-4 h-4" /> Preview
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="w-4 h-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* Config Tab */}
          <TabsContent value="config" className="flex-1 overflow-auto space-y-4 mt-4">
            {/* Presets */}
            <div className="flex gap-2">
              <Button
                variant={config.preset === 'conservative' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset('conservative')}
              >
                Conservador
              </Button>
              <Button
                variant={config.preset === 'aggressive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset('aggressive')}
              >
                Agressivo
              </Button>
              <Button
                variant={config.preset === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setConfig(c => ({ ...c, preset: 'custom' }))}
              >
                Personalizado
              </Button>
            </div>

            {/* Basic Options */}
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="remove-empty">Remover linhas vazias</Label>
                <Switch
                  id="remove-empty"
                  checked={config.remove_empty_lines}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, remove_empty_lines: v, preset: 'custom' }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="strip-emojis">Remover emojis dos títulos</Label>
                <Switch
                  id="strip-emojis"
                  checked={config.strip_emojis}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, strip_emojis: v, preset: 'custom' }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Deduplicação</Label>
                <Select
                  value={config.dedupe_by}
                  onValueChange={(v) => setConfig(c => ({ ...c, dedupe_by: v as CleanConfig['dedupe_by'], preset: 'custom' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Desativado</SelectItem>
                    <SelectItem value="url">Por URL</SelectItem>
                    <SelectItem value="title">Por Título</SelectItem>
                    <SelectItem value="both">URL + Título</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Health Check */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Health Check
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label>Ativar verificação de URLs</Label>
                    <Switch
                      checked={config.healthcheck.enabled}
                      onCheckedChange={(v) => setConfig(c => ({
                        ...c,
                        healthcheck: { ...c.healthcheck, enabled: v },
                        preset: 'custom',
                      }))}
                    />
                  </div>
                  {config.healthcheck.enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Timeout (ms)</Label>
                          <Input
                            type="number"
                            value={config.healthcheck.timeout}
                            onChange={(e) => setConfig(c => ({
                              ...c,
                              healthcheck: { ...c.healthcheck, timeout: parseInt(e.target.value) || 3000 },
                            }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Concorrência</Label>
                          <Input
                            type="number"
                            value={config.healthcheck.concurrency}
                            onChange={(e) => setConfig(c => ({
                              ...c,
                              healthcheck: { ...c.healthcheck, concurrency: parseInt(e.target.value) || 10 },
                            }))}
                          />
                        </div>
                      </div>
                      <Alert>
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                          Health check pode demorar para {entriesCount.toLocaleString()} entradas
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Group Actions */}
              {groups.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filtros por Grupo ({groups.length})
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {groups.slice(0, 20).map((group) => {
                          const action = config.group_actions.find(g => g.group === group);
                          return (
                            <div key={group} className="flex items-center justify-between text-sm">
                              <span className="truncate max-w-[200px]">{group}</span>
                              <Select
                                value={action?.action || 'keep'}
                                onValueChange={(v) => {
                                  const newActions = config.group_actions.filter(g => g.group !== group);
                                  if (v !== 'keep') {
                                    newActions.push({ group, action: v as 'keep' | 'remove' });
                                  }
                                  setConfig(c => ({ ...c, group_actions: newActions, preset: 'custom' }));
                                }}
                              >
                                <SelectTrigger className="w-24 h-7">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="keep">Manter</SelectItem>
                                  <SelectItem value="remove">Remover</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="flex-1 overflow-auto space-y-4 mt-4">
            {isAnalyzing ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analisando amostra...</span>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>Nenhuma sugestão de otimização</p>
              </div>
            ) : (
              <>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Impacto estimado</div>
                  <div className="text-2xl font-bold">{totalImpact.toLocaleString()} entradas</div>
                </div>
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        <div>
                          <div className="text-sm font-medium">{s.message}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.impact.toLocaleString()} itens afetados
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={s.action}>
                        Aplicar
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    suggestions.forEach(s => s.action());
                    toast.success('Todas as sugestões aplicadas');
                  }}
                >
                  Aplicar Todas
                </Button>
              </>
            )}
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="flex-1 overflow-auto space-y-4 mt-4">
            {stats && (
              <div className="grid grid-cols-4 gap-2">
                <StatCard label="Total" value={stats.totalEntries} />
                <StatCard label="Válidas" value={stats.validEntries} variant="success" />
                <StatCard label="Duplicadas" value={stats.duplicatesRemoved} variant="warning" />
                <StatCard label="Removidas" value={stats.invalidUrlsRemoved + stats.emptyTitlesRemoved} variant="danger" />
              </div>
            )}

            {preview.length > 0 ? (
              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {preview.map((entry, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded text-xs ${
                        entry.action === 'remove'
                          ? 'bg-red-500/10 border-l-2 border-red-500'
                          : entry.action === 'modify'
                          ? 'bg-yellow-500/10 border-l-2 border-yellow-500'
                          : 'bg-green-500/10 border-l-2 border-green-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate max-w-[400px]">
                          {entry.original.title || '(sem título)'}
                        </span>
                        <Badge variant={entry.action === 'remove' ? 'destructive' : entry.action === 'modify' ? 'secondary' : 'outline'}>
                          {entry.action === 'remove' ? 'Remover' : entry.action === 'modify' ? 'Modificar' : 'Manter'}
                        </Badge>
                      </div>
                      {entry.reason && (
                        <div className="text-muted-foreground mt-1">{entry.reason}</div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Clique em "Simular" para ver o preview</p>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-1 overflow-auto space-y-4 mt-4">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum histórico de limpeza</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            job.status === 'completed' ? 'default' :
                            job.status === 'failed' ? 'destructive' : 'secondary'
                          }>
                            {job.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleString()}
                          </span>
                        </div>
                        {job.stats && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {(job.stats as unknown as CleanStats).validEntries?.toLocaleString()} válidas de{' '}
                            {(job.stats as unknown as CleanStats).totalEntries?.toLocaleString()}
                          </div>
                        )}
                      </div>
                      {job.status === 'completed' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUndo(job.id)}
                        >
                          <Undo2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progress */}
        {(isAnalyzing || isExecuting) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{isExecuting ? 'Executando limpeza...' : 'Analisando...'}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          <Button
            variant="secondary"
            onClick={handlePreview}
            disabled={isAnalyzing || isExecuting}
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            Simular
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isAnalyzing || isExecuting}
          >
            {isExecuting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Executar Limpeza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ 
  label, 
  value, 
  variant = 'default' 
}: { 
  label: string; 
  value: number; 
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variants = {
    default: 'bg-muted/50',
    success: 'bg-green-500/10 text-green-600',
    warning: 'bg-yellow-500/10 text-yellow-600',
    danger: 'bg-red-500/10 text-red-600',
  };

  return (
    <div className={`p-2 rounded-lg text-center ${variants[variant]}`}>
      <div className="text-lg font-bold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
