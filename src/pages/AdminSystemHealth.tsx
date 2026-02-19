/**
 * AdminSystemHealth - System health overview (placeholder after IPTV removal)
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

const AdminSystemHealth = () => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Monitoramento de saúde do sistema disponível em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSystemHealth;
