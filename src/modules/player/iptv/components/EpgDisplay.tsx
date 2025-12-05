/**
 * EPG Display Component
 */

import React from 'react';
import { X, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EpgProgram } from '../types';

interface EpgDisplayProps {
  currentProgram: EpgProgram | null;
  upcomingPrograms: EpgProgram[];
  isLoading: boolean;
  onClose: () => void;
}

export function EpgDisplay({
  currentProgram,
  upcomingPrograms,
  isLoading,
  onClose,
}: EpgDisplayProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getProgress = (program: EpgProgram) => {
    const now = Date.now();
    const start = program.start.getTime();
    const end = program.end.getTime();
    const total = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-black/95 backdrop-blur-sm overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-white font-semibold">Guia de Programação</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* No EPG Available */}
      {!isLoading && !currentProgram && upcomingPrograms.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-white/50 text-center">
            Guia de programação não disponível para este canal
          </p>
        </div>
      )}

      {/* EPG Content */}
      {!isLoading && (currentProgram || upcomingPrograms.length > 0) && (
        <div className="flex-1 overflow-y-auto">
          {/* Current Program */}
          {currentProgram && (
            <div className="p-4 border-b border-white/10 bg-primary/10">
              <div className="flex items-center gap-2 text-xs text-primary mb-2">
                <span className="px-2 py-0.5 bg-primary/20 rounded-full">
                  AO VIVO
                </span>
              </div>
              
              <h4 className="text-white font-medium mb-1">
                {currentProgram.title}
              </h4>
              
              <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
                <Clock className="w-3 h-3" />
                <span>
                  {formatTime(currentProgram.start)} - {formatTime(currentProgram.end)}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-1000"
                  style={{ width: `${getProgress(currentProgram)}%` }}
                />
              </div>

              {currentProgram.description && (
                <p className="text-white/60 text-sm mt-3 line-clamp-3">
                  {currentProgram.description}
                </p>
              )}

              {currentProgram.category && (
                <span className="inline-block mt-2 px-2 py-0.5 bg-white/10 rounded text-xs text-white/70">
                  {currentProgram.category}
                </span>
              )}
            </div>
          )}

          {/* Upcoming Programs */}
          {upcomingPrograms.length > 0 && (
            <div className="p-4">
              <h5 className="text-white/50 text-xs uppercase tracking-wider mb-3">
                A seguir
              </h5>
              
              <div className="space-y-3">
                {upcomingPrograms
                  .filter(p => p.id !== currentProgram?.id)
                  .slice(0, 5)
                  .map((program) => (
                    <div
                      key={program.id}
                      className={cn(
                        'p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors',
                        'cursor-pointer'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h6 className="text-white text-sm font-medium truncate">
                            {program.title}
                          </h6>
                          <div className="flex items-center gap-1 text-xs text-white/50 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatTime(program.start)} - {formatTime(program.end)}
                            </span>
                          </div>
                        </div>
                        
                        {program.icon && (
                          <img 
                            src={program.icon} 
                            alt="" 
                            className="w-12 h-8 object-cover rounded"
                          />
                        )}
                      </div>
                      
                      {program.description && (
                        <p className="text-white/40 text-xs mt-2 line-clamp-2">
                          {program.description}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
