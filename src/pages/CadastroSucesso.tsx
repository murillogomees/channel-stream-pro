import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackCompleteRegistration } from '@/services/metaPixelService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Home, MessageCircle, LayoutDashboard, ArrowLeft } from 'lucide-react';
import VideoTutorial from '@/components/VideoTutorial';

export default function CadastroSucesso() {
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
    
    // Track successful registration
    trackCompleteRegistration({ 
      content_name: 'IPTV Registration', 
      value: 0,
      currency: 'BRL' 
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 rounded-full mb-6">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            🎉 Cadastro Realizado com Sucesso!
          </h1>
          <p className="text-xl text-muted-foreground">
            Seu acesso foi criado e você já pode começar a assistir
          </p>
        </div>

        {/* Instructions Card */}
        <Card className="p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">📱 Próximos Passos</h2>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Verifique seu WhatsApp</h3>
                <p className="text-muted-foreground">
                  Enviamos uma mensagem com todas as informações do seu plano, 
                  incluindo data de vencimento, valor e dicas de uso.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Aguarde a configuração</h3>
                <p className="text-muted-foreground">
                  Estamos configurando sua playlist automaticamente. 
                  Isso pode levar alguns minutos.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Abra o aplicativo</h3>
                <p className="text-muted-foreground">
                  Abra o app IPTV na sua TV. Seus canais já estarão disponíveis!
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Video Tutorial Card */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-4 text-center">🎬 Como Usar o App IPTV</h2>
          <p className="text-center text-muted-foreground mb-6">
            Assista ao tutorial interativo e aprenda a navegar pelo aplicativo
          </p>
          
          <VideoTutorial />
        </div>

        {/* Tips Card */}
        <Card className="p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">💡 Dicas Importantes</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-muted-foreground">
                <strong>Internet Estável:</strong> Recomendamos conexão de pelo menos 10 Mbps para qualidade Full HD
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-muted-foreground">
                <strong>Canais Favoritos:</strong> Adicione seus canais preferidos aos favoritos para acesso rápido
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-muted-foreground">
                <strong>Guia de Programação:</strong> Use o EPG (guia eletrônico) para ver a grade de programação
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-muted-foreground">
                <strong>Suporte 24/7:</strong> Nossa equipe está sempre disponível no WhatsApp para ajudar
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-muted-foreground">
                <strong>Ganhe 1 Mês Grátis:</strong> Indique um amigo e quando ele assinar, você ganha 1 mês grátis automaticamente!
              </p>
            </div>
          </div>
        </Card>

        {/* Support Card */}
        <Card className="p-8 mb-8 bg-primary/5 border-primary/20">
          <div className="flex items-center gap-4 mb-4">
            <MessageCircle className="w-8 h-8 text-primary" />
            <div>
              <h3 className="text-xl font-bold">Precisa de Ajuda?</h3>
              <p className="text-muted-foreground">
                Nossa equipe de suporte está à disposição
              </p>
            </div>
          </div>
          <p className="text-muted-foreground mb-4">
            Qualquer dúvida sobre instalação, configuração ou uso do sistema, 
            entre em contato conosco pelo WhatsApp. Respondemos rapidamente!
          </p>
          <Button 
            size="lg" 
            className="w-full sm:w-auto"
            onClick={() => window.open('https://wa.me/556131425880', '_blank')}
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Falar com Suporte
          </Button>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            size="lg"
            className="flex-1"
            onClick={() => navigate('/dashboard')}
          >
            <LayoutDashboard className="mr-2 h-5 w-5" />
            Acessar Meu Dashboard
          </Button>
          <Button 
            size="lg" 
            variant="secondary"
            className="flex-1 bg-primary/10 hover:bg-primary hover:text-primary-foreground"
            onClick={() => navigate('/')}
          >
            <Home className="mr-2 h-5 w-5" />
            Voltar ao Início
          </Button>
        </div>
      </div>
    </div>
  );
}
