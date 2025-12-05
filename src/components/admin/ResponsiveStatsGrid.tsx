/**
 * ResponsiveStatsGrid - Grid de estatísticas responsivo
 * Adapta colunas automaticamente para mobile, tablet, desktop e TV
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
  columns?: 2 | 3 | 4 | 5 | 6;
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

// Grid responsivo com suporte a TV
const gridClasses = {
  2: "grid-cols-1 sm:grid-cols-2 2xl:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5",
  5: "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-6",
  6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 3xl:grid-cols-8",
};

export function ResponsiveStatsGrid({ 
  stats, 
  columns = 4,
  className,
  loading,
}: ResponsiveStatsGridProps) {
  if (loading) {
    return (
      <div className={cn(
        "grid gap-3 sm:gap-4 md:gap-4 lg:gap-5 2xl:gap-6 3xl:gap-8",
        gridClasses[columns],
        className
      )}>
        {Array.from({ length: columns }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 sm:p-5 md:p-6 2xl:p-7 3xl:p-8">
              <div className="flex items-center gap-3 sm:gap-4 2xl:gap-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 2xl:w-14 2xl:h-14 3xl:w-16 3xl:h-16 bg-muted rounded-lg" />
                <div className="flex-1 space-y-2 2xl:space-y-3">
                  <div className="h-3 sm:h-4 2xl:h-5 bg-muted rounded w-1/2" />
                  <div className="h-5 sm:h-6 2xl:h-8 bg-muted rounded w-1/3" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      "grid gap-3 sm:gap-4 md:gap-4 lg:gap-5 2xl:gap-6 3xl:gap-8",
      gridClasses[columns],
      className
    )}>
      {stats.map((stat, idx) => (
        <Card 
          key={idx} 
          className="transition-shadow hover:shadow-md 2xl:hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary 2xl:focus:ring-4"
          tabIndex={0}
        >
          <CardContent className="p-3 sm:p-4 md:p-5 lg:p-6 2xl:p-7 3xl:p-8">
            <div className="flex items-center gap-3 sm:gap-4 2xl:gap-5 3xl:gap-6">
              {stat.icon && (
                <div className={cn(
                  "p-2 sm:p-3 2xl:p-4 3xl:p-5 rounded-lg flex-shrink-0 transition-transform hover:scale-105",
                  variantClasses[stat.variant || "default"]
                )}>
                  <div className="h-4 w-4 sm:h-5 sm:w-5 2xl:h-6 2xl:w-6 3xl:h-8 3xl:w-8 [&>svg]:w-full [&>svg]:h-full">
                    {stat.icon}
                  </div>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm 2xl:text-base 3xl:text-lg text-muted-foreground truncate">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-2 2xl:gap-3">
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-2xl 2xl:text-3xl 3xl:text-4xl font-bold truncate">
                    {stat.value}
                  </p>
                  {stat.trend && (
                    <span className={cn(
                      "text-xs sm:text-sm 2xl:text-base font-medium",
                      stat.trend.isPositive ? "text-green-500" : "text-red-500"
                    )}>
                      {stat.trend.isPositive ? "+" : ""}{stat.trend.value}%
                    </span>
                  )}
                </div>
                {stat.description && (
                  <p className="text-xs 2xl:text-sm 3xl:text-base text-muted-foreground mt-0.5 2xl:mt-1 hidden sm:block">
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
