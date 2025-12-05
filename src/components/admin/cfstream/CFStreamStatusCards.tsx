/**
 * CFStreamStatusCards - Cards de status dos uploads CF Stream
 */

import { Card, CardContent } from "@/components/ui/card";
import { Cloud, CheckCircle, Clock, AlertTriangle, Loader2, RefreshCw } from "lucide-react";

interface StatusCounts {
  queued: number;
  downloading: number;
  processing: number;
  ready: number;
  failed: number;
  error: number;
  needs_r2_fallback: number;
  retry_scheduled: number;
}

interface CFStreamStatusCardsProps {
  counts: StatusCounts;
  isLoading?: boolean;
}

export function CFStreamStatusCards({ counts, isLoading }: CFStreamStatusCardsProps) {
  // Combine error statuses for display
  const totalFailed = (counts.failed || 0) + (counts.error || 0);
  const totalR2Fallback = counts.needs_r2_fallback || 0;

  const cards = [
    {
      label: "Na Fila",
      value: counts.queued,
      icon: Clock,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Baixando",
      value: counts.downloading,
      icon: Cloud,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      label: "Processando",
      value: counts.processing,
      icon: Loader2,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      animate: true,
    },
    {
      label: "Prontos",
      value: counts.ready,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "R2 Fallback",
      value: totalR2Fallback,
      icon: Cloud,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Retry Agendado",
      value: counts.retry_scheduled,
      icon: RefreshCw,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "Falhou",
      value: totalFailed,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  const total = counts.queued + counts.downloading + counts.processing + counts.ready + 
    totalFailed + totalR2Fallback + counts.retry_scheduled;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon 
                  className={`h-4 w-4 ${card.color} ${card.animate ? 'animate-spin' : ''}`} 
                />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {isLoading ? "-" : card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {/* Total Card */}
      <Card className="border-border/50 col-span-2 sm:col-span-4 lg:col-span-7 bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Cloud className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Uploads</p>
                <p className="text-3xl font-bold">{isLoading ? "-" : total}</p>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="hidden sm:flex items-center gap-4 flex-1 max-w-md ml-8">
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden flex">
                {total > 0 && (
                  <>
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${(counts.ready / total) * 100}%` }}
                      title={`Prontos: ${counts.ready}`}
                    />
                    <div 
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${(totalR2Fallback / total) * 100}%` }}
                      title={`R2 Fallback: ${totalR2Fallback}`}
                    />
                    <div 
                      className="h-full bg-yellow-500 transition-all"
                      style={{ width: `${(counts.processing / total) * 100}%` }}
                      title={`Processando: ${counts.processing}`}
                    />
                    <div 
                      className="h-full bg-cyan-500 transition-all"
                      style={{ width: `${(counts.downloading / total) * 100}%` }}
                      title={`Baixando: ${counts.downloading}`}
                    />
                    <div 
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(counts.queued / total) * 100}%` }}
                      title={`Na Fila: ${counts.queued}`}
                    />
                    <div 
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${(counts.retry_scheduled / total) * 100}%` }}
                      title={`Retry: ${counts.retry_scheduled}`}
                    />
                    <div 
                      className="h-full bg-red-500 transition-all"
                      style={{ width: `${(totalFailed / total) * 100}%` }}
                      title={`Falhou: ${totalFailed}`}
                    />
                  </>
                )}
              </div>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {total > 0 ? `${Math.round((counts.ready / total) * 100)}% completo` : '0%'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
