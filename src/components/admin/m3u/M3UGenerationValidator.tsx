/**
 * M3U Generation Validator Dialog
 * Shows validation results and requires confirmation before generating M3U
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Info,
  Loader2,
  FileText,
  ListTree,
  AlertCircle,
  Tv,
  Film,
} from 'lucide-react';
import type { SeriesValidationResult, DuplicateGroup, SeriesEpisode } from '@/services/m3uSeriesValidationService';

interface M3UGenerationValidatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validationResult: SeriesValidationResult | null;
  isValidating: boolean;
  onConfirmGeneration: (options: GenerationOptions) => void;
  onCancel: () => void;
}

export interface GenerationOptions {
  removeDuplicates: boolean;
  useRecommendedDuplicates: boolean;
  includeInvalidEntries: boolean;
  generateNow: boolean;
}

export function M3UGenerationValidator({
  open,
  onOpenChange,
  validationResult,
  isValidating,
  onConfirmGeneration,
  onCancel,
}: M3UGenerationValidatorProps) {
  const [options, setOptions] = useState<GenerationOptions>({
    removeDuplicates: true,
    useRecommendedDuplicates: true,
    includeInvalidEntries: false,
    generateNow: false,
  });
  const [activeTab, setActiveTab] = useState('summary');

  const successRate = useMemo(() => {
    if (!validationResult) return 0;
    const total = validationResult.totalEpisodes;
    if (total === 0) return 0;
    return Math.round((validationResult.validEpisodes / total) * 100);
  }, [validationResult]);

  const issuesByType = useMemo(() => {
    if (!validationResult) return { errors: 0, warnings: 0, info: 0, duplicates: 0 };
    return validationResult.issues.reduce(
      (acc, issue) => {
        if (issue.type === 'error') acc.errors++;
        else if (issue.type === 'warning') acc.warnings++;
        else if (issue.type === 'duplicate') acc.duplicates++;
        else acc.info++;
        return acc;
      },
      { errors: 0, warnings: 0, info: 0, duplicates: 0 }
    );
  }, [validationResult]);

  const handleConfirm = () => {
    onConfirmGeneration({ ...options, generateNow: true });
  };

  if (isValidating) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Validando M3U...
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center gap-4">
            <Progress value={undefined} className="w-full" />
            <p className="text-sm text-muted-foreground">
              Analisando entradas, detectando duplicatas e validando URLs...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!validationResult) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {validationResult.valid ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            )}
            Validação do M3U
          </DialogTitle>
          <DialogDescription>
            Revise os resultados antes de gerar o arquivo M3U
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="summary" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Resumo</span>
            </TabsTrigger>
            <TabsTrigger value="issues" className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Problemas</span>
              {issuesByType.errors + issuesByType.warnings > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {issuesByType.errors + issuesByType.warnings}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="flex items-center gap-1">
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Duplicatas</span>
              {validationResult.duplicatesFound > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {validationResult.duplicatesFound}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1">
              <ListTree className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden mt-4">
            <TabsContent value="summary" className="h-full m-0">
              <SummaryTab
                validationResult={validationResult}
                successRate={successRate}
                issuesByType={issuesByType}
              />
            </TabsContent>

            <TabsContent value="issues" className="h-full m-0">
              <IssuesTab validationResult={validationResult} />
            </TabsContent>

            <TabsContent value="duplicates" className="h-full m-0">
              <DuplicatesTab 
                duplicateGroups={validationResult.duplicateGroups}
                options={options}
                onOptionsChange={setOptions}
              />
            </TabsContent>

            <TabsContent value="preview" className="h-full m-0">
              <PreviewTab preview={validationResult.preview} />
            </TabsContent>
          </div>
        </Tabs>

        <Separator className="my-4" />

        {/* Options */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Opções de Geração:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={options.removeDuplicates}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, removeDuplicates: !!checked }))
                }
              />
              <span>Remover duplicatas automaticamente</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={options.useRecommendedDuplicates}
                onCheckedChange={(checked) => 
                  setOptions(prev => ({ ...prev, useRecommendedDuplicates: !!checked }))
                }
                disabled={!options.removeDuplicates}
              />
              <span>Usar versão recomendada (melhor qualidade)</span>
            </label>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!validationResult.valid && issuesByType.errors > 0}
            className="gap-2"
          >
            {validationResult.valid ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Gerar Agora
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4" />
                Gerar com Avisos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Summary Tab Component
function SummaryTab({
  validationResult,
  successRate,
  issuesByType,
}: {
  validationResult: SeriesValidationResult;
  successRate: number;
  issuesByType: { errors: number; warnings: number; info: number; duplicates: number };
}) {
  const seriesCount = validationResult.stats.series.size;
  
  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardDescription className="text-xs">Total</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold">{validationResult.totalEpisodes.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardDescription className="text-xs">Válidos</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold text-green-500">
                {validationResult.validEpisodes.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardDescription className="text-xs">Duplicatas</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold text-yellow-500">
                {validationResult.duplicatesFound}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-1">
              <CardDescription className="text-xs">Séries</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-2xl font-bold text-blue-500">{seriesCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="text-xs">Taxa de Sucesso</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="flex items-center gap-3">
              <Progress value={successRate} className="flex-1" />
              <span className="text-sm font-medium">{successRate}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Issues Summary */}
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-sm">Resumo de Problemas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span>Erros: {issuesByType.errors}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>Avisos: {issuesByType.warnings}</span>
              </div>
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-orange-500" />
                <span>Duplicatas: {issuesByType.duplicates}</span>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                <span>Info: {issuesByType.info}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Series List */}
        {seriesCount > 0 && (
          <Card>
            <CardHeader className="p-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tv className="h-4 w-4" />
                Séries Detectadas ({seriesCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex flex-wrap gap-1.5">
                {Array.from(validationResult.stats.series.entries())
                  .slice(0, 20)
                  .map(([name, count]) => (
                    <Badge key={name} variant="secondary" className="text-xs">
                      {name} ({count})
                    </Badge>
                  ))}
                {seriesCount > 20 && (
                  <Badge variant="outline" className="text-xs">
                    +{seriesCount - 20} mais
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation Status */}
        <Alert variant={validationResult.valid ? 'default' : 'destructive'}>
          {validationResult.valid ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertTitle>
            {validationResult.valid ? 'Validação Aprovada' : 'Atenção Necessária'}
          </AlertTitle>
          <AlertDescription>
            {validationResult.valid
              ? 'O conteúdo está pronto para geração. Revise as opções e confirme.'
              : 'Existem problemas que requerem sua atenção. Revise antes de prosseguir.'}
          </AlertDescription>
        </Alert>
      </div>
    </ScrollArea>
  );
}

// Issues Tab Component
function IssuesTab({ validationResult }: { validationResult: SeriesValidationResult }) {
  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'duplicate':
        return <Copy className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getIssueBadge = (type: string) => {
    switch (type) {
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">Aviso</Badge>;
      case 'duplicate':
        return <Badge variant="secondary" className="bg-orange-500/20 text-orange-700">Duplicata</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  if (validationResult.issues.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
          <p>Nenhum problema detectado!</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-2">
        {validationResult.issues.map((issue, idx) => (
          <Card key={idx} className="p-3">
            <div className="flex items-start gap-3">
              {getIssueIcon(issue.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getIssueBadge(issue.type)}
                  <span className="text-sm font-medium truncate">{issue.message}</span>
                </div>
                {issue.details && (
                  <p className="text-xs text-muted-foreground truncate">{issue.details}</p>
                )}
                {issue.suggestedFix && (
                  <p className="text-xs text-primary mt-1">💡 {issue.suggestedFix}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// Duplicates Tab Component
function DuplicatesTab({
  duplicateGroups,
  options,
  onOptionsChange,
}: {
  duplicateGroups: DuplicateGroup[];
  options: GenerationOptions;
  onOptionsChange: (options: GenerationOptions) => void;
}) {
  if (duplicateGroups.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
          <p>Nenhuma duplicata detectada!</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        <Alert>
          <Copy className="h-4 w-4" />
          <AlertTitle>{duplicateGroups.length} grupos de duplicatas</AlertTitle>
          <AlertDescription>
            Episódios com mesmo identificador (série + temporada + episódio).
            A versão recomendada é selecionada por qualidade.
          </AlertDescription>
        </Alert>

        {duplicateGroups.slice(0, 10).map((group, idx) => (
          <Card key={idx}>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Film className="h-4 w-4" />
                {group.key.replace('|', ' - ')}
              </CardTitle>
              <CardDescription className="text-xs">
                {group.episodes.length} versões encontradas
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1.5">
                {group.episodes.map((ep, epIdx) => (
                  <div
                    key={ep.id}
                    className={`text-xs p-2 rounded flex items-center gap-2 ${
                      ep.id === group.recommended.id
                        ? 'bg-green-500/10 border border-green-500/30'
                        : 'bg-muted/50'
                    }`}
                  >
                    {ep.id === group.recommended.id && (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-700 text-[10px]">
                        Recomendado
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {ep.quality || 'unknown'}
                    </Badge>
                    <span className="truncate flex-1">{ep.url}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {duplicateGroups.length > 10 && (
          <p className="text-center text-sm text-muted-foreground">
            + {duplicateGroups.length - 10} grupos adicionais
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

// Preview Tab Component
function PreviewTab({ preview }: { preview: string }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(preview);
  };

  return (
    <div className="h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">Preview do M3U (primeiros 20 episódios)</span>
        <Button variant="ghost" size="sm" onClick={copyToClipboard}>
          <Copy className="h-4 w-4 mr-1" />
          Copiar
        </Button>
      </div>
      <ScrollArea className="flex-1 border rounded-md">
        <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
          {preview || '# Nenhum conteúdo para preview'}
        </pre>
      </ScrollArea>
    </div>
  );
}
