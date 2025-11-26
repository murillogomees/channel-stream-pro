import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Monitor, Download, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function AppInstall() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast.error('Instalação não disponível neste navegador');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      toast.success('App instalado com sucesso!');
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <h1 className="text-xl font-bold">Instalar App</h1>
          <div className="w-[80px]" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Install Status */}
        {isInstalled ? (
          <Card className="p-8 text-center mb-8 bg-primary/10 border-primary">
            <Check className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">App já instalado!</h2>
            <p className="text-muted-foreground mb-6">
              O app já está instalado no seu dispositivo.
            </p>
            <Button onClick={() => navigate('/app/player')}>
              Abrir Player IPTV
            </Button>
          </Card>
        ) : isInstallable ? (
          <Card className="p-8 text-center mb-8">
            <Download className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Instalar IPTV App</h2>
            <p className="text-muted-foreground mb-6">
              Instale o app no seu dispositivo para acesso rápido e experiência offline.
            </p>
            <Button onClick={handleInstall} size="lg">
              <Download className="w-5 h-5 mr-2" />
              Instalar Agora
            </Button>
          </Card>
        ) : (
          <Card className="p-8 text-center mb-8">
            <Smartphone className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Como Instalar</h2>
            <p className="text-muted-foreground">
              Siga as instruções abaixo para instalar o app no seu dispositivo.
            </p>
          </Card>
        )}

        {/* Installation Instructions */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Android/Chrome */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Smartphone className="w-8 h-8 text-primary" />
              <h3 className="text-xl font-bold">Android / Chrome</h3>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <span>Abra este site no navegador Chrome</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <span>Toque no menu (⋮) no canto superior direito</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <span>Selecione "Adicionar à tela inicial" ou "Instalar app"</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">4.</span>
                <span>Confirme a instalação</span>
              </li>
            </ol>
          </Card>

          {/* iOS/Safari */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Smartphone className="w-8 h-8 text-primary" />
              <h3 className="text-xl font-bold">iOS / Safari</h3>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <span>Abra este site no Safari</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <span>Toque no botão Compartilhar (□↑)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <span>Role para baixo e selecione "Adicionar à Tela de Início"</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">4.</span>
                <span>Toque em "Adicionar" para confirmar</span>
              </li>
            </ol>
          </Card>

          {/* Desktop */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="w-8 h-8 text-primary" />
              <h3 className="text-xl font-bold">Desktop / Computador</h3>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <span>Abra este site no Chrome, Edge ou Firefox</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <span>Procure pelo ícone de instalação (⊕) na barra de endereço</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <span>Clique no ícone e selecione "Instalar"</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">4.</span>
                <span>O app será adicionado ao seu sistema</span>
              </li>
            </ol>
          </Card>

          {/* Features */}
          <Card className="p-6 bg-primary/5">
            <h3 className="text-xl font-bold mb-4">Vantagens do App</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Acesso rápido direto da tela inicial</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Funciona offline após primeiro acesso</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Experiência otimizada para TV e mobile</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Atualizações automáticas</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Sem necessidade de lojas de apps</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
