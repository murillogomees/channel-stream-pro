/**
 * ResponsiveNav - Navegação responsiva
 * Mobile: Bottom nav ou hamburger
 * Tablet: Sidebar colapsável
 * Desktop/TV: Sidebar expandida
 */

import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: string | number;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

interface ResponsiveNavProps {
  groups: NavGroup[];
  logo?: ReactNode;
  footer?: ReactNode;
  /** Mostrar bottom nav em mobile */
  bottomNav?: boolean;
  /** Items para bottom nav (max 5) */
  bottomNavItems?: NavItem[];
  className?: string;
}

export function ResponsiveNav({
  groups,
  logo,
  footer,
  bottomNav = true,
  bottomNavItems,
  className,
}: ResponsiveNavProps) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const isTablet = useMediaQuery("(min-width: 769px) and (max-width: 1024px)");

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + "/");

  // Mobile: Sheet + optional bottom nav
  if (isMobile) {
    const bottomItems = bottomNavItems?.slice(0, 5) || groups[0]?.items.slice(0, 5) || [];

    return (
      <>
        {/* Mobile Header with hamburger */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b h-14 flex items-center px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-3">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <div className="flex flex-col h-full">
                {logo && (
                  <div className="p-4 border-b">
                    {logo}
                  </div>
                )}
                <ScrollArea className="flex-1">
                  <nav className="p-4 space-y-6">
                    {groups.map((group, gIdx) => (
                      <div key={gIdx}>
                        {group.label && (
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                            {group.label}
                          </div>
                        )}
                        <div className="space-y-1">
                          {group.items.map((item) => (
                            <Link
                              key={item.href}
                              to={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                isActive(item.href)
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              {item.icon}
                              <span className="flex-1">{item.label}</span>
                              {item.badge && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </nav>
                </ScrollArea>
                {footer && (
                  <div className="p-4 border-t">
                    {footer}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          {logo}
        </div>

        {/* Bottom Navigation */}
        {bottomNav && bottomItems.length > 0 && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-inset-bottom">
            <div className="flex items-center justify-around h-16">
              {bottomItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 flex-1 h-full px-2",
                    isActive(item.href)
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {item.icon}
                  <span className="text-[10px] font-medium truncate max-w-full">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </nav>
        )}

        {/* Spacing for fixed elements */}
        <div className="h-14" /> {/* Top header */}
        {bottomNav && <div className="h-16" />} {/* Bottom nav */}
      </>
    );
  }

  // Tablet/Desktop/TV: Sidebar
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-card border-r transition-all duration-300 z-40 flex flex-col",
        collapsed ? "w-16 2xl:w-20" : "w-64 2xl:w-72 3xl:w-80",
        className
      )}
    >
      {/* Logo */}
      {logo && (
        <div className={cn(
          "h-16 2xl:h-20 3xl:h-24 border-b flex items-center",
          collapsed ? "justify-center px-2" : "px-4 2xl:px-6"
        )}>
          {!collapsed && logo}
        </div>
      )}

      {/* Nav Items */}
      <ScrollArea className="flex-1 py-4">
        <nav className={cn("space-y-6", collapsed ? "px-2" : "px-3 2xl:px-4")}>
          {groups.map((group, gIdx) => (
            <div key={gIdx}>
              {group.label && !collapsed && (
                <div className="text-xs 2xl:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 2xl:px-3">
                  {group.label}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg font-medium transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                      "2xl:focus:ring-4 2xl:focus:ring-offset-4", // TV focus
                      collapsed
                        ? "justify-center p-3 2xl:p-4"
                        : "px-3 py-2.5 2xl:px-4 2xl:py-3 3xl:px-5 3xl:py-4",
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      "text-sm 2xl:text-base 3xl:text-lg"
                    )}
                  >
                    <span className="flex-shrink-0 [&>svg]:h-5 [&>svg]:w-5 2xl:[&>svg]:h-6 2xl:[&>svg]:w-6 3xl:[&>svg]:h-7 3xl:[&>svg]:w-7">
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="px-2 py-0.5 text-xs 2xl:text-sm rounded-full bg-primary/20 text-primary">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {footer && !collapsed && (
        <div className="p-4 2xl:p-6 border-t">
          {footer}
        </div>
      )}

      {/* Collapse Toggle (tablet only) */}
      {isTablet && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border bg-background shadow-sm"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>
      )}
    </aside>
  );
}

export default ResponsiveNav;
