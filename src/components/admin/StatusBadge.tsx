import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  HelpCircle 
} from 'lucide-react';

type StatusType = 
  | 'operational' | 'healthy' 
  | 'degraded' 
  | 'down' | 'critical' | 'offline'
  | 'unknown'
  | 'pendente' | 'pending'
  | 'processando' | 'processing'
  | 'completo' | 'complete' | 'completed'
  | 'active' | 'ativo'
  | 'inactive' | 'inativo'
  | 'success' | 'sucesso'
  | 'error' | 'erro' | 'failed'
  | 'warning' | 'aviso';

interface StatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
  showTooltip?: boolean;
}

const statusConfig: Record<string, { 
  label: string; 
  variant: string; 
  className: string;
  description: string;
  icon: any;
  critical?: boolean;
}> = {
  operational: {
    label: 'Operacional',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
    description: 'Sistema funcionando normalmente sem problemas detectados',
    icon: CheckCircle,
  },
  healthy: {
    label: 'Saudável',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
    description: 'Todos os serviços estão saudáveis e operacionais',
    icon: CheckCircle,
  },
  degraded: {
    label: 'Degradado',
    variant: 'default',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
    description: 'Serviço operando com performance reduzida ou problemas intermitentes',
    icon: AlertTriangle,
  },
  down: {
    label: 'Inativo',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
    description: 'Serviço temporariamente indisponível',
    icon: XCircle,
    critical: true,
  },
  critical: {
    label: 'Crítico',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
    description: 'Situação crítica que requer atenção imediata',
    icon: AlertCircle,
    critical: true,
  },
  offline: {
    label: 'Offline',
    variant: 'default',
    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
    description: 'Serviço completamente offline sem conexão',
    icon: XCircle,
  },
  unknown: {
    label: 'Desconhecido',
    variant: 'default',
    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
    description: 'Status não pode ser determinado no momento',
    icon: HelpCircle,
  },
  // Status de processamento
  pendente: {
    label: 'Pendente',
    variant: 'default',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
    description: 'Aguardando processamento ou ação',
    icon: Clock,
  },
  pending: {
    label: 'Pendente',
    variant: 'default',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
    description: 'Aguardando processamento ou ação',
    icon: Clock,
  },
  processando: {
    label: 'Processando',
    variant: 'default',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
    description: 'Operação em andamento',
    icon: Loader2,
  },
  processing: {
    label: 'Processando',
    variant: 'default',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
    description: 'Operação em andamento',
    icon: Loader2,
  },
  completo: {
    label: 'Completo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
    description: 'Operação concluída com sucesso',
    icon: CheckCircle2,
  },
  complete: {
    label: 'Completo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
    description: 'Operação concluída com sucesso',
    icon: CheckCircle2,
  },
  completed: {
    label: 'Completo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
    description: 'Operação concluída com sucesso',
    icon: CheckCircle2,
  },
  // Status ativo/inativo
  active: {
    label: 'Ativo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
    description: 'Recurso está ativo e disponível',
    icon: CheckCircle,
  },
  ativo: {
    label: 'Ativo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
    description: 'Recurso está ativo e disponível',
    icon: CheckCircle,
  },
  inactive: {
    label: 'Inativo',
    variant: 'default',
    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
    description: 'Recurso está temporariamente inativo',
    icon: XCircle,
  },
  inativo: {
    label: 'Inativo',
    variant: 'default',
    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
    description: 'Recurso está temporariamente inativo',
    icon: XCircle,
  },
  // Status de sucesso/erro
  success: {
    label: 'Sucesso',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
    description: 'Operação realizada com sucesso',
    icon: CheckCircle2,
  },
  sucesso: {
    label: 'Sucesso',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
    description: 'Operação realizada com sucesso',
    icon: CheckCircle2,
  },
  error: {
    label: 'Erro',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
    description: 'Ocorreu um erro durante a operação',
    icon: AlertCircle,
    critical: true,
  },
  erro: {
    label: 'Erro',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
    description: 'Ocorreu um erro durante a operação',
    icon: AlertCircle,
    critical: true,
  },
  failed: {
    label: 'Falhou',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
    description: 'A operação falhou e não foi concluída',
    icon: XCircle,
    critical: true,
  },
  warning: {
    label: 'Aviso',
    variant: 'default',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
    description: 'Situação que requer atenção mas não é crítica',
    icon: AlertTriangle,
  },
  aviso: {
    label: 'Aviso',
    variant: 'default',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
    description: 'Situação que requer atenção mas não é crítica',
    icon: AlertTriangle,
  },
};

export function StatusBadge({ status, className, showIcon = true, showTooltip = true }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const config = statusConfig[normalizedStatus] || statusConfig.unknown;
  const Icon = config.icon;

  const badge = (
    <Badge 
      variant={config.variant as any}
      className={cn(
        'font-semibold px-3 py-1 transition-all duration-300 ease-in-out',
        'hover:scale-105 hover:shadow-sm',
        config.className,
        config.critical && 'animate-pulse',
        className
      )}
    >
      <span className="flex items-center gap-1.5">
        {showIcon && Icon && (
          <Icon className={cn(
            'h-3.5 w-3.5',
            config.critical && 'animate-pulse',
            normalizedStatus === 'processando' || normalizedStatus === 'processing' ? 'animate-spin' : ''
          )} />
        )}
        {config.label}
      </span>
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs text-sm"
        >
          <p className="font-semibold mb-1">{config.label}</p>
          <p className="text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function getStatusVariant(status: string): string {
  const normalizedStatus = status.toLowerCase();
  return statusConfig[normalizedStatus]?.className || statusConfig.unknown.className;
}

export function getStatusLabel(status: string): string {
  const normalizedStatus = status.toLowerCase();
  return statusConfig[normalizedStatus]?.label || statusConfig.unknown.label;
}
