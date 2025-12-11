import { useState, useRef, useEffect } from 'react';
import { format, addHours, startOfHour, differenceInMinutes, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Clock, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface EPGProgram {
  id: string;
  channelId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  category?: string;
  icon?: string;
}

interface EPGTimelineProps {
  programs: EPGProgram[];
  currentProgram?: EPGProgram | null;
  onProgramSelect?: (program: EPGProgram) => void;
  className?: string;
}

const HOUR_WIDTH = 200; // pixels per hour
const TIMELINE_HOURS = 24;

export function EPGTimeline({ 
  programs, 
  currentProgram, 
  onProgramSelect,
  className 
}: EPGTimelineProps) {
  const [timelineStart, setTimelineStart] = useState(() => startOfHour(new Date()));
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  // Generate time slots
  const timeSlots = Array.from({ length: TIMELINE_HOURS }, (_, i) => 
    addHours(timelineStart, i)
  );

  // Calculate program position and width
  const getProgramStyle = (program: EPGProgram) => {
    const start = new Date(program.start);
    const end = new Date(program.end);
    const offsetMinutes = differenceInMinutes(start, timelineStart);
    const durationMinutes = differenceInMinutes(end, start);
    
    const left = (offsetMinutes / 60) * HOUR_WIDTH;
    const width = (durationMinutes / 60) * HOUR_WIDTH;
    
    return { left: Math.max(0, left), width: Math.max(width, 50) };
  };

  // Check if program is current
  const isCurrentProgram = (program: EPGProgram) => {
    const start = new Date(program.start);
    const end = new Date(program.end);
    return isWithinInterval(now, { start, end });
  };

  // Calculate current time indicator position
  const currentTimePosition = () => {
    const offsetMinutes = differenceInMinutes(now, timelineStart);
    return (offsetMinutes / 60) * HOUR_WIDTH;
  };

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const position = currentTimePosition();
      scrollRef.current.scrollLeft = Math.max(0, position - 100);
    }
  }, []);

  const shiftTimeline = (hours: number) => {
    setTimelineStart(prev => addHours(prev, hours));
  };

  return (
    <div className={cn("bg-card rounded-lg border border-border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Guia de Programação</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => shiftTimeline(-6)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setTimelineStart(startOfHour(new Date()))}
          >
            <Clock className="h-3 w-3 mr-1" />
            Agora
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => shiftTimeline(6)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="w-full" ref={scrollRef}>
        <div className="relative" style={{ width: TIMELINE_HOURS * HOUR_WIDTH }}>
          {/* Time header */}
          <div className="flex border-b border-border bg-muted/50">
            {timeSlots.map((slot, i) => (
              <div
                key={i}
                className="flex-shrink-0 px-2 py-1.5 text-xs text-muted-foreground border-r border-border/50"
                style={{ width: HOUR_WIDTH }}
              >
                {format(slot, 'HH:mm', { locale: ptBR })}
              </div>
            ))}
          </div>

          {/* Current time indicator */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-20"
            style={{ left: currentTimePosition() }}
          >
            <div className="absolute -top-0.5 -left-1 w-2.5 h-2.5 rounded-full bg-primary" />
          </div>

          {/* Programs row */}
          <div className="relative h-20 bg-background">
            {programs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Sem programação disponível
              </div>
            ) : (
              programs.map((program) => {
                const style = getProgramStyle(program);
                const isCurrent = isCurrentProgram(program);
                
                return (
                  <button
                    key={program.id}
                    className={cn(
                      "absolute top-2 h-16 rounded px-2 py-1 text-left transition-all",
                      "border overflow-hidden group",
                      isCurrent 
                        ? "bg-primary/20 border-primary text-primary-foreground" 
                        : "bg-muted/50 border-border hover:bg-muted hover:border-primary/50",
                      currentProgram?.id === program.id && "ring-2 ring-primary"
                    )}
                    style={{
                      left: style.left,
                      width: style.width - 4,
                    }}
                    onClick={() => onProgramSelect?.(program)}
                  >
                    <div className="text-xs font-medium truncate">
                      {program.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {format(new Date(program.start), 'HH:mm')} - {format(new Date(program.end), 'HH:mm')}
                    </div>
                    {program.category && (
                      <div className="text-[10px] text-primary/70 truncate mt-0.5">
                        {program.category}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Current program info */}
      {currentProgram && (
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                  AO VIVO
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(currentProgram.start), 'HH:mm')} - {format(new Date(currentProgram.end), 'HH:mm')}
                </span>
              </div>
              <h4 className="font-medium text-sm mt-1 truncate">{currentProgram.title}</h4>
              {currentProgram.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {currentProgram.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
