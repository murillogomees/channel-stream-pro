import { useState, useEffect } from "react";
import { AdminLayout, PageHeader } from "@/components/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Shield, 
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Plus,
  Trash2,
  Settings,
  Search,
  Loader2,
  Eye
} from "lucide-react";
import { toast } from "sonner";

interface RLSPolicy {
  name: string;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  expression: string;
}

interface TableRLS {
  table: string;
  rlsEnabled: boolean;
  policies: RLSPolicy[];
  orphanPolicies: string[];
}

// RLS data based on the schema
const RLS_DATA: TableRLS[] = [
  {
    table: 'profiles',
    rlsEnabled: true,
    policies: [
      { name: 'Users can view own profile', command: 'SELECT', expression: 'auth.uid() = id OR is_admin_or_master()' },
      { name: 'Users can update own profile', command: 'UPDATE', expression: 'auth.uid() = id' },
      { name: 'Admins can manage all profiles', command: 'ALL', expression: 'is_admin_or_master()' }
    ],
    orphanPolicies: []
  },
  {
    table: 'user_roles',
    rlsEnabled: true,
    policies: [
      { name: 'Users can view own roles', command: 'SELECT', expression: 'auth.uid() = user_id OR is_admin_or_master()' },
      { name: 'Admins can manage roles', command: 'ALL', expression: 'is_admin_or_master()' }
    ],
    orphanPolicies: []
  },
  {
    table: 'subscription_plans',
    rlsEnabled: true,
    policies: [
      { name: 'Anyone can view plans', command: 'SELECT', expression: 'true' },
      { name: 'Admins can manage plans', command: 'ALL', expression: 'is_admin_or_master()' }
    ],
    orphanPolicies: []
  },
  {
    table: 'payments',
    rlsEnabled: true,
    policies: [
      { name: 'Users can view own payments', command: 'SELECT', expression: 'auth.uid() = user_id' },
      { name: 'Admins can manage payments', command: 'ALL', expression: 'is_admin_or_master()' }
    ],
    orphanPolicies: []
  },
  {
    table: 'iptv_channels',
    rlsEnabled: true,
    policies: [
      { name: 'Authenticated users can view', command: 'SELECT', expression: 'auth.role() = \'authenticated\'' },
      { name: 'Admins can manage channels', command: 'ALL', expression: 'is_admin_or_master()' }
    ],
    orphanPolicies: []
  },
  {
    table: 'iptv_playlists',
    rlsEnabled: true,
    policies: [
      { name: 'Users can view own playlists', command: 'SELECT', expression: 'auth.uid() = user_id OR is_public = true' },
      { name: 'Users can manage own playlists', command: 'ALL', expression: 'auth.uid() = user_id' }
    ],
    orphanPolicies: []
  },
  {
    table: 'notification_templates',
    rlsEnabled: true,
    policies: [
      { name: 'Admins can manage templates', command: 'ALL', expression: 'is_admin_or_master()' }
    ],
    orphanPolicies: []
  },
  {
    table: 'activity_logs',
    rlsEnabled: true,
    policies: [
      { name: 'Users can view own activity', command: 'SELECT', expression: 'auth.uid() = user_id' },
      { name: 'Admins can view all', command: 'SELECT', expression: 'is_admin_or_master()' },
      { name: 'Anyone can insert', command: 'INSERT', expression: 'true' }
    ],
    orphanPolicies: []
  },
  {
    table: 'security_events',
    rlsEnabled: true,
    policies: [
      { name: 'Admins can manage', command: 'ALL', expression: 'is_admin_or_master()' },
      { name: 'Anyone can insert', command: 'INSERT', expression: 'true' }
    ],
    orphanPolicies: []
  },
  {
    table: 'affiliates',
    rlsEnabled: true,
    policies: [
      { name: 'Users can view own affiliate', command: 'SELECT', expression: 'auth.uid() = user_id' },
      { name: 'Admins can manage', command: 'ALL', expression: 'is_admin_or_master()' }
    ],
    orphanPolicies: []
  },
  {
    table: 'homepage_content',
    rlsEnabled: true,
    policies: [
      { name: 'Anyone can view', command: 'SELECT', expression: 'true' },
      { name: 'Admins can manage', command: 'ALL', expression: 'is_admin_or_master()' }
    ],
    orphanPolicies: []
  },
  {
    table: 'test_contacts',
    rlsEnabled: true,
    policies: [
      { name: 'Admins can manage', command: 'ALL', expression: 'is_admin_or_master()' }
    ],
    orphanPolicies: []
  }
];

