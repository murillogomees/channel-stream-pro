import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GitCompare, CheckCircle, AlertTriangle } from 'lucide-react';
import { FormSection, DialogBody } from '@/components/ui/form-section';

interface M3UList {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  status: string;
  plan_type?: string[];
  usage_count?: number;
  is_default?: boolean;
}

interface AdminComparisonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list1: M3UList | null;
  list2: M3UList | null;
}

export function AdminComparison({ open, onOpenChange, list1, list2 }: AdminComparisonProps) {
  if (!list1 || !list2) return null;

  const differences = {
    name: list1.name !== list2.name,
    description: list1.description !== list2.description,
    fileUrl: list1.file_url !== list2.file_url,
    status: list1.status !== list2.status,
    planType: JSON.stringify(list1.plan_type) !== JSON.stringify(list2.plan_type),
    usage: list1.usage_count !== list2.usage_count,
  };

  const hasDifferences = Object.values(differences).some(d => d);
  const diffCount = Object.values(differences).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            <GitCompare className="h-5 w-5" />
            Comparação de Listas M3U
          </DialogTitle>
          <DialogDescription>
            Comparando diferenças entre as duas listas selecionadas
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Resumo */}
          <Card className={hasDifferences ? 'border-amber-500/50 bg-amber-500/5' : 'border-success/50 bg-success/5'}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {hasDifferences ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold">
                    {hasDifferences 
                      ? `${diffCount} diferença(s) encontrada(s)` 
                      : 'Listas idênticas'}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasDifferences
                      ? 'As listas possuem diferenças nos campos destacados em amarelo.'
                      : 'As listas são idênticas em todos os aspectos comparados.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparação */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            {/* Headers */}
            <div className="font-semibold text-muted-foreground p-3 bg-muted/30 rounded-t-lg">
              Campo
            </div>
            <div className="font-semibold p-3 bg-primary/10 rounded-t-lg border-b-2 border-primary/20">
              {list1.name}
            </div>
            <div className="font-semibold p-3 bg-blue-500/10 rounded-t-lg border-b-2 border-blue-500/20">
              {list2.name}
            </div>

            {/* Nome */}
            <div className="p-3 border-b flex items-center">Nome</div>
            <div className={`p-3 border-b ${differences.name ? 'bg-amber-500/10' : ''}`}>
              {list1.name}
            </div>
            <div className={`p-3 border-b ${differences.name ? 'bg-amber-500/10' : ''}`}>
              {list2.name}
            </div>

            {/* Descrição */}
            <div className="p-3 border-b flex items-center">Descrição</div>
            <div className={`p-3 border-b ${differences.description ? 'bg-amber-500/10' : ''}`}>
              {list1.description || <span className="text-muted-foreground italic">Sem descrição</span>}
            </div>
            <div className={`p-3 border-b ${differences.description ? 'bg-amber-500/10' : ''}`}>
              {list2.description || <span className="text-muted-foreground italic">Sem descrição</span>}
            </div>

            {/* URL */}
            <div className="p-3 border-b flex items-center">URL</div>
            <div className={`p-3 border-b text-xs break-all ${differences.fileUrl ? 'bg-amber-500/10' : ''}`}>
              {list1.file_url}
            </div>
            <div className={`p-3 border-b text-xs break-all ${differences.fileUrl ? 'bg-amber-500/10' : ''}`}>
              {list2.file_url}
            </div>

            {/* Status */}
            <div className="p-3 border-b flex items-center">Status</div>
            <div className={`p-3 border-b ${differences.status ? 'bg-amber-500/10' : ''}`}>
              <Badge variant={list1.status === 'active' ? 'default' : 'secondary'}>
                {list1.status === 'active' ? '✅ Ativa' : '❌ Inativa'}
              </Badge>
            </div>
            <div className={`p-3 border-b ${differences.status ? 'bg-amber-500/10' : ''}`}>
              <Badge variant={list2.status === 'active' ? 'default' : 'secondary'}>
                {list2.status === 'active' ? '✅ Ativa' : '❌ Inativa'}
              </Badge>
            </div>

            {/* Planos */}
            <div className="p-3 border-b flex items-center">Tipos de Plano</div>
            <div className={`p-3 border-b ${differences.planType ? 'bg-amber-500/10' : ''}`}>
              {(list1.plan_type || []).join(', ') || 'Nenhum'}
            </div>
            <div className={`p-3 border-b ${differences.planType ? 'bg-amber-500/10' : ''}`}>
              {(list2.plan_type || []).join(', ') || 'Nenhum'}
            </div>

            {/* Uso */}
            <div className="p-3 flex items-center">Uso</div>
            <div className={`p-3 ${differences.usage ? 'bg-amber-500/10' : ''}`}>
              <Badge variant="outline">{list1.usage_count || 0} clientes</Badge>
            </div>
            <div className={`p-3 ${differences.usage ? 'bg-amber-500/10' : ''}`}>
              <Badge variant="outline">{list2.usage_count || 0} clientes</Badge>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-12">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
