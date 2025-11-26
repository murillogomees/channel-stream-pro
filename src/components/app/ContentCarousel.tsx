import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ContentCarouselProps {
  title: string;
  children: React.ReactNode;
  itemCount: number;
}

export function ContentCarousel({ title, children, itemCount }: ContentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (itemCount === 0) return null;

  return (
    <div className="mb-12 group/carousel">
      <div className="flex items-center justify-between mb-4 px-4 md:px-12">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </span>
      </div>

      <div className="relative group/scroll">
        {/* Left Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-full w-12 rounded-none bg-background/80 hover:bg-background/95 opacity-0 group-hover/scroll:opacity-100 transition-opacity backdrop-blur-sm"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-4 md:px-12 pb-4 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {children}
        </div>

        {/* Right Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-full w-12 rounded-none bg-background/80 hover:bg-background/95 opacity-0 group-hover/scroll:opacity-100 transition-opacity backdrop-blur-sm"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      </div>
    </div>
  );
}
