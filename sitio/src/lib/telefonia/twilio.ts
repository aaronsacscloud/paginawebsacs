// TELEFONÍA · Cliente mínimo de Twilio SIN el SDK de servidor (pesa ~10 MB):
// el AccessToken es un JWT HS256 que firmamos con crypto de Node, y el REST
// es fetch con Basic Auth. Envs en Vercel:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN            (Console → Account Info)
//   TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET        (los creo yo por API)
//   TWILIO_TWIML_APP_SID                             (la creo yo por API)
//   TWILIO_NUMERO                                    (+52… el número comprado)
import crypto from 'node:crypto';

const ENV: any = (import.meta as any).env || process.env;
export const ACCOUNT_SID = (ENV.TWILIO_ACCOUNT_SID || '').trim();
export const AUTH_TOKEN = (ENV.TWILIO_AUTH_TOKEN || '').trim();
export const API_KEY_SID = (ENV.TWILIO_API_KEY_SID || '').trim();
export const API_KEY_SECRET = (ENV.TWILIO_API_KEY_SECRET || '').trim();
export const TWIML_APP_SID = (ENV.TWILIO_TWIML_APP_SID || '').trim();
export const NUMERO = (ENV.TWILIO_NUMERO || '').trim();

export const telefoniaConfigurada = () =>
  !!(ACCOUNT_SID && AUTH_TOKEN && API_KEY_SID && API_KEY_SECRET && TWIML_APP_SID && NUMERO);
export const telefoniaFaltantes = () => [
  ['TWILIO_ACCOUNT_SID', ACCOUNT_SID], ['TWILIO_AUTH_TOKEN', AUTH_TOKEN],
  ['TWILIO_API_KEY_SID', API_KEY_SID], ['TWILIO_API_KEY_SECRET', API_KEY_SECRET],
  ['TWILIO_TWIML_APP_SID', TWIML_APP_SID], ['TWILIO_NUMERO', NUMERO],
].filter(([, v]) => !v).map(([k]) => k as string);

const b64url = (buf: Buffer) => buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

/** AccessToken de Voice para el navegador (JWT HS256, cty twilio-fpa;v=1). */
export function tokenVoz(identity: string, ttlSeg = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'HS256', cty: 'twilio-fpa;v=1' };
  const payload = {
    jti: `${API_KEY_SID}-${now}`, iss: API_KEY_SID, sub: ACCOUNT_SID,
    iat: now, exp: now + ttlSeg,
    grants: {
      identity,
      voice: { outgoing: { application_sid: TWIML_APP_SID }, incoming: { allow: true } },
    },
  };
  const base = `${b64url(Buffer.from(JSON.stringify(header)))}.${b64url(Buffer.from(JSON.stringify(payload)))}`;
  const firma = b64url(crypto.createHmac('sha256', API_KEY_SECRET).update(base).digest());
  return `${base}.${firma}`;
}

/** Firma X-Twilio-Signature: HMAC-SHA1(url + params ordenados, AUTH_TOKEN). */
export function firmaValida(url: string, params: Record<string, string>, firma: string | null): boolean {
  if (!firma) return false;
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join('');
  const esperada = crypto.createHmac('sha1', AUTH_TOKEN).update(Buffer.from(data, 'utf8')).digest('base64');
  try { return crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada)); } catch { return false; }
}

/** REST de Twilio (form-encoded, Basic Auth). */
export async function twilioRest(ruta: string, form?: Record<string, string>, metodo?: string) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}${ruta}`, {
    method: metodo || (form ? 'POST' : 'GET'),
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Twilio ${r.status}: ${j?.message || JSON.stringify(j).slice(0, 200)}`);
  return j;
}

/** Descarga una grabación (mp3) con Basic Auth. */
export async function descargarGrabacion(recordingUrl: string): Promise<ArrayBuffer> {
  const r = await fetch(`${recordingUrl}.mp3`, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64') },
  });
  if (!r.ok) throw new Error(`Grabación HTTP ${r.status}`);
  return r.arrayBuffer();
}

export const xml = (cuerpo: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${cuerpo}</Response>`, {
  headers: { 'Content-Type': 'text/xml' },
});
