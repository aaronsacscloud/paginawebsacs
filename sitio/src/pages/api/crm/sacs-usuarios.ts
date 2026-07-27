// GET /api/crm/sacs-usuarios            → lista de cuentas SACS ligadas
// GET /api/crm/sacs-usuarios?account=x  → usuarios de esa cuenta (proxy a sacs_api)
// Bajo el middleware admin (founder-only). Reenvía a sacs_api con x-crm-sync-secret.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = (import.meta.env.CRM_SYNC_SECRET || '').trim();
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const account = (url.searchParams.get('account') || '').trim().toLowerCase();

  // Sin cuenta → catálogo de cuentas SACS ligadas (para el selector).
  if (!account) {
    const { data, error } = await supabase.from('companies')
      .select('nombre, sacs_account').not('sacs_account', 'is', null).is('archived_at', null).range(0, 9999);
    if (error) return json({ error: error.message }, 500);
    const vistos = new Set<string>();
    const cuentas = (data || [])
      .filter(c => c.sacs_account && !vistos.has(c.sacs_account) && vistos.add(c.sacs_account))
      .map(c => ({ sacs_account: c.sacs_account, nombre: c.nombre }))
      .sort((a, b) => a.sacs_account.localeCompare(b.sacs_account));
    return json({ cuentas });
  }

  // Con cuenta → proxy a sacs_api.
  try {
    const r = await fetch(SACS_API + '/interno/crm/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ account }),
    });
    if (!r.ok) return json({ error: `SACS respondió ${r.status}` }, 502);
    const j = await r.json();
    if (!j.ok) return json({ error: j.error || 'Error en SACS' }, 502);
    return json({ account, total: j.total, usuarios: j.data || [] });
  } catch (e: any) {
    return json({ error: 'No se pudo contactar a SACS: ' + (e?.message || e) }, 502);
  }
};
