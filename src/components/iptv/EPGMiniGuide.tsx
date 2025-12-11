import { format, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EPGProgram {
  id: string;
  title: string;
  start: string;
  end: string;
  category?: string;
}

interface EPGMiniGuideProps {
  currentProgram?: EPGProgram | null;
  upcomingPrograms?: EPGProgram[];
  onShowFullGuide?: () => void;
  className?: string;
}

export function EPGMiniGuide({ 
  currentProgram, 
  upcomingPrograms = [],
  onShowFullGuide,
  className 
}: EPGMiniGuideProps) {
  const now = new Date();

  // Calculate progress percentage for current program
  const getProgress = () => {
    if (!currentProgram) return 0;
    const start = new Date(currentProgram.start).getTime();
    const end = new Date(currentProgram.end).getTime();
    const current = now.getTime();
    return Math.min(100, Math.max(0, ((current - start) / (end - start)) * 100));
  };

  if (!currentProgram && upcomingPrograms.length === 0) {
    return (
      <div className={cn("bg-background/80 backdrop-blur-sm rounded-lg p-3", className)}>
        <p className="text-xs text-muted-foreground text-center">
          Programação não disponível
        </p>
      </div>
    );
  }

  return (
    <div className={cn("bg-background/90 backdrop-blur-sm rounded-lg overflow-hidden", className)}>
      {/* Current program */}
      {currentProgram && (
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">
              AGORA
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(currentProgram.start), 'HH:mm')} - {format(new Date(currentProgram.end), 'HH:mm')}
            </span>
          </div>
          <h4 className="font-medium text-sm truncate">{currentProgram.title}</h4>
          {currentProgram.category && (
            <span className="text-xs text-muted-foreground">{currentProgram.category}</span>
          )}
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-1000"
              style={{ width: `${getProgress()}%` }}
            />
          </div>
        </div>
      )}

      {/* Upcoming programs */}
      {upcomingPrograms.length > 0 && (
        <div className="p-2">
          <div className="flex items-center gap-1 mb-1.5 px-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase font-medium">A seguir</span>
          </div>
          <div className="space-y-0.5">
            {upcomingPrograms.slice(0, 3).map((program) => (
              <div 
                key={program.id}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs text-muted-foreground w-10 flex-shrink-0">
                  {format(new Date(program.start), 'HH:mm')}
                </span>
                <span className="text-xs truncate flex-1">{program.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show full guide button */}
      {onShowFullGuide && (
        <button
          onClick={onShowFullGuide}
          className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs text-primary hover:bg-muted/50 transition-colors border-t border-border"
        >
          Ver programação completa
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
