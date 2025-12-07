/**
 * RLS Issue Card - Interactive card for each security issue with one-click actions
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Eye,
  EyeOff,
  Wand2,
  Copy,
  Play,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Shield,
  FileCode
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from 'sonner';

export interface RLSIssueWithResolution {
  id?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  table: string;
  issue: string;
  recommendation: string;
  policy_name?: string;
  policy_definition?: string;
  suggested_fix?: string;
  status?: 'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'ignored' | 'false_positive';
  resolution_notes?: string;
}

interface RLSIssueCardProps {
  issue: RLSIssueWithResolution;
  onStatusChange: (issue: RLSIssueWithResolution, status: string, notes?: string) => Promise<void>;
  onApplyFix: (issue: RLSIssueWithResolution) => Promise<void>;
}

export function RLSIssueCard({ issue, onStatusChange, onApplyFix }: RLSIssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(issue.resolution_notes || '');
  const [isApplying, setIsApplying] = useState(false);

  const getSeverityConfig = (severity: string) => {
    const configs: Record<string, { variant: any; icon: any; label: string; color: string }> = {
      critical: { variant: 'destructive', icon: XCircle, label: 'CRÍTICO', color: 'text-red-500' },
      high: { variant: 'destructive', icon: AlertTriangle, label: 'ALTO', color: 'text-orange-500' },
      medium: { variant: 'default', icon: Info, label: 'MÉDIO', color: 'text-yellow-500' },
      low: { variant: 'outline', icon: Info, label: 'BAIXO', color: 'text-blue-500' }
    };
    return configs[severity] || configs.low;
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; icon: any }> = {
      pending: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
      acknowledged: { label: 'Reconhecido', color: 'bg-blue-500', icon: Eye },
      in_progress: { label: 'Em Progresso', color: 'bg-purple-500', icon: Play },
      resolved: { label: 'Resolvido', color: 'bg-green-500', icon: CheckCircle2 },
      ignored: { label: 'Ignorado', color: 'bg-gray-500', icon: EyeOff },
      false_positive: { label: 'Falso Positivo', color: 'bg-slate-500', icon: XCircle },
    };
    return configs[status || 'pending'] || configs.pending;
  };

  const severityConfig = getSeverityConfig(issue.severity);
  const statusConfig = getStatusConfig(issue.status || 'pending');
  const SeverityIcon = severityConfig.icon;
  const StatusIcon = statusConfig.icon;

  const generateSuggestedFix = () => {
    // Generate SQL fix based on issue type
    if (issue.issue.includes('RLS não habilitado')) {
      return `-- Habilitar RLS na tabela ${issue.table}
ALTER TABLE public.${issue.table} ENABLE ROW LEVEL SECURITY;

-- Criar política básica de acesso (ajuste conforme necessário)
CREATE POLICY "Users can access own data"
  ON public.${issue.table}
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);`;
    }

    if (issue.issue.includes('USING sempre verdadeira')) {
      return `-- Corrigir política permissiva: ${issue.policy_name}
-- Substituir USING (true) por verificação baseada em role/user

DROP POLICY IF EXISTS "${issue.policy_name}" ON public.${issue.table};

CREATE POLICY "${issue.policy_name}"
  ON public.${issue.table}
  FOR ALL
  USING (is_admin_or_master(auth.uid()) OR auth.uid() = user_id)
  WITH CHECK (is_admin_or_master(auth.uid()) OR auth.uid() = user_id);`;
    }

    if (issue.issue.includes('WITH CHECK sempre verdadeiro')) {
      return `-- Corrigir WITH CHECK permissivo: ${issue.policy_name}
-- Adicionar validação adequada

DROP POLICY IF EXISTS "${issue.policy_name}" ON public.${issue.table};

CREATE POLICY "${issue.policy_name}"
  ON public.${issue.table}
  FOR ALL
  USING (is_admin_or_master(auth.uid()))
  WITH CHECK (is_admin_or_master(auth.uid()));`;
    }

    if (issue.issue.includes('recursão')) {
      return `-- Corrigir possível recursão em ${issue.policy_name}
-- Usar função SECURITY DEFINER para evitar recursão

CREATE OR REPLACE FUNCTION public.check_${issue.table}_access(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id
    AND role IN ('admin', 'master')
  );
$$;

DROP POLICY IF EXISTS "${issue.policy_name}" ON public.${issue.table};

CREATE POLICY "${issue.policy_name}"
  ON public.${issue.table}
  FOR ALL
  USING (check_${issue.table}_access(auth.uid()));`;
    }

    if (issue.issue.includes('sem cláusula WITH CHECK')) {
      return `-- Adicionar WITH CHECK à política ${issue.policy_name}

DROP POLICY IF EXISTS "${issue.policy_name}" ON public.${issue.table};

CREATE POLICY "${issue.policy_name}"
  ON public.${issue.table}
  FOR ALL
  USING (auth.uid() = user_id OR is_admin_or_master(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR is_admin_or_master(auth.uid()));`;
    }

    return `-- Análise manual necessária para: ${issue.table}
-- Issue: ${issue.issue}
-- Recomendação: ${issue.recommendation}`;
  };

  const suggestedFix = issue.suggested_fix || generateSuggestedFix();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(suggestedFix);
    toast.success('SQL copiado para clipboard!');
  };

  const handleQuickAction = async (status: string) => {
    await onStatusChange(issue, status, notes);
  };

  const handleApplyFix = async () => {
    setIsApplying(true);
    try {
      await onApplyFix({ ...issue, suggested_fix: suggestedFix });
    } finally {
      setIsApplying(false);
    }
  };

  const isResolved = issue.status === 'resolved' || issue.status === 'ignored' || issue.status === 'false_positive';

  return (
    <Card className={`transition-all ${isResolved ? 'opacity-60 border-muted' : severityConfig.variant === 'destructive' ? 'border-destructive' : 'border-border'}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Severity Icon */}
          <div className={`mt-1 ${severityConfig.color}`}>
            <SeverityIcon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge variant={severityConfig.variant} className="gap-1">
                {severityConfig.label}
              </Badge>
              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{issue.table}</code>
              {issue.policy_name && (
                <Badge variant="outline" className="font-mono text-xs">
                  {issue.policy_name}
                </Badge>
              )}
              <Badge className={`${statusConfig.color} text-white gap-1`}>
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </Badge>
            </div>

            {/* Issue Description */}
            <p className="text-sm font-medium mb-1">{issue.issue}</p>
            <p className="text-xs text-muted-foreground mb-3">{issue.recommendation}</p>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {!isResolved && (
                <>
                  {/* One-Click Fix Button */}
                  <Button 
                    size="sm" 
                    variant="default"
                    onClick={handleApplyFix}
                    disabled={isApplying}
                    className="gap-1"
                  >
                    <Wand2 className="w-3 h-3" />
                    {isApplying ? 'Aplicando...' : 'Aplicar Fix'}
                  </Button>

                  {/* Quick Status Actions */}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleQuickAction('acknowledged')}
                    className="gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Reconhecer
                  </Button>

                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => handleQuickAction('resolved')}
                    className="gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Marcar Resolvido
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost">
                        Mais ações...
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleQuickAction('in_progress')}>
                        <Play className="w-4 h-4 mr-2" />
                        Em Progresso
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleQuickAction('ignored')}>
                        <EyeOff className="w-4 h-4 mr-2" />
                        Ignorar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleQuickAction('false_positive')}>
                        <XCircle className="w-4 h-4 mr-2" />
                        Falso Positivo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}

              {isResolved && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleQuickAction('pending')}
                  className="gap-1"
                >
                  <Clock className="w-3 h-3" />
                  Reabrir
                </Button>
              )}
            </div>

            {/* Expandable Details */}
            <Collapsible open={expanded} onOpenChange={setExpanded} className="mt-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 p-0 h-auto">
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {expanded ? 'Ocultar detalhes' : 'Ver solução SQL'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                {/* Current Policy Definition */}
                {issue.policy_definition && (
                  <div>
                    <p className="text-xs font-medium mb-1 flex items-center gap-1">
                      <FileCode className="w-3 h-3" />
                      Definição Atual:
                    </p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {issue.policy_definition}
                    </pre>
                  </div>
                )}

                {/* Suggested Fix */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-yellow-500" />
                      Solução Sugerida:
                    </p>
                    <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-6 px-2">
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar
                    </Button>
                  </div>
                  <pre className="text-xs bg-green-500/10 border border-green-500/20 p-3 rounded overflow-x-auto">
                    {suggestedFix}
                  </pre>
                </div>

                {/* Notes */}
                <div>
                  <p className="text-xs font-medium mb-1">Notas:</p>
                  <Textarea
                    placeholder="Adicione notas sobre esta issue..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-xs h-20"
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2"
                    onClick={() => onStatusChange(issue, issue.status || 'pending', notes)}
                  >
                    Salvar Notas
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
