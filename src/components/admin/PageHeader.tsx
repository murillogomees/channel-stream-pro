import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  description?: string;
  backTo?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, backTo = "/dashboard", actions }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-6">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(backTo)}
          className="hover:bg-primary/10 flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{title}</h1>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 line-clamp-2">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 pl-11 sm:pl-0">
          {actions}
        </div>
      )}
    </div>
  );
}
