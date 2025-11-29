import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { M3UEntry } from '@/hooks/useM3USyncEditor';

interface VirtualizedEntryListProps {
  entries: M3UEntry[];
  selectedEntries: Set<string>;
  onToggleSelection: (entryId: string) => void;
  onEdit: (entry: M3UEntry) => void;
  onDelete: (entryId: string) => void;
}

export const VirtualizedEntryList = React.memo(function VirtualizedEntryList({
  entries,
  selectedEntries,
  onToggleSelection,
  onEdit,
  onDelete,
}: VirtualizedEntryListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div 
      ref={parentRef} 
      className="h-[250px] overflow-auto ml-8 mt-1 pr-4"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => {
          const entry = entries[virtualItem.index];
          return (
            <div
              key={entry.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30 text-sm group h-full">
                <Checkbox
                  checked={selectedEntries.has(entry.id)}
                  onCheckedChange={() => onToggleSelection(entry.id)}
                />
                
                {entry.tvg_logo && (
                  <img 
                    src={entry.tvg_logo} 
                    alt=""
                    className="w-6 h-6 rounded object-cover flex-shrink-0"
                    loading="lazy"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                
                <span className="flex-1 truncate">{entry.title}</span>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onEdit(entry)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => onDelete(entry.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
