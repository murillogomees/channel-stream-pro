import { useState, useEffect } from "react";
import { AdminLayout, PageHeader } from "@/components/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  Code2, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Settings,
  Search,
  Loader2,
  FileCode
} from "lucide-react";
import { toast } from "sonner";

interface FunctionInfo {
  name: string;
  status: 'used' | 'dead' | 'suspect';
  calledFrom: string[];
  lastUsed?: string;
  action: 'keep' | 'remove' | 'refactor' | null;
}

// Database functions from the schema
const DB_FUNCTIONS: FunctionInfo[] = [
  { name: 'handle_new_user', status: 'used', calledFrom: ['auth.users trigger'], action: null },
  { name: 'is_admin_or_master', status: 'used', calledFrom: ['RLS policies (40+)'], action: null },
  { name: 'has_role', status: 'used', calledFrom: ['RLS policies', 'AuthContext'], action: null },
  { name: 'update_updated_at_column', status: 'used', calledFrom: ['Multiple triggers'], action: null },
  { name: 'normalize_text', status: 'used', calledFrom: ['iptv_channels', 'search functions'], action: null },
  { name: 'generate_source_hash', status: 'used', calledFrom: ['M3U import'], action: null },
  { name: 'get_channel_shard', status: 'used', calledFrom: ['IPTV routing'], action: null },
  { name: 'update_channel_health', status: 'used', calledFrom: ['Health checks'], action: null },
  { name: 'generate_stream_token', status: 'used', calledFrom: ['Stream proxy'], action: null },
  { name: 'validate_stream_token', status: 'used', calledFrom: ['Stream proxy'], action: null },
  { name: 'check_rate_limit', status: 'used', calledFrom: ['Rate limiter'], action: null },
  { name: 'is_blocked', status: 'used', calledFrom: ['IP blocking'], action: null },
  { name: 'auto_block_identifier', status: 'suspect', calledFrom: ['Security events'], lastUsed: '30d ago', action: null },
  { name: 'cleanup_rate_limits', status: 'used', calledFrom: ['Cron jobs'], action: null },
  { name: 'revoke_token_family', status: 'suspect', calledFrom: ['Token management'], lastUsed: '45d ago', action: null },
  { name: 'parse_series_info_from_name', status: 'used', calledFrom: ['Series organization'], action: null },
  { name: 'auto_organize_series_channels', status: 'used', calledFrom: ['Admin IPTV'], action: null },
  { name: 'force_detect_series_by_pattern', status: 'suspect', calledFrom: ['Manual trigger only'], action: null },
  { name: 'get_sync_statistics', status: 'used', calledFrom: ['M3U sync dashboard'], action: null },
  { name: 'get_m3u_distinct_categories', status: 'used', calledFrom: ['IPTV filters'], action: null },
  { name: 'cleanup_iptv_duplicates', status: 'suspect', calledFrom: ['Manual cleanup'], lastUsed: '60d ago', action: null },
  { name: 'toggle_feature_flag', status: 'dead', calledFrom: [], action: null },
  { name: 'cleanup_fase8_old_data', status: 'dead', calledFrom: [], action: null },
  { name: 'check_suspicious_login', status: 'used', calledFrom: ['Auth monitoring'], action: null },
  { name: 'get_auth_statistics', status: 'used', calledFrom: ['Admin dashboard'], action: null },
  { name: 'get_active_sessions', status: 'used', calledFrom: ['Admin users'], action: null },
  { name: 'track_affiliate_click', status: 'used', calledFrom: ['Affiliate system'], action: null }
];

