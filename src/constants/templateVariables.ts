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
];

// === VARIÁVEIS DE CUPONS ===
const couponVariables: TemplateVariable[] = [
  { key: 'codigoCupom', label: 'Código do Cupom', description: 'Código do cupom de desconto', example: 'PROMO30' },
  { key: 'descontoCupom', label: 'Desconto do Cupom', description: 'Valor ou percentual do desconto', example: '30%' },
  { key: 'validadeCupom', label: 'Validade do Cupom', description: 'Data de expiração do cupom', example: '31/12/2024' },
  { key: 'cupomAtivo', label: 'Cupom Ativo', description: 'Se o cupom está ativo', example: 'Sim' },
  { key: 'usosRestantesCupom', label: 'Usos Restantes', description: 'Quantas vezes o cupom ainda pode ser usado', example: '10' },
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
];

// === VARIÁVEIS DE CONTEÚDO M3U ===
const m3uContentVariables: TemplateVariable[] = [
  { key: 'totalCanais', label: 'Total de Canais', description: 'Quantidade total de canais disponíveis', example: '1.500+' },
  { key: 'totalFilmes', label: 'Total de Filmes', description: 'Quantidade de filmes no catálogo', example: '50.000+' },
  { key: 'totalSeries', label: 'Total de Séries', description: 'Quantidade de séries disponíveis', example: '5.000+' },
  { key: 'categoriasDisponiveis', label: 'Categorias', description: 'Lista de categorias disponíveis', example: 'Esportes, Filmes, Séries...' },
  { key: 'ultimaAtualizacao', label: 'Última Atualização', description: 'Data da última atualização da lista', example: '07/12/2024' },
];

// === VARIÁVEIS DE ESTATÍSTICAS DO USUÁRIO ===
const userStatsVariables: TemplateVariable[] = [
  { key: 'tempoTotalAssistido', label: 'Tempo Total Assistido', description: 'Tempo total que o usuário assistiu', example: '45 horas' },
  { key: 'canalMaisAssistido', label: 'Canal Mais Assistido', description: 'Canal favorito do usuário', example: 'Globo HD' },
  { key: 'generoFavorito', label: 'Gênero Favorito', description: 'Gênero mais assistido', example: 'Ação' },
  { key: 'ultimoConteudo', label: 'Último Conteúdo', description: 'Último conteúdo assistido', example: 'Breaking Bad S05E16' },
  { key: 'quantidadeVisualizacoes', label: 'Total Visualizações', description: 'Total de visualizações', example: '342' },
];

// === VARIÁVEIS MANUAIS/PERSONALIZADAS ===
const customVariables: TemplateVariable[] = [
  { key: 'textoPersonalizado1', label: 'Texto Personalizado 1', description: 'Campo livre para texto customizado', example: 'Qualquer texto...' },
  { key: 'textoPersonalizado2', label: 'Texto Personalizado 2', description: 'Campo livre para texto customizado', example: 'Qualquer texto...' },
  { key: 'textoPersonalizado3', label: 'Texto Personalizado 3', description: 'Campo livre para texto customizado', example: 'Qualquer texto...' },
  { key: 'linkPersonalizado', label: 'Link Personalizado', description: 'URL customizada', example: 'https://seulink.com' },
  { key: 'numeroPersonalizado', label: 'Número Personalizado', description: 'Valor numérico customizado', example: '100' },
];

