import { Link } from "react-router-dom";
import { AdminLayout, PageHeader } from "@/components/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Database, 
  GitCompare, 
  Code2, 
  ShieldCheck,
  Search,
  Play,
  ArrowRight,
  Zap
} from "lucide-react";

interface SystemModule {
  path: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'ready' | 'beta' | 'new';
  color: string;
}

const SYSTEM_MODULES: SystemModule[] = [
  {
    path: '/admin/system/auth',
    title: 'Auth Recovery',
    description: 'Diagnóstico e restauração do sistema de autenticação',
    icon: <Shield className="h-6 w-6" />,
    status: 'ready',
    color: 'border-l-blue-500'
  },
  {
    path: '/admin/system/database',
    title: 'Database Rebuild',
    description: 'Visão geral e decisão por tabela',
    icon: <Database className="h-6 w-6" />,
    status: 'ready',
    color: 'border-l-green-500'
  },
  {
    path: '/admin/system/schema-preview',
    title: 'Schema Preview',
    description: 'Visualize mudanças antes de aplicar (Anti-Gambiarra)',
    icon: <GitCompare className="h-6 w-6" />,
    status: 'new',
    color: 'border-l-purple-500'
  },
  {
    path: '/admin/system/functions',
    title: 'Functions & RPCs',
    description: 'Gerenciamento de funções do banco',
    icon: <Code2 className="h-6 w-6" />,
    status: 'ready',
    color: 'border-l-yellow-500'
  },
  {
    path: '/admin/system/rls',
    title: 'RLS Control',
    description: 'Controle de Row Level Security',
    icon: <ShieldCheck className="h-6 w-6" />,
    status: 'ready',
    color: 'border-l-orange-500'
  },
  {
    path: '/admin/system/usage',
    title: 'Usage Validation',
    description: 'Validação de uso real no sistema',
    icon: <Search className="h-6 w-6" />,
    status: 'beta',
    color: 'border-l-cyan-500'
  },
  {
    path: '/admin/system/execute',
    title: 'Execute Plan',
    description: 'Checklist final e execução',
    icon: <Play className="h-6 w-6" />,
    status: 'ready',
    color: 'border-l-red-500'
  }
];

export default function SystemControlIndex() {
  const getStatusBadge = (status: SystemModule['status']) => {
    switch (status) {
      case 'ready':
        return <Badge className="bg-green-500/20 text-green-400">Pronto</Badge>;
      case 'beta':
        return <Badge className="bg-yellow-500/20 text-yellow-400">Beta</Badge>;
      case 'new':
        return <Badge className="bg-purple-500/20 text-purple-400">Novo</Badge>;
    }
  };

  return (
    <AdminLayout>
      <PageHeader
        title="System Control Panel"
        description="Orquestrador de decisões - Nenhuma ação cria legado. Tudo passa por validação."
        backTo="/admin/dashboard"
      />

      <div className="space-y-6">
        {/* Architecture Notice */}
        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Zap className="h-8 w-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Arquitetura de Controle</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Quem manda:</strong> Lovable → cérebro, validação, decisões | Admin UI → painel de controle | Supabase Cloud → execução</p>
                  <p><strong>Regra-mãe:</strong> A UI NÃO cria nada sozinha. Ela apenas solicita. O Lovable valida, pergunta, executa ou descarta.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anti-Legacy Pattern */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Padrão Anti-Legado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                <span className="text-red-400">❌ Nada fixo</span>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                <span className="text-red-400">❌ Nada permanente</span>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                <span className="text-red-400">❌ Nada escondido</span>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <span className="text-green-400">✓ Orientado a ação</span>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <span className="text-green-400">✓ Com status</span>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <span className="text-green-400">✓ Descartável se não usado</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SYSTEM_MODULES.map(module => (
            <Link key={module.path} to={module.path}>
              <Card className={`bg-card/50 border-border/50 border-l-4 ${module.color} hover:bg-accent/10 transition-colors h-full cursor-pointer`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {module.icon}
                    </div>
                    {getStatusBadge(module.status)}
                  </div>
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-primary text-sm">
                    Acessar módulo
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Rules */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Regras Anti-Legado (Obrigatórias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Qualquer tabela criada: tem caso de uso, tem origem clara, tem owner</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Qualquer coisa sem uso → marcada para deleção</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Logs: retenção curta ou fora do banco</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Nenhuma ação executa sem confirmação</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Tudo passa por validação de uso real</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
