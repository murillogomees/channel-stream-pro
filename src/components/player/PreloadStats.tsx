/**
 * ============================================================================
 * PreloadStats - Debug/Stats display for preloading
 * ============================================================================
 */

import { cn } from "@/lib/utils";
import { Database, Zap, CheckCircle, XCircle } from "lucide-react";

interface PreloadStatsProps {
  preloaded: number;
  cacheHits: number;
  cacheMisses: number;
  cacheSize: number;
  isPreloading: boolean;
  className?: string;
}

export function PreloadStats({
  preloaded,
  cacheHits,
  cacheMisses,
  cacheSize,
  isPreloading,
  className,
}: PreloadStatsProps) {
  const hitRate = cacheHits + cacheMisses > 0 
    ? Math.round((cacheHits / (cacheHits + cacheMisses)) * 100) 
    : 0;

  return (
    <div
      className={cn(
        "bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg p-3 text-xs font-mono",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2 text-foreground/80">
        <Database className="w-4 h-4" />
        <span className="font-semibold">Preload Stats</span>
        {isPreloading && (
          <span className="ml-auto flex items-center gap-1 text-yellow-500">
            <Zap className="w-3 h-3 animate-pulse" />
            Loading
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cache:</span>
          <span className="text-foreground">{cacheSize}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Preloaded:</span>
          <span className="text-green-500">{preloaded}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" /> Hits:
          </span>
          <span className="text-green-500">{cacheHits}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-500" /> Misses:
          </span>
          <span className="text-red-500">{cacheMisses}</span>
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-border/50">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Hit Rate:</span>
          <span className={cn(
            "font-bold",
            hitRate >= 70 ? "text-green-500" : 
            hitRate >= 40 ? "text-yellow-500" : "text-red-500"
          )}>
            {hitRate}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default PreloadStats;
