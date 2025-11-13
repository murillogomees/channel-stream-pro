import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

import step1 from '@/assets/tutorial/video-step1-main-menu.png';
import step2 from '@/assets/tutorial/video-step2-channel-grid.png';
import step3 from '@/assets/tutorial/video-step3-watching.png';
import step4 from '@/assets/tutorial/video-step4-channel-info.png';
import step5 from '@/assets/tutorial/video-step5-movies.png';
import step6 from '@/assets/tutorial/video-step6-favorites.png';

interface TutorialStep {
  image: string;
  title: string;
  description: string;
  duration: number; // em segundos
}

const tutorialSteps: TutorialStep[] = [
  {
    image: step1,
    title: 'Menu Principal do SmartOne IPTV',
    description: 'Ao abrir o app, você verá o menu principal com categorias como TV ao Vivo, Filmes, Séries e Esportes. Use o controle remoto para navegar entre as opções.',
    duration: 5,
  },
  {
    image: step2,
    title: 'Grade de Canais',
    description: 'Escolha a categoria "TV ao Vivo" para ver todos os canais disponíveis. Os canais são organizados por categorias: Notícias, Entretenimento, Esportes e mais.',
    duration: 5,
  },
  {
    image: step3,
    title: 'Assistindo TV ao Vivo',
    description: 'Selecione qualquer canal para começar a assistir. A barra de controle aparece na parte inferior com informações do canal, controles de volume e outras opções.',
    duration: 5,
  },
  {
    image: step4,
    title: 'Informações do Programa',
    description: 'Pressione o botão "Info" do controle para ver detalhes do programa atual: nome, descrição, horário e próximas atrações do canal.',
    duration: 5,
  },
  {
    image: step5,
    title: 'Catálogo de Filmes',
    description: 'Acesse a seção "Filmes" para explorar milhares de títulos organizados por categoria: Ação, Drama, Comédia, Suspense e mais. Clique em qualquer filme para assistir.',
    duration: 5,
  },
  {
    image: step6,
    title: 'Seus Favoritos',
    description: 'Marque seus canais favoritos clicando no ícone de coração. Acesse rapidamente seus canais preferidos na seção "Favoritos".',
    duration: 5,
  },
];

export default function VideoTutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 0.1;
          
          // Se completou o tempo do step atual, avança para o próximo
          if (newProgress >= tutorialSteps[currentStep].duration) {
            if (currentStep < tutorialSteps.length - 1) {
              setCurrentStep(currentStep + 1);
              return 0;
            } else {
              // Chegou ao fim do tutorial
              setIsPlaying(false);
              return tutorialSteps[currentStep].duration;
            }
          }
          
          return newProgress;
        });
      }, 100);
    }

    return () => clearInterval(interval);
  }, [isPlaying, currentStep]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setProgress(0);
      setIsPlaying(false);
    }
  };

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      setProgress(0);
      setIsPlaying(false);
    }
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setProgress(0);
    setIsPlaying(false);
  };

  const currentStepData = tutorialSteps[currentStep];
  const progressPercentage = (progress / currentStepData.duration) * 100;

  return (
    <Card className="overflow-hidden">
      {/* Video/Image Display */}
      <div className="relative aspect-video bg-black">
        <img
          src={currentStepData.image}
          alt={currentStepData.title}
          className="w-full h-full object-contain animate-fade-in"
          key={currentStep}
        />
        
        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-background/30">
          <div
            className="h-full bg-primary transition-all duration-100"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Step Counter */}
        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
          {currentStep + 1} / {tutorialSteps.length}
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-xl font-semibold mb-2">{currentStepData.title}</h3>
          <p className="text-muted-foreground">{currentStepData.description}</p>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRestart}
            disabled={currentStep === 0 && progress === 0}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            className="h-12 w-12"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentStep === tutorialSteps.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Step Indicators */}
        <div className="flex justify-center gap-2">
          {tutorialSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentStep(index);
                setProgress(0);
                setIsPlaying(false);
              }}
              className={`h-2 rounded-full transition-all ${
                index === currentStep
                  ? 'w-8 bg-primary'
                  : index < currentStep
                  ? 'w-2 bg-primary/50'
                  : 'w-2 bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
