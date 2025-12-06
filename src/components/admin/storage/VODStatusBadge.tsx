import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HardDrive, Cloud, Zap, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VODStorageStatus = 'none' | 'r2_only' | 'r2_cf' | 'cf_only' | 'syncing' | 'error';

interface VODStatusBadgeProps {
  status: VODStorageStatus;
  r2Url?: string | null;
  cfStreamUid?: string | null;
  cfStatus?: string | null;
  className?: string;
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<VODStorageStatus, {
  label: string;
  description: string;
  icon: React.ReactNode;
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  colors: string;
}> = {
  none: {
    label: 'Não Hospedado',
    description: 'VOD ainda não foi enviado para nenhum storage',
    icon: <AlertCircle className="h-3 w-3" />,
    variant: 'secondary',
    colors: 'bg-muted text-muted-foreground'
  },
  r2_only: {
    label: 'R2',
    description: 'Armazenado apenas no Cloudflare R2',
    icon: <HardDrive className="h-3 w-3" />,
    variant: 'outline',
    colors: 'bg-orange-500/10 text-orange-500 border-orange-500/30'
  },
  r2_cf: {
    label: 'R2 + CF',
    description: 'Armazenado no R2 e disponível no CF Stream',
    icon: <CheckCircle2 className="h-3 w-3" />,
    variant: 'default',
    colors: 'bg-green-500/10 text-green-500 border-green-500/30'
  },
  cf_only: {
    label: 'CF Stream',
    description: 'Disponível apenas no Cloudflare Stream',
    icon: <Zap className="h-3 w-3" />,
    variant: 'outline',
    colors: 'bg-blue-500/10 text-blue-500 border-blue-500/30'
  },
  syncing: {
    label: 'Sincronizando',
    description: 'Sincronização R2 → CF Stream em andamento',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    variant: 'outline',
    colors: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
  },
  error: {
    label: 'Erro',
    description: 'Falha na sincronização ou upload',
    icon: <AlertCircle className="h-3 w-3" />,
    variant: 'destructive',
    colors: 'bg-destructive/10 text-destructive border-destructive/30'
  }
};

export function getVODStorageStatus(
  r2Uploaded: boolean | null,
  r2Url: string | null | undefined,
  cfStreamUid: string | null | undefined,
  cfStatus: string | null | undefined
): VODStorageStatus {
  const hasR2 = r2Uploaded || !!r2Url;
  const hasCF = !!cfStreamUid && cfStatus === 'ready';
  const cfSyncing = !!cfStreamUid && cfStatus && !['ready', 'error'].includes(cfStatus);
  const cfError = cfStatus === 'error';

  if (cfError) return 'error';
  if (cfSyncing) return 'syncing';
  if (hasR2 && hasCF) return 'r2_cf';
  if (hasR2) return 'r2_only';
  if (hasCF) return 'cf_only';
  return 'none';
}

export function VODStatusBadge({ 
  status, 
  r2Url, 
  cfStreamUid, 
  cfStatus,
  className,
  showLabel = true 
}: VODStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Badge 
              variant={config.variant}
              className={cn(
                'gap-1 cursor-help',
                config.colors,
                className
              )}
            >
              {config.icon}
              {showLabel && <span>{config.label}</span>}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {r2Url && (
              <p className="text-xs truncate max-w-[200px]">
                R2: {r2Url.split('/').pop()}
              </p>
            )}
            {cfStreamUid && (
              <p className="text-xs">
                CF: {cfStreamUid.slice(0, 8)}... ({cfStatus || 'unknown'})
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Componente compacto para usar em listas
export function VODStatusIndicator({ 
  r2Uploaded, 
  r2Url, 
  cfStreamUid, 
  cfStatus 
}: {
  r2Uploaded?: boolean | null;
  r2Url?: string | null;
  cfStreamUid?: string | null;
  cfStatus?: string | null;
}) {
  const status = getVODStorageStatus(r2Uploaded, r2Url, cfStreamUid, cfStatus);
  
  return (
    <VODStatusBadge 
      status={status} 
      r2Url={r2Url} 
      cfStreamUid={cfStreamUid}
      cfStatus={cfStatus}
    />
  );
}
