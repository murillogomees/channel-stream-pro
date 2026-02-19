import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getExpirationColor, getExpirationLabel } from "@/hooks/useSigmaClients";

interface ExpirationBadgeProps {
  expirationDate: string;
}

const colorMap = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
};

export function ExpirationBadge({ expirationDate }: ExpirationBadgeProps) {
  const color = getExpirationColor(expirationDate);
  const label = getExpirationLabel(color);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span
            className={cn(
              "inline-block h-3 w-3 rounded-full ring-2 ring-background shadow-sm",
              colorMap[color]
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
