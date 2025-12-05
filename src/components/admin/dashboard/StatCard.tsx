/**
 * StatCard - Card semântico para estatísticas do dashboard
 * Com hierarquia visual clara e cores semanticas
 */

import { memo, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export type StatVariant = "default" | "success" | "warning" | "danger" | "info" | "purple";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  variant?: StatVariant;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<StatVariant, { card: string; icon: string; value: string }> = {
  default: {
    card: "stat",
    icon: "bg-stat-primary/10 text-stat-primary",
    value: "text-foreground",
  },
  success: {
    card: "stat-success",
    icon: "bg-stat-success/10 text-stat-success",
    value: "text-stat-success",
  },
  warning: {
    card: "stat-warning",
    icon: "bg-stat-warning/10 text-stat-warning",
    value: "text-stat-warning",
  },
  danger: {
    card: "stat-danger",
    icon: "bg-stat-danger/10 text-stat-danger",
    value: "text-stat-danger",
  },
  info: {
    card: "stat-info",
    icon: "bg-stat-info/10 text-stat-info",
    value: "text-stat-info",
  },
  purple: {
    card: "stat-purple",
    icon: "bg-stat-purple/10 text-stat-purple",
    value: "text-stat-purple",
  },
};

const trendStyles = {
  up: { icon: TrendingUp, color: "text-stat-success" },
  down: { icon: TrendingDown, color: "text-stat-danger" },
  neutral: { icon: Minus, color: "text-muted-foreground" },
};

export const StatCard = memo(({
  icon,
  label,
  value,
  variant = "default",
  trend,
  subtitle,
  className,
  onClick,
}: StatCardProps) => {
  const styles = variantStyles[variant];
  const TrendIcon = trend ? trendStyles[trend.direction].icon : null;

  return (
    <Card
      variant={styles.card as any}
      className={cn(
        "animate-fade-in overflow-hidden",
        onClick && "cursor-pointer hover:shadow-elevation-3 hover:-translate-y-0.5 transition-all",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Icon */}
          <div
            className={cn(
              "p-3 rounded-xl transition-transform duration-300 hover:scale-110",
              styles.icon
            )}
          >
            {icon}
          </div>

          {/* Trend indicator */}
          {trend && TrendIcon && (
            <div className={cn("flex items-center gap-1 text-xs font-medium", trendStyles[trend.direction].color)}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span>{trend.value > 0 ? `+${trend.value}%` : `${trend.value}%`}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="mt-4 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={cn("text-3xl font-bold tracking-tight", styles.value)}>
            {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend?.label && (
            <p className="text-xs text-muted-foreground mt-1">{trend.label}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

StatCard.displayName = "StatCard";

export default StatCard;
