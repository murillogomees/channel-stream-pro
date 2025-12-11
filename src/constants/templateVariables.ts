// Template Variables System - Categorized variables for WhatsApp templates

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  example: string;
}

export interface VariableCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  variables: TemplateVariable[];
}

// === VARIÁVEIS DO CLIENTE ===
const clientVariables: TemplateVariable[] = [
  { key: 'nome', label: 'Nome', description: 'Nome completo do cliente', example: 'João Silva' },
  { key: 'primeiroNome', label: 'Primeiro Nome', description: 'Apenas o primeiro nome', example: 'João' },
  { key: 'email', label: 'E-mail', description: 'E-mail do cliente', example: 'joao@email.com' },
  { key: 'telefone', label: 'Telefone', description: 'Telefone do cliente', example: '(11) 99999-9999' },
  { key: 'usuarioM3u', label: 'Usuário M3U', description: 'Nome de usuário para acesso M3U', example: 'joao_user' },
  { key: 'senhaM3u', label: 'Senha M3U', description: 'Senha de acesso M3U', example: '****' },
  { key: 'macSmartOne', label: 'MAC SmartOne', description: 'Endereço MAC do dispositivo', example: '00:1A:2B:3C:4D:5E' },
  { key: 'dispositivoContratado', label: 'Dispositivo', description: 'Tipo de dispositivo contratado', example: 'Smart TV' },
  { key: 'origemCadastro', label: 'Origem Cadastro', description: 'Como o cliente conheceu o serviço', example: 'Instagram' },
  { key: 'idCliente', label: 'ID do Cliente', description: 'Identificador único do cliente', example: 'CLI-12345' },
  { key: 'cidadeCliente', label: 'Cidade', description: 'Cidade do cliente', example: 'São Paulo' },
  { key: 'estadoCliente', label: 'Estado', description: 'Estado do cliente', example: 'SP' },
  { key: 'cpfCliente', label: 'CPF', description: 'CPF do cliente (mascarado)', example: '***.***.***-00' },
  { key: 'tempoCliente', label: 'Tempo como Cliente', description: 'Há quanto tempo é cliente', example: '6 meses' },
];

// === VARIÁVEIS DE ASSINATURA ===
const subscriptionVariables: TemplateVariable[] = [
  { key: 'plano', label: 'Plano', description: 'Nome do plano contratado', example: 'Mensal' },
  { key: 'valor', label: 'Valor', description: 'Valor do plano', example: '30.00' },
  { key: 'valorFormatado', label: 'Valor Formatado', description: 'Valor com símbolo R$', example: 'R$ 30,00' },
  { key: 'dataVencimento', label: 'Data Vencimento', description: 'Data de vencimento do plano', example: '15/01/2025' },
  { key: 'dataContratacao', label: 'Data Contratação', description: 'Data de contratação', example: '15/12/2024' },
  { key: 'dataCadastro', label: 'Data Cadastro', description: 'Data de cadastro no sistema', example: '10/12/2024' },
  { key: 'diasRestantes', label: 'Dias Restantes', description: 'Dias até o vencimento', example: '5' },
  { key: 'diasVencido', label: 'Dias Vencido', description: 'Dias desde o vencimento', example: '3' },
  { key: 'situacao', label: 'Situação', description: 'Status atual do cliente', example: 'Ativo' },
  { key: 'isRecorrente', label: 'É Recorrente', description: 'Se tem pagamento recorrente', example: 'Sim' },
  { key: 'planoAnterior', label: 'Plano Anterior', description: 'Plano antes da mudança', example: 'Básico' },
  { key: 'novoPlano', label: 'Novo Plano', description: 'Novo plano após upgrade', example: 'Premium' },
  { key: 'economiaAnual', label: 'Economia Anual', description: 'Economia com plano anual', example: 'R$ 80,00' },
  { key: 'diasTeste', label: 'Dias de Teste', description: 'Dias restantes no teste', example: '3' },
  { key: 'dataFimTeste', label: 'Fim do Teste', description: 'Data do fim do período teste', example: '20/12/2024' },
  { key: 'duracaoPlano', label: 'Duração do Plano', description: 'Período do plano contratado', example: '30 dias' },
];

