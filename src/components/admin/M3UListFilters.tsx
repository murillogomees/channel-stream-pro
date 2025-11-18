import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { M3UTag } from '@/hooks/useM3UTags';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface M3UListFiltersProps {
  tags: M3UTag[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  tagFilterLogic: 'AND' | 'OR';
  onTagFilterLogicChange: (logic: 'AND' | 'OR') => void;
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusFilterChange: (status: 'all' | 'active' | 'inactive') => void;
  showFavoritesOnly: boolean;
  onShowFavoritesOnlyChange: (show: boolean) => void;
}

export function M3UListFilters({
  tags,
  selectedTags,
  onTagsChange,
  tagFilterLogic,
  onTagFilterLogicChange,
  statusFilter,
  onStatusFilterChange,
  showFavoritesOnly,
  onShowFavoritesOnlyChange
}: M3UListFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(t => t !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  };

  const clearFilters = () => {
    onTagsChange([]);
    onStatusFilterChange('all');
    onShowFavoritesOnlyChange(false);
  };

  const hasActiveFilters = selectedTags.length > 0 || statusFilter !== 'all' || showFavoritesOnly;

  const getTagsByCategory = (category: string) => {
    return tags.filter(tag => tag.category === category);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filtros Avançados
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {(selectedTags.length || 0) + (statusFilter !== 'all' ? 1 : 0) + (showFavoritesOnly ? 1 : 0)}
              </Badge>
            )}
          </Button>
        </CollapsibleTrigger>
        
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Limpar Filtros
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Favorites Filter */}
            <div className="space-y-2">
              <Label>Favoritos</Label>
              <Button
                variant={showFavoritesOnly ? "default" : "outline"}
                size="sm"
                onClick={() => onShowFavoritesOnlyChange(!showFavoritesOnly)}
                className="w-full"
              >
                {showFavoritesOnly ? 'Mostrando apenas favoritos' : 'Mostrar todos'}
              </Button>
            </div>

            {/* Tags Filter */}
            {selectedTags.length > 0 && (
              <div className="space-y-2">
                <Label>Lógica das Tags</Label>
                <Select value={tagFilterLogic} onValueChange={onTagFilterLogicChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">E (todas as tags)</SelectItem>
                    <SelectItem value="OR">OU (qualquer tag)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Qualidade Tags */}
            <div className="space-y-2">
              <Label>Qualidade</Label>
              <div className="flex flex-wrap gap-2">
                {getTagsByCategory('qualidade').map(tag => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Tipo Tags */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="flex flex-wrap gap-2">
                {getTagsByCategory('tipo').map(tag => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Região Tags */}
            <div className="space-y-2">
              <Label>Região</Label>
              <div className="flex flex-wrap gap-2">
                {getTagsByCategory('regiao').map(tag => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Idioma Tags */}
            <div className="space-y-2">
              <Label>Idioma</Label>
              <div className="flex flex-wrap gap-2">
                {getTagsByCategory('idioma').map(tag => (
                  <Badge
                    key={tag.id}
                    variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tag.id)}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
