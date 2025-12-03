/**
 * CastButton - Chromecast/Cast button component
 */

import React, { memo } from 'react';
import { Cast, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type CastState = 'unavailable' | 'available' | 'connecting' | 'connected';

interface CastButtonProps {
  castState: CastState;
  deviceName?: string | null;
  onCastClick: () => void;
  className?: string;
}

export const CastButton = memo(function CastButton({
  castState,
  deviceName,
  onCastClick,
  className,
}: CastButtonProps) {
  if (castState === 'unavailable') {
    return null;
  }

  const isConnecting = castState === 'connecting';
  const isConnected = castState === 'connected';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCastClick}
            disabled={isConnecting}
            className={cn(
              'relative transition-colors',
              isConnected && 'text-primary',
              className
            )}
          >
            {isConnecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Cast className="w-5 h-5" />
                {isConnected && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isConnected 
            ? `Conectado a ${deviceName || 'Chromecast'}`
            : isConnecting
              ? 'Conectando...'
              : 'Transmitir para dispositivo'
          }
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

export default CastButton;
