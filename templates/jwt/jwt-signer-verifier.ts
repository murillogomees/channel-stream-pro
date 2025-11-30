/**
 * JWT Signer/Verifier Template
 * 
 * Supports both HMAC (HS256) and RSA (RS256) algorithms
 * 
 * Usage:
 * - Node.js: import and use directly
 * - Edge Functions: Works with Web Crypto API
 */

// Types
interface JWTHeader {
  alg: 'HS256' | 'RS256';
  typ: 'JWT';
}

interface JWTPayload {
  sub: string;          // Subject (user ID)
  exp?: number;         // Expiration time
  iat?: number;         // Issued at
  nbf?: number;         // Not before
  iss?: string;         // Issuer
  aud?: string;         // Audience
  jti?: string;         // JWT ID
  [key: string]: unknown;
}

interface SignOptions {
  expiresIn?: number;   // Seconds until expiration
  issuer?: string;
  audience?: string;
  jwtId?: string;
}

// Base64URL encoding/decoding
function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data;
  
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================
// HMAC (HS256) Implementation
// ============================================

export class HMACJWTSigner {
  private secret: string;

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error('Secret must be at least 32 characters');
    }
    this.secret = secret;
  }

  async sign(payload: JWTPayload, options: SignOptions = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    // Build complete payload
    const completePayload: JWTPayload = {
      ...payload,
      iat: now,
    };

    if (options.expiresIn) {
      completePayload.exp = now + options.expiresIn;
    }
    if (options.issuer) {
      completePayload.iss = options.issuer;
    }
    if (options.audience) {
      completePayload.aud = options.audience;
    }
    if (options.jwtId) {
      completePayload.jti = options.jwtId;
    }

    // Create header
    const header: JWTHeader = { alg: 'HS256', typ: 'JWT' };

    // Encode header and payload
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(completePayload));
    const message = `${headerB64}.${payloadB64}`;

    // Sign with HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(message)
    );

    const signatureB64 = base64UrlEncode(new Uint8Array(signature));

    return `${message}.${signatureB64}`;
  }

  async verify(token: string): Promise<JWTPayload | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signatureB64] = parts;

      // Verify signature
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(this.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const message = `${headerB64}.${payloadB64}`;
      const signature = base64UrlDecode(signatureB64);

      const valid = await crypto.subtle.verify(
        'HMAC',
        key,
        signature,
        new TextEncoder().encode(message)
      );

      if (!valid) return null;

      // Decode and validate payload
      const payload = JSON.parse(
        new TextDecoder().decode(base64UrlDecode(payloadB64))
      ) as JWTPayload;

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      // Check not before
      if (payload.nbf && payload.nbf > Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}

// ============================================
// RSA (RS256) Implementation
// ============================================

export class RSAJWTSigner {
  private privateKey: CryptoKey | null = null;
  private publicKey: CryptoKey | null = null;

  async importPrivateKey(pemKey: string): Promise<void> {
    const pemContents = pemKey
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s/g, '');

    const binaryKey = base64UrlDecode(pemContents);

    this.privateKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
  }

  async importPublicKey(pemKey: string): Promise<void> {
    const pemContents = pemKey
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '');

    const binaryKey = base64UrlDecode(pemContents);

    this.publicKey = await crypto.subtle.importKey(
      'spki',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
  }

  async sign(payload: JWTPayload, options: SignOptions = {}): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not imported');
    }

    const now = Math.floor(Date.now() / 1000);

    const completePayload: JWTPayload = {
      ...payload,
      iat: now,
    };

    if (options.expiresIn) {
      completePayload.exp = now + options.expiresIn;
    }
    if (options.issuer) {
      completePayload.iss = options.issuer;
    }
    if (options.audience) {
      completePayload.aud = options.audience;
    }

    const header: JWTHeader = { alg: 'RS256', typ: 'JWT' };

    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(completePayload));
    const message = `${headerB64}.${payloadB64}`;

    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      this.privateKey,
      new TextEncoder().encode(message)
    );

    const signatureB64 = base64UrlEncode(new Uint8Array(signature));

    return `${message}.${signatureB64}`;
  }

  async verify(token: string): Promise<JWTPayload | null> {
    if (!this.publicKey) {
      throw new Error('Public key not imported');
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [headerB64, payloadB64, signatureB64] = parts;

      const message = `${headerB64}.${payloadB64}`;
      const signature = base64UrlDecode(signatureB64);

      const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        this.publicKey,
        signature,
        new TextEncoder().encode(message)
      );

      if (!valid) return null;

      const payload = JSON.parse(
        new TextDecoder().decode(base64UrlDecode(payloadB64))
      ) as JWTPayload;

      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }
}

// ============================================
// Usage Examples
// ============================================

/*
// HMAC Example
const hmacSigner = new HMACJWTSigner('your-secret-key-at-least-32-chars!');

// Sign
const token = await hmacSigner.sign(
  { sub: 'user-123', role: 'admin' },
  { expiresIn: 3600, issuer: 'iptvlink' }
);

// Verify
const payload = await hmacSigner.verify(token);
if (payload) {
  console.log('Valid token:', payload);
}

// RSA Example
const rsaSigner = new RSAJWTSigner();
await rsaSigner.importPrivateKey(privateKeyPem);
await rsaSigner.importPublicKey(publicKeyPem);

const rsaToken = await rsaSigner.sign({ sub: 'user-456' });
const rsaPayload = await rsaSigner.verify(rsaToken);
*/

// Stream Token Generator (for CDN access)
export async function generateStreamToken(
  signer: HMACJWTSigner | RSAJWTSigner,
  userId: string,
  channelId: string,
  options: {
    expiresIn?: number;
    ipRestriction?: string;
    maxUses?: number;
  } = {}
): Promise<string> {
  return signer.sign(
    {
      sub: userId,
      channel_id: channelId,
      r2_key: `channels/${channelId}/.*`,
      ip: options.ipRestriction,
      max_uses: options.maxUses,
      jti: crypto.randomUUID(),
    },
    {
      expiresIn: options.expiresIn || 3600,
      issuer: 'iptvlink',
      audience: 'stream',
    }
  );
}

export default { HMACJWTSigner, RSAJWTSigner, generateStreamToken };
