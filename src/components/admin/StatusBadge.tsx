import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusType = 
  | 'operational' | 'healthy' 
  | 'degraded' 
  | 'down' | 'critical' | 'offline'
  | 'unknown';

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