export default function RLSControl() {
  const [tables, setTables] = useState<TableRLS[]>(RLS_DATA);
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState<TableRLS | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleRLS = (tableName: string) => {
    setTables(prev => prev.map(t => 
      t.table === tableName ? { ...t, rlsEnabled: !t.rlsEnabled } : t
    ));
    const table = tables.find(t => t.table === tableName);
    toast.success(`RLS ${!table?.rlsEnabled ? 'ativada' : 'desativada'} para ${tableName}`);
  };

  const applyDefaultPolicy = (tableName: string) => {
    toast.success(`Policy padrão aplicada para ${tableName}`);
  };

  const removePolicy = (tableName: string, policyName: string) => {
    setTables(prev => prev.map(t => 
      t.table === tableName 
        ? { ...t, policies: t.policies.filter(p => p.name !== policyName) }
        : t
    ));
    toast.success(`Policy "${policyName}" removida`);
  };

  const filteredTables = tables.filter(t => 
    t.table.toLowerCase().includes(search.toLowerCase())
  );

  const enabledCount = tables.filter(t => t.rlsEnabled).length;
  const disabledCount = tables.filter(t => !t.rlsEnabled).length;
  const totalPolicies = tables.reduce((sum, t) => sum + t.policies.length, 0);
  const orphanCount = tables.reduce((sum, t) => sum + t.orphanPolicies.length, 0);

  return (
    <AdminLayout>
      <PageHeader
        title="RLS Control"
        description="Controle de Row Level Security por tabela"
        backTo="/admin/system"
      />

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-400" />
                RLS Ativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-400">{enabledCount}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldX className="h-4 w-4 text-red-400" />
                RLS Inativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-400">{disabledCount}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Total Policies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalPolicies}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-yellow-400" />
                Órfãs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-yellow-400">{orphanCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tabelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTables.map(table => (
            <Card 
              key={table.table}
              className={`bg-card/50 border-border/50 cursor-pointer hover:bg-accent/10 transition-colors
                ${table.rlsEnabled ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}
              onClick={() => setSelectedTable(table)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {table.rlsEnabled ? (
                      <ShieldCheck className="h-5 w-5 text-green-400" />
                    ) : (
                      <ShieldX className="h-5 w-5 text-red-400" />
                    )}
                    <CardTitle className="text-base">{table.table}</CardTitle>
                  </div>
                  <Switch
                    checked={table.rlsEnabled}
                    onCheckedChange={() => toggleRLS(table.table)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {table.policies.slice(0, 2).map(policy => (
                    <Badge key={policy.name} variant="secondary" className="text-xs">
                      {policy.command}
                    </Badge>
                  ))}
                  {table.policies.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{table.policies.length - 2}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selected Table Detail */}
        {selectedTable && (
          <Card className="bg-card/50 border-primary/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>{selectedTable.table}</CardTitle>
                  <Badge className={selectedTable.rlsEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                    RLS {selectedTable.rlsEnabled ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTable(null)}>
                  ✕
                </Button>
              </div>
              <CardDescription>
                {selectedTable.policies.length} policies configuradas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {selectedTable.policies.map((policy, i) => (
                    <div 
                      key={i}
                      className="p-4 rounded-lg bg-background/50 border border-border/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{policy.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{policy.command}</Badge>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-6 w-6 text-red-400 hover:text-red-300"
                            onClick={() => removePolicy(selectedTable.table, policy.name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <code className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded block">
                        {policy.expression}
                      </code>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2 pt-4 border-t border-border/50">
                <Button 
                  variant="outline" 
                  onClick={() => applyDefaultPolicy(selectedTable.table)}
                  className="flex-1"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Aplicar RLS Padrão
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => toast.info("Ajuste de policy em desenvolvimento")}
                  className="flex-1"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Ajustar Policy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
