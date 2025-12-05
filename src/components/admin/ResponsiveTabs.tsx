/**
 * ResponsiveTabs - Tabs responsivas com dropdown em mobile
 * Mobile: dropdown select
 * Desktop: tabs tradicionais
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
  
  return (
    <Tabs 
      defaultValue={defaultValue} 
      value={value}
      onValueChange={onValueChange}
      className={cn("space-y-4 2xl:space-y-6", className)}
    >
      {/* Mobile: Dropdown Select */}
      <div className="md:hidden">
        <Select value={currentValue} onValueChange={onValueChange}>
          <SelectTrigger className="w-full h-11 bg-background">
            <SelectValue>
              {tabs.find(t => t.value === currentValue) && (
                <span className="flex items-center gap-2">
                  {tabs.find(t => t.value === currentValue)?.icon}
                  {tabs.find(t => t.value === currentValue)?.label}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            {tabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                <span className="flex items-center gap-2">
                  {tab.icon && (
                    <span className="[&>svg]:h-4 [&>svg]:w-4 text-muted-foreground">
                      {tab.icon}
                    </span>
                  )}
                  {tab.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Traditional Tabs */}
      <TabsList className="hidden md:inline-flex h-auto p-1 bg-muted/50 rounded-lg">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-md transition-all",
              "data-[state=active]:bg-background data-[state=active]:shadow-sm",
              "data-[state=active]:text-foreground",
              "hover:text-foreground/80",
              // TV responsive
              "2xl:px-6 2xl:py-3 2xl:text-base",
              "3xl:px-8 3xl:py-4 3xl:text-lg",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            {tab.icon && (
              <span className="mr-2 [&>svg]:h-4 [&>svg]:w-4 2xl:[&>svg]:h-5 2xl:[&>svg]:w-5">
                {tab.icon}
              </span>
            )}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent 
          key={tab.value} 
          value={tab.value} 
          className="mt-4 2xl:mt-6 focus-visible:outline-none"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
