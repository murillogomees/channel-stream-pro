import { cn } from '@/lib/utils';
import { Film, Clapperboard, Heart, Home, Search, Settings, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TVNavRailProps {
  activeTab: 'home' | 'movies' | 'series' | 'favorites';
  onTabChange: (tab: 'home' | 'movies' | 'series' | 'favorites') => void;
  onSearch?: () => void;
  onSettings?: () => void;
}

const navItems = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'movies', label: 'Filmes', icon: Film },
  { id: 'series', label: 'Séries', icon: Clapperboard },
  { id: 'favorites', label: 'Favoritos', icon: Heart },
] as const;

export function TVNavRail({
  activeTab,
  onTabChange,
  onSearch,
  onSettings,
}: TVNavRailProps) {
  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-xl border-t border-border z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as typeof activeTab)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "relative p-1.5 rounded-lg transition-all",
                  isActive && "bg-primary/15"
                )}>
                  <Icon className={cn(
                    "w-5 h-5 transition-transform",
                    isActive && "scale-110"
                  )} />
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full" />
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium truncate max-w-[50px]",
                  isActive && "font-semibold"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
          
          {/* Settings Button */}
          {onSettings && (
            <button
              onClick={onSettings}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="p-1.5 rounded-lg transition-all">
                <Settings className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium truncate max-w-[50px]">
                Perfil
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-[72px] lg:w-[88px] bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border z-50 flex-col">
        <div className="flex flex-col h-full py-4">
          {/* Logo Area */}
          <div className="flex items-center justify-center h-16 mb-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Tv className="w-5 h-5 lg:w-6 lg:h-6 text-primary-foreground" />
            </div>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 flex flex-col items-center gap-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id as typeof activeTab)}
                  className={cn(
                    "relative w-full flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-all duration-200",
                    "hover:bg-sidebar-accent group focus:outline-none focus:ring-2 focus:ring-primary",
                    isActive && "bg-sidebar-accent"
                  )}
                >
                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                  )}
                  
                  <div className={cn(
                    "relative p-2 rounded-lg transition-all",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-sidebar-foreground group-hover:bg-sidebar-primary/10"
                  )}>
                    <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
                  </div>
                  
                  <span className={cn(
                    "text-[10px] lg:text-xs font-medium text-center leading-tight",
                    isActive ? "text-sidebar-foreground" : "text-sidebar-foreground/70"
                  )}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col items-center gap-2 px-2 pt-4 border-t border-sidebar-border">
            {onSearch && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onSearch}
                className="w-12 h-12 rounded-xl hover:bg-sidebar-accent"
              >
                <Search className="w-5 h-5 text-sidebar-foreground/70" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.href = '/app/profile'}
              className="w-12 h-12 rounded-xl hover:bg-sidebar-accent"
            >
              <Settings className="w-5 h-5 text-sidebar-foreground/70" />
            </Button>
          </div>
        </div>
      </nav>
    </>
  );
}
