/**
 * IntegrationCard - Card semântico para seções de integração
 * Variantes coloridas por tipo de integração com hierarquia visual clara
 */

import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type IntegrationVariant = 
  | "payment" 
  | "messaging" 
  | "cdn" 
  | "transcode" 
  | "cache" 
  | "qa"
  | "default";

interface IntegrationCardProps {
  children: ReactNode;
  variant?: IntegrationVariant;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  badge?: string;
  badgeVariant?: "default" | "success" | "warning" | "danger";
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

const variantStyles: Record<IntegrationVariant, {
  border: string;
  iconBg: string;
  iconColor: string;
  accentBar: string;
}> = {
  payment: {
    border: "border-integration-payment/30 hover:border-integration-payment/50",
    iconBg: "bg-integration-payment-bg",
    iconColor: "text-integration-payment",
    accentBar: "bg-integration-payment"
  },
  messaging: {
    border: "border-integration-messaging/30 hover:border-integration-messaging/50",
    iconBg: "bg-integration-messaging-bg",
    iconColor: "text-integration-messaging",
    accentBar: "bg-integration-messaging"
  },
  cdn: {
    border: "border-integration-cdn/30 hover:border-integration-cdn/50",
    iconBg: "bg-integration-cdn-bg",
    iconColor: "text-integration-cdn",
    accentBar: "bg-integration-cdn"
  },
  transcode: {
    border: "border-integration-transcode/30 hover:border-integration-transcode/50",
    iconBg: "bg-integration-transcode-bg",
    iconColor: "text-integration-transcode",
    accentBar: "bg-integration-transcode"
  },
  cache: {
    border: "border-integration-cache/30 hover:border-integration-cache/50",
    iconBg: "bg-integration-cache-bg",
    iconColor: "text-integration-cache",
    accentBar: "bg-integration-cache"
  },
  qa: {
    border: "border-integration-qa/30 hover:border-integration-qa/50",
    iconBg: "bg-integration-qa-bg",
    iconColor: "text-integration-qa",
    accentBar: "bg-integration-qa"
  },
  default: {
    border: "border-border hover:border-primary/50",
    iconBg: "bg-muted",
    iconColor: "text-foreground",
    accentBar: "bg-primary"
  }
};

const badgeStyles: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/20 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-destructive/20 text-destructive"
};

export const IntegrationCard = forwardRef<HTMLElement, IntegrationCardProps>(({
  children,
  variant = "default",
  icon: Icon,
  title,
  description,
  badge,
  badgeVariant = "default",
  className,
  onClick,
  interactive = false
}, ref) => {
  const styles = variantStyles[variant];
  
  return (
    <article
      ref={ref}
      role="region"
      aria-label={title}
      data-card-type={variant}
      onClick={onClick}
      className={cn(
        // Base styles
        "relative overflow-hidden rounded-xl border bg-card",
        "shadow-elevation-1 transition-all duration-200",
        // Variant border
        styles.border,
        // Interactive styles
        interactive && "cursor-pointer hover:shadow-elevation-2 hover:-translate-y-0.5",
        onClick && "cursor-pointer",
        // Focus styles for accessibility
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      tabIndex={interactive || onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Accent bar at top */}
      <div className={cn("absolute top-0 left-0 right-0 h-1", styles.accentBar)} />
      
      {/* Card content */}
      <div className="p-4 sm:p-5 pt-5 sm:pt-6">
        {/* Header with icon, title, badge */}
        {(Icon || title || badge) && (
          <header className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div className={cn(
                  "flex-shrink-0 rounded-lg p-2.5",
                  styles.iconBg
                )}>
                  <Icon className={cn("h-5 w-5", styles.iconColor)} />
                </div>
              )}
              {title && (
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {description}
                    </p>
                  )}
                </div>
              )}
            </div>
            {badge && (
              <span className={cn(
                "flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full",
                badgeStyles[badgeVariant]
              )}>
                {badge}
              </span>
            )}
          </header>
        )}
        
        {/* Body content */}
        <div className="text-sm">
          {children}
        </div>
      </div>
    </article>
  );
});

IntegrationCard.displayName = "IntegrationCard";

export default IntegrationCard;
