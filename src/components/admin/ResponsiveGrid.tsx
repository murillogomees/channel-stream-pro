/**
 * ResponsiveGrid - Grid flexível para cards e conteúdo
 * Adapta automaticamente para diferentes tamanhos de tela incluindo TV
 * Breakpoints: xs (0-480) | sm (481-768) | md (769-1024) | lg (1025-1280) | xl (1281-1440) | 2xl (1441-1920) | 3xl (1921+)
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveGridProps {
  children: ReactNode;
  /** Número de colunas em telas grandes */
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Gap entre itens */
  gap?: "sm" | "md" | "lg";
  /** Auto-fit com minmax para grid fluido */
  autoFit?: boolean;
  /** Tamanho mínimo do item em auto-fit */
  minItemWidth?: string;
  className?: string;
}

// Colunas responsivas com suporte a TV
const columnClasses = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-4",
  4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5",
  5: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 3xl:grid-cols-6",
  6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8",
};

// Gap responsivo com suporte a TV
const gapClasses = {
  sm: "gap-2 sm:gap-2 md:gap-3 lg:gap-3 2xl:gap-4 3xl:gap-5",
  md: "gap-3 sm:gap-3 md:gap-4 lg:gap-4 2xl:gap-5 3xl:gap-6",
  lg: "gap-4 sm:gap-4 md:gap-5 lg:gap-6 2xl:gap-7 3xl:gap-8",
};

export function ResponsiveGrid({ 
  children, 
  columns = 3,
  gap = "md",
  autoFit = false,
  minItemWidth = "280px",
  className,
}: ResponsiveGridProps) {
  if (autoFit) {
    return (
      <div 
        className={cn(
          "grid",
          gapClasses[gap],
          className
        )}
        style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(min(${minItemWidth}, 100%), 1fr))`,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cn(
      "grid",
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  );
}

export default ResponsiveGrid;
