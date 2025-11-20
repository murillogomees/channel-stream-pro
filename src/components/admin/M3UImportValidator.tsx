import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle, Clock, FileText, ArrowRight } from 'lucide-react';

interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface ValidationResult {
  valid: boolean;
  totalChannels: number;
  validChannels: number;
  invalidChannels: number;
  estimatedTime: number;
  issues: ValidationIssue[];
  preview: {
    name: string;
    url: string;
    logo?: string;
  }[];
}

interface M3UImportValidatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validationResult: ValidationResult | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function M3UImportValidator({
  open,
  onOpenChange,
  validationResult,
  onConfirm,
  onCancel,
  loading = false
}: M3UImportValidatorProps) {
  if (!validationResult) return null;

  const successRate = (validationResult.validChannels / validationResult.totalChannels) * 100;

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Validação Pré-Importação
          </DialogTitle>
          <DialogDescription>
            Análise completa do arquivo M3U antes da importação
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Total de Canais</div>
                <div className="text-2xl font-bold">{validationResult.totalChannels}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Canais Válidos</div>
                <div className="text-2xl font-bold text-green-500">{validationResult.validChannels}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">Canais Inválidos</div>
                <div className="text-2xl font-bold text-red-500">{validationResult.invalidChannels}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Tempo Estimado
                </div>
                <div className="text-2xl font-bold">{validationResult.estimatedTime}s</div>
              </CardContent>
            </Card>
          </div>

          {/* Success Rate */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Taxa de Sucesso</span>
              <span className="text-muted-foreground">{successRate.toFixed(1)}%</span>
            </div>
            <Progress value={successRate} className="h-2" />
          </div>

          {/* Issues */}
          {validationResult.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Problemas Detectados ({validationResult.issues.length})</h4>
              <ScrollArea className="h-[150px] rounded-md border p-3">
                <div className="space-y-2">
                  {validationResult.issues.map((issue, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      {getIssueIcon(issue.type)}
                      <div className="flex-1">
                        <p className="font-medium">{issue.message}</p>
                        {issue.details && (
                          <p className="text-xs text-muted-foreground">{issue.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Preview dos Primeiros Canais</h4>
            <ScrollArea className="h-[200px] rounded-md border">
              <div className="space-y-1 p-3">
                {validationResult.preview.map((channel, idx) => (
                  <Card key={idx} className="p-2">
                    <div className="flex items-center gap-3">
                      {channel.logo ? (
                        <img src={channel.logo} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{channel.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{channel.url}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Canal {idx + 1}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Validation Result */}
          <Card className={validationResult.valid ? 'border-green-500/50 bg-green-500/5' : 'border-yellow-500/50 bg-yellow-500/5'}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {validationResult.valid ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
                <div className="flex-1">
                  <h4 className="font-medium">
                    {validationResult.valid ? 'Arquivo válido e pronto para importação' : 'Arquivo contém problemas'}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {validationResult.valid
                      ? 'Todos os canais foram validados com sucesso. Você pode prosseguir com a importação.'
                      : 'Alguns canais podem não funcionar corretamente. Você pode continuar, mas alguns problemas podem ocorrer.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? 'Importando...' : (
              <>
                Confirmar Importação
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
