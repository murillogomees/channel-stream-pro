import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, XCircle, Clock, FileText, ArrowRight, Hash, CheckCircle2 } from 'lucide-react';
import { FormSection, DialogBody } from '@/components/ui/form-section';

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
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            <FileText className="h-5 w-5" />
            Validação Pré-Importação
          </DialogTitle>
          <DialogDescription>
            Análise completa do arquivo M3U antes da importação
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-lg border bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="flex items-center gap-2 text-primary">
                <Hash className="h-4 w-4" />
                <span className="text-xs font-medium">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{validationResult.totalChannels}</p>
            </div>

            <div className="p-4 rounded-lg border bg-gradient-to-br from-success/10 to-success/5">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Válidos</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-success">{validationResult.validChannels}</p>
            </div>

            <div className="p-4 rounded-lg border bg-gradient-to-br from-destructive/10 to-destructive/5">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Inválidos</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-destructive">{validationResult.invalidChannels}</p>
            </div>

            <div className="p-4 rounded-lg border bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <div className="flex items-center gap-2 text-blue-500">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Tempo Est.</span>
              </div>
              <p className="text-2xl font-bold mt-1">{validationResult.estimatedTime}s</p>
            </div>
          </div>

          {/* Success Rate */}
          <div className="space-y-2 p-4 rounded-lg border bg-card">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">Taxa de Sucesso</span>
              <Badge variant={successRate >= 90 ? 'default' : successRate >= 70 ? 'secondary' : 'destructive'}>
                {successRate.toFixed(1)}%
              </Badge>
            </div>
            <Progress value={successRate} className="h-2" />
          </div>

          {/* Issues */}
          {validationResult.issues.length > 0 && (
            <div className="space-y-3">
              <FormSection
                icon={<AlertTriangle className="h-5 w-5" />}
                title="Problemas Detectados"
                description={`${validationResult.issues.length} problema(s) encontrado(s)`}
                variant="warning"
              />
              <ScrollArea className="h-[150px] rounded-lg border">
                <div className="p-4 space-y-2">
                  {validationResult.issues.map((issue, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      {getIssueIcon(issue.type)}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{issue.message}</p>
                        {issue.details && (
                          <p className="text-xs text-muted-foreground mt-1">{issue.details}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-3">
            <FormSection
              icon={<FileText className="h-5 w-5" />}
              title="Preview dos Canais"
              description="Primeiros canais do arquivo"
              variant="info"
            />
            <ScrollArea className="h-[200px] rounded-lg border">
              <div className="p-4 space-y-2">
                {validationResult.preview.map((channel, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    {channel.logo ? (
                      <img src={channel.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{channel.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{channel.url}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{idx + 1}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Validation Result */}
          <Card className={validationResult.valid ? 'border-success/50 bg-success/5' : 'border-amber-500/50 bg-amber-500/5'}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {validationResult.valid ? (
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold">
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
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading} className="h-12">
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading} className="h-12">
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
