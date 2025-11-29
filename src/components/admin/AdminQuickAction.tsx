import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface AdminQuickActionProps {
  title: string;
  icon: LucideIcon;
  href: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
}

export function AdminQuickAction({
  title,
  icon: Icon,
  href,
  variant = 'outline',
}: AdminQuickActionProps) {
  return (
    <Button variant={variant} asChild className="h-auto py-3 px-4 flex-col gap-1">
      <Link to={href}>
        <Icon className="h-5 w-5" />
        <span className="text-xs">{title}</span>
      </Link>
    </Button>
  );
}
