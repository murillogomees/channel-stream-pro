/**
 * ResponsiveContainer - Container responsivo para páginas
 * Adapta padding, max-width e espaçamento por breakpoint
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveContainerProps {
  children: ReactNode;
  /** Largura máxima do container */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /** Padding responsivo */
  padded?: boolean;
  /** Centralizar conteúdo */
  centered?: boolean;
  className?: string;
}

const maxWidthClasses = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

export function ResponsiveContainer({
  children,
  maxWidth = "2xl",
  padded = true,
  centered = true,
  className,
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        maxWidthClasses[maxWidth],
        centered && "mx-auto",
        padded && "px-3 sm:px-4 md:px-6 lg:px-8 2xl:px-10 3xl:px-12",
        className
      )}
    >
      {children}
    </div>
  );
}

export default ResponsiveContainer;
