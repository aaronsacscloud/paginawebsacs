// Application-level encryption para tokens OAuth almacenados en
// calendar_connections (access_token, refresh_token).
//
// Por qué app-level y no DB-level (pgcrypto/pgsodium):
// - Si DB se compromete (dump, backup leak) pero la env del server no,
//   los tokens permanecen ilegibles. La key vive sólo en proceso Node.
// - No requiere extensión activa ni migración de columnas (text sigue siendo text).
// - Backwards compatible: si token NO tiene prefijo `enc:v1:`, asumimos
//   plaintext legacy y lo devolvemos tal cual (se re-encriptará en el
//   próximo refresh).
//
// Algoritmo: AES-256-GCM con IV aleatorio de 12 bytes + auth tag de 16 bytes.
// Output format: `enc:v1:<base64url(iv)>:<base64url(ciphertext+tag)>`.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const PREFIX = 'enc:v1:';

let cachedKey: Buffer | null = null;
let warnedMissing = false;

function getKey(): Buffer | null {
  if (cachedKey) return cachedKey;
  const raw = (import.meta.env.OAUTH_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    if (!warnedMissing) {
      // Una sola vez por proceso, para no spammear logs.
      console.warn('[oauth-tokens] OAUTH_TOKEN_ENCRYPTION_KEY no está definida — los tokens se guardarán en PLAINTEXT. Genera una con: openssl rand -base64 32');
      warnedMissing = true;
    }
    return null;
  }
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      console.warn('[oauth-tokens] OAUTH_TOKEN_ENCRYPTION_KEY debe ser 32 bytes (base64 de 32 bytes). Tokens se guardarán en plaintext.');
      return null;
    }
    cachedKey = buf;
    return buf;
  } catch {
    console.warn('[oauth-tokens] OAUTH_TOKEN_ENCRYPTION_KEY mal formada. Tokens se guardarán en plaintext.');
    return null;
  }
}

/**
 * Encripta un token OAuth. Si la key no está configurada, devuelve el
 * plaintext sin prefijo para no romper el flujo.
 */
export function encryptToken(plaintext: string | null | undefined): string {
  if (!plaintext) return '';
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${Buffer.concat([ct, tag]).toString('base64url')}`;
}

/**
 * Desencripta un token. Si el valor NO tiene el prefijo `enc:v1:`,
 * se asume plaintext legacy y se devuelve tal cual.
 */
export function decryptToken(stored: string | null | undefined): string {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const key = getKey();
  if (!key) {
    console.error('[oauth-tokens] Token encrypted pero no hay key disponible para desencriptar.');
    return '';
  }
  try {
    const [, , ivB64, ctB64] = stored.split(':');
    if (!ivB64 || !ctB64) return '';
    const iv = Buffer.from(ivB64, 'base64url');
    const combined = Buffer.from(ctB64, 'base64url');
    const tag = combined.subarray(combined.length - 16);
    const ct = combined.subarray(0, combined.length - 16);
    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch (err: any) {
    console.error('[oauth-tokens] decrypt falló:', err?.message || 'unknown');
    return '';
  }
}

/** Detección rápida sin desencriptar. */
export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && typeof value === 'string' && value.startsWith(PREFIX);
}