// === VARIÁVEIS DE PAGAMENTO ===
const paymentVariables: TemplateVariable[] = [
  { key: 'formaPagamento', label: 'Forma de Pagamento', description: 'Método de pagamento usado', example: 'PIX' },
  { key: 'dataUltimoPagamento', label: 'Último Pagamento', description: 'Data do último pagamento', example: '10/12/2024' },
  { key: 'valorUltimoPagamento', label: 'Valor Último Pago', description: 'Valor do último pagamento', example: 'R$ 30,00' },
  { key: 'statusPagamento', label: 'Status Pagamento', description: 'Status do pagamento', example: 'Aprovado' },
  { key: 'linkPagamento', label: 'Link Pagamento', description: 'Link para realizar pagamento', example: 'https://pay.mercadopago.com/...' },
  { key: 'pixCopiaECola', label: 'PIX Copia e Cola', description: 'Código PIX para pagamento', example: '00020126...' },
  { key: 'motivoErro', label: 'Motivo do Erro', description: 'Razão de falha no pagamento', example: 'Saldo insuficiente' },
  { key: 'statusInfo', label: 'Info Status', description: 'Informações adicionais do status', example: 'Aguardando confirmação bancária' },
  { key: 'idTransacao', label: 'ID da Transação', description: 'Identificador da transação', example: 'TRX-123456' },
  { key: 'dataProximaCobranca', label: 'Próxima Cobrança', description: 'Data da próxima cobrança recorrente', example: '15/02/2025' },
  { key: 'valorDesconto', label: 'Valor do Desconto', description: 'Valor descontado', example: 'R$ 10,00' },
  { key: 'valorFinal', label: 'Valor Final', description: 'Valor após descontos', example: 'R$ 69,90' },
  { key: 'parcelaAtual', label: 'Parcela Atual', description: 'Número da parcela atual', example: '2 de 12' },
];

// === VARIÁVEIS DE CUPONS ===
const couponVariables: TemplateVariable[] = [
  { key: 'codigoCupom', label: 'Código do Cupom', description: 'Código do cupom de desconto', example: 'PROMO30' },
  { key: 'descontoCupom', label: 'Desconto do Cupom', description: 'Valor ou percentual do desconto', example: '30%' },
  { key: 'validadeCupom', label: 'Validade do Cupom', description: 'Data de expiração do cupom', example: '31/12/2024' },
  { key: 'cupomAtivo', label: 'Cupom Ativo', description: 'Se o cupom está ativo', example: 'Sim' },
  { key: 'usosRestantesCupom', label: 'Usos Restantes', description: 'Quantas vezes o cupom ainda pode ser usado', example: '10' },
  { key: 'tipoCupom', label: 'Tipo de Cupom', description: 'Tipo do cupom (porcentagem ou valor fixo)', example: 'Porcentagem' },
  { key: 'cupomExclusivo', label: 'Cupom Exclusivo', description: 'Se é exclusivo para o cliente', example: 'Sim' },
];

// === VARIÁVEIS DO SISTEMA ===
const systemVariables: TemplateVariable[] = [
  { key: 'dataHoje', label: 'Data Hoje', description: 'Data atual', example: '07/12/2024' },
  { key: 'horaAtual', label: 'Hora Atual', description: 'Hora atual', example: '14:30' },
  { key: 'diaSemana', label: 'Dia da Semana', description: 'Dia da semana atual', example: 'Sábado' },
  { key: 'mesAtual', label: 'Mês Atual', description: 'Nome do mês atual', example: 'Dezembro' },
  { key: 'anoAtual', label: 'Ano Atual', description: 'Ano atual', example: '2024' },
  { key: 'nomeEmpresa', label: 'Nome da Empresa', description: 'Nome do seu negócio', example: 'IPTV LINK' },
  { key: 'whatsappSuporte', label: 'WhatsApp Suporte', description: 'Número de suporte', example: '(61) 99697-5924' },
  { key: 'emailSuporte', label: 'E-mail Suporte', description: 'E-mail de suporte', example: 'suporte@iptvlink.com' },
  { key: 'linkSite', label: 'Link do Site', description: 'URL do site', example: 'https://iptvlink.com' },
  { key: 'linkApp', label: 'Link do App', description: 'Link para baixar o aplicativo', example: 'https://app.iptvlink.com' },
  { key: 'horasAtendimento', label: 'Horário Atendimento', description: 'Horário de funcionamento do suporte', example: '08h às 22h' },
  { key: 'versaoApp', label: 'Versão do App', description: 'Versão atual do aplicativo', example: '2.5.0' },
  { key: 'linkIndicacao', label: 'Link de Indicação', description: 'Link personalizado de indicação', example: 'https://iptvlink.com/r/joao123' },
];

// === VARIÁVEIS DE CONTEÚDO M3U ===
const m3uContentVariables: TemplateVariable[] = [
  { key: 'totalCanais', label: 'Total de Canais', description: 'Quantidade total de canais disponíveis', example: '1.500+' },
  { key: 'totalFilmes', label: 'Total de Filmes', description: 'Quantidade de filmes no catálogo', example: '50.000+' },
  { key: 'totalSeries', label: 'Total de Séries', description: 'Quantidade de séries disponíveis', example: '5.000+' },
  { key: 'categoriasDisponiveis', label: 'Categorias', description: 'Lista de categorias disponíveis', example: 'Esportes, Filmes, Séries...' },
  { key: 'ultimaAtualizacao', label: 'Última Atualização', description: 'Data da última atualização da lista', example: '07/12/2024' },
  { key: 'novosConteudos', label: 'Novos Conteúdos', description: 'Quantidade de novos conteúdos', example: '150 novos filmes' },
  { key: 'conteudoEmDestaque', label: 'Destaque', description: 'Conteúdo em destaque no momento', example: 'The Last of Us - Temporada 2' },
  { key: 'qualidadeStream', label: 'Qualidade Stream', description: 'Qualidade máxima disponível', example: '4K Ultra HD' },
];

