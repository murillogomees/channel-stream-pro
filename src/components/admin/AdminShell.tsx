/**
 * AdminShell - Layout padrão para todas as páginas admin
 * Design consistente com header, search e navegação
 * Responsivo: Mobile | Tablet | Desktop | TV
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminHeader } from "./AdminHeader";

interface AdminShellProps {
  children: ReactNode;
  /** @deprecated Título removido do header */
  title?: string;
  /** @deprecated Descrição removida do header */
  description?: string;
  backTo?: string;
  className?: string;
  /** Largura máxima do container */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  /** Padding adicional para telas grandes */
  tvOptimized?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-screen-sm",
  md: "max-w-screen-md",
  lg: "max-w-screen-lg",
  xl: "max-w-screen-xl",
  "2xl": "max-w-screen-2xl",
  full: "max-w-full",
};

export function AdminShell({ 
  children, 
  backTo = "/admin/dashboard",
  className,
  maxWidth = "2xl",
  tvOptimized = true,
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader backTo={backTo} />
      
      <main className={cn(
        "mx-auto w-full",
        // Padding responsivo
        "px-3 sm:px-4 md:px-6 lg:px-8 xl:px-8",
        // Padding extra para TV
        tvOptimized && "2xl:px-10 3xl:px-12",
        // Padding vertical responsivo
        "py-4 sm:py-5 md:py-6 lg:py-6",
        tvOptimized && "2xl:py-8 3xl:py-10",
        // Max width
        maxWidthClasses[maxWidth],
        className
      )}>
        {children}
      </main>
    </div>
  );
}

export default AdminShell;
