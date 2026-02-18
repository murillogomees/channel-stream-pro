import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getExpirationStatus } from "@/services/sigmaBlaze/sigmaClientsService";

interface StatusCircleProps {
  expirationDate: string;
}

const colorMap = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
};

export function StatusCircle({ expirationDate }: StatusCircleProps) {
  const status = getExpirationStatus(expirationDate);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className={cn("inline-block h-3 w-3 rounded-full ring-2 ring-background", colorMap[status.color])} />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{status.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
