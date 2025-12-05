/**
 * BuildStatsOverview - Estatísticas gerais do sistema de builds
 */

import { Card, CardContent } from "@/components/ui/card";
import { 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Rocket,
  Tv,
  Globe,
  Monitor
} from "lucide-react";

export function BuildStatsOverview() {
  const stats = [
    { 
      label: 'Plataformas', 
      value: '8', 
      icon: Smartphone, 
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    { 
      label: 'Builds Hoje', 
      value: '12', 
      icon: Rocket, 
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    },
    { 
      label: 'Sucesso', 
      value: '95%', 
      icon: CheckCircle2, 
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    },
    { 
      label: 'Tempo Médio', 
      value: '4m 32s', 
      icon: Clock, 
      color: 'text-orange-500',
      bg: 'bg-orange-500/10'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-lg sm:text-2xl font-bold">{stat.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
