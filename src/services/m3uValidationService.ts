interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface ValidationResult {
  valid: boolean;
  totalChannels: number;
  validChannels: number;
  invalidChannels: number;
  estimatedTime: number;
  issues: ValidationIssue[];
  preview: {
    name: string;
    url: string;
    logo?: string;
  }[];
}

class M3UValidationService {
  /**
   * Valida conteúdo M3U antes de importar
   */
  async validateM3UContent(content: string): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const preview: any[] = [];
    let validChannels = 0;
    let invalidChannels = 0;

    try {
      // Parse básico do conteúdo M3U
      const lines = content.split('\n').filter(line => line.trim());
      
      if (!lines[0]?.includes('#EXTM3U')) {
        issues.push({
          type: 'error',
          message: 'Arquivo M3U inválido',
          details: 'Cabeçalho #EXTM3U não encontrado'
        });
        return this.createFailedResult(issues);
      }

      const channels: any[] = [];
      let currentChannel: any = null;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
          // Extrair informações do canal
          const nameMatch = line.match(/,(.+)$/);
          const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
          const tvgLogoMatch = line.match(/tvg-logo="([^"]+)"/);
          const groupMatch = line.match(/group-title="([^"]+)"/);

          currentChannel = {
            name: nameMatch ? nameMatch[1].trim() : 'Sem nome',
            tvg_id: tvgIdMatch ? tvgIdMatch[1] : '',
            tvg_logo: tvgLogoMatch ? tvgLogoMatch[1] : '',
            group_title: groupMatch ? groupMatch[1] : 'Outros'
          };
        } else if (line && !line.startsWith('#') && currentChannel) {
          currentChannel.url = line;
          channels.push(currentChannel);
          currentChannel = null;
        }
      }

      // Validar cada canal
      for (const channel of channels) {
        const isValid = this.validateChannel(channel, issues);
        if (isValid) {
          validChannels++;
        } else {
          invalidChannels++;
        }

        // Adicionar aos primeiros 10 canais para preview
        if (preview.length < 10) {
          preview.push({
            name: channel.name,
            url: channel.url,
            logo: channel.tvg_logo
          });
        }
      }

      // Verificações gerais
      if (channels.length === 0) {
        issues.push({
          type: 'error',
          message: 'Nenhum canal encontrado',
          details: 'O arquivo M3U não contém canais válidos'
        });
      }

      if (channels.length > 5000) {
        issues.push({
          type: 'warning',
          message: 'Arquivo muito grande',
          details: `${channels.length} canais detectados. Importação pode levar vários minutos.`
        });
      }

      // URLs duplicadas
      const urlCounts = new Map<string, number>();
      channels.forEach(ch => {
        const count = urlCounts.get(ch.url) || 0;
        urlCounts.set(ch.url, count + 1);
      });
      const duplicates = Array.from(urlCounts.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        issues.push({
          type: 'warning',
          message: 'URLs duplicadas detectadas',
          details: `${duplicates.length} URLs aparecem mais de uma vez`
        });
      }

      // Estimar tempo de importação
      const estimatedTime = Math.ceil(channels.length / 100); // ~100 canais por segundo

      return {
        valid: issues.filter(i => i.type === 'error').length === 0,
        totalChannels: channels.length,
        validChannels,
        invalidChannels,
        estimatedTime,
        issues,
        preview
      };
    } catch (error) {
      console.error('Validation error:', error);
      issues.push({
        type: 'error',
        message: 'Erro ao validar arquivo',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return this.createFailedResult(issues);
    }
  }

  /**
   * Valida um canal individual
   */
  private validateChannel(channel: any, issues: ValidationIssue[]): boolean {
    let valid = true;

    // Validar URL
    if (!channel.url || !this.isValidUrl(channel.url)) {
      issues.push({
        type: 'warning',
        message: `Canal "${channel.name}" possui URL inválida`,
        details: channel.url || 'URL vazia'
      });
      valid = false;
    }

    // Validar nome
    if (!channel.name || channel.name === 'Sem nome') {
      issues.push({
        type: 'info',
        message: 'Canal sem nome detectado',
        details: `URL: ${channel.url}`
      });
    }

    // Validar logo
    if (channel.tvg_logo && !this.isValidUrl(channel.tvg_logo)) {
      issues.push({
        type: 'info',
        message: `Logo inválida para canal "${channel.name}"`,
        details: channel.tvg_logo
      });
    }

    return valid;
  }

  /**
   * Valida se uma string é uma URL válida
   */
  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Cria resultado de falha
   */
  private createFailedResult(issues: ValidationIssue[]): ValidationResult {
    return {
      valid: false,
      totalChannels: 0,
      validChannels: 0,
      invalidChannels: 0,
      estimatedTime: 0,
      issues,
      preview: []
    };
  }

  /**
   * Valida URL M3U antes de baixar
   */
  async validateM3UUrl(url: string): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Validar formato da URL
    if (!this.isValidUrl(url)) {
      issues.push({
        type: 'error',
        message: 'URL inválida',
        details: 'O formato da URL não é válido'
      });
      return this.createFailedResult(issues);
    }

    // Verificar se é M3U
    if (!url.toLowerCase().endsWith('.m3u') && !url.toLowerCase().endsWith('.m3u8')) {
      issues.push({
        type: 'warning',
        message: 'URL não parece ser um arquivo M3U',
        details: 'Esperado extensão .m3u ou .m3u8'
      });
    }

    issues.push({
      type: 'info',
      message: 'URL válida',
      details: 'Pronta para download e processamento'
    });

    return {
      valid: true,
      totalChannels: 0,
      validChannels: 0,
      invalidChannels: 0,
      estimatedTime: 5,
      issues,
      preview: []
    };
  }
}

export const m3uValidationService = new M3UValidationService();
