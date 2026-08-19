// Lectura y escritura de Google Sheets con la cuenta de servicio.
//
// La credencial ya existía en el proyecto (save-lead.ts la usaba en línea para
// escribir su respaldo de leads). Se extrae aquí porque ahora hay un segundo
// consumidor —la hoja donde caen los leads de TikTok— y dos copias de la misma
// autenticación es la forma segura de que una se quede atrás cuando se rote la
// llave.
//
// La cuenta de servicio necesita que la hoja esté COMPARTIDA con su correo
// (el `client_email` del JSON). Sin eso Google responde 403 y el cron se ve
// "corriendo bien" sin traer una sola fila.
import { google } from 'googleapis';

/** Ámbito completo: se lee la hoja y se le escribe de vuelta el estado. */
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let cache: any = null;

function auth() {
  if (cache) return cache;
  const b64 = import.meta.env.GOOGLE_SERVICE_ACCOUNT_B64 || '';
  if (!b64) return null;
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  cache = new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
  return cache;
}

/** El correo de la cuenta de servicio, para poder decirle al usuario con quién compartir la hoja. */
export function correoDeServicio(): string | null {
  try {
    const b64 = import.meta.env.GOOGLE_SERVICE_ACCOUNT_B64 || '';
    if (!b64) return null;
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')).client_email || null;
  } catch { return null; }
}

const api = () => {
  const a = auth();
  return a ? google.sheets({ version: 'v4', auth: a }) : null;
};

/**
 * Lee un rango como matriz. Devuelve [] si no hay credencial o la hoja está
 * vacía; NUNCA lanza por una hoja sin filas (un cron no puede tronar porque
 * hoy no llegó ningún lead).
 */
export async function leerRango(spreadsheetId: string, rango: string): Promise<string[][]> {
  const s = api();
  if (!s) throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_B64 en el entorno.');
  const r = await s.spreadsheets.values.get({
    spreadsheetId, range: rango,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return (r.data.values || []).map(f => (f || []).map(c => (c == null ? '' : String(c))));
}

/** Nombre de la primera pestaña. Zapier suele llamarla "Hoja 1" o "Sheet1". */
export async function primeraPestana(spreadsheetId: string): Promise<string | null> {
  const s = api();
  if (!s) return null;
  const r = await s.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  return r.data.sheets?.[0]?.properties?.title || null;
}

/**
 * Escribe celdas sueltas de una columna (A1 por celda). Best-effort: si la
 * cuenta de servicio solo tiene permiso de LECTURA, se reporta y se sigue —
 * el anti-duplicado real es el índice único del CRM, no esta marca.
 */
export async function escribirCeldas(
  spreadsheetId: string,
  celdas: { rango: string; valor: string }[],
): Promise<{ ok: boolean; error?: string }> {
  const s = api();
  if (!s || !celdas.length) return { ok: false, error: 'sin credencial o sin celdas' };
  try {
    await s.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: celdas.map(c => ({ range: c.rango, values: [[c.valor]] })),
      },
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Índice de columna (0-based) → letra A1: 0→A, 26→AA. */
export function letraColumna(i: number): string {
  let n = i + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
