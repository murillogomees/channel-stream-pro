import { useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TVSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultCount?: number;
}

export function TVSearchOverlay({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  resultCount,
}: TVSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl animate-fade-in">
      <div className="max-w-3xl mx-auto px-4 pt-20 lg:pt-32">
        {/* Search Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Buscar canais, filmes e séries..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-16 pl-14 pr-4 text-xl lg:text-2xl font-medium bg-muted/50 border-2 border-border focus:border-primary rounded-xl"
            />
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-14 w-14 rounded-xl hover:bg-muted"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Result Count */}
        {searchQuery && (
          <p className="text-muted-foreground">
            {resultCount === 0 ? (
              'Nenhum resultado encontrado'
            ) : resultCount === 1 ? (
              '1 resultado encontrado'
            ) : (
              `${resultCount?.toLocaleString()} resultados encontrados`
            )}
          </p>
        )}

        {/* Search Suggestions (when empty) */}
        {!searchQuery && (
          <div className="mt-8">
            <p className="text-sm text-muted-foreground mb-4">Sugestões populares:</p>
            <div className="flex flex-wrap gap-2">
              {['Esportes', 'Filmes', 'Notícias', 'Infantil', 'Documentários'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onSearchChange(suggestion)}
                  className="px-4 py-2 rounded-full bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
