export interface M3UListExport {
  id: string;
  name: string;
  file_url: string;
  description?: string;
  plan_type?: string[];
  status: string;
  is_default?: boolean;
  created_at: string;
  updated_at: string;
}

export function exportToCSV(data: M3UListExport[], filename: string = 'listas-m3u.csv') {
  // Criar cabeçalhos CSV
  const headers = [
    'Nome',
    'URL',
    'Descrição',
    'Tipos de Plano',
    'Status',
    'Padrão',
    'Criado em',
    'Atualizado em'
  ];

  // Criar linhas CSV
  const rows = data.map(list => [
    escapeCSV(list.name),
    escapeCSV(list.file_url),
    escapeCSV(list.description || ''),
    escapeCSV((list.plan_type || []).join(', ')),
    list.status === 'active' ? 'Ativa' : 'Inativa',
    list.is_default ? 'Sim' : 'Não',
    formatDate(list.created_at),
    formatDate(list.updated_at)
  ]);

  // Combinar cabeçalhos e linhas
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Criar blob e fazer download
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(value: string): string {
  if (!value) return '';
  
  // Se o valor contém vírgula, aspas ou quebra de linha, envolve com aspas
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // Duplica aspas internas
    return `"${value.replace(/"/g, '""')}"`;
  }
  
  return value;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}
