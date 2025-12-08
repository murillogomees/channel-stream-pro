/**
 * Migration Checklist Page - Interactive checklist for Supabase Cloud to Self-Hosted migration
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  supabaseMigrationService, 
  MIGRATION_CONFIG,
  MigrationVerificationResult 
} from '@/services/supabaseMigrationService';
import { 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  XCircle, 
  ChevronDown, 
  ChevronRight,
  Database,
  Shield,
  Server,
  Globe,
  Key,
  RefreshCw,
  Play,
  Copy,
  ExternalLink,
  Loader2,
  ArrowLeft,
  FileText,
  Webhook
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: 'database' | 'security' | 'functions' | 'integrations' | 'frontend' | 'validation';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  autoCheck?: () => Promise<boolean>;
  action?: () => Promise<void>;
  actionLabel?: string;
  commands?: string[];
  notes?: string;
  critical?: boolean;
}

// MIGRATION_CONFIG is imported from supabaseMigrationService

export default function AdminMigrationChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [runningCheck, setRunningCheck] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0
  });
  const { toast } = useToast();

  // Initialize checklist items
  const initializeChecklist = useCallback(async () => {
    const checklistItems: ChecklistItem[] = [
      // DATABASE CATEGORY
      {
        id: 'db_tables',
        title: 'Tabelas Migradas',
        description: 'Verificar se todas as tabelas públicas foram migradas',
        category: 'database',
        status: 'pending',
        critical: true,
        autoCheck: async () => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          return (count || 0) > 0;
        }
      },
      {
        id: 'db_m3u_entries',
        title: 'M3U Entries (209k+)',
        description: 'Verificar migração completa de m3u_sync_entries',
        category: 'database',
        status: 'pending',
        critical: true,
        autoCheck: async () => {
          const { count } = await supabase
            .from('m3u_sync_entries')
            .select('*', { count: 'exact', head: true });
          return (count || 0) >= 200000;
        }
      },
      {
        id: 'db_channels',
        title: 'M3U Channels (22k+)',
        description: 'Verificar migração de m3u_channels',
        category: 'database',
        status: 'pending',
        autoCheck: async () => {
          const { count } = await supabase
            .from('m3u_channels')
            .select('*', { count: 'exact', head: true });
          return (count || 0) >= 20000;
        }
      },
      {
        id: 'db_functions',
        title: 'Database Functions',
        description: 'Verificar se funções RPC foram migradas',
        category: 'database',
        status: 'pending',
        autoCheck: async () => {
          const { data, error } = await supabase.rpc('is_admin_or_master');
          return !error;
        }
      },
      {
        id: 'db_sequences',
        title: 'Sequences Atualizadas',
        description: 'Verificar se sequences estão sincronizadas',
        category: 'database',
        status: 'pending',
        notes: 'Executar UPDATE em sequences se necessário'
      },

      // SECURITY CATEGORY
      {
        id: 'sec_rls_enabled',
        title: 'RLS Policies Ativas',
        description: 'Verificar Row Level Security em todas as tabelas',
        category: 'security',
        status: 'pending',
        critical: true,
        autoCheck: async () => {
          // Check if profiles has RLS
          const { data } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);
          return data !== null; // RLS would block if not configured
        }
      },
      {
        id: 'sec_roles',
        title: 'User Roles Migrados',
        description: 'Verificar roles (master/admin/client)',
        category: 'security',
        status: 'pending',
        critical: true,
        autoCheck: async () => {
          const { count } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true });
          return (count || 0) >= 10;
        }
      },
      {
        id: 'sec_auth_users',
        title: 'Auth Users Sincronizados',
        description: 'Verificar usuários no auth.users',
        category: 'security',
        status: 'pending',
        critical: true,
        notes: 'Auth users precisam ser re-criados ou migrados separadamente'
      },
      {
        id: 'sec_jwt_secret',
        title: 'JWT Secret Configurado',
        description: 'Verificar se JWT secret está correto no self-hosted',
        category: 'security',
        status: 'pending',
        critical: true,
        notes: 'JWT secret deve ser igual ao configurado no docker-compose'
      },

      // FUNCTIONS CATEGORY
      {
        id: 'func_edge_deployed',
        title: 'Edge Functions Deployed',
        description: '75 Edge Functions precisam ser redeployadas',
        category: 'functions',
        status: 'pending',
        critical: true,
        notes: 'Executar supabase functions deploy --project-ref [self-hosted]',
        commands: [
          'cd /path/to/project',
          'supabase link --project-ref srv1182856',
          'supabase functions deploy'
        ]
      },
      {
        id: 'func_secrets',
        title: 'Function Secrets',
        description: 'Configurar secrets nas Edge Functions',
        category: 'functions',
        status: 'pending',
        critical: true,
        notes: 'Copiar todas as secrets do Supabase Cloud para Self-Hosted'
      },
      {
        id: 'func_cors',
        title: 'CORS Configurado',
        description: 'Verificar CORS headers nas Edge Functions',
        category: 'functions',
        status: 'pending'
      },

      // INTEGRATIONS CATEGORY
      {
        id: 'int_mercadopago',
        title: 'MercadoPago Webhook',
        description: 'Atualizar URL do webhook no painel MercadoPago',
        category: 'integrations',
        status: 'pending',
        critical: true,
        notes: `Novo URL: ${MIGRATION_CONFIG.destination.url}functions/v1/mercadopago-webhook`
      },
      {
        id: 'int_whatsapp',
        title: 'WhatsApp Webhook',
        description: 'Atualizar URL do webhook WhatsApp',
        category: 'integrations',
        status: 'pending',
        critical: true,
        notes: `Novo URL: ${MIGRATION_CONFIG.destination.url}functions/v1/whatsapp-webhook`
      },
      {
        id: 'int_cloudflare',
        title: 'Cloudflare R2/Workers',
        description: 'Verificar configuração R2 e CDN Workers',
        category: 'integrations',
        status: 'pending',
        notes: 'R2 credentials permanecem iguais, verificar endpoints'
      },
      {
        id: 'int_smartone',
        title: 'SmartOne API',
        description: 'Verificar integração SmartOne IPTV',
        category: 'integrations',
        status: 'pending'
      },

      // FRONTEND CATEGORY
      {
        id: 'fe_supabase_url',
        title: 'SUPABASE_URL Atualizado',
        description: 'Atualizar URL do Supabase no frontend',
        category: 'frontend',
        status: 'pending',
        critical: true,
        notes: 'Alterar em src/integrations/supabase/client.ts'
      },
      {
        id: 'fe_anon_key',
        title: 'ANON_KEY Atualizado',
        description: 'Atualizar chave anon no frontend',
        category: 'frontend',
        status: 'pending',
        critical: true
      },
      {
        id: 'fe_deploy',
        title: 'Frontend Redeployado',
        description: 'Rebuild e deploy do frontend',
        category: 'frontend',
        status: 'pending',
        critical: true
      },

      // VALIDATION CATEGORY
      {
        id: 'val_login_test',
        title: 'Teste de Login',
        description: 'Testar login com usuário master',
        category: 'validation',
        status: 'pending',
        critical: true
      },
      {
        id: 'val_crud_test',
        title: 'Teste CRUD',
        description: 'Testar operações de leitura/escrita',
        category: 'validation',
        status: 'pending'
      },
      {
        id: 'val_streaming_test',
        title: 'Teste de Streaming',
        description: 'Testar playback de vídeo/M3U',
        category: 'validation',
        status: 'pending',
        critical: true
      },
      {
        id: 'val_payment_test',
        title: 'Teste de Pagamento',
        description: 'Testar integração MercadoPago',
        category: 'validation',
        status: 'pending'
      },
      {
        id: 'val_notifications',
        title: 'Teste de Notificações',
        description: 'Testar envio WhatsApp',
        category: 'validation',
        status: 'pending'
      }
    ];

    setItems(checklistItems);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    initializeChecklist();
  }, [initializeChecklist]);

  // Calculate stats
  useEffect(() => {
    const total = items.length;
    const completed = items.filter(i => i.status === 'completed').length;
    const failed = items.filter(i => i.status === 'failed').length;
    const pending = items.filter(i => i.status === 'pending' || i.status === 'in_progress').length;
    setStats({ total, completed, failed, pending });
  }, [items]);

  // Run auto-check for an item
  const runCheck = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item?.autoCheck) return;

    setRunningCheck(itemId);
    setItems(prev => prev.map(i => 
      i.id === itemId ? { ...i, status: 'in_progress' } : i
    ));

    try {
      const result = await item.autoCheck();
      setItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, status: result ? 'completed' : 'failed' } : i
      ));
      toast({
        title: result ? 'Verificação OK' : 'Verificação Falhou',
        description: item.title,
        variant: result ? 'default' : 'destructive'
      });
    } catch (error) {
      setItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, status: 'failed' } : i
      ));
      toast({
        title: 'Erro na verificação',
        description: String(error),
        variant: 'destructive'
      });
    } finally {
      setRunningCheck(null);
    }
  };

  // Run all auto-checks
  const runAllChecks = async () => {
    const autoCheckItems = items.filter(i => i.autoCheck && i.status !== 'completed');
    
    for (const item of autoCheckItems) {
      await runCheck(item.id);
      // Small delay between checks
      await new Promise(r => setTimeout(r, 500));
    }
  };

  // Toggle item status manually
  const toggleStatus = (itemId: string) => {
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const nextStatus = i.status === 'completed' ? 'pending' : 'completed';
      return { ...i, status: nextStatus };
    }));
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!', description: 'Texto copiado para clipboard' });
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'security':
        return <Shield className="h-4 w-4" />;
      case 'functions':
        return <Server className="h-4 w-4" />;
      case 'integrations':
        return <Globe className="h-4 w-4" />;
      case 'frontend':
        return <Key className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  // Render checklist item
  const renderItem = (item: ChecklistItem) => (
    <Collapsible key={item.id} className="border rounded-lg mb-2">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50">
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); toggleStatus(item.id); }}>
            {getStatusIcon(item.status)}
          </button>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium">{item.title}</span>
              {item.critical && (
                <Badge variant="destructive" className="text-xs">Crítico</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.autoCheck && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={(e) => { e.stopPropagation(); runCheck(item.id); }}
              disabled={runningCheck === item.id}
            >
              {runningCheck === item.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          )}
          <ChevronDown className="h-4 w-4" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="space-y-3 pt-2 border-t">
          {item.notes && (
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
              <p className="text-sm">{item.notes}</p>
            </div>
          )}
          {item.commands && item.commands.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Comandos:</p>
              <div className="bg-black/90 rounded-md p-3">
                {item.commands.map((cmd, idx) => (
                  <div key={idx} className="flex items-center justify-between group">
                    <code className="text-sm text-green-400 font-mono">{cmd}</code>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => copyToClipboard(cmd)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  const categories = [
    { id: 'database', label: 'Database', icon: <Database className="h-4 w-4" /> },
    { id: 'security', label: 'Segurança', icon: <Shield className="h-4 w-4" /> },
    { id: 'functions', label: 'Functions', icon: <Server className="h-4 w-4" /> },
    { id: 'integrations', label: 'Integrações', icon: <Globe className="h-4 w-4" /> },
    { id: 'frontend', label: 'Frontend', icon: <Key className="h-4 w-4" /> },
    { id: 'validation', label: 'Validação', icon: <CheckCircle2 className="h-4 w-4" /> }
  ];

  const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Checklist de Migração</h1>
            <p className="text-muted-foreground">
              Supabase Cloud → Self-Hosted (VPS Hostinger)
            </p>
          </div>
        </div>
        <Button onClick={runAllChecks} disabled={!!runningCheck}>
          <RefreshCw className={`h-4 w-4 mr-2 ${runningCheck ? 'animate-spin' : ''}`} />
          Verificar Tudo
        </Button>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Progresso da Migração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{stats.completed} de {stats.total} itens concluídos</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span>Concluídos: {stats.completed}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <span>Falhos: {stats.failed}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted" />
                <span>Pendentes: {stats.pending}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="text-red-500">●</span> Origem (Supabase Cloud)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL:</span>
              <code className="text-xs">{MIGRATION_CONFIG.origin.url}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Project ID:</span>
              <code className="text-xs">{MIGRATION_CONFIG.origin.projectId}</code>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <span className="text-green-500">●</span> Destino (Self-Hosted)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL:</span>
              <code className="text-xs">{MIGRATION_CONFIG.destination.url}</code>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Anon Key:</span>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6"
                onClick={() => copyToClipboard(MIGRATION_CONFIG.destination.anonKey)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checklist Tabs */}
      <Tabs defaultValue="database" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          {categories.map(cat => {
            const catItems = items.filter(i => i.category === cat.id);
            const catCompleted = catItems.filter(i => i.status === 'completed').length;
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="flex items-center gap-2">
                {cat.icon}
                <span className="hidden sm:inline">{cat.label}</span>
                <Badge variant="secondary" className="ml-1">
                  {catCompleted}/{catItems.length}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map(cat => (
          <TabsContent key={cat.id} value={cat.id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {cat.icon}
                  {cat.label}
                </CardTitle>
                <CardDescription>
                  {items.filter(i => i.category === cat.id && i.status === 'completed').length} de{' '}
                  {items.filter(i => i.category === cat.id).length} itens concluídos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  {items
                    .filter(i => i.category === cat.id)
                    .map(renderItem)}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Webhook Updates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            URLs de Webhook (Atualizar Manualmente)
          </CardTitle>
          <CardDescription>
            Atualize estes webhooks nos painéis externos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {supabaseMigrationService.getWebhookUpdates().map((webhook, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{webhook.service}</span>
                  <Badge variant="outline">{webhook.configLocation}</Badge>
                </div>
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Antiga:</span>
                    <code className="block text-xs bg-muted p-2 rounded mt-1 line-through opacity-50">
                      {webhook.oldUrl}
                    </code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nova:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs bg-primary/10 p-2 rounded text-primary">
                        {webhook.newUrl}
                      </code>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => copyToClipboard(webhook.newUrl)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Deployment Commands */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Comandos de Deploy
          </CardTitle>
          <CardDescription>
            Execute estes comandos no terminal para completar a migração
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {supabaseMigrationService.getDeploymentCommands().map((cmd, idx) => (
              <div key={idx} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{cmd.step}</span>
                  <span className="text-xs text-muted-foreground">{cmd.description}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-black/90 text-green-400 p-3 rounded font-mono">
                    {cmd.command}
                  </code>
                  <Button 
                    size="icon" 
                    variant="outline"
                    onClick={() => copyToClipboard(cmd.command)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-auto flex-col py-4"
              onClick={() => copyToClipboard(MIGRATION_CONFIG.destination.url)}
            >
              <Globe className="h-6 w-6 mb-2" />
              <span>Copiar Nova URL</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto flex-col py-4"
              onClick={() => copyToClipboard(MIGRATION_CONFIG.destination.anonKey)}
            >
              <Key className="h-6 w-6 mb-2" />
              <span>Copiar Anon Key</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto flex-col py-4"
              onClick={() => window.open(`${MIGRATION_CONFIG.destination.url}`, '_blank')}
            >
              <ExternalLink className="h-6 w-6 mb-2" />
              <span>Abrir Self-Hosted</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto flex-col py-4"
              onClick={() => copyToClipboard(MIGRATION_CONFIG.destination.serviceKey)}
            >
              <Shield className="h-6 w-6 mb-2" />
              <span>Copiar Service Key</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
