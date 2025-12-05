/**
 * ResponsiveTable - Tabela responsiva com fallback para cards em mobile
 * Baseado no ResponsiveDataView mas com melhor suporte a TV
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

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  /** Prioridade de visibilidade: 1 = sempre, 2 = tablet+, 3 = desktop+, 4 = TV only */
  priority?: 1 | 2 | 3 | 4;
  /** Largura fixa (para sticky headers) */
  width?: string;
  /** Alinhamento */
  align?: "left" | "center" | "right";
}

interface Action<T> {
  label: string;
  icon?: ReactNode;
  onClick: (item: T) => void;
  variant?: "default" | "destructive";
  /** Mostrar como botão inline (max 2) */
  inline?: boolean;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  actions?: Action<T>[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  /** Sticky header para scroll */
  stickyHeader?: boolean;
  /** Altura máxima para scroll */
  maxHeight?: string;
  /** Linha selecionada para foco TV */
  selectedKey?: string;
  onRowSelect?: (item: T) => void;
  className?: string;
}

export function ResponsiveTable<T extends Record<string, any>>({
  data,
  columns,
  actions,
  keyExtractor,
  loading,
  emptyMessage = "Nenhum item encontrado",
  stickyHeader = false,
  maxHeight,
  selectedKey,
  onRowSelect,
  className,
}: ResponsiveTableProps<T>) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Colunas por prioridade
  const priorityColumns = {
    always: columns.filter((c) => !c.priority || c.priority === 1),
    tablet: columns.filter((c) => c.priority === 2),
    desktop: columns.filter((c) => c.priority === 3),
    tv: columns.filter((c) => c.priority === 4),
  };

  const inlineActions = actions?.filter((a) => a.inline).slice(0, 2) || [];
  const menuActions = actions?.filter((a) => !a.inline) || [];

