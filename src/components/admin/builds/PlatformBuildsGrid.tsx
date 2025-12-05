/**
 * PlatformBuildsGrid - Grid de plataformas para build
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Square, 
  Download,
  Settings,
  Smartphone,
  Tablet,
  Monitor,
  Tv,
  Globe,
  Gamepad2,
  Rocket
} from "lucide-react";
import { useBuildSystem } from "./hooks/useBuildSystem";
import { 
  Platform, 
  PlatformName, 
  PLATFORM_LABELS, 
  BUILD_STATUS_COLORS 
} from "./types";
import { cn } from "@/lib/utils";

const PLATFORM_ICON_MAP: Record<PlatformName, React.ElementType> = {
  android: Smartphone,
  ios: Tablet,
  web: Globe,
  tizen: Tv,
  webos: Tv,
  roku: Tv,
  desktop: Monitor,
  console: Gamepad2
};

export function PlatformBuildsGrid() {
  const { 
    platforms, 
    jobs, 
    isRunning, 
    startBuild, 
    startAllBuilds, 
    cancelBuild 
  } = useBuildSystem();

  const getLatestJob = (platformName: PlatformName) => {
    return jobs
      .filter(j => j.platform === platformName)
      .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime())[0];
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={startAllBuilds} 
          disabled={isRunning}
          className="gap-2"
        >
          <Rocket className="h-4 w-4" />
          Build Todas Plataformas
        </Button>
      </div>

      {/* Platform Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {platforms.map((platform) => {
          const Icon = PLATFORM_ICON_MAP[platform.name];
          const latestJob = getLatestJob(platform.name);
          const isBuilding = latestJob && ['queued', 'building', 'testing', 'deploying'].includes(latestJob.status);

          return (
            <Card key={platform.name} className="border-border/50 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{PLATFORM_LABELS[platform.name]}</CardTitle>
                      <p className="text-xs text-muted-foreground capitalize">{platform.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    P{platform.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Status */}
                {latestJob && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge className={cn("text-xs", BUILD_STATUS_COLORS[latestJob.status])}>
                        {latestJob.status}
                      </Badge>
                      {isBuilding && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(latestJob.progress)}%
                        </span>
                      )}
                    </div>
                    {isBuilding && (
                      <Progress value={latestJob.progress} className="h-1" />
                    )}
                  </div>
                )}

                {/* Player Config Preview */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Buffer:</span>
                    <span className="ml-1 font-medium">{platform.playerConfig.buffer}s</span>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-muted-foreground">Retries:</span>
                    <span className="ml-1 font-medium">{platform.playerConfig.retries}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {isBuilding ? (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={() => cancelBuild(latestJob.id)}
                    >
                      <Square className="h-3 w-3" />
                      Cancelar
                    </Button>
                  ) : (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={() => startBuild(platform.name)}
                      disabled={isRunning}
                    >
                      <Play className="h-3 w-3" />
                      Build
                    </Button>
                  )}
                  {latestJob?.status === 'success' && (
                    <Button variant="outline" size="sm" className="gap-1">
                      <Download className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Developer Account */}
                {platform.developerAccount && (
                  <p className="text-xs text-muted-foreground truncate">
                    📦 {platform.developerAccount}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
