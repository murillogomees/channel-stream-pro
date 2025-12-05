/**
 * IntegrationTabs - Tabs estilizados para página de integrações
 * Com indicadores coloridos por seção e responsividade
 */

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LucideIcon } from "lucide-react";
import { IntegrationVariant } from "./IntegrationCard";

interface TabItem {
  value: string;
  label: string;
  icon: LucideIcon;
  variant: IntegrationVariant;
  content: ReactNode;
  badge?: string;
}

interface IntegrationTabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

const variantColors: Record<IntegrationVariant, {
  indicator: string;
  text: string;
  bg: string;
}> = {
  payment: {
    indicator: "bg-integration-payment",
    text: "text-integration-payment",
    bg: "bg-integration-payment-bg"
  },
  messaging: {
    indicator: "bg-integration-messaging",
    text: "text-integration-messaging",
    bg: "bg-integration-messaging-bg"
  },
  cdn: {
    indicator: "bg-integration-cdn",
    text: "text-integration-cdn",
    bg: "bg-integration-cdn-bg"
  },
  transcode: {
    indicator: "bg-integration-transcode",
    text: "text-integration-transcode",
    bg: "bg-integration-transcode-bg"
  },
  cache: {
    indicator: "bg-integration-cache",
    text: "text-integration-cache",
    bg: "bg-integration-cache-bg"
  },
  qa: {
    indicator: "bg-integration-qa",
    text: "text-integration-qa",
    bg: "bg-integration-qa-bg"
  },
  default: {
    indicator: "bg-primary",
    text: "text-primary",
    bg: "bg-primary/10"
  }
};

export function IntegrationTabs({
  tabs,
  defaultValue,
  value,
  onValueChange,
  className
}: IntegrationTabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || tabs[0]?.value);
  const currentValue = value ?? internalValue;
  
  const handleValueChange = (newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  const selectedTab = tabs.find(t => t.value === currentValue);
  const selectedColors = selectedTab ? variantColors[selectedTab.variant] : variantColors.default;

  return (
    <Tabs
      value={currentValue}
      onValueChange={handleValueChange}
      className={cn("space-y-6", className)}
    >
      {/* Mobile: Select dropdown */}
      <div className="md:hidden">
        <Select value={currentValue} onValueChange={handleValueChange}>
          <SelectTrigger 
            className={cn(
              "w-full h-12 border-2",
              selectedColors.text,
              "border-current/30 bg-card"
            )}
          >
            <SelectValue>
              {selectedTab && (
                <div className="flex items-center gap-2">
                  <selectedTab.icon className={cn("h-4 w-4", selectedColors.text)} />
                  <span className="font-medium">{selectedTab.label}</span>
                  {selectedTab.badge && (
                    <span className={cn(
                      "ml-auto text-xs px-1.5 py-0.5 rounded-full",
                      selectedColors.bg,
                      selectedColors.text
                    )}>
                      {selectedTab.badge}
                    </span>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border shadow-lg">
            {tabs.map((tab) => {
              const colors = variantColors[tab.variant];
              return (
                <SelectItem 
                  key={tab.value} 
                  value={tab.value}
                  className="py-3"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded", colors.bg)}>
                      <tab.icon className={cn("h-4 w-4", colors.text)} />
                    </div>
                    <span className="font-medium">{tab.label}</span>
                    {tab.badge && (
                      <span className={cn(
                        "ml-2 text-xs px-1.5 py-0.5 rounded-full",
                        colors.bg,
                        colors.text
                      )}>
                        {tab.badge}
                      </span>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Horizontal tabs */}
      <TabsList className="hidden md:grid w-full h-auto p-1.5 bg-surface-1 rounded-xl gap-1" style={{
        gridTemplateColumns: `repeat(${Math.min(tabs.length, 7)}, 1fr)`
      }}>
        {tabs.map((tab) => {
          const colors = variantColors[tab.variant];
          const isActive = currentValue === tab.value;
          
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg",
                "transition-all duration-200",
                "data-[state=active]:bg-card data-[state=active]:shadow-elevation-1",
                "hover:bg-surface-2/50",
                isActive && colors.text
              )}
            >
              {/* Color indicator dot */}
              <span className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full",
                "transition-all duration-200",
                isActive ? colors.indicator : "bg-muted-foreground/30"
              )} />
              
              <tab.icon className={cn(
                "h-4 w-4 ml-2 transition-colors",
                isActive ? colors.text : "text-muted-foreground"
              )} />
              
              <span className={cn(
                "text-sm font-medium transition-colors hidden lg:inline",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {tab.label}
              </span>
              
              {tab.badge && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full hidden xl:inline",
                  isActive ? cn(colors.bg, colors.text) : "bg-muted text-muted-foreground"
                )}>
                  {tab.badge}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* Tab contents */}
      {tabs.map((tab) => (
        <TabsContent 
          key={tab.value} 
          value={tab.value}
          className="mt-6 animate-fade-in"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default IntegrationTabs;
