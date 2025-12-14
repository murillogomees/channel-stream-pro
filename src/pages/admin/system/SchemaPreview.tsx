import { useState } from "react";
import { AdminLayout, PageHeader } from "@/components/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  GitCompare, 
  Plus, 
  Minus, 
  ArrowRight,
  Database,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

interface SchemaChange {
  table: string;
  type: 'add_column' | 'remove_column' | 'modify_column' | 'add_table' | 'remove_table';
  field?: string;
  oldValue?: string;
  newValue?: string;
}

interface ImpactEstimate {
  storage: { before: string; after: string; change: string };
  egress: { before: string; after: string; change: string };
  cacheImpact: 'none' | 'partial' | 'full';
}

export default function SchemaPreview() {
  const [changes, setChanges] = useState<SchemaChange[]>([
    { table: 'profiles', type: 'add_column', field: 'last_activity_at', newValue: 'TIMESTAMP' },
    { table: 'profiles', type: 'remove_column', field: 'deprecated_field', oldValue: 'TEXT' },
    { table: 'iptv_channels', type: 'modify_column', field: 'metadata', oldValue: 'TEXT', newValue: 'JSONB' },
    { table: 'legacy_logs', type: 'remove_table' },
    { table: 'streaming_sessions', type: 'add_table', newValue: '5 columns' }
  ]);

  const [impact, setImpact] = useState<ImpactEstimate>({
    storage: { before: '2.4 GB', after: '2.1 GB', change: '-12%' },
    egress: { before: '45 GB/mês', after: '38 GB/mês', change: '-15%' },
    cacheImpact: 'partial'
  });

  const [applying, setApplying] = useState(false);

  const getChangeIcon = (type: SchemaChange['type']) => {
    switch (type) {
      case 'add_column':
      case 'add_table':
        return <Plus className="h-4 w-4 text-green-400" />;
      case 'remove_column':
      case 'remove_table':
        return <Minus className="h-4 w-4 text-red-400" />;
      case 'modify_column':
        return <ArrowRight className="h-4 w-4 text-blue-400" />;
    }
  };

  const getChangeBadge = (type: SchemaChange['type']) => {
    switch (type) {
      case 'add_column':
        return <Badge className="bg-green-500/20 text-green-400">+ Coluna</Badge>;
      case 'remove_column':
        return <Badge className="bg-red-500/20 text-red-400">- Coluna</Badge>;
      case 'modify_column':
        return <Badge className="bg-blue-500/20 text-blue-400">Modificar</Badge>;
      case 'add_table':
        return <Badge className="bg-green-500/20 text-green-400">+ Tabela</Badge>;
      case 'remove_table':
        return <Badge className="bg-red-500/20 text-red-400">- Tabela</Badge>;
    }
  };

  const applyChanges = async () => {
    setApplying(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success("Mudanças aplicadas com sucesso!");
      setChanges([]);
    } catch (error) {
      toast.error("Erro ao aplicar mudanças");
    } finally {
      setApplying(false);
    }
  };

  const addedChanges = changes.filter(c => c.type === 'add_column' || c.type === 'add_table');
  const removedChanges = changes.filter(c => c.type === 'remove_column' || c.type === 'remove_table');
  const modifiedChanges = changes.filter(c => c.type === 'modify_column');

  return (
    <AdminLayout>
      <PageHeader
        title="Schema Preview"
        description="Visualize mudanças antes de aplicar (Anti-Gambiarra)"
        backTo="/admin/system"
      />

      <div className="space-y-6">
        {/* Impact Estimates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                Storage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {impact.storage.before} → {impact.storage.after}
                </div>
                <Badge className={impact.storage.change.startsWith('-') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                  {impact.storage.change}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Egress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {impact.egress.before} → {impact.egress.after}
                </div>
                <Badge className={impact.egress.change.startsWith('-') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                  {impact.egress.change}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Cache Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={
                impact.cacheImpact === 'none' ? 'bg-green-500/20 text-green-400' :
                impact.cacheImpact === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }>
                {impact.cacheImpact === 'none' ? 'Nenhum' : 
                 impact.cacheImpact === 'partial' ? 'Parcial' : 'Total'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Diff Visual */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Before */}
          <Card className="bg-card/50 border-red-500/30">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <Minus className="h-5 w-5" />
                Antes (Removido)
              </CardTitle>
              <CardDescription>
                {removedChanges.length} alterações de remoção
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {removedChanges.map((change, i) => (
                    <div 
                      key={i}
                      className="p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-red-300">{change.table}</span>
                        {getChangeBadge(change.type)}
                      </div>
                      {change.field && (
                        <div className="text-sm text-muted-foreground">
                          <code className="px-1 py-0.5 bg-red-500/10 rounded">
                            {change.field}: {change.oldValue}
                          </code>
                        </div>
                      )}
                    </div>
                  ))}
                  {removedChanges.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhuma remoção pendente
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* After */}
          <Card className="bg-card/50 border-green-500/30">
            <CardHeader>
              <CardTitle className="text-green-400 flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Depois (Adicionado)
              </CardTitle>
              <CardDescription>
                {addedChanges.length} alterações de adição
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {addedChanges.map((change, i) => (
                    <div 
                      key={i}
                      className="p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-green-300">{change.table}</span>
                        {getChangeBadge(change.type)}
                      </div>
                      {change.field && (
                        <div className="text-sm text-muted-foreground">
                          <code className="px-1 py-0.5 bg-green-500/10 rounded">
                            {change.field}: {change.newValue}
                          </code>
                        </div>
                      )}
                      {change.type === 'add_table' && (
                        <div className="text-sm text-muted-foreground">
                          Nova tabela com {change.newValue}
                        </div>
                      )}
                    </div>
                  ))}
                  {addedChanges.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      Nenhuma adição pendente
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Modified Fields */}
        {modifiedChanges.length > 0 && (
          <Card className="bg-card/50 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-blue-400 flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Campos Modificados
              </CardTitle>
              <CardDescription>
                {modifiedChanges.length} campos serão alterados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {modifiedChanges.map((change, i) => (
                  <div 
                    key={i}
                    className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-blue-300">{change.table}.{change.field}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <code className="px-2 py-1 bg-red-500/10 rounded text-red-300">
                        {change.oldValue}
                      </code>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <code className="px-2 py-1 bg-green-500/10 rounded text-green-300">
                        {change.newValue}
                      </code>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Resumo das Mudanças</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="text-2xl font-bold text-green-400">{addedChanges.length}</div>
                <div className="text-sm text-muted-foreground">Adições</div>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-2xl font-bold text-red-400">{removedChanges.length}</div>
                <div className="text-sm text-muted-foreground">Remoções</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-2xl font-bold text-blue-400">{modifiedChanges.length}</div>
                <div className="text-sm text-muted-foreground">Modificações</div>
              </div>
            </div>

            <Separator />

            {changes.length > 0 ? (
              <div className="flex gap-3">
                <Button 
                  onClick={applyChanges} 
                  disabled={applying}
                  className="flex-1"
                >
                  {applying ? (
                    <>Aplicando...</>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Aplicar Mudanças
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="flex-1"
                >
                  <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                  Voltar para Ajustes
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhuma mudança pendente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
