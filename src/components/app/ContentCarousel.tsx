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
    <section className="group/carousel">
      {/* Section Header */}
      <div className="flex items-baseline gap-3 mb-4 px-4 sm:px-6 md:px-8 lg:px-12">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
          {title}
        </h2>
        <span className="text-xs sm:text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {/* Carousel Container */}
      <div className="relative group/scroll">
        {/* Left Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-[calc(100%-1rem)] w-10 md:w-12 rounded-none bg-gradient-to-r from-background via-background/90 to-transparent opacity-0 group-hover/scroll:opacity-100 transition-opacity"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
        </Button>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 md:px-8 lg:px-12 pb-2 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {children}
        </div>

        {/* Right Arrow */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-[calc(100%-1rem)] w-10 md:w-12 rounded-none bg-gradient-to-l from-background via-background/90 to-transparent opacity-0 group-hover/scroll:opacity-100 transition-opacity"
          onClick={() => scroll('right')}
        >
          <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
        </Button>
      </div>
    </section>
  );
}
