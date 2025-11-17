import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Check, ExternalLink } from 'lucide-react';

interface M3UList {
  id: string;
  name: string;
  file_url: string;
  status: string;
  plan_type?: 'teste' | 'basico' | 'premium';
  is_default?: boolean;
}

interface M3UListPreviewProps {
  selectedLists: string[];
  allLists: M3UList[];
}

export const M3UListPreview = ({ selectedLists, allLists }: M3UListPreviewProps) => {
  const selectedListsData = allLists.filter(list => selectedLists.includes(list.id));

  const getPlanTypeBadge = (planType?: string) => {
    const colors = {
      teste: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      basico: 'bg-green-500/10 text-green-500 border-green-500/20',
      premium: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    };
    
    return colors[planType as keyof typeof colors] || colors.teste;
  };

  if (selectedLists.length === 0) {
    return (
      <Card className="p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma lista M3U selecionada
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium">
            Listas Selecionadas ({selectedListsData.length})
          </h4>
          <Badge variant="outline" className="text-xs">
            Preview
          </Badge>
        </div>
        
        {selectedListsData.map((list) => (
          <div
            key={list.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30"
          >
            <div className="mt-1">
              <Check className="h-4 w-4 text-primary" />
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{list.name}</span>
                {list.is_default && (
                  <Badge variant="outline" className="text-xs">
                    Padrão
                  </Badge>
                )}
                <Badge className={getPlanTypeBadge(list.plan_type)}>
                  {list.plan_type || 'teste'}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                <a 
                  href={list.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors line-clamp-1"
                >
                  {list.file_url}
                </a>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge 
                  variant={list.status === 'active' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {list.status === 'active' ? 'Ativa' : 'Inativa'}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
