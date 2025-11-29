/**
 * AdminLayout - Layout responsivo para páginas administrativas
 * Padrão UI/UX consistente para mobile e desktop
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  className?: string;
  /** Largura máxima do container (default: max-w-7xl) */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "7xl" | "full";
  /** Padding interno (default: true) */
  padded?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

export function AdminLayout({ 
  children, 
  className,
  maxWidth = "7xl",
  padded = true,
}: AdminLayoutProps) {
  return (
    <div 
      className={cn(
        "min-h-screen bg-background",
        padded && "p-3 sm:p-4 md:p-6 lg:p-8",
        className
      )}
    >
      <div className={cn(
        "mx-auto w-full",
        maxWidthClasses[maxWidth],
        "space-y-4 sm:space-y-6"
      )}>
        {children}
      </div>
    </div>
  );
}

export default AdminLayout;
