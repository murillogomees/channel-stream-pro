/**
 * AdminShell - Layout padrão para todas as páginas admin
 * Design consistente com header, search e navegação
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminHeader } from "./AdminHeader";

interface AdminShellProps {
  children: ReactNode;
  title: string;
  description?: string;
  backTo?: string;
  className?: string;
  /** Largura máxima do container (default: max-w-7xl) */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "7xl" | "full";
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

export function AdminShell({ 
  children, 
  title,
  description,
  backTo = "/admin/dashboard",
  className,
  maxWidth = "7xl",
}: AdminShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader 
        title={title}
        description={description}
        backTo={backTo}
      />
      
      <main className={cn(
        "container mx-auto px-3 sm:px-6 py-4 sm:py-6",
        maxWidthClasses[maxWidth],
        className
      )}>
        {children}
      </main>
    </div>
  );
}

export default AdminShell;
