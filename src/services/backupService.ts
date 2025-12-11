import { supabase } from '@/lib/supabase';

export interface BackupMetadata {
  backup_date: string;
  backup_version: string;
  total_active: number;
  total_inactive: number;
  by_situation: {
    testando: number;
    ativo: number;
    devendo: number;
    inativo: number;
    lead: number;
  };
}

export interface BackupData {
  timestamp: string;
  total_clientes: number;
  clientes: any[];
  metadata: BackupMetadata;
}

export const backupService = {
  async createBackup(): Promise<BackupData> {
    const { data, error } = await supabase.functions.invoke('backup-clients', {
      method: 'POST',
    });

    if (error) throw error;
    return data.backup;
  },

  async downloadBackupJSON(backup: BackupData, filename?: string) {
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `backup_clientes_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  async downloadBackupCSV(backup: BackupData, filename?: string) {
    const headers = [
      'ID',
      'Nome',
      'Telefone',
      'Email',
      'Situação',
      'Plano',
      'Data Cadastro',
      'Data Vencimento',
      'Cliente Ativo',
      'Origem Cadastro',
      'M3U Lists',
    ];

    const rows = backup.clientes.map(cliente => [
      cliente.id,
      cliente.nome,
      cliente.telefone,
      cliente.email || '',
      cliente.situacao,
      cliente.plano,
      cliente.data_cadastro,
      cliente.data_vencimento || '',
      cliente.cliente_ativo ? 'Sim' : 'Não',
      cliente.origem_cadastro || '',
      cliente.m3u_lists?.map((m: any) => m.name).join('; ') || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => 
          typeof cell === 'string' && cell.includes(',') 
            ? `"${cell}"` 
            : cell
        ).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `backup_clientes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  async scheduleAutomaticBackup(intervalHours: number = 24) {
    // Esta função pode ser expandida para configurar backups automáticos
    // Por enquanto, apenas retorna a configuração
    return {
      enabled: true,
      interval_hours: intervalHours,
      next_backup: new Date(Date.now() + intervalHours * 60 * 60 * 1000).toISOString(),
    };
  },
};
