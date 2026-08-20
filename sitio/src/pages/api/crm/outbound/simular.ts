// OUTBOUND · "Ver como": proxy founder-only hacia el simulador de sacs_api —
// la MISMA función decidir() de la entrega real, con la razón de cada filtro.
// GET ?account=<cuenta>&uid=<uid>
import type { APIRoute } from 'astro';

export const prerender = false;
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();
const json = (o: any, s = 200) => new Response(JSON.stringify(o), {
  status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

export const GET: APIRoute = async ({ url }) => {
  const account = String(url.searchParams.get('account') || '').trim().toLowerCase();
  const uid = String(url.searchParams.get('uid') || '').trim();
  if (!account || !uid) return json({ error: 'Faltan account y uid' }, 400);
  try {
    const r = await fetch(SACS_API + '/interno/crm/campanas-simular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ account, uid }),
    });
    if (!r.ok) return json({ error: 'sacs_api respondió ' + r.status }, 502);
    return json(await r.json());
  } catch { return json({ error: 'Sin conexión con sacs_api' }, 502); }
};
