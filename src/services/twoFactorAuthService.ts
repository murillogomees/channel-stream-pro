/**
 * SERVIÇO DE AUTENTICAÇÃO DE DOIS FATORES (2FA)
 * 
 * SECURITY HARDENED: Uses SECURITY DEFINER functions where available
 * TOTP secrets are stored in separate restricted table
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
   * Uses SECURITY DEFINER function via raw query
   */
  async disable2FA(userId: string): Promise<boolean> {
    try {
      // Use SECURITY DEFINER function - call via raw SQL since types may not be updated
      const { data, error } = await supabase
        .rpc('disable_user_2fa' as any, { p_user_id: userId });

      if (error) {
        console.error('[2FA] Erro ao desabilitar 2FA:', error);
        // Fallback to profiles table if function doesn't exist yet
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            totp_enabled: false,
            totp_secret: null,
            totp_verified_at: null
          })
          .eq('id', userId);
        
        if (updateError) {
          console.error('[2FA] Fallback error:', updateError);
          return false;
        }
        return true;
      }

      return data === true;
    } catch (error) {
      console.error('[2FA] Erro ao desabilitar 2FA:', error);
      return false;
    }
  },

  /**
   * Verifica se o usuário tem 2FA habilitado
   * Uses SECURITY DEFINER function via raw query
   */
  async is2FAEnabled(userId: string): Promise<boolean> {
    try {
      // Use SECURITY DEFINER function - call via raw SQL since types may not be updated
      const { data, error } = await supabase
        .rpc('check_user_2fa_enabled' as any, { p_user_id: userId });

      if (error) {
        console.error('[2FA] Erro ao verificar status 2FA via RPC:', error);
        // Fallback to profiles table if function doesn't exist yet
        const { data: profile, error: selectError } = await supabase
          .from('profiles')
          .select('totp_enabled')
          .eq('id', userId)
          .single();

        if (selectError || !profile) {
          return false;
        }

        return profile.totp_enabled || false;
      }

      return data === true;
    } catch (error) {
      console.error('[2FA] Erro ao verificar status 2FA:', error);
      return false;
    }
  }
};