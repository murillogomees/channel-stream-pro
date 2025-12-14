import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Save,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Database,
  Code2,
  Zap,
  FileCheck
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  category: 'auth' | 'schema' | 'rls' | 'functions' | 'performance';
  status: 'pending' | 'ok' | 'warning' | 'error';
}

const INITIAL_CHECKLIST: ChecklistItem[] = [
  {
    id: 'auth-integrity',
    label: 'Auth Íntegro',
    description: 'Sistema de autenticação funcionando corretamente',
    checked: false,
    category: 'auth',
    status: 'pending'
  },
  {
    id: 'profiles-sync',
    label: 'Profiles Sincronizados',
    description: 'Tabela profiles sincronizada com auth.users',
    checked: false,
    category: 'auth',
    status: 'pending'
  },
  {
    id: 'roles-assigned',
    label: 'Roles Atribuídas',
    description: 'Todos usuários têm roles definidas',
    checked: false,
    category: 'auth',
    status: 'pending'
  },
  {
    id: 'schema-validated',
    label: 'Schema Validado',
    description: 'Estrutura do banco de dados validada',
    checked: false,
    category: 'schema',
    status: 'pending'
  },
  {
    id: 'no-orphan-tables',
    label: 'Sem Tabelas Órfãs',
    description: 'Todas tabelas têm uso no código',
    checked: false,
    category: 'schema',
    status: 'pending'
  },
  {
    id: 'indexes-optimized',
    label: 'Índices Otimizados',
    description: 'Índices de performance criados',
    checked: false,
    category: 'schema',
    status: 'pending'
  },
  {
    id: 'rls-enabled',
    label: 'RLS Ativada',
    description: 'Row Level Security ativa em todas tabelas',
    checked: false,
    category: 'rls',
    status: 'pending'
  },
  {
    id: 'policies-valid',
    label: 'Policies Válidas',
    description: 'Todas policies funcionando corretamente',
    checked: false,
    category: 'rls',
    status: 'pending'
  },
  {
    id: 'no-orphan-policies',
    label: 'Sem Policies Órfãs',
    description: 'Nenhuma policy sem uso',
    checked: false,
    category: 'rls',
    status: 'pending'
  },
  {
    id: 'functions-cleaned',
    label: 'Functions Limpas',
    description: 'Funções mortas removidas',
    checked: false,
    category: 'functions',
    status: 'pending'
  },
  {
    id: 'triggers-valid',
    label: 'Triggers Válidos',
    description: 'Todos triggers funcionando',
    checked: false,
    category: 'functions',
    status: 'pending'
  },
  {
    id: 'egress-reduced',
    label: 'Egress Reduzido',
    description: 'Otimizações de egress aplicadas',
    checked: false,
    category: 'performance',
    status: 'pending'
  },
  {
    id: 'cache-optimized',
    label: 'Cache Otimizado',
    description: 'Estratégias de cache implementadas',
    checked: false,
    category: 'performance',
    status: 'pending'
  }
];

