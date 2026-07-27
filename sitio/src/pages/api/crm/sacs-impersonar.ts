// POST /api/crm/sacs-impersonar  { account, uid }
// "Acceso administrado": pide a sacs_api un custom token de Firebase para entrar
// a SACS como ese usuario, y devuelve la URL de canje en app.sacscloud.com.
// Bajo el middleware admin (solo founder/cs). El token va en la URL de un solo uso.
import type { APIRoute } from 'astro';
import { getSessionFromRequest } from '../../../lib/auth/session';

export const prerender = false;

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();
const APP_URL = import.meta.env.SACS_APP_URL || 'https://app.sacscloud.com';
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({} as any));
  const account = String(body.account || '').trim().toLowerCase();
  const uid = String(body.uid || '').trim(); // opcional: sin uid entra como Super Admin
  if (!account) return json({ error: 'account requerido' }, 400);

  // Identidad del founder (para el claim del token). No bloquea si falta.
  let founder = 'crm';
  try { const u = await getSessionFromRequest(request); if (u?.email) founder = u.email; } catch { /* noop */ }

  try {
    const r = await fetch(SACS_API + '/interno/crm/impersonar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ account, uid, founder }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return json({ error: j.error || `SACS respondió ${r.status}` }, 502);

    const url = APP_URL + '/impersonar-crm.html?token=' + encodeURIComponent(j.token)
      + '&account=' + encodeURIComponent(j.account)
      + '&uid=' + encodeURIComponent(j.uid)
      + '&name=' + encodeURIComponent(j.name || '')
      + '&email=' + encodeURIComponent(j.email || '')
      + '&home=' + encodeURIComponent(j.home || '');
    return json({ url, name: j.name, account: j.account });
  } catch (e: any) {
    return json({ error: 'No se pudo contactar a SACS: ' + (e?.message || e) }, 502);
  }
};
