// GET /api/crm/sacs-cuenta-360?account=x — 360 de una cuenta SACS (usuarios,
// sucursales, últimas transacciones, promociones) para el detalle del cliente.
// Founder-only (middleware). Proxy a sacs_api /interno/crm/cuenta-360.
import type { APIRoute } from 'astro';

export const prerender = false;
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = import.meta.env.CRM_SYNC_SECRET || 'sacs-crm-sync-2026';
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const account = (url.searchParams.get('account') || '').trim().toLowerCase();
  if (!account) return json({ error: 'account requerido' }, 400);
  try {
    const r = await fetch(SACS_API + '/interno/crm/cuenta-360', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ account }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) return json({ error: j.error || `SACS respondió ${r.status}` }, 502);
    return json(j);
  } catch (e: any) {
    return json({ error: 'No se pudo contactar a SACS: ' + (e?.message || e) }, 502);
  }
};