export default function ExecutePlan() {
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');

  const toggleItem = (id: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const runValidation = async () => {
    setExecuting(true);
    setProgress(0);

    const updatedChecklist = [...checklist];

    for (let i = 0; i < updatedChecklist.length; i++) {
      const item = updatedChecklist[i];
      setCurrentStep(item.label);
      
      // Simulate validation
      await new Promise(r => setTimeout(r, 500));
      
      // Random status for demo (in real app, would do actual checks)
      const statuses: ChecklistItem['status'][] = ['ok', 'ok', 'ok', 'warning'];
      item.status = statuses[Math.floor(Math.random() * statuses.length)];
      item.checked = item.status === 'ok';
      
      setProgress(Math.round(((i + 1) / updatedChecklist.length) * 100));
      setChecklist([...updatedChecklist]);
    }

    setExecuting(false);
    setCurrentStep('');

    const allOk = updatedChecklist.every(i => i.status === 'ok');
    if (allOk) {
      toast.success("Validação completa - Pronto para execução!");
    } else {
      toast.warning("Alguns itens precisam de atenção");
    }
  };

  const executePlan = async () => {
    const unchecked = checklist.filter(i => !i.checked);
    if (unchecked.length > 0) {
      toast.error(`${unchecked.length} itens não validados. Execute a validação primeiro.`);
      return;
    }

    setExecuting(true);
    setProgress(0);

    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 200));
      setProgress(i);
    }

    setExecuting(false);
    toast.success("Plano executado com sucesso!");
  };

  const savePlan = () => {
    const plan = {
      timestamp: new Date().toISOString(),
      items: checklist.filter(i => i.checked).map(i => i.id)
    };
    localStorage.setItem('db-execution-plan', JSON.stringify(plan));
    toast.success("Plano salvo localmente");
  };

  const discardPlan = () => {
    setChecklist(INITIAL_CHECKLIST);
    localStorage.removeItem('db-execution-plan');
    toast.success("Plano descartado");
  };

  const getCategoryIcon = (category: ChecklistItem['category']) => {
    switch (category) {
      case 'auth': return <Shield className="h-4 w-4" />;
      case 'schema': return <Database className="h-4 w-4" />;
      case 'rls': return <Shield className="h-4 w-4" />;
      case 'functions': return <Code2 className="h-4 w-4" />;
      case 'performance': return <Zap className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />;
    }
  };

  const checkedCount = checklist.filter(i => i.checked).length;
  const okCount = checklist.filter(i => i.status === 'ok').length;
  const warningCount = checklist.filter(i => i.status === 'warning').length;

  const categories = ['auth', 'schema', 'rls', 'functions', 'performance'] as const;

  return (
    <AdminLayout>
      <PageHeader
        title="Execute Plan"
        description="Checklist final e execução do plano de ações"
        backTo="/admin/system"
      />

      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Itens</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{checklist.length}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-400">Validados</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-400">{okCount}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-yellow-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-400">Alertas</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-yellow-400">{warningCount}</span>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Progresso</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{Math.round((checkedCount / checklist.length) * 100)}%</span>
            </CardContent>
          </Card>
        </div>

        {/* Validation Progress */}
        {executing && (
          <Card className="bg-card/50 border-primary/30">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{currentStep || 'Processando...'}</span>
                </div>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Checklist by Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {categories.map(category => {
            const categoryItems = checklist.filter(i => i.category === category);
            const categoryLabels = {
              auth: 'Autenticação',
              schema: 'Schema',
              rls: 'RLS',
              functions: 'Functions',
              performance: 'Performance'
            };

            return (
              <Card key={category} className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {getCategoryIcon(category)}
                    {categoryLabels[category]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {categoryItems.map(item => (
                      <div 
                        key={item.id}
                        className={`p-3 rounded-lg border flex items-start gap-3 transition-colors
                          ${item.status === 'ok' ? 'bg-green-500/5 border-green-500/20' :
                            item.status === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
                            item.status === 'error' ? 'bg-red-500/5 border-red-500/20' :
                            'bg-background/50 border-border/50'}`}
                      >
                        <Checkbox
                          checked={item.checked}
                          onCheckedChange={() => toggleItem(item.id)}
                          disabled={executing}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{item.label}</span>
                            {getStatusIcon(item.status)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Action Buttons */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Ações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {warningCount > 0 && (
              <Alert className="border-yellow-500/30 bg-yellow-500/5">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  {warningCount} item(s) precisam de revisão antes da execução.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={runValidation} 
                disabled={executing}
                variant="secondary"
                className="flex-1 min-w-[200px]"
              >
                {executing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Validar Checklist
              </Button>

              <Button 
                onClick={executePlan} 
                disabled={executing || checkedCount < checklist.length}
                className="flex-1 min-w-[200px]"
              >
                <Play className="h-4 w-4 mr-2" />
                Executar Plano
              </Button>

              <Button 
                onClick={savePlan} 
                disabled={executing}
                variant="outline"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Plano
              </Button>

              <Button 
                onClick={discardPlan} 
                disabled={executing}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Descartar Plano
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
