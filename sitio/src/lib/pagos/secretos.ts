// Cifrado en reposo de credenciales de pasarela (AES-256-GCM).
//
// Mismo formato de cable que helpers/secrets.js de sacs_api —`enc-v1:iv:tag:texto`—
// a propósito: si algún día hay que mover credenciales entre los dos sistemas, o
// auditar, no queremos dos esquemas distintos que descifrar.
//
// El prefijo permite migrar de texto plano a cifrado sin romper nada y versionar
// una rotación futura sin adivinar qué formato tiene cada fila.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const PREFIJO = 'enc-v1:';

function llave(): Buffer {
  const raw = (import.meta.env.SECRETS_ENCRYPTION_KEY || process.env.SECRETS_ENCRYPTION_KEY || '').trim();
  if (!raw) throw new Error('Falta SECRETS_ENCRYPTION_KEY (32 bytes en 64 caracteres hex).');
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  if (raw.length === 32) return Buffer.from(raw, 'utf8');
  throw new Error('SECRETS_ENCRYPTION_KEY debe ser 64 caracteres hex (32 bytes) o 32 caracteres ASCII.');
}

export const estaCifrado = (v: unknown): boolean => typeof v === 'string' && v.startsWith(PREFIJO);

export function cifrar(texto: string): string {
  if (!texto) throw new Error('cifrar() necesita un valor.');
  const iv = randomBytes(IV_LEN);
  const c = createCipheriv(ALGO, llave(), iv);
  const enc = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return PREFIJO + iv.toString('hex') + ':' + c.getAuthTag().toString('hex') + ':' + enc.toString('hex');
}

export function descifrar(valor?: string | null): string | null {
  if (!valor) return null;
  // Tolerante con texto plano: permite migrar filas viejas sin un paso previo.
  if (!estaCifrado(valor)) return valor;
  try {
    const [, ivHex, tagHex, datoHex] = valor.split(':');
    const d = createDecipheriv(ALGO, llave(), Buffer.from(ivHex, 'hex'));
    d.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([d.update(Buffer.from(datoHex, 'hex')), d.final()]).toString('utf8');
  } catch { return null; }
}

/** Para enseñar en pantalla sin revelar: APP_USR-1234…9f2c */
export const enmascarar = (t?: string | null): string =>
  !t ? '—' : t.length <= 14 ? '••••' : t.slice(0, 8) + '…' + t.slice(-4);
