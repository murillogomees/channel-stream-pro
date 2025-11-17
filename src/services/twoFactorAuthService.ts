/**
 * SERVIÇO DE AUTENTICAÇÃO DE DOIS FATORES (2FA)
 * 
 * Gerencia configuração e verificação de TOTP
 */

import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode';

export const twoFactorAuthService = {
  /**
   * Gera um novo secret TOTP e retorna QR code
   */
  async generateSecret(): Promise<{ secret: string; qrCodeDataURL: string; email: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-totp-secret');

      if (error) {
        console.error('[2FA] Erro ao gerar secret:', error);
        return null;
      }

      const { secret, otpAuthURL, email } = data;

      // Gerar QR code
      const qrCodeDataURL = await QRCode.toDataURL(otpAuthURL);

      return { secret, qrCodeDataURL, email };
    } catch (error) {
      console.error('[2FA] Erro ao gerar secret:', error);
      return null;
    }
  },

  /**
   * Verifica um token TOTP
   */
  async verifyToken(token: string, enableAfterVerify: boolean = false): Promise<{ valid: boolean; enabled: boolean } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('verify-totp-token', {
        body: { token, enableAfterVerify }
      });

      if (error) {
        console.error('[2FA] Erro ao verificar token:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[2FA] Erro ao verificar token:', error);
      return null;
    }
  },

  /**
   * Desabilita 2FA para o usuário atual
   */
  async disable2FA(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          totp_enabled: false,
          totp_secret: null,
          totp_verified_at: null
        })
        .eq('id', userId);

      if (error) {
        console.error('[2FA] Erro ao desabilitar 2FA:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[2FA] Erro ao desabilitar 2FA:', error);
      return false;
    }
  },

  /**
   * Verifica se o usuário tem 2FA habilitado
   */
  async is2FAEnabled(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('totp_enabled')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return false;
      }

      return data.totp_enabled || false;
    } catch (error) {
      console.error('[2FA] Erro ao verificar status 2FA:', error);
      return false;
    }
  }
};
