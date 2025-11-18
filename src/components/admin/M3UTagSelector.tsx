import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { useM3UTags, M3UTag } from '@/hooks/useM3UTags';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface M3UTagSelectorProps {
  selectedTags: string[];
  onChange: (tagIds: string[]) => void;
}

const categoryLabels = {
  qualidade: 'Qualidade',
  tipo: 'Tipo',
  regiao: 'Região',
  idioma: 'Idioma'
};

export function M3UTagSelector({ selectedTags, onChange }: M3UTagSelectorProps) {
  const { tags, isLoading } = useM3UTags();

  const handleAddTag = (tagId: string) => {
    if (!selectedTags.includes(tagId)) {
      onChange([...selectedTags, tagId]);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTags.filter(id => id !== tagId));
  };

  const getTagById = (tagId: string): M3UTag | undefined => {
    return tags.find(t => t.id === tagId);
  };

  const availableTags = tags.filter(tag => !selectedTags.includes(tag.id));

  return (
    <div className="space-y-4">
      <div>
        <Label>Tags e Categorias</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Adicione tags para categorizar esta lista
        </p>
        
        <Select onValueChange={handleAddTag} disabled={isLoading || availableTags.length === 0}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma tag..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(categoryLabels).map(([category, label]) => {
              const categoryTags = availableTags.filter(t => t.category === category);
              if (categoryTags.length === 0) return null;
              
              return (
                <div key={category}>
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                    {label}
                  </div>
                  {categoryTags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </div>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map(tagId => {
            const tag = getTagById(tagId);
            if (!tag) return null;
            
            return (
              <Badge
                key={tagId}
                variant="secondary"
                style={{ backgroundColor: tag.color + '20', borderColor: tag.color }}
                className="gap-1"
              >
                {tag.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => handleRemoveTag(tagId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
