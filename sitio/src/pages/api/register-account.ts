// POST /api/register-account — PROVISIONA la cuenta SACS real (camino PRUEBA
// GRATIS, sin pago). La web llama server-side al webservice de sacs_api con el
// secreto + la IP real del usuario (rate-limit). Los caminos de PAGO y REGALO
// provisionan dentro de create-subscription (tras confirmar Stripe), reusando
// el mismo lib/register.
//
// Body: { nombre, empresa, email, password, account_id?, whatsapp?, giro?,
//         sucursales?, partner_uid? }
// → si no mandan account_id, se genera único desde `empresa`.

import type { APIRoute } from 'astro';
import {
  provisionAccount,
  generateUniqueAccountId,
  isValidAccountId,
  slugifyAccountId,
} from '../../lib/register';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const nombre = String(body.nombre || '').trim();
  const empresa = String(body.empresa || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  // ── Validaciones server-side (defensa: nunca confiar solo en el front) ──
  if (nombre.length < 2) return json({ error: 'Escribe tu nombre.' }, 400);
  if (empresa.length < 2) return json({ error: 'Escribe el nombre de tu negocio.' }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: 'Email no válido.' }, 400);
  if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);

  // account_id: el que mandan (validado) o uno generado único desde la empresa.
  let accountId = String(body.account_id || '').trim().toLowerCase();
  if (accountId) {
    if (!isValidAccountId(accountId)) {
      return json({ error: 'El subdominio debe tener 3-30 letras minúsculas (a-z), sin números ni espacios.', code: 'invalid_account' }, 400);
    }
  } else {
    accountId = await generateUniqueAccountId(empresa || slugifyAccountId(nombre));
  }

  // IP real del usuario para el rate-limit del backend.
  const clientIp =
    (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    clientAddress ||
    '';

  const result = await provisionAccount({
    account_name: empresa,
    account_id: accountId,
    nombre,
    email,
    password,
    client_ip: clientIp,
    whatsapp: String(body.whatsapp || '').trim() || undefined,
    giro: String(body.giro || '').trim() || undefined,
    sucursales: String(body.sucursales || '').trim() || undefined,
    partner_uid: String(body.partner_uid || '').trim() || undefined,
    plan: 'trial',
    source: 'web-prueba-gratis',
  });

  if (result.ok) {
    return json({
      success: true,
      account_id: result.data?.account_id || accountId,
      account_name: empresa,
      email,
      // El front hace auto-login con email+password y manda la verificación.
      login_url: `https://app.sacscloud.com`,
    });
  }

  // Errores legibles + código para que el form reaccione (rebobinar al paso).
  const status = result.code === 'rate_limited' ? 429 : result.status >= 400 && result.status < 500 ? 400 : 502;
  return json({ error: result.error, code: result.code, account_id: accountId }, status);
};