// === VARIÁVEIS DE ESTATÍSTICAS DO USUÁRIO ===
const userStatsVariables: TemplateVariable[] = [
  { key: 'tempoTotalAssistido', label: 'Tempo Total Assistido', description: 'Tempo total que o usuário assistiu', example: '45 horas' },
  { key: 'canalMaisAssistido', label: 'Canal Mais Assistido', description: 'Canal favorito do usuário', example: 'Globo HD' },
  { key: 'generoFavorito', label: 'Gênero Favorito', description: 'Gênero mais assistido', example: 'Ação' },
  { key: 'ultimoConteudo', label: 'Último Conteúdo', description: 'Último conteúdo assistido', example: 'Breaking Bad S05E16' },
  { key: 'quantidadeVisualizacoes', label: 'Total Visualizações', description: 'Total de visualizações', example: '342' },
  { key: 'diasInativo', label: 'Dias Inativo', description: 'Dias sem acessar a plataforma', example: '15' },
  { key: 'ultimoAcesso', label: 'Último Acesso', description: 'Data do último acesso', example: '05/12/2024' },
  { key: 'dispositivosAtivos', label: 'Dispositivos Ativos', description: 'Quantidade de dispositivos conectados', example: '2' },
];

// === VARIÁVEIS DE AFILIADO ===
const affiliateVariables: TemplateVariable[] = [
  { key: 'codigoAfiliado', label: 'Código Afiliado', description: 'Código único do afiliado', example: 'AFF123' },
  { key: 'totalIndicacoes', label: 'Total Indicações', description: 'Número total de indicações', example: '25' },
  { key: 'indicacoesConvertidas', label: 'Indicações Convertidas', description: 'Indicações que assinaram', example: '18' },
  { key: 'comissaoTotal', label: 'Comissão Total', description: 'Total de comissões acumuladas', example: 'R$ 540,00' },
  { key: 'comissaoPendente', label: 'Comissão Pendente', description: 'Comissão aguardando pagamento', example: 'R$ 120,00' },
  { key: 'nomeIndicado', label: 'Nome do Indicado', description: 'Nome de quem foi indicado', example: 'Maria Santos' },
  { key: 'planoIndicado', label: 'Plano do Indicado', description: 'Plano que o indicado assinou', example: 'Anual' },
];

// === VARIÁVEIS DE ENGAJAMENTO ===
const engagementVariables: TemplateVariable[] = [
  { key: 'pontosFidelidade', label: 'Pontos Fidelidade', description: 'Pontos acumulados no programa', example: '1.500' },
  { key: 'nivelFidelidade', label: 'Nível Fidelidade', description: 'Nível no programa de fidelidade', example: 'Ouro' },
  { key: 'recompensaDisponivel', label: 'Recompensa Disponível', description: 'Recompensa que pode ser resgatada', example: '1 mês grátis' },
  { key: 'proximaRecompensa', label: 'Próxima Recompensa', description: 'Pontos para próxima recompensa', example: 'Faltam 500 pontos' },
  { key: 'aniversarioCliente', label: 'Aniversário Cliente', description: 'Data de aniversário como cliente', example: '15/03/2024' },
  { key: 'mesesComoCliente', label: 'Meses como Cliente', description: 'Total de meses como cliente', example: '12' },
  { key: 'economiaTotal', label: 'Economia Total', description: 'Total economizado em promoções', example: 'R$ 200,00' },
];

// === VARIÁVEIS MANUAIS/PERSONALIZADAS ===
const customVariables: TemplateVariable[] = [
  { key: 'textoPersonalizado1', label: 'Texto Personalizado 1', description: 'Campo livre para texto customizado', example: 'Qualquer texto...' },
  { key: 'textoPersonalizado2', label: 'Texto Personalizado 2', description: 'Campo livre para texto customizado', example: 'Qualquer texto...' },
  { key: 'textoPersonalizado3', label: 'Texto Personalizado 3', description: 'Campo livre para texto customizado', example: 'Qualquer texto...' },
  { key: 'linkPersonalizado', label: 'Link Personalizado', description: 'URL customizada', example: 'https://seulink.com' },
  { key: 'numeroPersonalizado', label: 'Número Personalizado', description: 'Valor numérico customizado', example: '100' },
  { key: 'dataPersonalizada', label: 'Data Personalizada', description: 'Data customizada', example: '25/12/2024' },
  { key: 'mensagemEspecial', label: 'Mensagem Especial', description: 'Mensagem especial para ocasiões', example: 'Feliz Natal!' },
];

