import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, CheckCircle, Clock, AlertTriangle, Zap, HardDrive } from 'lucide-react';

interface MigrationStats {
  sync_entries: { total: number; synced: number; pending: number };
  channels: { total: number; synced: number; pending: number };
  playlist_entries: { total: number; synced: number; pending: number };
  jobs: { total: number; running: number; completed: number; failed: number };
  failed_items: number;
}

interface MigrationStatsCardsProps {
  stats: MigrationStats | null;
  isLoading?: boolean;
}

export function MigrationStatsCards({ stats, isLoading }: MigrationStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-4 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 bg-muted rounded mb-1" />
              <div className="h-3 w-32 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const totalItems = stats.sync_entries.total + stats.channels.total + stats.playlist_entries.total;
  const syncedItems = stats.sync_entries.synced + stats.channels.synced + stats.playlist_entries.synced;
  const pendingItems = stats.sync_entries.pending + stats.channels.pending + stats.playlist_entries.pending;
  const syncProgress = totalItems > 0 ? Math.round((syncedItems / totalItems) * 100) : 0;

  const cards = [
    {
      title: 'Total de Items',
      value: totalItems.toLocaleString(),
      description: `${syncProgress}% migrado para R2`,
      icon: Database,
      iconColor: 'text-blue-500',
    },
    {
      title: 'Sincronizados',
      value: syncedItems.toLocaleString(),
      description: 'Items no R2 CDN',
      icon: CheckCircle,
      iconColor: 'text-green-500',
    },
    {
      title: 'Pendentes',
      value: pendingItems.toLocaleString(),
      description: 'Aguardando migração',
      icon: Clock,
      iconColor: 'text-yellow-500',
    },
    {
      title: 'Falhas',
      value: stats.failed_items.toLocaleString(),
      description: 'Requerem atenção',
      icon: AlertTriangle,
      iconColor: stats.failed_items > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.iconColor}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableBreakdownCards({ stats }: { stats: MigrationStats | null }) {
  if (!stats) return null;

  const tables = [
    { name: 'm3u_sync_entries', data: stats.sync_entries, icon: Database },
    { name: 'm3u_channels', data: stats.channels, icon: HardDrive },
    { name: 'playlist_entries', data: stats.playlist_entries, icon: Zap },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {tables.map((table) => {
        const progress = table.data.total > 0 
          ? Math.round((table.data.synced / table.data.total) * 100) 
          : 0;

        return (
          <Card key={table.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{table.name}</CardTitle>
              <table.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{table.data.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Sincronizado</span>
                <span className="font-medium">{table.data.synced.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-yellow-600">Pendente</span>
                <span className="font-medium">{table.data.pending.toLocaleString()}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mt-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">{progress}% completo</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
