import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useChannels } from '@/hooks/useChannels';
import { useTVNavigation } from '@/hooks/useTVNavigation';
import { VideoPlayer } from '@/components/app/VideoPlayer';
import { ChannelList } from '@/components/app/ChannelList';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut, Loader2, Tv } from 'lucide-react';
import type { Channel } from '@/utils/m3uParser';
import { toast } from 'sonner';

export default function AppHome() {
  const navigate = useNavigate();
  const { session, subscriptionStatus, isAuthenticated, isLoading, logout } = useAppAuth();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTVMode, setIsTVMode] = useState(false);

  const {
    channels,
    categories,
    selectedCategory,
    setSelectedCategory,
    loading: channelsLoading,
    error: channelsError,
  } = useChannels(session?.m3uUrl);

  const { focusedId } = useTVNavigation(isTVMode);

  // Detect TV mode (Android TV, Fire TV, etc.)
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isTV = userAgent.includes('tv') || 
                 userAgent.includes('androidtv') || 
                 userAgent.includes('firetv') ||
                 window.matchMedia('(pointer: coarse) and (min-width: 1024px)').matches;
    setIsTVMode(isTV);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) {
      setSelectedChannel(channels[0]);
    }
  }, [channels, selectedChannel]);

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
    setIsMobileMenuOpen(false);
    toast.success(`Mudando para ${channel.name}`);
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Desconectado com sucesso');
    navigate('/');
  };

  if (isLoading || channelsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando canais...</p>
        </div>
      </div>
    );
  }

  if (channelsError) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md px-4">
          <Tv className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Erro ao carregar canais</h2>
          <p className="text-muted-foreground mb-4">{channelsError}</p>
          <Button onClick={handleLogout} variant="outline">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // Desktop/TV Layout
  if (!isTVMode && window.innerWidth >= 768) {
    return (
      <div className="h-screen flex bg-background">
        {/* Sidebar */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h1 className="text-lg font-bold">IPTV LINK</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
          
          <ChannelList
            channels={channels}
            categories={categories}
            selectedChannel={selectedChannel || undefined}
            selectedCategory={selectedCategory}
            onChannelSelect={handleChannelSelect}
            onCategorySelect={setSelectedCategory}
          />
        </div>

        {/* Player */}
        <div className="flex-1 flex items-center justify-center bg-black">
          {selectedChannel ? (
            <VideoPlayer
              url={selectedChannel.url}
              title={selectedChannel.name}
              logo={selectedChannel.logo}
              className="w-full h-full"
            />
          ) : (
            <div className="text-center text-white">
              <Tv className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">Selecione um canal para assistir</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-background">
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <div className="p-4 border-b">
              <h1 className="text-lg font-bold">IPTV LINK</h1>
            </div>
            <ChannelList
              channels={channels}
              categories={categories}
              selectedChannel={selectedChannel || undefined}
              selectedCategory={selectedCategory}
              onChannelSelect={handleChannelSelect}
              onCategorySelect={setSelectedCategory}
              isTVMode={isTVMode}
            />
          </SheetContent>
        </Sheet>

        <h1 className="font-semibold truncate flex-1 text-center">
          {selectedChannel?.name || 'IPTV LINK'}
        </h1>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      {/* Player */}
      <div className="flex-1 bg-black">
        {selectedChannel ? (
          <VideoPlayer
            url={selectedChannel.url}
            title={selectedChannel.name}
            logo={selectedChannel.logo}
            className="w-full h-full"
          />
        ) : (
          <div className="h-full flex items-center justify-center text-white">
            <div className="text-center">
              <Tv className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl">Nenhum canal selecionado</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
