/**
 * FormSection - Standardized form section header for all modals
 * Matches AdminUserForm styling for consistency across the system
 */

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface FormSectionProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  variant?: 'primary' | 'success' | 'warning' | 'info' | 'secondary';
  badge?: string;
  className?: string;
}

const variants = {
  primary: 'from-primary/10 to-primary/5 border-primary/20',
  success: 'from-success/10 to-success/5 border-success/20',
  warning: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
  info: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
  secondary: 'from-muted/50 to-muted/20 border-border',
};

const iconColors = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  secondary: 'text-muted-foreground',
};

export function FormSection({ 
  icon, 
  title, 
  description, 
  variant = 'primary', 
  badge,
  className 
}: FormSectionProps) {
  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border bg-gradient-to-r",
      variants[variant],
      className
    )}>
      <div className={cn("flex-shrink-0", iconColors[variant])}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {badge && (
            <Badge variant="secondary" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}

// Standard form field wrapper with consistent spacing
interface FormFieldGroupProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function FormFieldGroup({ children, columns = 2, className }: FormFieldGroupProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn("grid gap-4 pl-2", gridCols[columns], className)}>
      {children}
    </div>
  );
}

// Standardized dialog body wrapper
interface DialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return (
    <div className={cn("space-y-6 max-h-[60vh] overflow-y-auto px-6 py-4 scrollbar-thin", className)}>
      {children}
    </div>
  );
}
