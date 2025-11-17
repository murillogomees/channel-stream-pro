import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AdminAchievements } from "@/types/badge";
import { Trophy, Star, Award } from "lucide-react";

interface AdminBadgesProps {
  achievements: AdminAchievements;
  compact?: boolean;
}

export function AdminBadges({ achievements, compact = false }: AdminBadgesProps) {
  const { badges, score, rank, level, nextLevelProgress } = achievements;

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="gap-1">
          <Trophy className="h-3 w-3" />
          Nível {level}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Star className="h-3 w-3" />
          {score} pts
        </Badge>
        {badges.slice(0, 3).map((badge) => (
          <TooltipProvider key={badge.id}>
            <Tooltip>
              <TooltipTrigger>
                <Badge 
                  variant="outline"
                  className="cursor-help"
                  style={{ borderColor: badge.color }}
                >
                  {badge.icon}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <div className="font-semibold">{badge.name}</div>
                  <div className="text-xs text-muted-foreground">{badge.description}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        {badges.length > 3 && (
          <Badge variant="secondary">+{badges.length - 3}</Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Conquistas
        </CardTitle>
        <CardDescription>
          Badges e reconhecimento por performance excepcional
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score e Nível */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold">Nível {level}</span>
            </div>
            <Badge variant="default" className="gap-1">
              <Star className="h-3 w-3" />
              {score} pontos
            </Badge>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rank: {rank}</span>
              <span className="text-muted-foreground">
                {Math.round(nextLevelProgress)}% para nível {level + 1}
              </span>
            </div>
            <Progress value={nextLevelProgress} className="h-2" />
          </div>
        </div>

        {/* Badges Conquistados */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">
            Badges Conquistados ({badges.length})
          </h4>
          
          {badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Continue respondendo alertas para conquistar badges!
            </p>
          ) : (
            <div className="grid gap-2">
              {badges.map((badge) => (
                <TooltipProvider key={badge.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="flex items-center gap-3 p-2 rounded-lg border cursor-help hover:bg-accent/50 transition-colors"
                        style={{ borderColor: `${badge.color}20` }}
                      >
                        <div 
                          className="flex items-center justify-center w-10 h-10 rounded-full text-2xl"
                          style={{ backgroundColor: `${badge.color}15` }}
                        >
                          {badge.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{badge.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {badge.description}
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className="text-xs shrink-0"
                          style={{ borderColor: badge.color, color: badge.color }}
                        >
                          {badge.rarity}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <div className="font-semibold">{badge.name}</div>
                        <div className="text-xs">{badge.description}</div>
                        <div className="text-xs text-muted-foreground">
                          Requisito: {badge.requirement}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {badges.filter(b => b.rarity === 'legendary').length}
            </div>
            <div className="text-xs text-muted-foreground">Lendários</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">
              {badges.filter(b => b.rarity === 'epic').length}
            </div>
            <div className="text-xs text-muted-foreground">Épicos</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
