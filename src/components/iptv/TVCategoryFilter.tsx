import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Folder } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Category {
  id: string;
  name: string;
  display_name: string;
  channelCount: number;
}

interface TVCategoryFilterProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  title: string;
}

export function TVCategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
  title,
}: TVCategoryFilterProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (categories.length === 0) return null;

  // Truncate category name - leave space for count
  const truncateName = (name: string, maxLength: number = 22) => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength).trim() + '…';
  };

  const totalCount = categories.reduce((acc, cat) => acc + cat.channelCount, 0);

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border overflow-hidden w-[280px] flex-shrink-0">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{title}</span>
          <Badge variant="secondary" className="text-xs">
            {categories.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Category List */}
      {isExpanded && (
        <ScrollArea className="max-h-[60vh]">
          <div className="p-2 space-y-0.5">
            {/* All option */}
            <button
              onClick={() => onSelectCategory(null)}
              className={cn(
                "w-full flex items-center px-3 py-2 rounded-lg text-sm transition-all",
                selectedCategory === null
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted/70 text-foreground"
              )}
            >
              <span className="flex-1 text-left">Todos</span>
              <span className={cn(
                "text-xs tabular-nums ml-2",
                selectedCategory === null ? "text-primary-foreground/80" : "text-muted-foreground"
              )}>
                {totalCount.toLocaleString()}
              </span>
            </button>

            {/* Categories */}
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onSelectCategory(category.id)}
                className={cn(
                  "w-full flex items-center px-3 py-2 rounded-lg text-sm transition-all",
                  selectedCategory === category.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted/70 text-foreground"
                )}
                title={category.display_name}
              >
                <span className="flex-1 text-left overflow-hidden whitespace-nowrap">
                  {truncateName(category.display_name)}
                </span>
                <span className={cn(
                  "text-xs tabular-nums ml-2 flex-shrink-0",
                  selectedCategory === category.id ? "text-primary-foreground/80" : "text-muted-foreground"
                )}>
                  {category.channelCount.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
