/**
 * ResponsiveTabs - Tabs responsivas com dropdown em mobile/tablet
 * Mobile/Tablet: dropdown select com ícones
 * Desktop: tabs tradicionais horizontais
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface ResponsiveTabsProps {
  defaultValue: string;
  tabs: {
    value: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
  }[];
  className?: string;
  /** Valor controlado */
  value?: string;
  onValueChange?: (value: string) => void;
}

export function ResponsiveTabs({ 
  defaultValue, 
  tabs, 
  className,
  value,
  onValueChange,
}: ResponsiveTabsProps) {
  const currentValue = value || defaultValue;
  const currentTab = tabs.find(t => t.value === currentValue);
  
  return (
    <Tabs 
      defaultValue={defaultValue} 
      value={value}
      onValueChange={onValueChange}
      className={cn("space-y-4 2xl:space-y-6", className)}
    >
      {/* Mobile/Tablet: Dropdown Select (até lg) */}
      <div className="lg:hidden">
        <Select value={currentValue} onValueChange={onValueChange}>
          <SelectTrigger className={cn(
            "w-full h-12 px-4",
            "bg-card border-border/50 rounded-xl",
            "shadow-elevation-1 hover:shadow-elevation-2",
            "transition-all duration-200",
            "focus:ring-2 focus:ring-primary/30"
          )}>
            <SelectValue>
              {currentTab && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                    <span className="[&>svg]:h-4 [&>svg]:w-4 text-primary">
                      {currentTab.icon}
                    </span>
                  </div>
                  <span className="font-medium text-foreground">
                    {currentTab.label}
                  </span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent 
            className="bg-popover border border-border shadow-elevation-3 rounded-xl p-1 z-50 min-w-[200px]"
            position="popper"
            sideOffset={8}
          >
            {tabs.map((tab) => {
              const isActive = tab.value === currentValue;
              return (
                <SelectItem 
                  key={tab.value} 
                  value={tab.value}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer",
                    "transition-colors duration-150",
                    "focus:bg-accent focus:text-accent-foreground",
                    isActive && "bg-primary/10"
                  )}
                >
                  <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-md",
                    isActive ? "bg-primary/20" : "bg-muted"
                  )}>
                    <span className={cn(
                      "[&>svg]:h-4 [&>svg]:w-4",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>
                      {tab.icon}
                    </span>
                  </div>
                  <span className={cn(
                    "font-medium",
                    isActive ? "text-primary" : "text-foreground"
                  )}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-primary" />
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Traditional Tabs (lg+) */}
      <TabsList className={cn(
        "hidden lg:inline-flex h-auto p-1.5 gap-1",
        "bg-surface-1 rounded-xl",
        "shadow-elevation-1"
      )}>
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium rounded-lg",
              "transition-all duration-200",
              "data-[state=active]:bg-card data-[state=active]:shadow-elevation-1",
              "data-[state=active]:text-foreground",
              "data-[state=inactive]:text-muted-foreground",
              "hover:text-foreground hover:bg-surface-2/50",
              // TV responsive
              "2xl:px-5 2xl:py-3 2xl:text-base",
              "3xl:px-6 3xl:py-3.5 3xl:text-lg",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            {tab.icon && (
              <span className={cn(
                "mr-2 [&>svg]:h-4 [&>svg]:w-4",
                "2xl:[&>svg]:h-5 2xl:[&>svg]:w-5"
              )}>
                {tab.icon}
              </span>
            )}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Tab Contents */}
      {tabs.map((tab) => (
        <TabsContent 
          key={tab.value} 
          value={tab.value} 
          className="mt-4 2xl:mt-6 focus-visible:outline-none animate-fade-in"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
