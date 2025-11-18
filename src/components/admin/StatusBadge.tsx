import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
}

const statusConfig: Record<string, { label: string; variant: string; className: string }> = {
  operational: {
    label: 'Operacional',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  healthy: {
    label: 'Saudável',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  degraded: {
    label: 'Degradado',
    variant: 'default',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
  },
  down: {
    label: 'Inativo',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
  },
  critical: {
    label: 'Crítico',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
  },
  offline: {
    label: 'Offline',
    variant: 'default',
    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
  },
  unknown: {
    label: 'Desconhecido',
    variant: 'default',
    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
  },
  // Status de processamento
  pendente: {
    label: 'Pendente',
    variant: 'default',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
  },
  pending: {
    label: 'Pendente',
    variant: 'default',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
  },
  processando: {
    label: 'Processando',
    variant: 'default',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
  },
  processing: {
    label: 'Processando',
    variant: 'default',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
  },
  completo: {
    label: 'Completo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  complete: {
    label: 'Completo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  completed: {
    label: 'Completo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  // Status ativo/inativo
  active: {
    label: 'Ativo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  ativo: {
    label: 'Ativo',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  inactive: {
    label: 'Inativo',
    variant: 'default',
    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
  },
  inativo: {
    label: 'Inativo',
    variant: 'default',
    className: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20 hover:bg-gray-500/20',
  },
  // Status de sucesso/erro
  success: {
    label: 'Sucesso',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  sucesso: {
    label: 'Sucesso',
    variant: 'default',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  error: {
    label: 'Erro',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
  },
  erro: {
    label: 'Erro',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
  },
  failed: {
    label: 'Falhou',
    variant: 'default',
    className: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 hover:bg-red-500/20',
  },
  warning: {
    label: 'Aviso',
    variant: 'default',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
  },
  aviso: {
    label: 'Aviso',
    variant: 'default',
    className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const config = statusConfig[normalizedStatus] || statusConfig.unknown;

  return (
    <Badge 
      variant={config.variant as any}
      className={cn(
        'font-semibold px-3 py-1',
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
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
