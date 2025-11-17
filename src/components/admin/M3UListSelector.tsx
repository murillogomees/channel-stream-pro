import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface M3UList {
  id: string;
  name: string;
  file_url: string;
  status: string;
  plan_type?: 'teste' | 'basico' | 'premium';
  is_default?: boolean;
}

interface M3UListSelectorProps {
  selectedLists: string[];
  onChange: (selectedIds: string[]) => void;
  onListsLoaded?: (lists: M3UList[]) => void;
}

export const M3UListSelector = ({ selectedLists, onChange, onListsLoaded }: M3UListSelectorProps) => {
  const [lists, setLists] = useState<M3UList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('m3u_lists')
        .select('*')
        .eq('status', 'active')
        .order('priority', { ascending: false });

      if (error) throw error;

      const loadedLists = (data || []) as M3UList[];
      setLists(loadedLists);
      
      // Notify parent component about loaded lists
      if (onListsLoaded) {
        onListsLoaded(loadedLists);
      }
    } catch (error: any) {
      console.error('Error loading M3U lists:', error);
      toast.error('Erro ao carregar listas M3U');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (listId: string) => {
    const newSelection = selectedLists.includes(listId)
      ? selectedLists.filter(id => id !== listId)
      : [...selectedLists, listId];
    
    onChange(newSelection);
  };

  const getPlanTypeBadge = (planType?: string) => {
    const colors = {
      teste: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      basico: 'bg-green-500/10 text-green-500 border-green-500/20',
      premium: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    };
    
    return colors[planType as keyof typeof colors] || colors.teste;
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Carregando listas...</div>;
  }

  if (lists.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        Nenhuma lista M3U ativa disponível. Configure listas em Admin → M3U Lists.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lists.map((list) => (
        <div
          key={list.id}
          className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/5 transition-all"
        >
          <Checkbox
            id={`m3u-${list.id}`}
            checked={selectedLists.includes(list.id)}
            onCheckedChange={() => handleToggle(list.id)}
            className="mt-1"
          />
          <div className="flex-1 space-y-1">
            <Label
              htmlFor={`m3u-${list.id}`}
              className="font-medium cursor-pointer flex items-center gap-2"
            >
              {list.name}
              {list.is_default && (
                <Badge variant="outline" className="text-xs">
                  Padrão
                </Badge>
              )}
              <Badge className={getPlanTypeBadge(list.plan_type)}>
                {list.plan_type || 'teste'}
              </Badge>
            </Label>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {list.file_url}
            </p>
          </div>
          {selectedLists.includes(list.id) && (
            <Check className="h-4 w-4 text-primary mt-1" />
          )}
        </div>
      ))}
    </div>
  );
};