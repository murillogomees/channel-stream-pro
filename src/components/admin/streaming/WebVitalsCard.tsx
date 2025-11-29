/**
 * ============================================================================
 * WebVitalsCard - Web Vitals Dashboard Card
 * ============================================================================
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Layout, MousePointer, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebVitals } from '@/hooks/useWebVitals';

export function WebVitalsCard() {
  const { 
    metrics, 
    score, 
    formatValue, 
    getRatingColor,
    getScoreColor,
  } = useWebVitals();

  const metricConfigs = [
    {
      key: 'LCP',
      name: 'Largest Contentful Paint',
      description: 'Tempo até o maior elemento visível',
      icon: Layout,
      target: '< 2.5s',
    },
    {
      key: 'FID',
      name: 'First Input Delay',
      description: 'Tempo de resposta à primeira interação',
      icon: MousePointer,
      target: '< 100ms',
    },
    {
      key: 'CLS',
      name: 'Cumulative Layout Shift',
      description: 'Estabilidade visual da página',
      icon: Activity,
      target: '< 0.1',
    },
    {
      key: 'FCP',
      name: 'First Contentful Paint',
      description: 'Tempo até primeiro conteúdo visível',
      icon: Zap,
      target: '< 1.8s',
    },
    {
      key: 'TTFB',
      name: 'Time to First Byte',
      description: 'Tempo de resposta do servidor',
      icon: Clock,
      target: '< 800ms',
    },
  ];

  const getRatingBadge = (rating?: string) => {
    if (!rating) return null;
    
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      'good': { label: 'Bom', variant: 'default' },
      'needs-improvement': { label: 'Precisa melhorar', variant: 'secondary' },
      'poor': { label: 'Ruim', variant: 'destructive' },
    };
    
    const config = variants[rating] || variants['poor'];
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Core Web Vitals
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Score:</span>
            <span className={cn('text-2xl font-bold', getScoreColor(score))}>
              {score}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metricConfigs.map((config) => {
            const metric = metrics[config.key as keyof typeof metrics];
            const Icon = config.icon;

            return (
              <div 
                key={config.key}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.key}</span>
                      {metric && getRatingBadge(metric.rating)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {config.description}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {metric ? (
                    <span className={cn('text-lg font-mono', getRatingColor(metric.rating))}>
                      {formatValue(config.key as any, metric.value)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Meta: {config.target}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tips */}
        <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <h4 className="text-sm font-medium text-blue-400 mb-2">💡 Dicas de Otimização</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            {metrics.LCP && metrics.LCP.rating !== 'good' && (
              <li>• LCP: Otimize imagens e use preload para recursos críticos</li>
            )}
            {metrics.CLS && metrics.CLS.rating !== 'good' && (
              <li>• CLS: Defina dimensões para imagens e evite inserções dinâmicas</li>
            )}
            {metrics.FID && metrics.FID.rating !== 'good' && (
              <li>• FID: Reduza JavaScript e divida tarefas longas</li>
            )}
            {metrics.TTFB && metrics.TTFB.rating !== 'good' && (
              <li>• TTFB: Use CDN e otimize queries do backend</li>
            )}
            {Object.values(metrics).every(m => m?.rating === 'good') && (
              <li>✅ Todas as métricas estão ótimas! Continue monitorando.</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default WebVitalsCard;