// === FRASES FAMOSAS DE FILMES E ATORES ===
export const FAMOUS_QUOTES: { quote: string; source: string; year?: number }[] = [
  // Clássicos Eternos (20 frases)
  { quote: "Eu voltarei.", source: "O Exterminador do Futuro", year: 1984 },
  { quote: "Que a Força esteja com você.", source: "Star Wars", year: 1977 },
  { quote: "Depois de tudo, amanhã é outro dia.", source: "E o Vento Levou", year: 1939 },
  { quote: "Vou fazer uma oferta que ele não pode recusar.", source: "O Poderoso Chefão", year: 1972 },
  { quote: "Francamente, minha cara, eu não dou a mínima.", source: "E o Vento Levou", year: 1939 },
  { quote: "Toto, tenho a sensação de que não estamos mais no Kansas.", source: "O Mágico de Oz", year: 1939 },
  { quote: "Aqui está olhando para você, garota.", source: "Casablanca", year: 1942 },
  { quote: "Você está falando comigo?", source: "Taxi Driver", year: 1976 },
  { quote: "Eu sou o rei do mundo!", source: "Titanic", year: 1997 },
  { quote: "Houston, temos um problema.", source: "Apollo 13", year: 1995 },
  { quote: "Eu amo o cheiro de napalm pela manhã.", source: "Apocalypse Now", year: 1979 },
  { quote: "Você é um brinquedo, você não pode voar!", source: "Toy Story", year: 1995 },
  { quote: "Eu serei melhor amanhã.", source: "Jerry Maguire", year: 1996 },
  { quote: "Que os jogos comecem!", source: "Jogos Vorazes", year: 2012 },
  { quote: "Eu vejo você.", source: "Avatar", year: 2009 },
  { quote: "Vamos lá, faça meu dia!", source: "Dirty Harry", year: 1983 },
  { quote: "Você não pode lidar com a verdade!", source: "Questão de Honra", year: 1992 },
  { quote: "Elementar, meu caro Watson.", source: "Sherlock Holmes", year: 2009 },
  { quote: "Eu sou o único!", source: "Highlander", year: 1986 },
  { quote: "Bem-vindo ao deserto do real.", source: "Matrix", year: 1999 },

  // Ação e Aventura (20 frases)
  { quote: "Yippee-ki-yay, filho da mãe!", source: "Duro de Matar", year: 1988 },
  { quote: "Mantenha seus amigos por perto, mas seus inimigos mais perto ainda.", source: "O Poderoso Chefão II", year: 1974 },
  { quote: "Eu sou o Homem de Ferro.", source: "Homem de Ferro", year: 2008 },
  { quote: "Com grandes poderes vêm grandes responsabilidades.", source: "Homem-Aranha", year: 2002 },
  { quote: "Por que caímos? Para aprendermos a nos levantar.", source: "Batman Begins", year: 2005 },
  { quote: "Até a vista, baby.", source: "O Exterminador do Futuro 2", year: 1991 },
  { quote: "Eu sou inevitável.", source: "Vingadores: Ultimato", year: 2019 },
  { quote: "Eu posso fazer isso o dia todo.", source: "Capitão América", year: 2011 },
  { quote: "Wakanda para sempre!", source: "Pantera Negra", year: 2018 },
  { quote: "Eu sou vingança.", source: "Batman", year: 2022 },
  { quote: "Eu não sou um herói.", source: "The Dark Knight", year: 2008 },
  { quote: "A velocidade é tudo.", source: "Velozes e Furiosos", year: 2001 },
  { quote: "Missão aceita.", source: "Missão Impossível", year: 1996 },
  { quote: "Eu sou Groot.", source: "Guardiões da Galáxia", year: 2014 },
  { quote: "Bora, Felicia!", source: "Sexta-Feira em Apuros", year: 1995 },
  { quote: "Eu sou a tempestade.", source: "Sicário", year: 2015 },
  { quote: "Não existe colher.", source: "Matrix", year: 1999 },
  { quote: "Você quer viver para sempre?", source: "Starship Troopers", year: 1997 },
  { quote: "Preciso de armas. Muitas armas.", source: "Matrix", year: 1999 },
  { quote: "Eu escolho a violência.", source: "Game of Thrones", year: 2016 },

  // Drama e Inspiracional (20 frases)
  { quote: "A vida é como uma caixa de chocolates. Você nunca sabe o que vai encontrar.", source: "Forrest Gump", year: 1994 },
  { quote: "Carpe Diem. Aproveite o dia, rapazes. Tornem suas vidas extraordinárias.", source: "Sociedade dos Poetas Mortos", year: 1989 },
  { quote: "Esperança é uma coisa boa, talvez a melhor das coisas, e coisas boas nunca morrem.", source: "Um Sonho de Liberdade", year: 1994 },
  { quote: "Você é mais corajoso do que acredita, mais forte do que parece e mais inteligente do que pensa.", source: "Ursinho Pooh", year: 1977 },
  { quote: "Ao infinito e além!", source: "Toy Story", year: 1995 },
  { quote: "Apenas continue nadando.", source: "Procurando Nemo", year: 2003 },
  { quote: "Ohana significa família. Família significa que ninguém é deixado para trás.", source: "Lilo & Stitch", year: 2002 },
  { quote: "Não importa o que aconteça, o sol vai nascer amanhã.", source: "Annie", year: 1982 },
  { quote: "Hakuna Matata! Sem preocupações para o resto de seus dias.", source: "O Rei Leão", year: 1994 },
  { quote: "A coragem não é a ausência de medo, mas o triunfo sobre ele.", source: "Mandela: Longo Caminho para a Liberdade", year: 2013 },
  { quote: "Nunca deixe ninguém dizer que você não pode fazer algo.", source: "À Procura da Felicidade", year: 2006 },
  { quote: "Toda grande aventura começa com um primeiro passo.", source: "Kung Fu Panda", year: 2008 },
  { quote: "Ontem é história, amanhã é mistério, mas hoje é um presente.", source: "Kung Fu Panda", year: 2008 },
  { quote: "Você nunca sabe o quão forte você é até ser forte seja a única opção.", source: "Mulher Maravilha", year: 2017 },
  { quote: "A mudança mais significativa começa de dentro.", source: "Divertida Mente", year: 2015 },
  { quote: "Você foi feito para grandes coisas.", source: "O Discurso do Rei", year: 2010 },
  { quote: "Cada dia é uma nova oportunidade.", source: "Groundhog Day", year: 1993 },
  { quote: "Sua mente é o seu limite.", source: "A Origem", year: 2010 },
  { quote: "Escolha seu próprio destino.", source: "Aladin", year: 1992 },
  { quote: "A maior jornada começa com um único passo.", source: "Avatar", year: 2009 },

  // Suspense e Terror (15 frases)
  { quote: "Eu vejo pessoas mortas.", source: "O Sexto Sentido", year: 1999 },
  { quote: "Aqui está Johnny!", source: "O Iluminado", year: 1980 },
  { quote: "Querem brincar de um jogo?", source: "Jogos Mortais", year: 2004 },
  { quote: "Um, dois, o Freddy vem aí.", source: "A Hora do Pesadelo", year: 1984 },
  { quote: "Eu serei seu espelho.", source: "Espelhos do Medo", year: 2008 },
  { quote: "Eles estão aqui.", source: "Poltergeist", year: 1982 },
  { quote: "É apenas um filme... é apenas um filme.", source: "A Última Casa da Rua", year: 1972 },
  { quote: "O mal nunca morre.", source: "Halloween", year: 1978 },
  { quote: "Você vai flutuar também.", source: "It: A Coisa", year: 2017 },
  { quote: "Doce sonhos.", source: "A Hora do Pesadelo", year: 1984 },
  { quote: "Nunca durma novamente.", source: "A Hora do Pesadelo", year: 1984 },
  { quote: "Eu sou sua pior pesadelo.", source: "Scream", year: 1996 },
  { quote: "Qual é o seu filme de terror favorito?", source: "Pânico", year: 1996 },
  { quote: "A morte é apenas o começo.", source: "A Múmia", year: 1999 },
  { quote: "Algo maligno vem aí.", source: "O Bebê de Rosemary", year: 1968 },

  // Romance (15 frases)
  { quote: "Você me completa.", source: "Jerry Maguire", year: 1996 },
  { quote: "Eu sou apenas uma garota, parada na frente de um garoto, pedindo para ele amá-la.", source: "Um Lugar Chamado Notting Hill", year: 1999 },
  { quote: "Você deveria ter sido minha.", source: "O Diário de Uma Paixão", year: 2004 },
  { quote: "Quando você percebe que quer passar o resto da vida com alguém, você quer que o resto da vida comece o mais rápido possível.", source: "Harry e Sally", year: 1989 },
  { quote: "Eu te amo 3000.", source: "Vingadores: Ultimato", year: 2019 },
  { quote: "Você me fez mais forte do que eu jamais pensei que poderia ser.", source: "A Culpa é das Estrelas", year: 2014 },
  { quote: "É assim que você se despede?", source: "Casablanca", year: 1942 },
  { quote: "Sempre teremos Paris.", source: "Casablanca", year: 1942 },
  { quote: "Eu voltaria para você.", source: "Orgulho e Preconceito", year: 2005 },
  { quote: "Eu te amo mais do que palavras podem dizer.", source: "Romeu e Julieta", year: 1996 },
  { quote: "Amor significa nunca ter que dizer que sente muito.", source: "Love Story", year: 1970 },
  { quote: "Você é meu para sempre.", source: "Crepúsculo", year: 2008 },
  { quote: "Onde você vai, eu vou.", source: "Sweet Home Alabama", year: 2002 },
  { quote: "Você é a razão pela qual eu acredito no amor.", source: "Me Chame Pelo Seu Nome", year: 2017 },
  { quote: "Cada história de amor é bonita, mas a nossa é minha favorita.", source: "P.S. Eu Te Amo", year: 2007 },

  // Ficção Científica (15 frases)
  { quote: "A Matrix está em toda parte.", source: "Matrix", year: 1999 },
  { quote: "Eu sei Kung Fu.", source: "Matrix", year: 1999 },
  { quote: "Viva longa e prosperamente.", source: "Star Trek", year: 1966 },
  { quote: "E.T. ligar casa.", source: "E.T. - O Extraterrestre", year: 1982 },
  { quote: "Para onde vamos, não precisamos de estradas.", source: "De Volta para o Futuro", year: 1985 },
  { quote: "Isto é pesado.", source: "De Volta para o Futuro", year: 1985 },
  { quote: "Eu sou seu pai.", source: "Star Wars: O Império Contra-Ataca", year: 1980 },
  { quote: "Não há colher.", source: "Matrix", year: 1999 },
  { quote: "Muuuurph!", source: "Interestelar", year: 2014 },
  { quote: "Não entre gentilmente naquela boa noite.", source: "Interestelar", year: 2014 },
  { quote: "O futuro não está escrito.", source: "O Exterminador do Futuro", year: 1984 },
  { quote: "Resistência é fútil.", source: "Star Trek", year: 1989 },
  { quote: "Eu sou o Alpha e o Ômega.", source: "Eu, Robô", year: 2004 },
  { quote: "Humanos são curiosas criaturas.", source: "Blade Runner", year: 1982 },
  { quote: "Eu vi coisas que vocês não acreditariam.", source: "Blade Runner", year: 1982 },

  // Animação e Infantil (15 frases)
  { quote: "Supercalifragilisticexpialidocious!", source: "Mary Poppins", year: 1964 },
  { quote: "Deixa pra lá.", source: "Frozen", year: 2013 },
  { quote: "Para sempre é um tempo muito longo.", source: "A Bela e a Fera", year: 1991 },
  { quote: "Você tem um amigo em mim.", source: "Toy Story", year: 1995 },
  { quote: "Aventura está lá fora!", source: "Up: Altas Aventuras", year: 2009 },
  { quote: "Ratatouille significa que qualquer um pode cozinhar.", source: "Ratatouille", year: 2007 },
  { quote: "Sou um ogro! O que você esperava? Flores e mel?", source: "Shrek", year: 2001 },
  { quote: "Todo mundo quer ser gato.", source: "Aristogatas", year: 1970 },
  { quote: "Eu acredito em você.", source: "Moana", year: 2016 },
  { quote: "A magia está em você.", source: "Encanto", year: 2021 },
  { quote: "Não falamos do Bruno.", source: "Encanto", year: 2021 },
  { quote: "Eu sou malvado.", source: "Meu Malvado Favorito", year: 2010 },
  { quote: "Bananas!", source: "Minions", year: 2015 },
  { quote: "Olhe para as estrelas.", source: "O Rei Leão", year: 1994 },
  { quote: "Lembre-se de quem você é.", source: "O Rei Leão", year: 1994 },

  // Épicos e Históricos (15 frases)
  { quote: "Esta é Esparta!", source: "300", year: 2006 },
  { quote: "Eu sou Maximus Decimus Meridius.", source: "Gladiador", year: 2000 },
  { quote: "Liberdade!", source: "Coração Valente", year: 1995 },
  { quote: "Meu precioso.", source: "O Senhor dos Anéis", year: 2001 },
  { quote: "Um anel para a todos governar.", source: "O Senhor dos Anéis", year: 2001 },
  { quote: "Você não passará!", source: "O Senhor dos Anéis", year: 2001 },
  { quote: "Coragem, querido coração.", source: "Crônicas de Nárnia", year: 2005 },
  { quote: "Não é quem eu sou por baixo, mas o que eu faço que me define.", source: "Batman Begins", year: 2005 },
  { quote: "O medo é o caminho para o lado sombrio.", source: "Star Wars", year: 1999 },
  { quote: "Você foi o escolhido!", source: "Star Wars III", year: 2005 },
  { quote: "Eu sou o perigo.", source: "Breaking Bad", year: 2008 },
  { quote: "Winter is coming.", source: "Game of Thrones", year: 2011 },
  { quote: "Fogo e sangue.", source: "Game of Thrones", year: 2011 },
  { quote: "A noite é escura e cheia de terrores.", source: "Game of Thrones", year: 2012 },
  { quote: "Não hoje.", source: "Game of Thrones", year: 2012 },

  // Filosofia e Motivacional (15 frases)
  { quote: "A vingança é um prato que se come frio.", source: "Kill Bill", year: 2003 },
  { quote: "Todos os dias acima do solo é um bom dia.", source: "Scarface", year: 1983 },
  { quote: "Sempre haverá pessoas que não acreditam em você. Use isso como combustível.", source: "Creed", year: 2015 },
  { quote: "Não importa quão escura a noite, a manhã sempre chega.", source: "Les Misérables", year: 2012 },
  { quote: "O primeiro passo é o mais difícil.", source: "O Fabuloso Destino de Amélie Poulain", year: 2001 },
  { quote: "Seja a mudança que você deseja ver no mundo.", source: "Gandhi", year: 1982 },
  { quote: "A vida não é medida pelo número de respirações que damos, mas pelos momentos que nos tiram o fôlego.", source: "Hitch", year: 2005 },
  { quote: "Não conte os dias, faça os dias contarem.", source: "Ali", year: 2001 },
  { quote: "O sucesso não é final, o fracasso não é fatal.", source: "Darkest Hour", year: 2017 },
  { quote: "Você nunca sabe o quão forte você é até ser forte seja a única opção.", source: "Unbroken", year: 2014 },
  { quote: "O impossível é apenas uma opinião.", source: "Rocky", year: 1976 },
  { quote: "Cada momento é um novo começo.", source: "Meia-Noite em Paris", year: 2011 },
  { quote: "A única pessoa que você deve tentar ser melhor é quem você era ontem.", source: "Good Will Hunting", year: 1997 },
  { quote: "Você é capaz de mais do que imagina.", source: "Soul", year: 2020 },
  { quote: "Nunca desista de algo que você não pode passar um dia sem pensar.", source: "The Pursuit of Happyness", year: 2006 },

  // Crime e Drama Policial (15 frases)
  { quote: "Diga olá para o meu amiguinho!", source: "Scarface", year: 1983 },
  { quote: "Eu bebo seu milkshake!", source: "Sangue Negro", year: 2007 },
  { quote: "O primeiro mandamento do Clube da Luta é: você não fala sobre o Clube da Luta.", source: "Clube da Luta", year: 1999 },
  { quote: "Deixe a arma. Pegue os cannoli.", source: "O Poderoso Chefão", year: 1972 },
  { quote: "Sou engraçado como, engraçado como um palhaço?", source: "Os Bons Companheiros", year: 1990 },
  { quote: "Eu sempre digo a verdade, mesmo quando minto.", source: "Scarface", year: 1983 },
  { quote: "Crime não compensa.", source: "O Poderoso Chefão", year: 1972 },
  { quote: "Você está fora do seu elemento.", source: "O Grande Lebowski", year: 1998 },
  { quote: "Respeito é tudo.", source: "O Irlandês", year: 2019 },
  { quote: "A família é tudo.", source: "Velozes e Furiosos", year: 2001 },
  { quote: "Eu sou a lei.", source: "Juiz Dredd", year: 1995 },
  { quote: "Você não sabe com quem está lidando.", source: "O Poderoso Chefão", year: 1972 },
  { quote: "Nada pessoal, são apenas negócios.", source: "O Poderoso Chefão", year: 1972 },
  { quote: "Eu faço o que precisa ser feito.", source: "John Wick", year: 2014 },
  { quote: "O mundo não é justo, então faça sua própria justiça.", source: "The Punisher", year: 2004 },

  // Comédia (10 frases)
  { quote: "Meu nome é Bond. James Bond.", source: "007", year: 1962 },
  { quote: "Ninguém coloca Baby num canto.", source: "Dirty Dancing", year: 1987 },
  { quote: "Eu me sinto precioso!", source: "Ace Ventura", year: 1994 },
  { quote: "Estou pronto! Estou pronto!", source: "Bob Esponja", year: 1999 },
  { quote: "Isso é tão legal!", source: "Escola de Rock", year: 2003 },
  { quote: "Às vezes você só precisa dançar.", source: "Footloose", year: 1984 },
  { quote: "Eu sou o cara mais sortudo do mundo.", source: "O Máscara", year: 1994 },
  { quote: "Tudo mundo já tem um momento de glória.", source: "Napoleon Dynamite", year: 2004 },
  { quote: "A vida vai encontrar um jeito.", source: "Jurassic Park", year: 1993 },
  { quote: "Vamos precisar de um barco maior.", source: "Tubarão", year: 1975 },

  // Fantasia e Magia (10 frases)
  { quote: "Você é um bruxo, Harry.", source: "Harry Potter", year: 2001 },
  { quote: "Depois de tudo esse tempo? Sempre.", source: "Harry Potter", year: 2011 },
  { quote: "Expecto Patronum!", source: "Harry Potter", year: 2004 },
  { quote: "Toda grande magia tem um preço.", source: "O Grande Truque", year: 2006 },
  { quote: "Não basta sobreviver. É preciso viver.", source: "Wall-E", year: 2008 },
  { quote: "A magia é real se você acreditar.", source: "Peter Pan", year: 1953 },
  { quote: "Segundo à direita e depois sempre em frente.", source: "Peter Pan", year: 1953 },
  { quote: "Bibbidi-bobbidi-boo!", source: "Cinderela", year: 1950 },
  { quote: "Um sonho é um desejo que seu coração faz.", source: "Cinderela", year: 1950 },
  { quote: "Fé, confiança e pó de pirlimpimpim.", source: "Peter Pan", year: 1953 },

  // Esportes e Superação (10 frases)
  { quote: "Adriaaaaan!", source: "Rocky", year: 1976 },
  { quote: "Não há choro no beisebol!", source: "O Time de sua Vida", year: 1992 },
  { quote: "Você nasceu para isso.", source: "Rocketman", year: 2019 },
  { quote: "Não é sobre quão forte você bate. É sobre quão forte você pode ser atingido e continuar avançando.", source: "Rocky Balboa", year: 2006 },
  { quote: "A vitória tem cem pais, mas a derrota é órfã.", source: "Carros de Fogo", year: 1981 },
  { quote: "Eu como relâmpago e cago trovão.", source: "Rocky III", year: 1982 },
  { quote: "Todo campeão já foi um desafiante que se recusou a desistir.", source: "Creed II", year: 2018 },
  { quote: "Dor é temporária, vitória é para sempre.", source: "Coach Carter", year: 2005 },
  { quote: "Você joga para ganhar o jogo.", source: "Any Given Sunday", year: 1999 },
  { quote: "É isso que fazemos. Nós lutamos.", source: "Warrior", year: 2011 },
];

