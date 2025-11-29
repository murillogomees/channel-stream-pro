import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminCategoryCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  stats?: {
    label: string;
    value: string | number;
  }[];
  status?: 'ok' | 'warning' | 'error';
}

export function AdminCategoryCard({
  title,
  description,
  icon: Icon,
  href,
  badge,
  badgeVariant = 'secondary',
  stats,
  status = 'ok',
}: AdminCategoryCardProps) {
  const statusColors = {
    ok: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <Link to={href} className="block group">
      <Card className="h-full transition-all duration-200 hover:shadow-lg hover:border-primary/50 group-hover:scale-[1.02]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {title}
                  {badge && (
                    <Badge variant={badgeVariant} className="text-xs">
                      {badge}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  {description}
                </CardDescription>
              </div>
            </div>
            <div className={cn('h-2 w-2 rounded-full', statusColors[status])} />
          </div>
        </CardHeader>
        {stats && stats.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex gap-4 text-sm">
              {stats.map((stat, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-muted-foreground text-xs">{stat.label}</span>
                  <span className="font-semibold">{stat.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}
