import { cn } from '@/lib/utils';
import { Tv, Film, Clapperboard, Heart, Home, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TVNavRailProps {
  activeTab: 'home' | 'live' | 'movies' | 'series' | 'favorites';
  onTabChange: (tab: 'home' | 'live' | 'movies' | 'series' | 'favorites') => void;
  onSearch?: () => void;
  onSettings?: () => void;
}

const navItems = [
  { id: 'home', label: 'Início', icon: Home },
  { id: 'live', label: 'TV ao Vivo', icon: Tv },
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
    <nav className="fixed left-0 top-0 bottom-0 w-[72px] lg:w-[88px] bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border z-50 flex flex-col py-4">
      {/* Logo Area */}
      <div className="flex items-center justify-center h-16 mb-4">
        <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary rounded-xl flex items-center justify-center">
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
                isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground group-hover:bg-sidebar-primary/10"
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
        {onSettings && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettings}
            className="w-12 h-12 rounded-xl hover:bg-sidebar-accent"
          >
            <Settings className="w-5 h-5 text-sidebar-foreground/70" />
          </Button>
        )}
      </div>
    </nav>
  );
}
