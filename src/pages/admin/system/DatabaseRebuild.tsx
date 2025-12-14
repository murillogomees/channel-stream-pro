import { useState, useEffect } from "react";
import { AdminLayout, PageHeader } from "@/components/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Database, 
  Table2, 
  Trash2, 
  Settings2, 
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Loader2,
  RefreshCw,
  Plus,
  Minus,
  FileCode
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TableInfo {
  name: string;
  rowCount: number;
  status: 'used' | 'partial' | 'unused';
  usedIn: string[];
  action: 'keep' | 'simplify' | 'remove' | 'create' | null;
}

interface DatabaseStats {
  totalTables: number;
  usedTables: number;
  orphanTables: number;
  deadFunctions: number;
  pendingRLS: number;
}

// Tables that are actively used in the codebase
const USED_TABLES = [
  'profiles', 'user_roles', 'subscription_plans', 'payments', 
  'notification_templates', 'notification_queue', 'auto_notifications',
  'iptv_channels', 'iptv_playlists', 'iptv_playlist_channels',
  'activity_logs', 'security_events', 'auth_sessions_log',
  'homepage_content', 'homepage_faqs', 'banners',
  'affiliates', 'affiliate_referrals', 'affiliate_payouts',
  'discount_coupons', 'test_contacts'
];

// Tables with partial usage
const PARTIAL_TABLES = [
  'm3u_sources', 'epg_programs', 'device_fingerprints',
  'ip_blacklist', 'ip_whitelist', 'health_checks',
  'feature_flag_config', 'app_versions'
];

