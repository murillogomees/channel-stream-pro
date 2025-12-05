import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DollarSign, HardDrive, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import { StorageCosts } from '@/hooks/useStorageConsolidatedReport';

interface StorageCostEstimatorProps {
  costs?: StorageCosts;
  isLoading: boolean;
  alertThreshold?: number;
}

export function StorageCostEstimator({ costs, isLoading, alertThreshold = 100 }: StorageCostEstimatorProps) {
  const totalCost = costs?.total_monthly || 0;
  const progressPercent = Math.min((totalCost / alertThreshold) * 100, 100);
  const isOverBudget = totalCost > alertThreshold;

  const costItems = [
    { 
      label: 'R2 Storage', 
      value: costs?.r2_storage || 0, 
      icon: HardDrive, 
      color: 'text-orange-500',
      description: '$0.015/GB/mês'
    },
    { 
      label: 'R2 Operations', 
      value: costs?.r2_operations || 0, 
      icon: HardDrive, 
      color: 'text-orange-400',
      description: '$0.36/milhão GET'
    },
    { 
      label: 'CF Encoding', 
      value: costs?.cf_encoding || 0, 
      icon: Zap, 
      color: 'text-blue-500',
      description: '$0.01/min codificado'
    },
    { 
      label: 'CF Storage', 
      value: costs?.cf_storage || 0, 
      icon: Zap, 
      color: 'text-blue-400',
      description: '$0.005/min/mês'
    },
    { 
      label: 'CF Delivery', 
      value: costs?.cf_delivery || 0, 
      icon: TrendingUp, 
      color: 'text-green-500',
      description: '$1/1000 min assistidos'
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-500" />
          Estimativa de Custos
        </CardTitle>
        <CardDescription>
          Baseado na precificação Cloudflare R2 + Stream
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress to threshold */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Uso do orçamento mensal</span>
            <span className={isOverBudget ? 'text-destructive font-medium' : ''}>
              ${totalCost.toFixed(2)} / ${alertThreshold}
            </span>
          </div>
          <Progress 
            value={progressPercent} 
            className={isOverBudget ? '[&>div]:bg-destructive' : ''} 
          />
          {isOverBudget && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              Orçamento excedido em ${(totalCost - alertThreshold).toFixed(2)}
            </div>
          )}
        </div>

        {/* Cost breakdown */}
        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : (
            costItems.map((item) => (
              <div 
                key={item.label} 
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono">
                  ${item.value.toFixed(2)}
                </Badge>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div className="pt-3 border-t space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Total Mensal</span>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <Badge className="text-lg font-bold bg-green-500/20 text-green-600 border-green-500/30">
                ${totalCost.toFixed(2)}
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Projeção Anual</span>
            {isLoading ? (
              <Skeleton className="h-4 w-12" />
            ) : (
              <span>${costs?.projected_annual.toFixed(0) || 0}</span>
            )}
          </div>
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground pt-2">
          💡 R2 não cobra egress (download). Custos reais podem variar com uso.
        </p>
      </CardContent>
    </Card>
  );
}
