import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AdminBadges } from "./AdminBadges";
import type { AdminPerformanceStats } from "@/services/securityAlertStatsService";
import type { AdminAchievements } from "@/types/badge";
import { Trophy, Clock, CheckCircle2, Target, TrendingUp } from "lucide-react";

interface AdminComparisonProps {
  admins: {
    stats: AdminPerformanceStats;
    achievements: AdminAchievements;
  }[];
}

export function AdminComparison({ admins }: AdminComparisonProps) {
  const formatTime = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    if (minutes < 1) return `${Math.round(minutes * 60)}s`;
    if (minutes < 60) return `${Math.round(minutes)}min`;
    return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}min`;
  };

  const getComparisonColor = (value: number, max: number, inverse: boolean = false) => {
    const percentage = (value / max) * 100;
    if (inverse) {
      if (percentage <= 33) return 'text-success';
      if (percentage <= 66) return 'text-warning';
      return 'text-destructive';
    }
    if (percentage >= 66) return 'text-success';
    if (percentage >= 33) return 'text-warning';
    return 'text-destructive';
  };

  if (admins.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Selecione admins para comparar
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {admins.map(({ stats, achievements }, index) => (
        <Card key={stats.admin_id} className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16" />
          
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{stats.admin_name}</CardTitle>
              <Badge variant="outline" className="text-lg">
                #{index + 1}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{stats.admin_phone}</p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Score e Level */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Score Total
                </span>
                <span className="text-2xl font-bold">{achievements.score}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Level {achievements.level}</span>
                <span className="text-muted-foreground">{achievements.rank}</span>
              </div>
              <Progress value={achievements.nextLevelProgress} className="h-2" />
            </div>

            {/* Métricas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  Total de Alertas
                </span>
                <span className="font-medium">{stats.total_alerts}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  Taxa de Confirmação
                </span>
                <Badge
                  variant={stats.confirmation_rate >= 85 ? "default" : "secondary"}
                  className={getComparisonColor(stats.confirmation_rate, 100)}
                >
                  {stats.confirmation_rate}%
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Tempo Médio
                </span>
                <span className="font-medium">
                  {formatTime(stats.avg_response_time_minutes)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Ações Tomadas
                </span>
                <span className="font-medium">{stats.alerts_with_action}</span>
              </div>
            </div>

            {/* Badges */}
            <div className="pt-4 border-t">
              <AdminBadges achievements={achievements} compact />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
