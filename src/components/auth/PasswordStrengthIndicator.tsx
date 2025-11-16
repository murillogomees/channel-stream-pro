import { useEffect, useState } from "react";
import { evaluatePasswordStrength } from "@/utils/passwordSecurity";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthIndicatorProps {
  password: string;
  onStrengthChange?: (isStrong: boolean) => void;
}

export const PasswordStrengthIndicator = ({ 
  password, 
  onStrengthChange 
}: PasswordStrengthIndicatorProps) => {
  const [strength, setStrength] = useState({ isStrong: false, score: 0, feedback: [] as string[] });

  useEffect(() => {
    if (password) {
      const result = evaluatePasswordStrength(password);
      setStrength(result);
      onStrengthChange?.(result.isStrong);
    } else {
      setStrength({ isStrong: false, score: 0, feedback: [] });
      onStrengthChange?.(false);
    }
  }, [password, onStrengthChange]);

  if (!password) return null;

  const getStrengthColor = () => {
    if (strength.score >= 5) return "bg-green-500";
    if (strength.score >= 3) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStrengthText = () => {
    if (strength.score >= 5) return "Senha forte";
    if (strength.score >= 3) return "Senha média";
    return "Senha fraca";
  };

  const getStrengthIcon = () => {
    if (strength.score >= 5) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (strength.score >= 3) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const progressValue = (strength.score / 6) * 100;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        {getStrengthIcon()}
        <span className={cn(
          "text-sm font-medium",
          strength.score >= 5 ? "text-green-600" : 
          strength.score >= 3 ? "text-yellow-600" : 
          "text-red-600"
        )}>
          {getStrengthText()}
        </span>
      </div>
      
      <Progress 
        value={progressValue} 
        className="h-2"
        indicatorClassName={getStrengthColor()}
      />
      
      {strength.feedback.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1 mt-2">
          {strength.feedback.map((item, index) => (
            <li key={index} className="flex items-start gap-1">
              <span className="text-red-500 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
