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
  retry_scheduled: number;
}

interface CFStreamStatusCardsProps {
  counts: StatusCounts;
  isLoading?: boolean;
}

export function CFStreamStatusCards({ counts, isLoading }: CFStreamStatusCardsProps) {
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
      label: "Retry Agendado",
      value: counts.retry_scheduled,
      icon: RefreshCw,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "Falhou",
      value: counts.failed,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
  ];

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
      <Card className="border-border/50 col-span-2 sm:col-span-3 lg:col-span-6 bg-muted/30">
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
                      style={{ width: `${(counts.failed / total) * 100}%` }}
                      title={`Falhou: ${counts.failed}`}
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