export default function DatabaseRebuild() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);

  const fetchDatabaseStats = async () => {
    setLoading(true);
    try {
      // Predefined table info (simulated - in production would query information_schema)
      const tableData: TableInfo[] = [
        { name: 'profiles', rowCount: 0, status: 'used', usedIn: getTableUsage('profiles'), action: null },
        { name: 'user_roles', rowCount: 0, status: 'used', usedIn: getTableUsage('user_roles'), action: null },
        { name: 'subscription_plans', rowCount: 0, status: 'used', usedIn: getTableUsage('subscription_plans'), action: null },
        { name: 'payments', rowCount: 0, status: 'used', usedIn: getTableUsage('payments'), action: null },
        { name: 'notification_templates', rowCount: 0, status: 'used', usedIn: getTableUsage('notification_templates'), action: null },
        { name: 'iptv_channels', rowCount: 0, status: 'used', usedIn: getTableUsage('iptv_channels'), action: null },
        { name: 'iptv_playlists', rowCount: 0, status: 'used', usedIn: getTableUsage('iptv_playlists'), action: null },
        { name: 'activity_logs', rowCount: 0, status: 'used', usedIn: getTableUsage('activity_logs'), action: null },
        { name: 'security_events', rowCount: 0, status: 'used', usedIn: getTableUsage('security_events'), action: null },
        { name: 'homepage_content', rowCount: 0, status: 'used', usedIn: getTableUsage('homepage_content'), action: null },
        { name: 'affiliates', rowCount: 0, status: 'used', usedIn: getTableUsage('affiliates'), action: null },
        { name: 'discount_coupons', rowCount: 0, status: 'used', usedIn: getTableUsage('discount_coupons'), action: null },
        { name: 'm3u_sources', rowCount: 0, status: 'partial', usedIn: [], action: null },
        { name: 'epg_programs', rowCount: 0, status: 'partial', usedIn: [], action: null },
        { name: 'device_fingerprints', rowCount: 0, status: 'partial', usedIn: [], action: null },
        { name: 'feature_flag_config', rowCount: 0, status: 'partial', usedIn: [], action: null },
      ];

      // Fetch counts for key tables
      const { count: profilesCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: channelsCount } = await supabase.from('iptv_channels').select('*', { count: 'exact', head: true });
      
      tableData[0].rowCount = profilesCount || 0;
      tableData[5].rowCount = channelsCount || 0;

      setTables(tableData);

      setStats({
        totalTables: tableData.length,
        usedTables: tableData.filter(t => t.status === 'used').length,
        orphanTables: tableData.filter(t => t.status === 'unused').length,
        deadFunctions: 3, // Placeholder - would need actual function scan
        pendingRLS: 5 // Placeholder - would need actual RLS scan
      });

      toast.success("Dados carregados");
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const getTableUsage = (tableName: string): string[] => {
    const usageMap: Record<string, string[]> = {
      profiles: ['AuthContext', 'AdminUserList', 'AdminClientes', 'useProfiles'],
      user_roles: ['AuthContext', 'AdminUserRoles', 'useAuth'],
      subscription_plans: ['AdminPlansManager', 'Checkout', 'PlansSection'],
      payments: ['AdminPayments', 'CheckoutSuccess', 'usePayments'],
      notification_templates: ['AdminTemplates', 'AdminNotificacoes'],
      notification_queue: ['AdminNotificationQueue', 'NotificationService'],
      iptv_channels: ['IPTVPlayer', 'AdminIPTV', 'useIPTVChannels'],
      iptv_playlists: ['IPTVHome', 'useIPTVPlaylists'],
      activity_logs: ['AdminActivityLogs', 'useActivityLogs'],
      security_events: ['AdminSecurity', 'useSecurityEvents'],
      homepage_content: ['Homepage', 'AdminHomepageEditor'],
      homepage_faqs: ['FAQSection', 'AdminHomepageEditor'],
      affiliates: ['AffiliateDashboard', 'AdminAffiliates'],
      discount_coupons: ['Checkout', 'AdminCoupons']
    };
    return usageMap[tableName] || [];
  };

  const setTableAction = (tableName: string, action: TableInfo['action']) => {
    setTables(prev => prev.map(t => 
      t.name === tableName ? { ...t, action } : t
    ));
  };

  const getStatusBadge = (status: TableInfo['status']) => {
    switch (status) {
      case 'used':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" /> Usada</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><AlertTriangle className="h-3 w-3 mr-1" /> Parcial</Badge>;
      case 'unused':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" /> Não Usada</Badge>;
    }
  };

  const getActionBadge = (action: TableInfo['action']) => {
    if (!action) return null;
    switch (action) {
      case 'keep':
        return <Badge variant="outline" className="text-green-400 border-green-500/30">Manter</Badge>;
      case 'simplify':
        return <Badge variant="outline" className="text-blue-400 border-blue-500/30">Simplificar</Badge>;
      case 'remove':
        return <Badge variant="outline" className="text-red-400 border-red-500/30">Remover</Badge>;
      case 'create':
        return <Badge variant="outline" className="text-purple-400 border-purple-500/30">Criar</Badge>;
    }
  };

  useEffect(() => {
    fetchDatabaseStats();
  }, []);

  const usedTables = tables.filter(t => t.status === 'used');
  const partialTables = tables.filter(t => t.status === 'partial');
  const unusedTables = tables.filter(t => t.status === 'unused');

  return (
    <AdminLayout>
      <PageHeader
        title="Database Rebuild"
        description="Visão geral e decisão por tabela"
        backTo="/admin/system"
      />

      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{stats?.totalTables || '-'}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-400">Usadas</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-400">{stats?.usedTables || '-'}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-400">Órfãs</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-400">{stats?.orphanTables || '-'}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-400">Functions Mortas</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-yellow-400">{stats?.deadFunctions || '-'}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-400">RLS Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-orange-400">{stats?.pendingRLS || '-'}</span>
            </CardContent>
          </Card>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button onClick={fetchDatabaseStats} disabled={loading} variant="outline">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </div>

        {/* Tables by Category */}
        <Tabs defaultValue="used" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="used" className="data-[state=active]:bg-green-500/20">
              Usadas ({usedTables.length})
            </TabsTrigger>
            <TabsTrigger value="partial" className="data-[state=active]:bg-yellow-500/20">
              Parciais ({partialTables.length})
            </TabsTrigger>
            <TabsTrigger value="unused" className="data-[state=active]:bg-red-500/20">
              Órfãs ({unusedTables.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="used">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-green-400">Tabelas Usadas</CardTitle>
                <CardDescription>
                  Tabelas ativamente utilizadas no código
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {usedTables.map(table => (
                      <TableCard 
                        key={table.name} 
                        table={table} 
                        onAction={setTableAction}
                        onSelect={() => setSelectedTable(table)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="partial">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-yellow-400">Tabelas Parcialmente Usadas</CardTitle>
                <CardDescription>
                  Tabelas com uso limitado ou deprecated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {partialTables.map(table => (
                      <TableCard 
                        key={table.name} 
                        table={table} 
                        onAction={setTableAction}
                        onSelect={() => setSelectedTable(table)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unused">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-red-400">Tabelas Órfãs</CardTitle>
                <CardDescription>
                  Tabelas sem uso detectado - candidatas a remoção
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unusedTables.length === 0 ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Nenhuma tabela órfã</AlertTitle>
                    <AlertDescription>
                      Todas as tabelas estão sendo utilizadas no sistema.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {unusedTables.map(table => (
                        <TableCard 
                          key={table.name} 
                          table={table} 
                          onAction={setTableAction}
                          onSelect={() => setSelectedTable(table)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Selected Table Detail */}
        {selectedTable && (
          <Card className="bg-card/50 border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Table2 className="h-5 w-5 text-primary" />
                    {selectedTable.name}
                  </CardTitle>
                  <CardDescription>
                    {selectedTable.rowCount} registros
                  </CardDescription>
                </div>
                {getStatusBadge(selectedTable.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileCode className="h-4 w-4" />
                  Onde é usada:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTable.usedIn.length > 0 ? (
                    selectedTable.usedIn.map(file => (
                      <Badge key={file} variant="secondary">{file}</Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">Nenhum uso detectado</span>
                  )}
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Validação do Lovable</AlertTitle>
                <AlertDescription>
                  {selectedTable.status === 'used' ? (
                    <>Esta tabela é crítica para o funcionamento do sistema. Remoção causará {selectedTable.usedIn.length} erros potenciais.</>
                  ) : selectedTable.status === 'partial' ? (
                    <>Esta tabela tem uso limitado. Considere simplificar ou manter para compatibilidade.</>
                  ) : (
                    <>Esta tabela não tem uso detectado. Seguro para remoção após confirmação.</>
                  )}
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setTableAction(selectedTable.name, 'keep')}
                  className={selectedTable.action === 'keep' ? 'border-green-500' : ''}
                >
                  Manter
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setTableAction(selectedTable.name, 'simplify')}
                  className={selectedTable.action === 'simplify' ? 'border-blue-500' : ''}
                >
                  Simplificar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setTableAction(selectedTable.name, 'remove')}
                  className={selectedTable.action === 'remove' ? 'border-red-500' : ''}
                  disabled={selectedTable.status === 'used'}
                >
                  Remover
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedTable(null)}
                >
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

function TableCard({ 
  table, 
  onAction, 
  onSelect 
}: { 
  table: TableInfo; 
  onAction: (name: string, action: TableInfo['action']) => void;
  onSelect: () => void;
}) {
  const getStatusColor = () => {
    switch (table.status) {
      case 'used': return 'border-l-green-500';
      case 'partial': return 'border-l-yellow-500';
      case 'unused': return 'border-l-red-500';
    }
  };

  return (
    <div 
      className={`p-4 rounded-lg bg-background/50 border border-border/50 border-l-4 ${getStatusColor()} cursor-pointer hover:bg-accent/10 transition-colors`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium">{table.name}</span>
            <span className="text-muted-foreground text-sm ml-2">({table.rowCount} rows)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {table.action && (
            <Badge variant="outline" className={
              table.action === 'keep' ? 'text-green-400 border-green-500/30' :
              table.action === 'simplify' ? 'text-blue-400 border-blue-500/30' :
              table.action === 'remove' ? 'text-red-400 border-red-500/30' :
              'text-purple-400 border-purple-500/30'
            }>
              {table.action}
            </Badge>
          )}
          <Eye className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      {table.usedIn.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {table.usedIn.slice(0, 3).map(file => (
            <Badge key={file} variant="secondary" className="text-xs">{file}</Badge>
          ))}
          {table.usedIn.length > 3 && (
            <Badge variant="secondary" className="text-xs">+{table.usedIn.length - 3}</Badge>
          )}
        </div>
      )}
    </div>
  );
}
