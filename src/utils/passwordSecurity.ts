/**
 * UTILITÁRIO DE SEGURANÇA DE SENHAS
 * 
 * Funções para validação, geração de senhas fortes e
 * tratamento de erros de senhas comprometidas (HIBP)
 */

export interface PasswordStrength {
  isStrong: boolean;
  score: number;
  feedback: string[];
}

/**
 * Verifica se o erro é relacionado a senha comprometida (HIBP)
 */
export function isCompromisedPasswordError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';
  
  return (
    code === 'weak_password' ||
    code === 'auth/weak-password' ||
    code === 'auth/compromised_password' ||
    message.includes('compromised') ||
    message.includes('breached') ||
    message.includes('leaked') ||
    message.includes('weak password') ||
    message.includes('password found in')
  );
}

/**
 * Gera sugestões de senha forte
 */
export function generatePasswordSuggestions(): string[] {
  const adjectives = ['Secure', 'Strong', 'Safe', 'Protected', 'Guarded'];
  const nouns = ['Cloud', 'Shield', 'Vault', 'Lock', 'Guard'];
  const symbols = ['@', '#', '!', '$', '%'];
  
  const suggestions: string[] = [];
  
  for (let i = 0; i < 3; i++) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 9000) + 1000;
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    
    suggestions.push(`${adj}${noun}${num}${symbol}`);
  }
  
  return suggestions;
}

/**
 * Avalia força da senha
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;
  
  // Comprimento
  if (password.length >= 12) {
    score += 2;
  } else if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Use no mínimo 12 caracteres');
  }
  
  // Maiúsculas
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Adicione letras maiúsculas');
  }
  
  // Minúsculas
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Adicione letras minúsculas');
  }
  
  // Números
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Adicione números');
  }
  
  // Símbolos
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Adicione símbolos (@, #, !, etc.)');
  }
  
  // Sequências comuns
  const commonSequences = ['123', 'abc', 'qwerty', 'password', 'admin'];
  const lowerPassword = password.toLowerCase();
  
  for (const seq of commonSequences) {
    if (lowerPassword.includes(seq)) {
      score -= 2;
      feedback.push('Evite sequências comuns');
      break;
    }
  }
  
  return {
    isStrong: score >= 5,
    score: Math.max(0, Math.min(6, score)),
    feedback,
  };
}

/**
 * Retorna mensagem de erro amigável para senha comprometida
 */
export function getCompromisedPasswordMessage(): string {
  return 'Esta senha foi identificada em vazamentos de dados e não pode ser usada por questões de segurança. Por favor, escolha outra senha.';
}

/**
 * Retorna dicas de segurança para senhas
 */
export function getPasswordSecurityTips(): string[] {
  return [
    'Use no mínimo 12 caracteres',
    'Combine letras maiúsculas e minúsculas',
    'Inclua números e símbolos especiais',
    'Evite palavras comuns e sequências',
    'Não reutilize senhas de outros sites',
    'Considere usar um gerenciador de senhas',
  ];
}
