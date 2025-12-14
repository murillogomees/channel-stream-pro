import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Helper para evitar erros de tipo excessivamente profundos
const db = supabase as unknown as {
  from: (table: string) => {
    select: (columns: string, options?: { count?: string; head?: boolean }) => {
      eq: (column: string, value: unknown) => Promise<{ data: unknown[] | null; count: number | null; error: Error | null }>;
      single: () => Promise<{ data: unknown | null; error: Error | null }>;
    } & Promise<{ data: unknown[] | null; count: number | null; error: Error | null }>;
    update: (data: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => Promise<{ error: Error | null }>;
    };
  };
};
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminCategoryCard } from '@/components/admin/AdminCategoryCard';
import { AdminQuickAction } from '@/components/admin/AdminQuickAction';
import {
  Users,
  ListMusic,
  Bell,
  Shield,
  Settings,
  BarChart3,
  UserCog,
  Plug,
  Search,
  Plus,
  RefreshCw,
  Home,
  LogOut,
  User,
  FileText,
  Activity,
  Database,
  Tv,
  CreditCard,
  MessageSquare,
} from 'lucide-react';

interface DashboardStats {
  totalClientes: number;
  clientesAtivos: number;
  clientesTestando: number;
  vencendoHoje: number;
  m3uLists: number;
  securityEvents: number;
}

export default function AdminHub() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<DashboardStats>({
    totalClientes: 0,
    clientesAtivos: 0,
    clientesTestando: 0,
    vencendoHoje: 0,
    m3uLists: 0,
    securityEvents: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Usar helper db para evitar erro de tipo infinito
      type ProfileRow = { situacao: string | null; data_vencimento: string | null };
      
      const profilesResult = await db.from('profiles').select('situacao, data_vencimento');
      const channelsResult = await db.from('iptv_channels').select('id', { count: 'exact', head: true });
      const securityResult = await db.from('security_events').select('id', { count: 'exact', head: true }).eq('resolved', false);

      const profiles = (profilesResult.data || []) as ProfileRow[];
      
      setStats({
        totalClientes: profiles.length,
        clientesAtivos: profiles.filter(c => c.situacao === 'Ativo').length,
        clientesTestando: profiles.filter(c => c.situacao === 'Testando').length,
        vencendoHoje: profiles.filter(c => c.data_vencimento?.startsWith(today)).length,
        m3uLists: channelsResult.count || 0,
        securityEvents: securityResult.count || 0,
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    {
      title: 'Usuários',
      description: 'Gerenciar assinantes e cadastros',
      icon: Users,
      href: '/admin/usuarios',
      badge: stats.vencendoHoje > 0 ? `${stats.vencendoHoje} vencendo` : undefined,
      badgeVariant: stats.vencendoHoje > 0 ? 'destructive' as const : undefined,
      stats: [
        { label: 'Total', value: stats.totalClientes },
        { label: 'Ativos', value: stats.clientesAtivos },
        { label: 'Testando', value: stats.clientesTestando },
      ],
    },
    {
      title: 'Playlists M3U',
      description: 'Listas, importação e sincronização',
      icon: ListMusic,
      href: '/admin/m3u',
      stats: [{ label: 'Listas ativas', value: stats.m3uLists }],
    },
    {
      title: 'Notificações',
      description: 'WhatsApp, templates e fila',
      icon: Bell,
      href: '/admin/notifications',
    },
    {
      title: 'Segurança',
      description: 'Alertas, IP blocking e 2FA',
      icon: Shield,
      href: '/admin/security',
      badge: stats.securityEvents > 0 ? `${stats.securityEvents} alertas` : undefined,
      badgeVariant: stats.securityEvents > 0 ? 'destructive' as const : undefined,
      status: stats.securityEvents > 0 ? 'warning' as const : 'ok' as const,
    },
    {
      title: 'Sistema',
      description: 'Health, backups e configurações',
      icon: Settings,
      href: '/admin/system',
    },
    {
      title: 'Analytics',
      description: 'Métricas, conversão e A/B tests',
      icon: BarChart3,
      href: '/admin/analytics',
    },
    {
      title: 'Usuários',
      description: 'Permissões, roles e auditoria',
      icon: UserCog,
      href: '/admin/users',
    },
    {
      title: 'Integrações',
      description: 'WhatsApp, CDN, Supabase',
      icon: Plug,
      href: '/admin/integrations',
    },
  ];

  const quickActions = [
    { title: 'Novo Usuário', icon: Plus, href: '/admin/usuarios?tab=create' },
    { title: 'Sync M3U', icon: RefreshCw, href: '/admin/m3u-sync' },
    { title: 'Planos', icon: CreditCard, href: '/dashboard/plans' },
    { title: 'Homepage', icon: FileText, href: '/dashboard/homepage' },
    { title: 'WhatsApp', icon: MessageSquare, href: '/admin/whatsapp-config' },
    { title: 'Player', icon: Tv, href: '/app/player' },
  ];

  const filteredCategories = categories.filter(
    cat =>
      cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 text-primary hover:opacity-80">
                <Home className="h-5 w-5" />
                <span className="font-semibold hidden sm:inline">IPTV Admin</span>
              </Link>
              <Badge variant="outline" className="hidden md:flex">
                {user?.email}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-64 hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar função..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="ghost" size="icon" asChild>
                <Link to="/admin/perfil">
                  <User className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => signOut()}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalClientes}</p>
                  <p className="text-xs text-muted-foreground">Clientes total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.clientesAtivos}</p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.m3uLists}</p>
                  <p className="text-xs text-muted-foreground">Listas M3U</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stats.securityEvents > 0 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.securityEvents}</p>
                  <p className="text-xs text-muted-foreground">Alertas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Ações Rápidas</h2>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <AdminQuickAction key={action.href} {...action} />
            ))}
          </div>
        </div>

        {/* Categories Grid */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Categorias</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCategories.map((category) => (
              <AdminCategoryCard key={category.href} {...category} />
            ))}
          </div>
        </div>

        {filteredCategories.length === 0 && searchQuery && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma função encontrada para "{searchQuery}"
          </div>
        )}
      </main>
    </div>
  );
}
