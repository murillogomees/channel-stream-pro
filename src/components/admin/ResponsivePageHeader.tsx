/**
 * ResponsivePageHeader - Header responsivo para páginas admin
 * Adapta ações para mobile com menu dropdown
 */

import { Button } from "@/components/ui/button";
import { ArrowLeft, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReactNode } from "react";

interface ActionItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  primary?: boolean;
}

interface ResponsivePageHeaderProps {
  title: string;
  description?: string;
  backTo?: string;
  /** Ações principais (botões no desktop, menu no mobile) */
  actions?: ActionItem[];
  /** Conteúdo customizado para área de ações */
  customActions?: ReactNode;
  /** Badges ou indicadores ao lado do título */
  badge?: ReactNode;
}

export function ResponsivePageHeader({ 
  title, 
  description, 
  backTo = "/admin/dashboard",
  actions,
  customActions,
  badge,
}: ResponsivePageHeaderProps) {
  const navigate = useNavigate();

  const primaryActions = actions?.filter(a => a.primary) || [];
  const secondaryActions = actions?.filter(a => !a.primary) || [];

  return (
    <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
      {/* Top row: Back + Title + Actions */}
      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(backTo)}
          className="hover:bg-primary/10 flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {/* Title area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold truncate">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>

        {/* Desktop actions */}
        {actions && actions.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            {actions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || (action.primary ? "default" : "outline")}
                size="sm"
                onClick={action.onClick}
                className="whitespace-nowrap"
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Mobile actions - Primary as button, rest in dropdown */}
        {actions && actions.length > 0 && (
          <div className="flex sm:hidden items-center gap-2 flex-shrink-0">
            {/* Show first primary action as button */}
            {primaryActions.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={primaryActions[0].onClick}
                className="h-9"
              >
                {primaryActions[0].icon}
                <span className="ml-1.5 hidden xs:inline">{primaryActions[0].label}</span>
              </Button>
            )}

            {/* Dropdown for other actions */}
            {(secondaryActions.length > 0 || primaryActions.length > 1) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {primaryActions.slice(1).map((action, idx) => (
                    <DropdownMenuItem key={`primary-${idx}`} onClick={action.onClick}>
                      {action.icon && <span className="mr-2">{action.icon}</span>}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                  {secondaryActions.map((action, idx) => (
                    <DropdownMenuItem 
                      key={`secondary-${idx}`} 
                      onClick={action.onClick}
                      className={action.variant === "destructive" ? "text-destructive" : ""}
                    >
                      {action.icon && <span className="mr-2">{action.icon}</span>}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {/* Custom actions */}
        {customActions}
      </div>
    </div>
  );
}

export default ResponsivePageHeader;
