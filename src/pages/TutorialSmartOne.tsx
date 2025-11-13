import { useState, useEffect } from 'react';
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
import { Loader2, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react';
import { PlanoCliente } from '@/types/cliente';

import step1 from '@/assets/tutorial/01-app-store-search.png';
import step2 from '@/assets/smartone-logo.png';
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
    origemCadastro: 'Website' as 'Google Ads' | 'Facebook' | 'Instagram' | 'Indicação' | 'Website' | 'Outro',
  });
  const [macError, setMacError] = useState('');
  const [macWarning, setMacWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { addCliente, updateCliente, clientes } = useClientes();
  const navigate = useNavigate();

  // Formatar MAC automaticamente durante digitação
  const formatMacAddress = (value: string): string => {
    // Remove caracteres não hexadecimais
    const cleaned = value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    
    // Adiciona : a cada 2 caracteres
    const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
    
    // Limita a 17 caracteres (XX:XX:XX:XX:XX:XX)
    return formatted.substring(0, 17);
  };

  // Validar MAC em tempo real
  const validateMac = (mac: string) => {
    if (mac.length === 0) {
      setMacError('');
      setMacWarning('');
      return;
    }

    // Validar formato
    const macRegex = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;
    
    if (mac.length < 17) {
      setMacError('MAC incompleto');
      setMacWarning('');
      return;
    }

    if (!macRegex.test(mac)) {
      setMacError('Formato inválido. Use XX:XX:XX:XX:XX:XX');
      setMacWarning('');
      return;
    }

    // Verificar se MAC já existe
    const macExistente = clientes.find(c => 
      c.macSmartOne?.toUpperCase() === mac.toUpperCase()
    );

    if (macExistente) {
      setMacError('');
      setMacWarning(`Este MAC já está cadastrado para ${macExistente.nome}`);
      return;
    }

    // MAC válido e disponível
    setMacError('');
    setMacWarning('');
  };

  // Atualizar MAC com formatação e validação
  useEffect(() => {
    if (formData.macSmartOne) {
      validateMac(formData.macSmartOne);
    }
  }, [formData.macSmartOne, clientes]);

  const handleMacChange = (value: string) => {
    const formatted = formatMacAddress(value);
    setFormData(prev => ({ ...prev, macSmartOne: formatted }));
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações rigorosas
    if (!formData.nome.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nome obrigatório',
        description: 'Por favor, informe seu nome completo.',
      });
      return;
    }

    if (!formData.telefone.trim() || formData.telefone.length < 10) {
      toast({
        variant: 'destructive',
        title: 'Telefone obrigatório',
        description: 'Por favor, informe um telefone válido com DDD.',
      });
      return;
    }

    if (!formData.email.trim()) {
      toast({
        variant: 'destructive',
        title: 'Email obrigatório',
        description: 'Por favor, informe um email válido.',
      });
      return;
    }

    if (!formData.macSmartOne || macError) {
      toast({
        variant: 'destructive',
        title: 'MAC obrigatório',
        description: 'Por favor, informe o endereço MAC válido do seu dispositivo.',
      });
      return;
    }

    // Validar formato MAC
    const macRegex = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(formData.macSmartOne)) {
      toast({
        title: 'MAC inválido',
        description: 'O endereço MAC deve estar no formato XX:XX:XX:XX:XX:XX',
        variant: 'destructive',
      });
      return;
    }

    // Verificar se MAC já foi cadastrado
    const macExistente = clientes.find(c => 
      c.macSmartOne?.toUpperCase() === formData.macSmartOne.toUpperCase()
    );

    if (macExistente) {
      toast({
        title: 'MAC já cadastrado',
        description: `Este endereço MAC já está registrado para ${macExistente.nome}`,
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
        usuario: '',
        senha: '',
        clienteAtivo: true,
        origemCadastro: formData.origemCadastro,
      });

      // Tentar criar playlist no SmartOne
      await smartoneService.syncPlaylistForClient(
        novoCliente,
        updateCliente
      );

      // Enviar notificações WhatsApp (cliente e admin)
      await sendClientWelcomeNotification(novoCliente);

      toast({
        title: '✅ Cadastro realizado!',
        description: 'Redirecionando...',
      });

      // Redirecionar para página de sucesso
      setTimeout(() => {
        navigate('/cadastro-sucesso');
      }, 1500);

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
                  onChange={(e) => handleMacChange(e.target.value)}
                  className={
                    macError ? 'border-destructive' : 
                    macWarning ? 'border-yellow-500' : 
                    formData.macSmartOne.length === 17 && !macError ? 'border-green-500' : ''
                  }
                  required
                />
                {macError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{macError}</span>
                  </div>
                )}
                {macWarning && !macError && (
                  <div className="flex items-center gap-2 text-sm text-yellow-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{macWarning}</span>
                  </div>
                )}
                {!macError && !macWarning && formData.macSmartOne.length === 17 && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>MAC válido e disponível</span>
                  </div>
                )}
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

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="origemCadastro">Como nos conheceu? (opcional)</Label>
                <Select
                  value={formData.origemCadastro}
                  onValueChange={(value: any) => handleInputChange('origemCadastro', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Website">Pesquisa no Google / Site</SelectItem>
                    <SelectItem value="Google Ads">Anúncio no Google</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Indicação">Indicação de Amigo</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
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
              disabled={isSubmitting || !!macError || !!macWarning}
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
