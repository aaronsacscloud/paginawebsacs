// Bridge de creación de cuenta SACS: la web (server-side) llama al webservice
// real de sacs_api (/v1/register, el mismo que usa SACSMobile) para PROVISIONAR
// la cuenta (Firebase + Mongo + colecciones). Antes la web solo creaba el cobro
// en Stripe y el CRM, y NUNCA la cuenta usable → el cliente no podía entrar.
//
// El secreto REGISTER_API_SECRET viaja en el header x-register-secret (server a
// server, NUNCA al navegador) y marca a la web como "caller confiable" para pasar
// la IP real del usuario (rate-limit correcto).

const SACS_API_BASE = (import.meta.env.SACS_API_BASE ||
  'https://sacs-api-819604817289.us-central1.run.app/v1').replace(/\/+$/, '');
const REGISTER_API_SECRET = (import.meta.env.REGISTER_API_SECRET || '').trim();
const FETCH_TIMEOUT_MS = 20000;

// Convierte el nombre del negocio en un subdominio válido (a-z, 3-30). El
// register exige /^[a-z]+$/, así que quitamos acentos, números y símbolos.
export function slugifyAccountId(nombre: string): string {
  const base = (nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acentos
    .toLowerCase()
    .replace(/[^a-z]/g, ''); // SOLO a-z (sin números/espacios)
  return base.slice(0, 30);
}

export function isValidAccountId(accountId: string): boolean {
  return /^[a-z]{3,30}$/.test(accountId || '');
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (REGISTER_API_SECRET) h['x-register-secret'] = REGISTER_API_SECRET;
  return h;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export interface RegisterInput {
  account_name: string;
  account_id: string;
  nombre: string;
  email: string;
  password: string;
  client_ip?: string;
  partner_uid?: string;
  plan?: string;
  source?: string;
  whatsapp?: string;
  giro?: string;
  sucursales?: string;
}

export interface RegisterResult {
  ok: boolean;
  status: number;
  data?: any;     // { account_id, user_uid, ... } en éxito
  error?: string; // mensaje legible
  code?: 'account_taken' | 'email_taken' | 'rate_limited' | 'invalid' | 'server';
}

// Provisiona la cuenta. NO lanza: devuelve { ok, status, data|error, code }.
export async function provisionAccount(input: RegisterInput): Promise<RegisterResult> {
  try {
    const r = await fetchWithTimeout(SACS_API_BASE + '/register', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(input),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.success) {
      return { ok: true, status: r.status, data: j.data };
    }
    // Mapear errores conocidos a códigos para que la UI reaccione bien.
    const msg = (j && (j.details || j.msg)) || 'No se pudo crear la cuenta.';
    let code: RegisterResult['code'] = 'server';
    if (r.status === 429) code = 'rate_limited';
    else if (/account_id|subdomin|ya existe|ya está registrad/i.test(msg)) code = 'account_taken';
    else if (/email.*(existe|registrad|already)/i.test(msg)) code = 'email_taken';
    else if (r.status === 400) code = 'invalid';
    return { ok: false, status: r.status, error: msg, code };
  } catch (e: any) {
    return { ok: false, status: 0, error: 'No se pudo conectar con el servidor de cuentas.', code: 'server' };
  }
}

// Pre-check de disponibilidad (subdominio y, como caller confiable, email).
export async function checkAvailability(
  accountId: string,
  email?: string,
): Promise<{ account_available?: boolean; account_format_ok?: boolean; email_available?: boolean }> {
  try {
    const qs = new URLSearchParams({ account_id: accountId });
    if (email) qs.set('email', email);
    const r = await fetchWithTimeout(SACS_API_BASE + '/register/check?' + qs.toString(), {
      method: 'GET',
      headers: authHeaders(),
    });
    const j = await r.json().catch(() => ({}));
    return {
      account_available: j.account_available,
      account_format_ok: j.account_format_ok,
      email_available: j.email_available,
    };
  } catch {
    return {};
  }
}

// Genera un account_id ÚNICO a partir del nombre, resolviendo colisiones con
// sufijos (boutiquemaria → boutiquemariamx → boutiquemariab…). Solo a-z.
export async function generateUniqueAccountId(nombre: string): Promise<string> {
  let base = slugifyAccountId(nombre);
  if (base.length < 3) base = (base + 'sacs').slice(0, 30);
  const sufijos = ['', 'mx', 'sacs', 'app', 'hq', 'co', 'pos', 'shop'];
  for (const suf of sufijos) {
    const cand = (base + suf).slice(0, 30);
    if (!isValidAccountId(cand)) continue;
    const av = await checkAvailability(cand);
    if (av.account_available) return cand;
  }
  // Último recurso: agrega letras pseudo-aleatorias derivadas (sin Date/random
  // para mantener determinismo si se reintenta — variamos por longitud).
  for (const ch of 'abcdefghijklmnopqrstuvwxyz'.split('')) {
    const cand = (base + ch).slice(0, 30);
    const av = await checkAvailability(cand);
    if (av.account_available) return cand;
  }
  return base; // que el register decida (devolverá account_taken si choca)
}

// ── Embajador: info de una cuenta sacs3 (existe + contacto del dueño) ──
// Server-to-server (x-register-secret). Lo usa el webhook de Stripe para
// (1) NO acreditar el 40% a cuentas inventadas y (2) notificar al referidor.
export interface AccountInfo { exists: boolean; nombre?: string; whatsapp?: string; email?: string; }

export async function getAccountInfo(account: string): Promise<AccountInfo> {
  try {
    const r = await fetchWithTimeout(
      SACS_API_BASE + '/gifts/account-info?account=' + encodeURIComponent(account),
      { method: 'GET', headers: authHeaders() },
    );
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.success || !j.data) return { exists: false };
    return j.data as AccountInfo;
  } catch {
    return { exists: false };
  }
}
