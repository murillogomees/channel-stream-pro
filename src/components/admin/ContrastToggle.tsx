import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContrast } from '@/contexts/ContrastContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export const ContrastToggle = () => {
  const { isHighContrast, toggleHighContrast } = useContrast();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleHighContrast}
            className="transition-colors"
            aria-label={isHighContrast ? "Desativar alto contraste" : "Ativar alto contraste"}
          >
            {isHighContrast ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isHighContrast ? 'Modo Normal' : 'Alto Contraste'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
