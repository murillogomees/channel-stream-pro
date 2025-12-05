/**
 * AdminLayout - Layout responsivo para páginas administrativas
 * Padrão UI/UX consistente para mobile, tablet, desktop e TV
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  className?: string;
  /** Largura máxima do container */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /** Padding interno (default: true) */
  padded?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

export function AdminLayout({ 
  children, 
  className,
  maxWidth = "2xl",
  padded = true,
}: AdminLayoutProps) {
  return (
    <div 
      className={cn(
        "min-h-screen bg-background",
        // Padding responsivo incluindo TV
        padded && "p-3 sm:p-4 md:p-6 lg:p-8 2xl:p-10 3xl:p-12",
        className
      )}
    >
      <div className={cn(
        "mx-auto w-full",
        maxWidthClasses[maxWidth],
        // Espaçamento vertical responsivo
        "space-y-4 sm:space-y-5 md:space-y-6 lg:space-y-6 2xl:space-y-8 3xl:space-y-10"
      )}>
        {children}
      </div>
    </div>
  );
}

export default AdminLayout;
