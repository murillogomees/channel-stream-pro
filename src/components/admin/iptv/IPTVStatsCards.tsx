/**
 * IPTV Stats Cards - Reusable realtime stats card component
 */

import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color?: 'default' | 'green' | 'red' | 'blue' | 'yellow' | 'purple' | 'orange';
  loading?: boolean;
  format?: 'number' | 'text';
}

const colorClasses = {
  default: 'text-primary',
  green: 'text-green-500',
  red: 'text-red-500',
  blue: 'text-blue-500',
  yellow: 'text-yellow-500',
  purple: 'text-purple-500',
  orange: 'text-orange-500',
};

export function IPTVStatCard({ label, value, icon: Icon, color = 'default', loading, format = 'number' }: StatCardProps) {
  const displayValue = format === 'number' && typeof value === 'number' 
    ? value.toLocaleString() 
    : value;

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mt-1" />
            ) : (
              <p className={cn('text-xl font-bold', colorClasses[color])}>
                {displayValue}
              </p>
            )}
          </div>
          <Icon className={cn('h-6 w-6 opacity-50', colorClasses[color])} />
        </div>
      </CardContent>
    </Card>
  );
}

interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
}

export function IPTVStatsGrid({ children, columns = 5 }: StatsGridProps) {
  const gridClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={cn('grid gap-2 md:gap-4', gridClasses[columns])}>
      {children}
    </div>
  );
}
