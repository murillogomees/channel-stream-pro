import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TVContentRowProps {
  title: string;
  children: React.ReactNode;
  itemCount: number;
  className?: string;
}

export function TVContentRow({ title, children, itemCount, className }: TVContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (itemCount === 0) return null;

  return (
    <section className={cn("py-4 lg:py-6", className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between gap-4 mb-3 lg:mb-4 px-4 lg:px-8">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg lg:text-xl xl:text-2xl font-bold text-foreground">
            {title}
          </h2>
          <span className="text-xs font-medium text-muted-foreground/70">
            {itemCount} {itemCount === 1 ? 'título' : 'títulos'}
          </span>
        </div>
        
        {/* Navigation Arrows (Desktop) */}
        <div className="hidden md:flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full transition-opacity",
              !canScrollLeft && "opacity-30 cursor-not-allowed"
            )}
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full transition-opacity",
              !canScrollRight && "opacity-30 cursor-not-allowed"
            )}
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Scrollable Row */}
      <div className="relative group">
        {/* Left Fade */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-16 lg:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity",
          !canScrollLeft && "opacity-0"
        )} />
        
        {/* Content */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 lg:gap-4 overflow-x-auto scroll-smooth px-4 lg:px-8 pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {children}
        </div>
        
        {/* Right Fade */}
        <div className={cn(
          "absolute right-0 top-0 bottom-0 w-16 lg:w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity",
          !canScrollRight && "opacity-0"
        )} />
      </div>
    </section>
  );
}
