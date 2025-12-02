import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { migrationAutomationService } from '@/services/migrationAutomationService';

export function MigrationStats() {
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    resolved: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await migrationAutomationService.getDriftStats();
      setStats(data);
    } catch (error) {
      console.error('[Stats] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const unresolved = stats.total - stats.resolved;
  const criticalPercentage = stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className={unresolved > 0 ? 'bg-destructive/10 border-destructive/20' : 'bg-green-500/10 border-green-500/20'}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Unresolved</p>
              <p className="text-3xl font-bold">{unresolved}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total} total findings
              </p>
            </div>
            <AlertCircle className={`h-8 w-8 ${unresolved > 0 ? 'text-destructive' : 'text-green-500'}`} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-orange-500/10 border-orange-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Critical</p>
              <p className="text-3xl font-bold">{stats.critical}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {criticalPercentage}% of total
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-yellow-500/10 border-yellow-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">High Priority</p>
              <p className="text-3xl font-bold">{stats.high}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Requires attention
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Resolved</p>
              <p className="text-3xl font-bold">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Fixed successfully
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}