/**
 * AdminShell - Layout padrão para todas as páginas admin
 * Inclui sidebar global + header com search
 * Responsivo: Mobile | Tablet | Desktop | TV
 */

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { GlobalSearch } from "./GlobalSearch";

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
  className,
  maxWidth = "2xl",
  tvOptimized = true,
}: AdminShellProps) {
  return (
    <div className="dark">
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background text-foreground">
          <AdminSidebar />
          <SidebarInset className="flex-1 flex flex-col">
            {/* Compact header */}
            <header className="border-b border-border bg-card/80 sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
              <div className="flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3">
                <SidebarTrigger className="h-8 w-8 flex-shrink-0" />
                <GlobalSearch />
              </div>
            </header>

            <main className={cn(
              "mx-auto w-full flex-1",
              "px-3 sm:px-4 md:px-6 lg:px-8 xl:px-8",
              tvOptimized && "2xl:px-10 3xl:px-12",
              "py-4 sm:py-5 md:py-6 lg:py-6",
              tvOptimized && "2xl:py-8 3xl:py-10",
              maxWidthClasses[maxWidth],
              className
            )}>
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

export default AdminShell;
