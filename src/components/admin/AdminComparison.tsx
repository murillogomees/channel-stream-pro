import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GitCompare } from 'lucide-react';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Comparação de Listas M3U
          </DialogTitle>
          <DialogDescription>
            Comparando diferenças entre as duas listas selecionadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent>
              {hasDifferences ? (
                <p className="text-sm text-muted-foreground">
                  Foram encontradas <span className="font-bold text-foreground">{Object.values(differences).filter(Boolean).length}</span> diferenças entre as listas.
                </p>
              ) : (
                <p className="text-sm text-green-600 dark:text-green-500">
                  As listas são idênticas em todos os aspectos comparados.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-4">
              <div className="font-semibold text-sm text-muted-foreground">Campo</div>
              <div className="space-y-3">
                <div className="py-2">Nome</div>
                <div className="py-2">Descrição</div>
                <div className="py-2">URL</div>
                <div className="py-2">Status</div>
                <div className="py-2">Tipos de Plano</div>
                <div className="py-2">Uso</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="font-semibold text-sm">{list1.name}</div>
              <div className="space-y-3">
                <div className={`py-2 ${differences.name ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {list1.name}
                </div>
                <div className={`py-2 ${differences.description ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {list1.description || <span className="text-muted-foreground italic">Sem descrição</span>}
                </div>
                <div className={`py-2 text-xs break-all ${differences.fileUrl ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {list1.file_url}
                </div>
                <div className={`py-2 ${differences.status ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  <Badge variant={list1.status === 'active' ? 'default' : 'secondary'}>
                    {list1.status === 'active' ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
                <div className={`py-2 ${differences.planType ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {(list1.plan_type || []).join(', ') || 'Nenhum'}
                </div>
                <div className={`py-2 ${differences.usage ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {list1.usage_count || 0} clientes
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="font-semibold text-sm">{list2.name}</div>
              <div className="space-y-3">
                <div className={`py-2 ${differences.name ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {list2.name}
                </div>
                <div className={`py-2 ${differences.description ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {list2.description || <span className="text-muted-foreground italic">Sem descrição</span>}
                </div>
                <div className={`py-2 text-xs break-all ${differences.fileUrl ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {list2.file_url}
                </div>
                <div className={`py-2 ${differences.status ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  <Badge variant={list2.status === 'active' ? 'default' : 'secondary'}>
                    {list2.status === 'active' ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
                <div className={`py-2 ${differences.planType ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {(list2.plan_type || []).join(', ') || 'Nenhum'}
                </div>
                <div className={`py-2 ${differences.usage ? 'bg-yellow-500/10 px-2 rounded' : ''}`}>
                  {list2.usage_count || 0} clientes
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
