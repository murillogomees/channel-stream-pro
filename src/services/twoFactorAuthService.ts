/**
 * Two Factor Authentication Service
 * Uses two_factor_auth table
 */

import { supabase } from "@/integrations/supabase/client";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

export interface TwoFactorSetup {
  secret: string;
  qrCodeDataURL: string;
  email: string;
}

class TwoFactorAuthService {
  private issuer = "IPTVLink";

  async generateSecret(): Promise<TwoFactorSetup | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return null;

      // Generate TOTP secret
      const totp = new OTPAuth.TOTP({
        issuer: this.issuer,
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromHex(this.generateRandomHex(20)),
      });

      const secret = totp.secret.base32;
      const otpAuthUrl = totp.toString();

      // Generate QR code
      const qrCodeDataURL = await QRCode.toDataURL(otpAuthUrl);

      // Store secret in database (not enabled yet)
      const { error } = await supabase
        .from("two_factor_auth")
        .upsert({
          user_id: user.id,
          secret: secret,
          is_enabled: false,
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error("[2FA] Failed to store secret:", error);
        return null;
      }

      return {
        secret,
        qrCodeDataURL,
        email: user.email,
      };
    } catch (error) {
      console.error("[2FA] Error generating secret:", error);
      return null;
    }
  }

  async verifyToken(
    token: string,
    enableAfterVerify: boolean = false
  ): Promise<{ valid: boolean; enabled: boolean } | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get stored secret
      const { data, error } = await supabase
        .from("two_factor_auth")
        .select("secret, is_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data?.secret) {
        console.error("[2FA] Failed to get secret:", error);
        return null;
      }

      // Verify token
      const totp = new OTPAuth.TOTP({
        issuer: this.issuer,
        label: user.email || "",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(data.secret),
      });

      const isValid = totp.validate({ token, window: 1 }) !== null;

      if (isValid && enableAfterVerify && !data.is_enabled) {
        // Enable 2FA
        const { error: updateError } = await supabase
          .from("two_factor_auth")
          .update({
            is_enabled: true,
            verified_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        if (updateError) {
          console.error("[2FA] Failed to enable:", updateError);
        }

        return { valid: true, enabled: true };
      }

      return { valid: isValid, enabled: data.is_enabled || false };
    } catch (error) {
      console.error("[2FA] Error verifying token:", error);
      return null;
    }
  }

  async disable2FA(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("two_factor_auth")
        .update({ is_enabled: false })
        .eq("user_id", userId);

      if (error) {
        console.error("[2FA] Failed to disable:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("[2FA] Error disabling:", error);
      return false;
    }
  }

  async is2FAEnabled(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("two_factor_auth")
        .select("is_enabled")
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !data) return false;
      return data.is_enabled || false;
    } catch (error) {
      console.error("[2FA] Error checking status:", error);
      return false;
    }
  }

  private generateRandomHex(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
  }
}

export const twoFactorAuthService = new TwoFactorAuthService();
