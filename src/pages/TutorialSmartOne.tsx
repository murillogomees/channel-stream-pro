import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useClientes } from '@/hooks/useClientes';
import { smartoneService } from '@/services/smartoneService';
import { sendClientWelcomeNotification } from '@/services/prospectNotificationService';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { PlanoCliente } from '@/types/cliente';

import step1 from '@/assets/tutorial/01-app-store-search.png';
import step2 from '@/assets/tutorial/02-app-install.png';
import step3 from '@/assets/tutorial/03-app-home.png';
import step4 from '@/assets/tutorial/04-settings-menu.png';
import step5 from '@/assets/tutorial/05-mac-address.png';

const tutorialSteps = [
  {
    title: '1. Procure o App na Loja',
    description: 'Abra a loja de aplicativos da sua Smart TV e procure por "SmartOne IPTV"',
    image: step1,
  },
  {
    title: '2. Instale o Aplicativo',
    description: 'Clique em "Instalar" e aguarde o download ser concluído',
    image: step2,
  },
  {
    title: '3. Abra o SmartOne IPTV',
    description: 'Após a instalação, abra o aplicativo',
    image: step3,
  },
  {
    title: '4. Acesse as Configurações',
    description: 'No menu principal, navegue até "Configurações" ou "Settings"',
    image: step4,
  },
  {
    title: '5. Copie o Endereço MAC',
    description: 'Em "Informações do Dispositivo", copie o endereço MAC e insira no formulário abaixo',
    image: step5,
  },
];

export default function TutorialSmartOne() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    macSmartOne: '',
    plano: 'Mensal' as PlanoCliente,
    valorPago: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { addCliente, updateCliente } = useClientes();
  const navigate = useNavigate();

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.telefone || !formData.email || !formData.macSmartOne) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    // Validar formato MAC (XX:XX:XX:XX:XX:XX ou XX-XX-XX-XX-XX-XX)
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(formData.macSmartOne)) {
      toast({
        title: 'MAC inválido',
        description: 'O endereço MAC deve estar no formato XX:XX:XX:XX:XX:XX',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Calcular data de vencimento baseada no plano
      const hoje = new Date();
      let diasPlano = 30;
      let valor = formData.valorPago || 0;
      
      switch (formData.plano) {
        case 'Mensal':
          diasPlano = 30;
          valor = valor || 29.90;
          break;
        case 'Trimestral':
          diasPlano = 90;
          valor = valor || 79.90;
          break;
        case 'Semestral':
          diasPlano = 180;
          valor = valor || 149.90;
          break;
        case 'Anual':
          diasPlano = 365;
          valor = valor || 279.90;
          break;
      }

      const dataVencimento = new Date(hoje);
      dataVencimento.setDate(hoje.getDate() + diasPlano);

      // Criar cliente
      const novoCliente = addCliente({
        nome: formData.nome,
        telefone: formData.telefone,
        email: formData.email,
        telegram: '',
        situacao: 'Ativo',
        dataContratacao: hoje.toISOString(),
        dataVencimento: dataVencimento.toISOString(),
        plano: formData.plano,
        valorPago: valor,
        dataUltimoPagamento: hoje.toISOString(),
        formaUltimoPagamento: 'Pix',
        macSmartOne: formData.macSmartOne,
        usuario: '', // Será preenchido pelo SmartOne
        senha: '', // Será preenchido pelo SmartOne
        clienteAtivo: true,
      });

      // Tentar criar playlist no SmartOne
      const syncResult = await smartoneService.syncPlaylistForClient(
        novoCliente,
        updateCliente
      );

      // Enviar notificações WhatsApp (cliente e admin)
      await sendClientWelcomeNotification(novoCliente);

      toast({
        title: '✅ Cadastro realizado!',
        description: 'Seu acesso foi criado com sucesso. Verifique seu WhatsApp para mais informações.',
      });

      // Redirecionar para página de sucesso ou home
      setTimeout(() => {
        navigate('/');
      }, 3000);

    } catch (error) {
      console.error('Erro ao processar cadastro:', error);
      toast({
        title: 'Erro no cadastro',
        description: 'Não foi possível completar seu cadastro. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Como Ativar seu SmartOne IPTV</h1>
          <p className="text-muted-foreground text-lg">
            Siga o passo a passo abaixo para instalar o aplicativo e ativar seu acesso
          </p>
        </div>

        {/* Tutorial Steps */}
        <div className="grid gap-8 mb-16">
          {tutorialSteps.map((step, index) => (
            <Card
              key={index}
              className={`p-6 transition-all ${
                currentStep === index ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    {currentStep > index ? (
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                    )}
                    <h3 className="text-2xl font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-lg mb-4">{step.description}</p>
                  {currentStep === index && index < tutorialSteps.length - 1 && (
                    <Button onClick={() => setCurrentStep(index + 1)}>
                      Próximo Passo <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={step.image}
                    alt={step.title}
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Registration Form */}
        <Card className="p-8">
          <h2 className="text-3xl font-bold mb-2">Complete seu Cadastro</h2>
          <p className="text-muted-foreground mb-6">
            Preencha os dados abaixo para ativar seu acesso ao SmartOne IPTV
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  placeholder="Digite seu nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">WhatsApp *</Label>
                <Input
                  id="telefone"
                  placeholder="(61) 99999-9999"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange('telefone', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="macSmartOne">Endereço MAC *</Label>
                <Input
                  id="macSmartOne"
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={formData.macSmartOne}
                  onChange={(e) => handleInputChange('macSmartOne', e.target.value.toUpperCase())}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Copie o endereço MAC da tela de informações do app
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plano">Plano *</Label>
                <Select
                  value={formData.plano}
                  onValueChange={(value) => handleInputChange('plano', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mensal">Mensal - R$ 29,90</SelectItem>
                    <SelectItem value="Trimestral">Trimestral - R$ 79,90</SelectItem>
                    <SelectItem value="Semestral">Semestral - R$ 149,90</SelectItem>
                    <SelectItem value="Anual">Anual - R$ 279,90</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valorPago">Valor Pago (R$)</Label>
                <Input
                  id="valorPago"
                  type="number"
                  step="0.01"
                  placeholder="29.90"
                  value={formData.valorPago || ''}
                  onChange={(e) => handleInputChange('valorPago', parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para usar o valor padrão do plano
                </p>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h3 className="font-semibold mb-2">🎉 O que você vai receber:</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ Acesso imediato ao SmartOne IPTV</li>
                <li>✓ Playlist configurada automaticamente</li>
                <li>✓ Mensagem no WhatsApp com todos os detalhes</li>
                <li>✓ Suporte técnico disponível</li>
                <li>✓ Atualizações e dicas de uso</li>
              </ul>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando cadastro...
                </>
              ) : (
                'Ativar Meu Acesso Agora'
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
