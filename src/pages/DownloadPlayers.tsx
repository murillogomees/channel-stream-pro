import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Star, Smartphone, Monitor, Tv, Laptop } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const DownloadPlayers = () => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('recommended_players')
        .select('*')
        .eq('status', 'active')
        .order('featured', { ascending: false })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setPlayers(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar players",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'android':
      case 'ios':
        return <Smartphone className="h-4 w-4" />;
      case 'windows':
      case 'macos':
      case 'linux':
        return <Laptop className="h-4 w-4" />;
      case 'smart tv':
      case 'android tv':
        return <Tv className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const handleDownload = (platform: string, links: any) => {
    const link = links[platform.toLowerCase().replace(' ', '')];
    if (link) {
      window.open(link, '_blank');
    } else {
      toast({
        title: "Link não disponível",
        description: `Link de download para ${platform} não encontrado`,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando players...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gradient-primary mb-4">
            Players Recomendados
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Baixe os melhores aplicativos para assistir IPTV em qualquer dispositivo.
            Todos os players são testados e aprovados pela nossa equipe.
          </p>
        </div>

        {/* Featured Players */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6 text-foreground">Mais Populares</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {players.filter(player => player.featured).map((player) => (
              <Card key={player.id} className="bg-gradient-card border-border shadow-glow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={player.icon_url}
                        alt={player.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <CardTitle className="text-xl text-foreground">{player.name}</CardTitle>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm text-muted-foreground">Recomendado</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-primary/10 text-primary">
                      Destaque
                    </Badge>
                  </div>
                  <CardDescription className="text-muted-foreground">
                    {player.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <h4 className="font-medium text-foreground mb-2">Plataformas disponíveis:</h4>
                    <div className="flex flex-wrap gap-2">
                      {player.platforms.map((platform: string) => (
                        <Badge key={platform} variant="secondary" className="gap-1">
                          {getPlatformIcon(platform)}
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {player.platforms.map((platform: string) => (
                      <Button
                        key={platform}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(platform, player.download_links)}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        {platform}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Other Players */}
        <div>
          <h2 className="text-2xl font-bold mb-6 text-foreground">Outras Opções</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {players.filter(player => !player.featured).map((player) => (
              <Card key={player.id} className="bg-gradient-card border-border">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <img
                      src={player.icon_url}
                      alt={player.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div>
                      <CardTitle className="text-lg text-foreground">{player.name}</CardTitle>
                    </div>
                  </div>
                  <CardDescription className="text-muted-foreground">
                    {player.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {player.platforms.map((platform: string) => (
                        <Badge key={platform} variant="outline" className="gap-1">
                          {getPlatformIcon(platform)}
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {player.platforms.slice(0, 2).map((platform: string) => (
                      <Button
                        key={platform}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(platform, player.download_links)}
                        className="w-full gap-2"
                      >
                        <Download className="h-4 w-4" />
                        {platform}
                      </Button>
                    ))}
                    {player.platforms.length > 2 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{player.platforms.length - 2} plataformas
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <Card className="mt-12 bg-gradient-card border-border">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">Como usar?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-foreground mb-2">📱 Para dispositivos móveis:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Baixe o aplicativo da loja oficial</li>
                  <li>Abra o app e vá em "Adicionar Lista"</li>
                  <li>Cole o link M3U que você recebeu</li>
                  <li>Aguarde carregar e comece a assistir!</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">💻 Para computadores:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Instale o player em seu sistema</li>
                  <li>Abra o arquivo M3U ou cole o link</li>
                  <li>Configure as preferências de vídeo</li>
                  <li>Aproveite a programação!</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DownloadPlayers;
