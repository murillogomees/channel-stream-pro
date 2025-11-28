import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ResponsiveTabsProps {
  defaultValue: string;
  tabs: {
    value: string;
    label: string;
    content: React.ReactNode;
  }[];
  className?: string;
}

export function ResponsiveTabs({ defaultValue, tabs, className }: ResponsiveTabsProps) {
  return (
    <Tabs defaultValue={defaultValue} className={cn("space-y-4", className)}>
      <ScrollArea className="w-full whitespace-nowrap">
        <TabsList className="inline-flex h-auto min-w-full p-1 bg-muted">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-shrink-0 px-3 py-2 text-sm whitespace-nowrap"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="space-y-4 mt-4">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