export default function FunctionsRPCs() {
  const [functions, setFunctions] = useState<FunctionInfo[]>(DB_FUNCTIONS);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'used' | 'dead' | 'suspect'>('all');

  const setFunctionAction = (name: string, action: FunctionInfo['action']) => {
    setFunctions(prev => prev.map(f => 
      f.name === name ? { ...f, action } : f
    ));
    toast.success(`Ação "${action}" definida para ${name}`);
  };

  const applyDefaultActions = () => {
    setFunctions(prev => prev.map(f => ({
      ...f,
      action: f.status === 'dead' ? 'remove' : 
              f.status === 'suspect' ? 'refactor' : 'keep'
    })));
    toast.success("Ações padrão aplicadas");
  };

  const getStatusBadge = (status: FunctionInfo['status']) => {
    switch (status) {
      case 'used':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" /> Usada</Badge>;
      case 'dead':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="h-3 w-3 mr-1" /> Morta</Badge>;
      case 'suspect':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><AlertTriangle className="h-3 w-3 mr-1" /> Suspeita</Badge>;
    }
  };

  const getActionBadge = (action: FunctionInfo['action']) => {
    if (!action) return null;
    switch (action) {
      case 'keep':
        return <Badge variant="outline" className="text-green-400 border-green-500/30">Manter</Badge>;
      case 'remove':
        return <Badge variant="outline" className="text-red-400 border-red-500/30">Remover</Badge>;
      case 'refactor':
        return <Badge variant="outline" className="text-blue-400 border-blue-500/30">Refatorar</Badge>;
    }
  };

  const filteredFunctions = functions.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase()) ||
                          f.calledFrom.some(c => c.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === 'all' || f.status === filter;
    return matchesSearch && matchesFilter;
  });

  const usedCount = functions.filter(f => f.status === 'used').length;
  const deadCount = functions.filter(f => f.status === 'dead').length;
  const suspectCount = functions.filter(f => f.status === 'suspect').length;

  return (
    <AdminLayout>
      <PageHeader
        title="Functions & RPCs"
        description="Gerenciamento de funções do banco de dados"
        backTo="/admin/system"
      />

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{functions.length}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 cursor-pointer hover:bg-accent/10" onClick={() => setFilter('used')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-400">Usadas</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-400">{usedCount}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 cursor-pointer hover:bg-accent/10" onClick={() => setFilter('dead')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-400">Mortas</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-400">{deadCount}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50 cursor-pointer hover:bg-accent/10" onClick={() => setFilter('suspect')}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-400">Suspeitas</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-yellow-400">{suspectCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar funções..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={filter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  Todas
                </Button>
                <Button 
                  variant={filter === 'used' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilter('used')}
                  className={filter === 'used' ? 'bg-green-500/20 text-green-400' : ''}
                >
                  Usadas
                </Button>
                <Button 
                  variant={filter === 'dead' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilter('dead')}
                  className={filter === 'dead' ? 'bg-red-500/20 text-red-400' : ''}
                >
                  Mortas
                </Button>
                <Button 
                  variant={filter === 'suspect' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setFilter('suspect')}
                  className={filter === 'suspect' ? 'bg-yellow-500/20 text-yellow-400' : ''}
                >
                  Suspeitas
                </Button>
              </div>
              <Button variant="secondary" onClick={applyDefaultActions}>
                <Settings className="h-4 w-4 mr-2" />
                Aplicar Ações Padrão
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Functions List */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Funções do Banco ({filteredFunctions.length})</CardTitle>
            <CardDescription>
              ⚠️ Default = Remover se não usada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredFunctions.map(func => (
                  <div 
                    key={func.name}
                    className={`p-4 rounded-lg bg-background/50 border border-border/50 
                      ${func.status === 'used' ? 'border-l-4 border-l-green-500' : 
                        func.status === 'dead' ? 'border-l-4 border-l-red-500' : 
                        'border-l-4 border-l-yellow-500'}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <FileCode className="h-4 w-4 text-primary" />
                        <code className="font-mono text-sm">{func.name}()</code>
                        {getStatusBadge(func.status)}
                      </div>
                      {func.action && getActionBadge(func.action)}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {func.calledFrom.length > 0 ? (
                          <span>Chamada em: {func.calledFrom.join(', ')}</span>
                        ) : (
                          <span className="text-red-400">Nenhuma chamada detectada</span>
                        )}
                        {func.lastUsed && (
                          <span className="ml-2 text-yellow-400">• Último uso: {func.lastUsed}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setFunctionAction(func.name, 'keep')}
                          className={func.action === 'keep' ? 'bg-green-500/20' : ''}
                        >
                          Manter
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setFunctionAction(func.name, 'refactor')}
                          className={func.action === 'refactor' ? 'bg-blue-500/20' : ''}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refatorar
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setFunctionAction(func.name, 'remove')}
                          className={func.action === 'remove' ? 'bg-red-500/20' : ''}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
