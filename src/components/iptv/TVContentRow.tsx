import { useRef, useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TVContentRowProps {
  title: string;
  children: React.ReactNode;
  itemCount: number;
  className?: string;
  initialVisibleCount?: number;
}

export function TVContentRow({ 
  title, 
  children, 
  itemCount, 
  className,
  initialVisibleCount = 15,
}: TVContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount);

  // Get children as array for lazy loading
  const childrenArray = useMemo(() => {
    return Array.isArray(children) ? children : [children];
  }, [children]);

  const visibleChildren = useMemo(() => {
    return childrenArray.slice(0, visibleCount);
  }, [childrenArray, visibleCount]);

  const hasMore = visibleCount < childrenArray.length;

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  // Intersection Observer for lazy loading on horizontal scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 10, childrenArray.length));
        }
      },
      { 
        root: scrollRef.current,
        rootMargin: '200px',
        threshold: 0.1 
      }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, childrenArray.length, visibleCount]);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, []);

  // Recheck scroll when visible children change
  useEffect(() => {
    checkScroll();
  }, [visibleChildren.length]);

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
          {visibleChildren}
          
          {/* Lazy load trigger for horizontal scroll */}
          {hasMore && (
            <div 
              ref={loadMoreRef}
              className="flex-shrink-0 flex items-center justify-center w-20 h-full"
            >
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
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
