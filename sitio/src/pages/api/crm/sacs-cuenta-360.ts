// GET /api/crm/sacs-cuenta-360?account=x — 360 de una cuenta SACS (usuarios,
// sucursales, últimas transacciones, promociones, uso profundo) para el detalle
// del cliente. Founder-only (middleware). Proxy a sacs_api /interno/crm/cuenta-360.
// Write-through: si la respuesta trae `uso`, lo persiste en companies.uso_sacs
// → cada apertura del drawer también refresca el caché que usan las señales.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

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
    if (j.uso) {
      // best-effort: no bloquea la respuesta si falla
      await supabase.from('companies')
        .update({ uso_sacs: j.uso, uso_sync_at: new Date().toISOString() })
        .eq('sacs_account', account).is('archived_at', null);
    }
    return json(j);
  } catch (e: any) {
    return json({ error: 'No se pudo contactar a SACS: ' + (e?.message || e) }, 502);
  }
};
