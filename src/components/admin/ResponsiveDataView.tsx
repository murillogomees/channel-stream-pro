/**
 * ResponsiveDataView - Visualização de dados responsiva
 * Desktop: Tabela tradicional
 * Mobile: Cards empilhados
 */

import { ReactNode, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Column<T> {
  key: string;
  header: string;
  /** Renderizar célula customizada */
  render?: (item: T) => ReactNode;
  /** Esconder em mobile (sempre visível no card expandido) */
  hideOnMobile?: boolean;
  /** Esconder em tablet */
  hideOnTablet?: boolean;
  /** Mostrar como badge no card mobile */
  asBadge?: boolean;
  /** Campo principal (título do card mobile) */
  isPrimary?: boolean;
  /** Campo secundário (subtítulo do card mobile) */
  isSecondary?: boolean;
}

interface ActionItem<T> {
  label: string;
  icon?: ReactNode;
  onClick: (item: T) => void;
  variant?: "default" | "destructive";
  /** Mostrar como botão no card (max 2) */
  showAsButton?: boolean;
}

interface ResponsiveDataViewProps<T> {
  data: T[];
  columns: Column<T>[];
  actions?: ActionItem<T>[];
  /** Key única para cada item */
  keyExtractor: (item: T) => string;
  /** Estado de loading */
  loading?: boolean;
  /** Mensagem quando vazio */
  emptyMessage?: string;
  /** Classe para container */
  className?: string;
  /** Renderizar footer customizado para card mobile */
  renderCardFooter?: (item: T) => ReactNode;
}

export function ResponsiveDataView<T extends Record<string, any>>({
  data,
  columns,
  actions,
  keyExtractor,
  loading,
  emptyMessage = "Nenhum item encontrado",
  className,
  renderCardFooter,
}: ResponsiveDataViewProps<T>) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (key: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const primaryColumn = columns.find(c => c.isPrimary);
  const secondaryColumn = columns.find(c => c.isSecondary);
  const badgeColumns = columns.filter(c => c.asBadge);
  const buttonActions = actions?.filter(a => a.showAsButton).slice(0, 2) || [];
  const menuActions = actions?.filter(a => !a.showAsButton) || [];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-5 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  const getValue = (item: T, column: Column<T>) => {
    if (column.render) return column.render(item);
    return item[column.key];
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.filter(c => !c.hideOnTablet).map(col => (
                    <TableHead 
                      key={col.key}
                      className={cn(
                        "whitespace-nowrap",
                        col.hideOnMobile && "hidden lg:table-cell"
                      )}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                  {actions && actions.length > 0 && (
                    <TableHead className="text-right w-[100px]">Ações</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(item => (
                  <TableRow key={keyExtractor(item)}>
                    {columns.filter(c => !c.hideOnTablet).map(col => (
                      <TableCell 
                        key={col.key}
                        className={cn(
                          col.hideOnMobile && "hidden lg:table-cell"
                        )}
                      >
                        {getValue(item, col)}
                      </TableCell>
                    ))}
                    {actions && actions.length > 0 && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {buttonActions.map((action, idx) => (
                            <Button
                              key={idx}
                              variant={action.variant === "destructive" ? "destructive" : "ghost"}
                              size="icon"
                              onClick={() => action.onClick(item)}
                              className="h-8 w-8"
                            >
                              {action.icon}
                            </Button>
                          ))}
                          {menuActions.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {menuActions.map((action, idx) => (
                                  <DropdownMenuItem
                                    key={idx}
                                    onClick={() => action.onClick(item)}
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
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {data.map(item => {
          const key = keyExtractor(item);
          const isExpanded = expandedCards.has(key);
          const hiddenColumns = columns.filter(c => c.hideOnMobile && !c.isPrimary && !c.isSecondary && !c.asBadge);

          return (
            <Card key={key} className="overflow-hidden">
              <CardContent className="p-3 sm:p-4">
                {/* Card Header */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Primary value (title) */}
                    {primaryColumn && (
                      <div className="font-medium truncate">
                        {getValue(item, primaryColumn)}
                      </div>
                    )}
                    {/* Secondary value (subtitle) */}
                    {secondaryColumn && (
                      <div className="text-sm text-muted-foreground truncate">
                        {getValue(item, secondaryColumn)}
                      </div>
                    )}
                    {/* Badges */}
                    {badgeColumns.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {badgeColumns.map(col => (
                          <div key={col.key}>
                            {getValue(item, col)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {buttonActions.map((action, idx) => (
                      <Button
                        key={idx}
                        variant={action.variant === "destructive" ? "destructive" : "ghost"}
                        size="icon"
                        onClick={() => action.onClick(item)}
                        className="h-8 w-8"
                      >
                        {action.icon}
                      </Button>
                    ))}
                    {menuActions.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {menuActions.map((action, idx) => (
                            <DropdownMenuItem
                              key={idx}
                              onClick={() => action.onClick(item)}
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
                </div>

                {/* Visible columns on mobile */}
                <div className="mt-3 space-y-2">
                  {columns
                    .filter(c => !c.hideOnMobile && !c.isPrimary && !c.isSecondary && !c.asBadge)
                    .map(col => (
                      <div key={col.key} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{col.header}</span>
                        <span className="font-medium">{getValue(item, col)}</span>
                      </div>
                    ))}
                </div>

                {/* Expandable hidden columns */}
                {hiddenColumns.length > 0 && (
                  <>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        {hiddenColumns.map(col => (
                          <div key={col.key} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{col.header}</span>
                            <span className="font-medium">{getValue(item, col)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-muted-foreground"
                      onClick={() => toggleCard(key)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-1" />
                          Ver menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Ver mais ({hiddenColumns.length})
                        </>
                      )}
                    </Button>
                  </>
                )}

                {/* Custom footer */}
                {renderCardFooter && renderCardFooter(item)}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default ResponsiveDataView;
