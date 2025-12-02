import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, Edit } from 'lucide-react';
import { CacheRule } from '@/services/smartCacheService';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CacheRulesTableProps {
  rules: CacheRule[];
  onToggle: (ruleId: string, enabled: boolean) => void;
  onDelete: (ruleId: string) => void;
  compact?: boolean;
}

export function CacheRulesTable({ rules, onToggle, onDelete, compact }: CacheRulesTableProps) {
  if (rules.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma regra de cache configurada
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Pattern</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>TTL</TableHead>
          <TableHead>Prioridade</TableHead>
          {!compact && <TableHead>Última Aplicação</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((rule) => (
          <TableRow key={rule.id}>
            <TableCell className="font-medium">
              {rule.name}
              {rule.description && (
                <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
              )}
            </TableCell>
            <TableCell>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {rule.match_pattern}
              </code>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{rule.match_type}</Badge>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <div className="text-sm">{rule.ttl}s</div>
                {rule.stale_while_revalidate && (
                  <div className="text-xs text-muted-foreground">
                    SWR: {rule.stale_while_revalidate}s
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>{rule.priority}</TableCell>
            {!compact && (
              <TableCell>
                {rule.last_applied_at ? (
                  <span className="text-xs">
                    {formatDistanceToNow(new Date(rule.last_applied_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Nunca</span>
                )}
              </TableCell>
            )}
            <TableCell>
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) => onToggle(rule.id, checked)}
              />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon">
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(rule.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
