// Tokens firmados de los links públicos de correo (baja, preferencias, encuesta).
//
// Un token viaja en el link de baja del footer y en el header RFC 8058, y más
// adelante en el Reply-To de cada envío. Forma:
//   base64url(payload JSON) + '.' + HMAC-SHA256(payload, EMAIL_TOKEN_SECRET)
//
// FAIL-CLOSED a propósito: sin secreto en el entorno, firmar() lanza y
// verificar() devuelve null. Un correo de marketing SIN link de baja válido no
// debe salir nunca — es preferible no enviar a enviar algo de lo que nadie se
// pueda dar de baja.
//
// Los tokens de baja NO expiran (x:0): alguien puede darse de baja desde un
// correo de hace un año, y ese clic tiene que funcionar.
import crypto from 'node:crypto';

export type Proposito = 'baja' | 'preferencias' | 'conversacion' | 'envio';

export interface Payload {
  /** tenant */   t: string;
  /** email */    m: string;
  /** send id */  s?: string | null;
  /** propósito */ p: Proposito;
  /** expira (epoch ms), 0 = nunca */ x: number;
}

function secreto(): string | null {
  const s = (import.meta.env.EMAIL_TOKEN_SECRET || '').trim();
  return s.length >= 32 ? s : null;
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s: string) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (payload: string, sec: string) =>
  b64url(crypto.createHmac('sha256', sec).update(payload).digest());

export function firmar(p: Omit<Payload, 'x'> & { x?: number }): string {
  const sec = secreto();
  if (!sec) throw new Error('Falta EMAIL_TOKEN_SECRET (≥32 caracteres) en el entorno.');
  const payload: Payload = { t: p.t, m: String(p.m).toLowerCase().trim(), s: p.s || null, p: p.p, x: p.x ?? 0 };
  const b = b64url(JSON.stringify(payload));
  return b + '.' + hmac(b, sec);
}

/** Devuelve el payload si la firma es válida y no expiró; null en cualquier otro caso. */
export function verificar(token: string, propositosOk?: Proposito[]): Payload | null {
  try {
    const sec = secreto();
    if (!sec) return null;
    const [b, firma] = String(token || '').split('.');
    if (!b || !firma) return null;
    // Comparación en tiempo constante: una comparación normal filtra el
    // secreto byte por byte ante un atacante paciente.
    const esperada = hmac(b, sec);
    if (firma.length !== esperada.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
    const p = JSON.parse(deB64url(b).toString('utf8')) as Payload;
    if (p.x && Date.now() > p.x) return null;
    if (propositosOk && !propositosOk.includes(p.p)) return null;
    return p;
  } catch { return null; }
}

/** ¿Está configurado el secreto? Para que el gate de la UI lo reporte. */
export const tokensListos = (): boolean => secreto() !== null;
