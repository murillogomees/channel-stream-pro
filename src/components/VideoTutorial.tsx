import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react';

import step1 from '@/assets/tutorial/real-step1-home.png';
import step2 from '@/assets/tutorial/real-step2-settings.png';
import step3 from '@/assets/tutorial/real-step3-channels.png';
import step4 from '@/assets/tutorial/real-step4-watching.png';
import step5 from '@/assets/tutorial/real-step5-movies.png';
import step6 from '@/assets/tutorial/real-step6-mac.png';

interface TutorialStep {
  image: string;
  title: string;
  description: string;
  duration: number; // em segundos
}

const tutorialSteps: TutorialStep[] = [
  {
    image: step1,
    title: '1. Tela Inicial do SmartOne IPTV',
    description: 'Ao abrir o app, você verá a tela inicial com o logo SmartOne e o menu inferior com 5 opções: Reload, Settings (Configurações), Channels (Canais), Movies (Filmes) e Series (Séries). Use o controle remoto para navegar.',
    duration: 5,
  },
  {
    image: step2,
    title: '2. Menu de Configurações',
    description: 'Acesse Settings para configurar o idioma, player skin, formato de saída e outras preferências. O menu lateral mostra todas as opções: ACCOUNTS, SETUP, ABOUT, INFO, PRELOAD e RETURN.',
    duration: 5,
  },
  {
    image: step3,
    title: '3. Grade de Canais ao Vivo',
    description: 'Na seção Channels você encontra todos os canais disponíveis organizados em categorias. Navegue pela grade usando as setas do controle e selecione o canal que deseja assistir.',
    duration: 5,
  },
  {
    image: step4,
    title: '4. Assistindo TV ao Vivo',
    description: 'O player mostra o conteúdo em tela cheia. A barra de controle na parte inferior exibe o nome do canal, horário, controles de volume e outras informações. Pressione OK para mostrar/ocultar os controles.',
    duration: 5,
  },
  {
    image: step5,
    title: '5. Catálogo de Filmes e Séries',
    description: 'Na seção Movies você encontra milhares de filmes organizados por categorias. Navegue pelos títulos, selecione um filme e pressione OK para assistir. O mesmo vale para a seção Series.',
    duration: 5,
  },
  {
    image: step6,
    title: '6. Encontrando o Endereço MAC',
    description: 'Para ativar seu acesso, vá em Settings > INFO e copie o endereço MAC exibido. Esse código identifica seu dispositivo e é necessário para a ativação do serviço.',
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
