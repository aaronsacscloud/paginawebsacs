// DEMAND ENGINE · autenticación con Google.
//
// Firma el JWT a mano en vez de traer `googleapis` entero. Dos razones: el
// adaptador de Vercel empaqueta lo que se importa, y `googleapis` son varios
// megas para usar dos endpoints; y así el motor no depende de la versión de una
// librería que el resto del repo usa para otra cosa.
import crypto from 'node:crypto';

const env = (k: string) => String((import.meta as any).env?.[k] || process.env[k] || '').trim();

type Credencial = { client_email: string; private_key: string; project_id: string };

export function credencial(): Credencial | null {
  const b64 = env('GOOGLE_SERVICE_ACCOUNT_B64');
  if (!b64) return null;
  try { return JSON.parse(Buffer.from(b64, 'base64').toString('utf8')); } catch { return null; }
}

export const correoDeServicio = () => credencial()?.client_email || null;

/** Los tokens duran una hora; pedir uno por consulta sería una llamada extra
 *  por cada página de resultados. */
const cache = new Map<string, { token: string; hasta: number }>();

export async function token(scope: string): Promise<string> {
  const c = credencial();
  if (!c) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_B64');

  const guardado = cache.get(scope);
  if (guardado && guardado.hasta > Date.now() + 60_000) return guardado.token;

  const ahora = Math.floor(Date.now() / 1000);
  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const sinFirma = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: c.client_email, scope, aud: 'https://oauth2.googleapis.com/token', exp: ahora + 3600, iat: ahora,
  })}`;
  const firma = crypto.createSign('RSA-SHA256').update(sinFirma).sign(c.private_key, 'base64url');

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${sinFirma}.${firma}` }),
  });
  const j: any = await r.json();
  if (!j.access_token) throw new Error(`Google no dio token: ${JSON.stringify(j).slice(0, 200)}`);

  cache.set(scope, { token: j.access_token, hasta: Date.now() + (j.expires_in || 3600) * 1000 });
  return j.access_token;
}

export const SCOPE_GSC = 'https://www.googleapis.com/auth/webmasters.readonly';

/** Las propiedades a las que la cuenta de servicio tiene acceso hoy. Sirve para
 *  que la pantalla pueda decir «ya puedo» o «todavía me falta el permiso» sin
 *  que nadie tenga que adivinar en cuál de los dos pasos se quedó. */
export async function propiedadesGsc(): Promise<{ url: string; permiso: string }[]> {
  const t = await token(SCOPE_GSC);
  const r = await fetch('https://www.googleapis.com/webmasters/v3/sites', { headers: { Authorization: `Bearer ${t}` } });
  const j: any = await r.json();
  if (j.error) throw new Error(`Search Console: ${j.error.message}`);
  return (j.siteEntry || []).map((s: any) => ({ url: s.siteUrl, permiso: s.permissionLevel }));
}