// === FRASES FAMOSAS DE FILMES E ATORES ===
export const FAMOUS_QUOTES: { quote: string; source: string; year?: number }[] = [
  // Clássicos Eternos
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
  
  // Ação e Aventura
  { quote: "Yippee-ki-yay, filho da mãe!", source: "Duro de Matar", year: 1988 },
  { quote: "Mantenha seus amigos por perto, mas seus inimigos mais perto ainda.", source: "O Poderoso Chefão II", year: 1974 },
  { quote: "Eu sou o Homem de Ferro.", source: "Homem de Ferro", year: 2008 },
  { quote: "Com grandes poderes vêm grandes responsabilidades.", source: "Homem-Aranha", year: 2002 },
  { quote: "Por que caímos? Para aprendermos a nos levantar.", source: "Batman Begins", year: 2005 },
  { quote: "Você não pode lidar com a verdade!", source: "Questão de Honra", year: 1992 },
  { quote: "Até a vista, baby.", source: "O Exterminador do Futuro 2", year: 1991 },
  { quote: "Eu sou inevitável.", source: "Vingadores: Ultimato", year: 2019 },
  { quote: "Eu posso fazer isso o dia todo.", source: "Capitão América", year: 2011 },
  { quote: "Wakanda para sempre!", source: "Pantera Negra", year: 2018 },
  
  // Drama e Inspiracional
  { quote: "A vida é como uma caixa de chocolates. Você nunca sabe o que vai encontrar.", source: "Forrest Gump", year: 1994 },
  { quote: "Carpe Diem. Aproveite o dia, rapazes. Tornem suas vidas extraordinárias.", source: "Sociedade dos Poetas Mortos", year: 1989 },
  { quote: "Esperança é uma coisa boa, talvez a melhor das coisas, e coisas boas nunca morrem.", source: "Um Sonho de Liberdade", year: 1994 },
  { quote: "Você é mais corajoso do que acredita, mais forte do que parece e mais inteligente do que pensa.", source: "Ursinho Pooh", year: 1977 },
  { quote: "Ao infinito e além!", source: "Toy Story", year: 1995 },
  { quote: "Apenas continue nadando.", source: "Procurando Nemo", year: 2003 },
  { quote: "Ohana significa família. Família significa que ninguém é deixado para trás.", source: "Lilo & Stitch", year: 2002 },
  { quote: "Não importa o que aconteça, o sol vai nascer amanhã.", source: "Annie", year: 1982 },
  { quote: "Todo mundo quer ser gato.", source: "Aristogatas", year: 1970 },
  { quote: "Hakuna Matata! Sem preocupações para o resto de seus dias.", source: "O Rei Leão", year: 1994 },
  
  // Suspense e Terror
  { quote: "Eu vejo pessoas mortas.", source: "O Sexto Sentido", year: 1999 },
  { quote: "Aqui está Johnny!", source: "O Iluminado", year: 1980 },
  { quote: "Querem brincar de um jogo?", source: "Jogos Mortais", year: 2004 },
  { quote: "Um, dois, o Freddy vem aí.", source: "A Hora do Pesadelo", year: 1984 },
  { quote: "Eu serei seu espelho.", source: "Espelhos do Medo", year: 2008 },
  
  // Comédia
  { quote: "Meu nome é Bond. James Bond.", source: "007", year: 1962 },
  { quote: "Você é tão burro que dói.", source: "Débi & Lóide", year: 1994 },
  { quote: "Eu me sinto precioso!", source: "Ace Ventura", year: 1994 },
  { quote: "Toga! Toga!", source: "Se Meu Fusca Falasse", year: 1968 },
  { quote: "Ninguém coloca Baby num canto.", source: "Dirty Dancing", year: 1987 },
  
  // Romance
  { quote: "Você me completa.", source: "Jerry Maguire", year: 1996 },
  { quote: "Eu sou apenas uma garota, parada na frente de um garoto, pedindo para ele amá-la.", source: "Um Lugar Chamado Notting Hill", year: 1999 },
  { quote: "Você deveria ter sido minha.", source: "O Diário de Uma Paixão", year: 2004 },
  { quote: "Quando você percebe que quer passar o resto da vida com alguém, você quer que o resto da vida comece o mais rápido possível.", source: "Harry e Sally", year: 1989 },
  { quote: "Eu te amo 3000.", source: "Vingadores: Ultimato", year: 2019 },
  
  // Ficção Científica
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
  
  // Animação e Infantil
  { quote: "Supercalifragilisticexpialidocious!", source: "Mary Poppins", year: 1964 },
  { quote: "Deixa pra lá.", source: "Frozen", year: 2013 },
  { quote: "Para sempre é um tempo muito longo.", source: "A Bela e a Fera", year: 1991 },
  { quote: "Você tem um amigo em mim.", source: "Toy Story", year: 1995 },
  { quote: "Aloha significa família.", source: "Lilo & Stitch", year: 2002 },
  { quote: "Eu sou Groot.", source: "Guardiões da Galáxia", year: 2014 },
  { quote: "Aventura está lá fora!", source: "Up: Altas Aventuras", year: 2009 },
  { quote: "Ratatouille significa que qualquer um pode cozinhar.", source: "Ratatouille", year: 2007 },
  { quote: "Eu sou a noite.", source: "Batman", year: 1989 },
  { quote: "Sou um ogro! O que você esperava? Flores e mel?", source: "Shrek", year: 2001 },
  
  // Épicos e Históricos
  { quote: "Esta é Esparta!", source: "300", year: 2006 },
  { quote: "Eu sou Maximus Decimus Meridius.", source: "Gladiador", year: 2000 },
  { quote: "Liberdade!", source: "Coração Valente", year: 1995 },
  { quote: "Meu precioso.", source: "O Senhor dos Anéis", year: 2001 },
  { quote: "Um anel para a todos governar.", source: "O Senhor dos Anéis", year: 2001 },
  { quote: "Você não passará!", source: "O Senhor dos Anéis", year: 2001 },
  { quote: "Depois de tudo isso, por que eu te seguiria até mais uma batalha?", source: "O Hobbit", year: 2012 },
  { quote: "Coragem, querido coração.", source: "Crônicas de Nárnia", year: 2005 },
  
  // Filosofia e Reflexão
  { quote: "Não é quem eu sou por baixo, mas o que eu faço que me define.", source: "Batman Begins", year: 2005 },
  { quote: "O medo é o caminho para o lado sombrio.", source: "Star Wars", year: 1999 },
  { quote: "A vingança é um prato que se come frio.", source: "Kill Bill", year: 2003 },
  { quote: "Todos os dias acima do solo é um bom dia.", source: "Scarface", year: 1983 },
  { quote: "Ontem é história, amanhã é um mistério, mas hoje é um presente.", source: "Kung Fu Panda", year: 2008 },
  { quote: "Sempre haverá pessoas que não acreditam em você. Use isso como combustível.", source: "Creed", year: 2015 },
  { quote: "Não importa quão escura a noite, a manhã sempre chega.", source: "Les Misérables", year: 2012 },
  
  // Crime e Drama Policial
  { quote: "Diga olá para o meu amiguinho!", source: "Scarface", year: 1983 },
  { quote: "Você me dá febre de terça-feira.", source: "Pulp Fiction", year: 1994 },
  { quote: "Eu bebo seu milkshake!", source: "Sangue Negro", year: 2007 },
  { quote: "O primeiro mandamento do Clube da Luta é: você não fala sobre o Clube da Luta.", source: "Clube da Luta", year: 1999 },
  { quote: "Deixe a arma. Pegue os cannoli.", source: "O Poderoso Chefão", year: 1972 },
  { quote: "Sou engraçado como, engraçado como um palhaço?", source: "Os Bons Companheiros", year: 1990 },
  
  // Motivacional e Esportes
  { quote: "Adriaaaaan!", source: "Rocky", year: 1976 },
  { quote: "Não há choro no beisebol!", source: "O Time de sua Vida", year: 1992 },
  { quote: "Você nasceu para isso.", source: "Rocketman", year: 2019 },
  { quote: "A vitória tem cem pais, mas a derrota é órfã.", source: "O Poderoso Chefão II", year: 1974 },
  { quote: "Não é sobre quão forte você bate. É sobre quão forte você pode ser atingido e continuar avançando.", source: "Rocky Balboa", year: 2006 },
  
  // Fantasia e Magia
  { quote: "Você é um bruxo, Harry.", source: "Harry Potter", year: 2001 },
  { quote: "Depois de tudo esse tempo? Sempre.", source: "Harry Potter", year: 2011 },
  { quote: "Expecto Patronum!", source: "Harry Potter", year: 2004 },
  { quote: "Eu solto você. Minha preciosa.", source: "O Senhor dos Anéis", year: 2003 },
  { quote: "Toda grande magia tem um preço.", source: "O Grande Truque", year: 2006 },
  { quote: "Não basta sobreviver. É preciso viver.", source: "Wall-E", year: 2008 },
  
  // Mais Clássicos
  { quote: "A vida encontra um jeito.", source: "Jurassic Park", year: 1993 },
  { quote: "Eu sou o capitão agora.", source: "Capitão Phillips", year: 2013 },
  { quote: "Eu sempre dependi da bondade de estranhos.", source: "Um Bonde Chamado Desejo", year: 1951 },
  { quote: "Rosebud.", source: "Cidadão Kane", year: 1941 },
  { quote: "Mãe!", source: "Psicose", year: 1960 },
  { quote: "Faça meu dia.", source: "Dirty Harry", year: 1983 },
  { quote: "A primeira regra é: não fale.", source: "Clube da Luta", year: 1999 },
  { quote: "Eu poderia ter sido um contendor.", source: "Sindicato de Ladrões", year: 1954 },
  { quote: "Vamos precisar de um barco maior.", source: "Tubarão", year: 1975 },
  { quote: "Esta cidade precisa de um herói melhor.", source: "Batman: O Cavaleiro das Trevas", year: 2008 },
  
  // Frases de Atores Famosos (fora de filmes)
  { quote: "Eu não falho. Eu descubro 10.000 maneiras que não funcionam.", source: "Thomas Edison (citado em filmes)" },
  { quote: "Seja a mudança que você deseja ver no mundo.", source: "Gandhi (citado em filmes)" },
  { quote: "A maior glória não é nunca cair, mas se levantar sempre que caímos.", source: "Confúcio (citado em filmes)" },
  { quote: "A vida não é medida pelo número de respirações que damos, mas pelos momentos que nos tiram o fôlego.", source: "Hitch - Conselheiro Amoroso", year: 2005 },
  { quote: "Não conte os dias, faça os dias contarem.", source: "Muhammad Ali (citado em filmes)" },
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
