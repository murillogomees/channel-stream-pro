/**
 * SectionHeader - Header de seção do dashboard
 * Com ícone e badge opcional
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon: ReactNode;
  title: string;
  badge?: string;
  variant?: "default" | "primary" | "gradient";
  className?: string;
}

export function SectionHeader({
  icon,
  title,
  badge,
  variant = "default",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3 mb-5", className)}>
      {variant === "gradient" ? (
        <div className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/70 text-primary-foreground px-4 py-1.5 rounded-full">
          <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
      ) : variant === "primary" ? (
        <>
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {badge && (
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="[&>svg]:h-5 [&>svg]:w-5 text-primary">{icon}</span>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {badge && (
            <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default SectionHeader;
