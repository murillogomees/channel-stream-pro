/**
 * ResponsiveFilters - Filtros responsivos para listas
 * Desktop: Inline com os filtros visíveis
 * Mobile: Collapsible com contador de filtros ativos
 */

import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Filter, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ResponsiveFiltersProps {
  children: ReactNode;
  /** Número de filtros ativos */
  activeCount?: number;
  /** Callback para limpar filtros */
  onClear?: () => void;
  /** Texto do resultado da busca */
  resultText?: string;
  className?: string;
  /** Sempre expandido no desktop */
  alwaysExpanded?: boolean;
}

export function ResponsiveFilters({ 
  children,
  activeCount = 0,
  onClear,
  resultText,
  className,
  alwaysExpanded = true,
}: ResponsiveFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Mobile: Collapsible filters */}
      <div className={cn(alwaysExpanded && "md:hidden")}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="flex-1 justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Filtros</span>
                  {activeCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {activeCount}
                    </Badge>
                  )}
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            {activeCount > 0 && onClear && (
              <Button variant="ghost" size="icon" onClick={onClear}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="p-3 sm:p-4 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {children}
                </div>
                {resultText && (
                  <p className="text-xs sm:text-sm text-muted-foreground pt-2 border-t">
                    {resultText}
                  </p>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop: Always visible */}
      {alwaysExpanded && (
        <Card className="hidden md:block">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Filtros</h3>
                {activeCount > 0 && (
                  <Badge variant="secondary">{activeCount} ativos</Badge>
                )}
              </div>
              {activeCount > 0 && onClear && (
                <Button variant="ghost" size="sm" onClick={onClear}>
                  Limpar filtros
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {children}
            </div>
            {resultText && (
              <p className="text-sm text-muted-foreground pt-2 border-t">
                {resultText}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ResponsiveFilters;
