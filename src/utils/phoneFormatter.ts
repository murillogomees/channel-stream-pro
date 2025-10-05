export function formatToBrazilianInternational(phone: string): string {
  // Remove tudo exceto números
  const cleaned = phone.replace(/\D/g, '');
  
  // Se já está em formato internacional, retorna
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return cleaned;
  }
  
  // Se tem 11 dígitos (DDD + 9 dígitos)
  if (cleaned.length === 11) {
    return `55${cleaned}`;
  }
  
  // Se tem 10 dígitos (DDD + 8 dígitos)
  if (cleaned.length === 10) {
    return `55${cleaned}`;
  }
  
  // Se tem 9 dígitos (sem DDD), assume DDD 61 (Brasília)
  if (cleaned.length === 9) {
    return `5561${cleaned}`;
  }
  
  // Se tem 8 dígitos (sem DDD), assume DDD 61 e adiciona 9 na frente
  if (cleaned.length === 8) {
    return `55619${cleaned}`;
  }
  
  // Retorna como está se não reconhecer o formato
  return cleaned;
}

export function isValidBrazilianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  
  // Valida se tem entre 10 e 13 dígitos
  if (cleaned.length < 10 || cleaned.length > 13) {
    return false;
  }
  
  // Se começa com 55, deve ter 12 ou 13 dígitos
  if (cleaned.startsWith('55')) {
    return cleaned.length === 12 || cleaned.length === 13;
  }
  
  // Caso contrário, deve ter 10 ou 11 dígitos
  return cleaned.length === 10 || cleaned.length === 11;
}

export function formatPhoneForDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  // Se está em formato internacional (5561999999999)
  if (cleaned.startsWith('55') && cleaned.length === 13) {
    const ddd = cleaned.substring(2, 4);
    const firstPart = cleaned.substring(4, 9);
    const secondPart = cleaned.substring(9);
    return `+55 (${ddd}) ${firstPart}-${secondPart}`;
  }
  
  if (cleaned.startsWith('55') && cleaned.length === 12) {
    const ddd = cleaned.substring(2, 4);
    const firstPart = cleaned.substring(4, 8);
    const secondPart = cleaned.substring(8);
    return `+55 (${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Se tem 11 dígitos (DDD + 9 dígitos)
  if (cleaned.length === 11) {
    const ddd = cleaned.substring(0, 2);
    const firstPart = cleaned.substring(2, 7);
    const secondPart = cleaned.substring(7);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  // Se tem 10 dígitos (DDD + 8 dígitos)
  if (cleaned.length === 10) {
    const ddd = cleaned.substring(0, 2);
    const firstPart = cleaned.substring(2, 6);
    const secondPart = cleaned.substring(6);
    return `(${ddd}) ${firstPart}-${secondPart}`;
  }
  
  return phone;
}
