import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Plus, Minus, Edit, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Change {
  id: string;
  change_type: 'added' | 'removed' | 'modified';
  entity_type: 'category' | 'channel';
  entity_name: string;
  old_data?: any;
  new_data?: any;
}

interface M3UConflictResolverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: Change[];
  onResolve: (mode: 'merge' | 'replace') => void;
  loading?: boolean;
}

export function M3UConflictResolver({
  open,
  onOpenChange,
  changes,
  onResolve,
  loading = false
}: M3UConflictResolverProps) {
  const [selectedMode, setSelectedMode] = useState<'merge' | 'replace'>('merge');

  const addedCount = changes.filter(c => c.change_type === 'added').length;
  const removedCount = changes.filter(c => c.change_type === 'removed').length;
  const modifiedCount = changes.filter(c => c.change_type === 'modified').length;

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added': return <Plus className="h-4 w-4 text-green-500" />;
      case 'removed': return <Minus className="h-4 w-4 text-red-500" />;
      case 'modified': return <Edit className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };

  const getChangeBadge = (type: string) => {
    switch (type) {
      case 'added': return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Adicionado</Badge>;
      case 'removed': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Removido</Badge>;
      case 'modified': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Modificado</Badge>;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Conflitos Detectados na Reimportação
          </DialogTitle>
          <DialogDescription>
            Foram detectadas {changes.length} mudanças na playlist. Escolha como deseja resolver:
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-500" />
                Adicionados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{addedCount}</div>
              <p className="text-xs text-muted-foreground">novos itens</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Edit className="h-4 w-4 text-yellow-500" />
                Modificados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{modifiedCount}</div>
              <p className="text-xs text-muted-foreground">itens alterados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Minus className="h-4 w-4 text-red-500" />
                Removidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{removedCount}</div>
              <p className="text-xs text-muted-foreground">itens deletados</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">Todas ({changes.length})</TabsTrigger>
            <TabsTrigger value="added">Adicionados ({addedCount})</TabsTrigger>
            <TabsTrigger value="modified">Modificados ({modifiedCount})</TabsTrigger>
            <TabsTrigger value="removed">Removidos ({removedCount})</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px] w-full rounded-md border p-4 mt-2">
            <TabsContent value="all" className="space-y-2 mt-0">
              {changes.map((change) => (
                <Card key={change.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getChangeIcon(change.change_type)}
                      <div>
                        <p className="font-medium">{change.entity_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {change.entity_type === 'category' ? 'Categoria' : 'Canal'}
                        </p>
                      </div>
                    </div>
                    {getChangeBadge(change.change_type)}
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="added" className="space-y-2 mt-0">
              {changes.filter(c => c.change_type === 'added').map((change) => (
                <Card key={change.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getChangeIcon(change.change_type)}
                      <div>
                        <p className="font-medium">{change.entity_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {change.entity_type === 'category' ? 'Categoria' : 'Canal'}
                        </p>
                      </div>
                    </div>
                    {getChangeBadge(change.change_type)}
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="modified" className="space-y-2 mt-0">
              {changes.filter(c => c.change_type === 'modified').map((change) => (
                <Card key={change.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getChangeIcon(change.change_type)}
                      <div>
                        <p className="font-medium">{change.entity_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {change.entity_type === 'category' ? 'Categoria' : 'Canal'}
                        </p>
                      </div>
                    </div>
                    {getChangeBadge(change.change_type)}
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="removed" className="space-y-2 mt-0">
              {changes.filter(c => c.change_type === 'removed').map((change) => (
                <Card key={change.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getChangeIcon(change.change_type)}
                      <div>
                        <p className="font-medium">{change.entity_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {change.entity_type === 'category' ? 'Categoria' : 'Canal'}
                        </p>
                      </div>
                    </div>
                    {getChangeBadge(change.change_type)}
                  </div>
                </Card>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="space-y-3 pt-4 border-t">
          <p className="text-sm font-medium">Escolha como resolver os conflitos:</p>
          
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className={`cursor-pointer transition-all ${selectedMode === 'merge' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedMode('merge')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Mesclar (Merge)</CardTitle>
                <CardDescription className="text-xs">
                  Mantém itens existentes e adiciona novos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Novos canais serão adicionados</li>
                  <li>• Canais existentes serão atualizados</li>
                  <li>• Canais antigos não serão removidos</li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${selectedMode === 'replace' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setSelectedMode('replace')}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Substituir (Replace)</CardTitle>
                <CardDescription className="text-xs">
                  Remove tudo e substitui pelo novo conteúdo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li>• Todos os canais antigos serão removidos</li>
                  <li>• Apenas novos canais serão mantidos</li>
                  <li>• Lista ficará idêntica à fonte</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={() => onResolve(selectedMode)} disabled={loading}>
            {loading ? 'Processando...' : (
              <>
                Aplicar {selectedMode === 'merge' ? 'Merge' : 'Substituição'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
