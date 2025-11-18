import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface StatusHistoryExport {
  id: string;
  service_name: string;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
  metadata?: any;
}

export function exportToCSV(history: StatusHistoryExport[], filename: string = 'historico-status') {
  // Cabeçalhos
  const headers = ['Data', 'Hora', 'Serviço', 'Status Anterior', 'Novo Status', 'Detalhes'];
  
  // Linhas de dados
  const rows = history.map(item => [
    format(new Date(item.changed_at), 'dd/MM/yyyy', { locale: ptBR }),
    format(new Date(item.changed_at), 'HH:mm:ss', { locale: ptBR }),
    item.service_name,
    item.previous_status || 'Inicial',
    item.new_status,
    item.metadata ? JSON.stringify(item.metadata) : ''
  ]);

  // Criar CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`;
  link.click();
}

export function exportToPDF(history: StatusHistoryExport[], filename: string = 'historico-status') {
  const doc = new jsPDF();
  
  // Título
  doc.setFontSize(16);
  doc.text('Histórico de Mudanças de Status', 14, 20);
  
  // Subtítulo com data de geração
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 28);
  
  // Tabela
  const tableData = history.map(item => [
    format(new Date(item.changed_at), 'dd/MM/yyyy\nHH:mm:ss', { locale: ptBR }),
    item.service_name,
    item.previous_status || 'Inicial',
    item.new_status,
    item.metadata ? JSON.stringify(item.metadata).substring(0, 30) + '...' : '-'
  ]);

  (doc as any).autoTable({
    head: [['Data/Hora', 'Serviço', 'Status Anterior', 'Novo Status', 'Detalhes']],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 35, left: 14, right: 14 },
  });

  // Rodapé
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Download
  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.pdf`);
}
