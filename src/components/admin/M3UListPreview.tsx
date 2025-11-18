import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, ExternalLink } from 'lucide-react';

interface M3UListPreviewProps {
  selectedLists: string[];
  allLists: any[];
}

export function M3UListPreview({ selectedLists, allLists }: M3UListPreviewProps) {
  const selectedListsData = allLists.filter(list => selectedLists.includes(list.id));

  if (selectedListsData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listas M3U Selecionadas</CardTitle>
        <CardDescription>
          {selectedListsData.length} {selectedListsData.length === 1 ? 'lista selecionada' : 'listas selecionadas'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {selectedListsData.map((list) => (
          <div key={list.id} className="flex items-start justify-between p-3 rounded-lg border bg-card">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium">{list.name}</h4>
                {list.is_default && (
                  <Badge variant="default">Padrão</Badge>
                )}
              </div>
              {list.description && (
                <p className="text-sm text-muted-foreground">{list.description}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Badge variant={list.status === 'active' ? 'default' : 'secondary'}>
                  {list.status === 'active' ? 'Ativa' : 'Inativa'}
                </Badge>
                {list.priority !== undefined && (
                  <Badge variant="outline">Prioridade: {list.priority}</Badge>
                )}
              </div>
            </div>
            <a
              href={list.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
