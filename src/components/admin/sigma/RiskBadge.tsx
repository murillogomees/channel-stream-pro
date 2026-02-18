import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getRiskLevel } from "@/services/sigmaBlaze/sigmaClientsService";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  score: number;
  reasons: string[];
}

const levelConfig = {
  low: { label: "Baixo", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20" },
  medium: { label: "Médio", className: "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20" },
  high: { label: "Alto", className: "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20" },
};

export function RiskBadge({ score, reasons }: RiskBadgeProps) {
  const level = getRiskLevel(score);
  const config = levelConfig[level];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={cn("font-mono text-xs gap-1", config.className)}>
            {score}
            <span className="text-[10px] opacity-70">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[250px]">
          <p className="font-semibold text-xs mb-1">Score de Risco: {score}/100</p>
          <ul className="text-xs space-y-0.5">
            {reasons.map((r, i) => (
              <li key={i} className="text-muted-foreground">• {r}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
