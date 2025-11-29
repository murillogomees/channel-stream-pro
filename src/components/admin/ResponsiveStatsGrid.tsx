/**
 * ResponsiveStatsGrid - Grid de estatísticas responsivo
 * Adapta colunas automaticamente para diferentes tamanhos de tela
 */

import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger" | "info";
  description?: string;
}

interface ResponsiveStatsGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  className?: string;
  loading?: boolean;
}

const variantClasses = {
  default: "bg-primary/10 text-primary",
  success: "bg-green-500/10 text-green-600 dark:text-green-400",
  warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const gridClasses = {
  2: "grid-cols-1 xs:grid-cols-2",
  3: "grid-cols-1 xs:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4",
};

export function ResponsiveStatsGrid({ 
  stats, 
  columns = 4,
  className,
  loading,
}: ResponsiveStatsGridProps) {
  if (loading) {
    return (
      <div className={cn("grid gap-3 sm:gap-4", gridClasses[columns], className)}>
        {Array.from({ length: columns }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 sm:h-4 bg-muted rounded w-1/2" />
                  <div className="h-5 sm:h-6 bg-muted rounded w-1/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3 sm:gap-4", gridClasses[columns], className)}>
      {stats.map((stat, idx) => (
        <Card key={idx} className="transition-shadow hover:shadow-md">
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              {stat.icon && (
                <div className={cn(
                  "p-2 sm:p-3 rounded-lg flex-shrink-0 transition-transform hover:scale-105",
                  variantClasses[stat.variant || "default"]
                )}>
                  <div className="h-4 w-4 sm:h-5 sm:w-5">
                    {stat.icon}
                  </div>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold truncate">
                    {stat.value}
                  </p>
                  {stat.trend && (
                    <span className={cn(
                      "text-xs font-medium",
                      stat.trend.isPositive ? "text-green-500" : "text-red-500"
                    )}>
                      {stat.trend.isPositive ? "+" : ""}{stat.trend.value}%
                    </span>
                  )}
                </div>
                {stat.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                    {stat.description}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default ResponsiveStatsGrid;
