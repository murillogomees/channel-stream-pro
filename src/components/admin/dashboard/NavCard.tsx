/**
 * NavCard - Card de navegação para o dashboard
 * Com hierarquia visual e estados de hover
 */

import { memo, useCallback, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowRight } from "lucide-react";

type NavCardVariant = "default" | "primary" | "accent" | "success" | "warning" | "info";

interface NavCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  path: string;
  badge?: string;
  isNew?: boolean;
  isHighlighted?: boolean;
  variant?: NavCardVariant;
  className?: string;
}

const variantStyles: Record<NavCardVariant, { icon: string; iconHover: string; highlight: string }> = {
  default: {
    icon: "bg-primary/10 text-primary",
    iconHover: "group-hover:bg-primary group-hover:text-primary-foreground",
    highlight: "",
  },
  primary: {
    icon: "bg-primary text-primary-foreground",
    iconHover: "group-hover:shadow-glow",
    highlight: "ring-2 ring-primary/30 bg-primary/5",
  },
  accent: {
    icon: "bg-stat-purple/10 text-stat-purple",
    iconHover: "group-hover:bg-stat-purple group-hover:text-white",
    highlight: "",
  },
  success: {
    icon: "bg-stat-success/10 text-stat-success",
    iconHover: "group-hover:bg-stat-success group-hover:text-white",
    highlight: "",
  },
  warning: {
    icon: "bg-stat-warning/10 text-stat-warning",
    iconHover: "group-hover:bg-stat-warning group-hover:text-white",
    highlight: "",
  },
  info: {
    icon: "bg-stat-info/10 text-stat-info",
    iconHover: "group-hover:bg-stat-info group-hover:text-white",
    highlight: "",
  },
};

export const NavCard = memo(({
  title,
  description,
  icon,
  path,
  badge,
  isNew,
  isHighlighted,
  variant = "default",
  className,
}: NavCardProps) => {
  const navigate = useNavigate();
  const styles = variantStyles[isHighlighted ? "primary" : variant];

  const handleClick = useCallback(() => {
    navigate(path);
  }, [navigate, path]);

  return (
    <Card
      variant="action"
      className={cn(
        "relative overflow-hidden animate-scale-in",
        isHighlighted && styles.highlight,
        className
      )}
      onClick={handleClick}
    >
      {/* New badge */}
      {isNew && (
        <div className="absolute top-0 right-0 z-10">
          <div className="bg-gradient-to-r from-stat-success to-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            NOVO
          </div>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          {/* Icon */}
          <div
            className={cn(
              "p-3 rounded-xl transition-all duration-300 group-hover:scale-110",
              styles.icon,
              styles.iconHover
            )}
          >
            {icon}
          </div>

          {/* Badge */}
          {badge && !isNew && (
            <Badge variant="secondary" className="animate-fade-in text-xs">
              {badge}
            </Badge>
          )}
        </div>

        {/* Title & Description */}
        <div className="mt-4 space-y-1">
          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors flex items-center gap-2">
            {title}
            <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </CardTitle>
          <CardDescription className="text-sm line-clamp-2">{description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
});

NavCard.displayName = "NavCard";

export default NavCard;
