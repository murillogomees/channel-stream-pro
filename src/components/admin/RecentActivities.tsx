import { useEffect, useState, memo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Bell, Smartphone, CheckCircle, XCircle, Settings } from 'lucide-react';
import { activityLogService } from '@/services/activityLogService';
import type { ActivityLog } from '@/types/activity';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

// Memoized icon and color lookup functions
const activityIcons: Record<string, React.ReactNode> = {
  client_created: <Users className="h-4 w-4" />,
  client_updated: <Users className="h-4 w-4" />,
  notification_sent: <Bell className="h-4 w-4" />,
  notification_failed: <XCircle className="h-4 w-4" />,
  playlist_synced: <Smartphone className="h-4 w-4" />,
  config_updated: <Settings className="h-4 w-4" />,
  payment_detected: <CheckCircle className="h-4 w-4" />,
};

const getActivityIcon = (actionType: string) => activityIcons[actionType] || <Activity className="h-4 w-4" />;

const getActivityColor = (actionType: string) => {
  if (actionType.includes('failed') || actionType.includes('error')) return 'destructive';
  if (actionType.includes('created') || actionType.includes('success')) return 'default';
  return 'secondary';
};

// Memoized activity item component
const ActivityItem = memo(({ activity }: { activity: ActivityLog }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
    <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5">
      {getActivityIcon(activity.action_type)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-none mb-1">
          {activity.action_description}
        </p>
        <Badge variant={getActivityColor(activity.action_type)} className="shrink-0">
          {activity.action_type.replace(/_/g, ' ')}
        </Badge>
      </div>
      {activity.entity_type && (
        <p className="text-xs text-muted-foreground">{activity.entity_type}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })}
      </p>
    </div>
  </div>
));
ActivityItem.displayName = 'ActivityItem';

export const RecentActivities = memo(function RecentActivities() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadActivities = useCallback(async () => {
    try {
      const data = await activityLogService.getRecentActivities(10);
      setActivities(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao carregar atividades:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();

    // Subscribe to real-time updates
    const unsubscribe = activityLogService.subscribeToActivities((newActivity) => {
      setActivities((prev) => [newActivity, ...prev].slice(0, 10));
      setLastUpdate(new Date());
    });

    return unsubscribe;
  }, [loadActivities]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Atividades Recentes</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                <span>Ao vivo • {lastUpdate.toLocaleTimeString('pt-BR')}</span>
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            Tempo Real
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma atividade registrada ainda
          </p>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});
