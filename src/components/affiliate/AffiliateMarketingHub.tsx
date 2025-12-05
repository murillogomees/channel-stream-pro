import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAffiliateMarketing, MarketingMaterial } from '@/hooks/useAffiliateMarketing';
import { Download, Image, FileText, Video, Mail, ExternalLink, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const typeIcons: Record<string, any> = {
  banner: Image,
  image: Image,
  text: FileText,
  video: Video,
  email_template: Mail
};

const typeLabels: Record<string, string> = {
  banner: 'Banners',
  image: 'Imagens',
  text: 'Textos',
  video: 'Vídeos',
  email_template: 'E-mails'
};

export function AffiliateMarketingHub() {
  const { materials, loading, incrementDownload } = useAffiliateMarketing();
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('all');

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.description?.toLowerCase().includes(search.toLowerCase());
    const matchesType = activeType === 'all' || m.type === activeType;
    return matchesSearch && matchesType && m.active;
  });

  const handleDownload = async (material: MarketingMaterial) => {
    if (material.content_url) {
      await incrementDownload(material.id);
      window.open(material.content_url, '_blank');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const types = ['all', ...Array.from(new Set(materials.map(m => m.type)))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar materiais..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeType} onValueChange={setActiveType}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          {types.filter(t => t !== 'all').map(type => (
            <TabsTrigger key={type} value={type}>
              {typeLabels[type] || type}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMaterials.map(material => {
          const Icon = typeIcons[material.type] || FileText;
          
          return (
            <Card key={material.id} className="overflow-hidden">
              {material.type === 'banner' || material.type === 'image' ? (
                <div className="h-32 bg-muted flex items-center justify-center overflow-hidden">
                  {material.content_url ? (
                    <img 
                      src={material.content_url} 
                      alt={material.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
              ) : (
                <div className="h-20 bg-muted flex items-center justify-center">
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              
              <CardContent className="p-4">
                <h3 className="font-medium truncate">{material.title}</h3>
                {material.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {material.description}
                  </p>
                )}
                
                <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                  {material.dimensions && (
                    <span className="px-2 py-0.5 bg-muted rounded">{material.dimensions}</span>
                  )}
                  <span>{material.download_count} downloads</span>
                </div>

                <div className="flex gap-2 mt-4">
                  {material.content_url && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleDownload(material)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  )}
                  {material.content_text && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyToClipboard(material.content_text!)}
                    >
                      Copiar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredMaterials.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Nenhum material encontrado
          </div>
        )}
      </div>
    </div>
  );
}
