/**
 * ResponsiveTabs - Tabs responsivas com scroll horizontal
 * Adapta para mobile, tablet, desktop e TV
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  return (
    <Tabs 
      defaultValue={defaultValue} 
      value={value}
      onValueChange={onValueChange}
      className={cn("space-y-4 2xl:space-y-6 3xl:space-y-8", className)}
    >
      <ScrollArea className="w-full whitespace-nowrap">
        <TabsList className="inline-flex h-auto min-w-full p-1 2xl:p-1.5 3xl:p-2 bg-muted">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "flex-shrink-0 px-3 py-2 text-sm whitespace-nowrap",
                // Responsivo para TV
                "sm:px-4 sm:py-2.5",
                "2xl:px-6 2xl:py-3 2xl:text-base",
                "3xl:px-8 3xl:py-4 3xl:text-lg",
                // Foco visível em TV
                "focus:ring-2 2xl:focus:ring-4 focus:ring-primary focus:ring-offset-2"
              )}
            >
              {tab.icon && (
                <span className="mr-2 [&>svg]:h-4 [&>svg]:w-4 2xl:[&>svg]:h-5 2xl:[&>svg]:w-5 3xl:[&>svg]:h-6 3xl:[&>svg]:w-6">
                  {tab.icon}
                </span>
              )}
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>

      {tabs.map((tab) => (
        <TabsContent 
          key={tab.value} 
          value={tab.value} 
          className="space-y-4 2xl:space-y-6 3xl:space-y-8 mt-4 2xl:mt-6 3xl:mt-8"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