// Export all categories
export const VARIABLE_CATEGORIES: VariableCategory[] = [
  {
    id: 'client',
    name: 'Dados do Cliente',
    icon: 'User',
    description: 'Informações pessoais e de acesso do cliente',
    variables: clientVariables,
  },
  {
    id: 'subscription',
    name: 'Assinatura',
    icon: 'CreditCard',
    description: 'Dados do plano e período de assinatura',
    variables: subscriptionVariables,
  },
  {
    id: 'payment',
    name: 'Pagamento',
    icon: 'Wallet',
    description: 'Informações de pagamento e transações',
    variables: paymentVariables,
  },
  {
    id: 'coupon',
    name: 'Cupons',
    icon: 'Ticket',
    description: 'Dados de cupons de desconto',
    variables: couponVariables,
  },
  {
    id: 'affiliate',
    name: 'Afiliados',
    icon: 'Users',
    description: 'Variáveis do programa de afiliados',
    variables: affiliateVariables,
  },
  {
    id: 'engagement',
    name: 'Engajamento',
    icon: 'Heart',
    description: 'Fidelidade, pontos e recompensas',
    variables: engagementVariables,
  },
  {
    id: 'system',
    name: 'Sistema',
    icon: 'Settings',
    description: 'Variáveis do sistema e empresa',
    variables: systemVariables,
  },
  {
    id: 'm3u',
    name: 'Conteúdo M3U',
    icon: 'Tv',
    description: 'Estatísticas de canais e conteúdo',
    variables: m3uContentVariables,
  },
  {
    id: 'userStats',
    name: 'Estatísticas do Usuário',
    icon: 'BarChart',
    description: 'Dados de visualização e uso do cliente',
    variables: userStatsVariables,
  },
  {
    id: 'custom',
    name: 'Personalizados',
    icon: 'Edit',
    description: 'Campos livres para personalização',
    variables: customVariables,
  },
];

// Helper to get all variables as flat array
export const getAllVariables = (): TemplateVariable[] => {
  return VARIABLE_CATEGORIES.flatMap(cat => cat.variables);
};

// Helper to get variable by key
export const getVariableByKey = (key: string): TemplateVariable | undefined => {
  return getAllVariables().find(v => v.key === key);
};

// Get quotes count
export const getQuotesCount = (): number => {
  return FAMOUS_QUOTES.length;
};

// Get random quote
export const getRandomQuote = (): { quote: string; source: string; year?: number } => {
  const index = Math.floor(Math.random() * FAMOUS_QUOTES.length);
  return FAMOUS_QUOTES[index];
};

// Search quotes by keyword
export const searchQuotes = (keyword: string): typeof FAMOUS_QUOTES => {
  const lower = keyword.toLowerCase();
  return FAMOUS_QUOTES.filter(
    q => q.quote.toLowerCase().includes(lower) || q.source.toLowerCase().includes(lower)
  );
};