  const getValue = (item: T, col: Column<T>) => {
    if (col.render) return col.render(item);
    return item[col.key];
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 2xl:p-6">
              <div className="h-5 2xl:h-6 bg-muted rounded w-1/3 mb-2" />
              <div className="h-4 2xl:h-5 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 2xl:p-12 3xl:p-16 text-center text-muted-foreground text-sm 2xl:text-lg 3xl:text-xl">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop/TV Table View */}
      <div className="hidden md:block">
        <Card>
          <div
            className={cn(
              "overflow-x-auto",
              maxHeight && "overflow-y-auto",
              maxHeight
            )}
            style={maxHeight ? { maxHeight } : undefined}
          >
            <Table>
              <TableHeader className={cn(stickyHeader && "sticky top-0 z-10 bg-card")}>
                <TableRow>
                  {/* Priority 1: Sempre visível */}
                  {priorityColumns.always.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        "whitespace-nowrap text-xs md:text-sm 2xl:text-base 3xl:text-lg",
                        col.align === "center" && "text-center",
                        col.align === "right" && "text-right"
                      )}
                      style={col.width ? { width: col.width } : undefined}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                  {/* Priority 2: Tablet+ */}
                  {priorityColumns.tablet.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        "whitespace-nowrap text-xs md:text-sm 2xl:text-base 3xl:text-lg",
                        col.align === "center" && "text-center",
                        col.align === "right" && "text-right"
                      )}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                  {/* Priority 3: Desktop+ */}
                  {priorityColumns.desktop.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        "hidden lg:table-cell whitespace-nowrap text-xs md:text-sm 2xl:text-base 3xl:text-lg",
                        col.align === "center" && "text-center",
                        col.align === "right" && "text-right"
                      )}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                  {/* Priority 4: TV only */}
                  {priorityColumns.tv.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        "hidden 2xl:table-cell whitespace-nowrap text-base 3xl:text-lg",
                        col.align === "center" && "text-center",
                        col.align === "right" && "text-right"
                      )}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                  {actions && actions.length > 0 && (
                    <TableHead className="text-right w-[100px] 2xl:w-[140px] text-xs md:text-sm 2xl:text-base">
                      Ações
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => {
                  const key = keyExtractor(item);
                  const isSelected = selectedKey === key;

                  return (
                    <TableRow
                      key={key}
                      tabIndex={onRowSelect ? 0 : undefined}
                      onClick={() => onRowSelect?.(item)}
                      className={cn(
                        onRowSelect && "cursor-pointer",
                        isSelected && "bg-primary/10 border-l-2 border-l-primary",
                        "focus:outline-none focus:bg-primary/5 2xl:focus:bg-primary/10"
                      )}
                    >
                      {priorityColumns.always.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            "text-xs md:text-sm 2xl:text-base 3xl:text-lg py-3 2xl:py-4 3xl:py-5",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right"
                          )}
                        >
                          {getValue(item, col)}
                        </TableCell>
                      ))}
                      {priorityColumns.tablet.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            "text-xs md:text-sm 2xl:text-base 3xl:text-lg py-3 2xl:py-4 3xl:py-5",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right"
                          )}
                        >
                          {getValue(item, col)}
                        </TableCell>
                      ))}
                      {priorityColumns.desktop.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            "hidden lg:table-cell text-xs md:text-sm 2xl:text-base 3xl:text-lg py-3 2xl:py-4 3xl:py-5",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right"
                          )}
                        >
                          {getValue(item, col)}
                        </TableCell>
                      ))}
                      {priorityColumns.tv.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            "hidden 2xl:table-cell text-base 3xl:text-lg py-4 3xl:py-5",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right"
                          )}
                        >
                          {getValue(item, col)}
                        </TableCell>
                      ))}
                      {actions && actions.length > 0 && (
                        <TableCell className="text-right py-3 2xl:py-4">
                          <div className="flex items-center justify-end gap-1 2xl:gap-2">
                            {inlineActions.map((action, idx) => (
                              <Button
                                key={idx}
                                variant={action.variant === "destructive" ? "destructive" : "ghost"}
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  action.onClick(item);
                                }}
                                className="h-8 w-8 2xl:h-10 2xl:w-10 3xl:h-12 3xl:w-12"
                              >
                                {action.icon}
                              </Button>
                            ))}
                            {menuActions.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 2xl:h-10 2xl:w-10"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreVertical className="h-4 w-4 2xl:h-5 2xl:w-5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {menuActions.map((action, idx) => (
                                    <DropdownMenuItem
                                      key={idx}
                                      onClick={() => action.onClick(item)}
                                      className={cn(
                                        "text-sm 2xl:text-base",
                                        action.variant === "destructive" && "text-destructive"
                                      )}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {data.map((item) => {
          const key = keyExtractor(item);
          const isExpanded = expandedCards.has(key);
          const hiddenColumns = [...priorityColumns.tablet, ...priorityColumns.desktop, ...priorityColumns.tv];
          const primaryCol = priorityColumns.always[0];
          const secondaryCol = priorityColumns.always[1];

          return (
            <Card
              key={key}
              className={cn(
                "overflow-hidden",
                onRowSelect && "cursor-pointer active:bg-muted/50"
              )}
              onClick={() => onRowSelect?.(item)}
            >
              <CardContent className="p-3 sm:p-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {primaryCol && (
                      <div className="font-medium text-sm sm:text-base truncate">
                        {getValue(item, primaryCol)}
                      </div>
                    )}
                    {secondaryCol && (
                      <div className="text-xs sm:text-sm text-muted-foreground truncate">
                        {getValue(item, secondaryCol)}
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {inlineActions.map((action, idx) => (
                      <Button
                        key={idx}
                        variant={action.variant === "destructive" ? "destructive" : "ghost"}
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick(item);
                        }}
                        className="h-8 w-8"
                      >
                        {action.icon}
                      </Button>
                    ))}
                    {menuActions.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
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

                {/* Visible fields (priority 1 restantes) */}
                {priorityColumns.always.slice(2).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {priorityColumns.always.slice(2).map((col) => (
                      <div key={col.key} className="flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-muted-foreground">{col.header}</span>
                        <span className="font-medium">{getValue(item, col)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expandable section */}
                {hiddenColumns.length > 0 && (
                  <>
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        {hiddenColumns.map((col) => (
                          <div key={col.key} className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="text-muted-foreground">{col.header}</span>
                            <span className="font-medium">{getValue(item, col)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-muted-foreground text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(key);
                      }}
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default ResponsiveTable;
