import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

interface SmartOneValidationAlertProps {
  errors: string[];
  warnings: string[];
  className?: string;
}

export const SmartOneValidationAlert = ({ errors, warnings, className }: SmartOneValidationAlertProps) => {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <Alert className={className}>
        <ShieldCheck className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-700">Validação OK</AlertTitle>
        <AlertDescription className="text-green-600">
          Cliente pronto para sincronizar com SmartOne
        </AlertDescription>
      </Alert>
    );
  }

  if (errors.length > 0) {
    return (
      <Alert variant="destructive" className={className}>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Erros de Validação</AlertTitle>
        <AlertDescription className="space-y-1">
          <ul className="list-disc list-inside space-y-1 text-sm">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
          <p className="text-xs mt-2 opacity-80">
            Corrija os erros acima antes de sincronizar.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className={className}>
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-yellow-700">Avisos de Validação</AlertTitle>
      <AlertDescription className="space-y-1 text-yellow-600">
        <ul className="list-disc list-inside space-y-1 text-sm">
          {warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
        <p className="text-xs mt-2 opacity-80">
          Você pode prosseguir, mas recomendamos revisar os avisos.
        </p>
      </AlertDescription>
    </Alert>
  );
};
