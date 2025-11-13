/**
 * Valida número de telefone brasileiro com DDI
 * Formato esperado: 55 + DDD (2 dígitos) + Número (8 ou 9 dígitos)
 * Exemplos válidos: 5561996975924, 556132345678
 */
export function validateBrazilianPhone(phone: string): {
  isValid: boolean;
  error?: string;
  formatted?: string;
} {
  // Remove espaços, parênteses, hífens
  const cleaned = phone.replace(/[\s\(\)\-]/g, '');
  
  // Verifica se contém apenas números
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Número deve conter apenas dígitos',
    };
  }
  
  // Verifica DDI 55 (Brasil)
  if (!cleaned.startsWith('55')) {
    return {
      isValid: false,
      error: 'Número deve começar com DDI 55 (Brasil)',
    };
  }
  
  // Verifica comprimento total (13 dígitos para celular, 12 para fixo)
  if (cleaned.length !== 13 && cleaned.length !== 12) {
    return {
      isValid: false,
      error: `Número inválido. Use formato: 55 + DDD + Número (${cleaned.length}/13 dígitos)`,
    };
  }
  
  // Extrai DDD (posição 2-4)
  const ddd = cleaned.substring(2, 4);
  const dddNum = parseInt(ddd);
  
  // Lista de DDDs válidos no Brasil
  const validDDDs = [
    11, 12, 13, 14, 15, 16, 17, 18, 19, // SP
    21, 22, 24, // RJ
    27, 28, // ES
    31, 32, 33, 34, 35, 37, 38, // MG
    41, 42, 43, 44, 45, 46, // PR
    47, 48, 49, // SC
    51, 53, 54, 55, // RS
    61, // DF
    62, 64, // GO
    63, // TO
    65, 66, // MT
    67, // MS
    68, // AC
    69, // RO
    71, 73, 74, 75, 77, // BA
    79, // SE
    81, 87, // PE
    82, // AL
    83, // PB
    84, // RN
    85, 88, // CE
    86, 89, // PI
    91, 93, 94, // PA
    92, 97, // AM
    95, // RR
    96, // AP
    98, 99, // MA
  ];
  
  if (!validDDDs.includes(dddNum)) {
    return {
      isValid: false,
      error: `DDD ${ddd} inválido`,
    };
  }
  
  // Valida número após DDD
  const phoneNumber = cleaned.substring(4);
  
  // Celular: deve começar com 9 e ter 9 dígitos
  // Fixo: não começa com 9 e tem 8 dígitos
  if (phoneNumber.length === 9) {
    if (!phoneNumber.startsWith('9')) {
      return {
        isValid: false,
        error: 'Celular deve começar com 9',
      };
    }
  } else if (phoneNumber.length === 8) {
    if (phoneNumber.startsWith('9')) {
      return {
        isValid: false,
        error: 'Telefone fixo não deve começar com 9',
      };
    }
  }
  
  // Formata para exibição: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
  const formatted = phoneNumber.length === 9
    ? `+55 (${ddd}) ${phoneNumber.substring(0, 5)}-${phoneNumber.substring(5)}`
    : `+55 (${ddd}) ${phoneNumber.substring(0, 4)}-${phoneNumber.substring(4)}`;
  
  return {
    isValid: true,
    formatted,
  };
}

/**
 * Retorna apenas os dígitos do número (remove formatação)
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Formata número para exibição visual
 */
export function formatPhoneNumber(phone: string): string {
  const validation = validateBrazilianPhone(phone);
  return validation.formatted || phone;
}
