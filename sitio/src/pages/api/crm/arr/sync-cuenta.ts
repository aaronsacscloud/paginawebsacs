// POST /api/crm/arr/sync-cuenta {company_id} — sincroniza AHORA la actividad de
// la cuenta SACS de una empresa (on-demand, sin esperar el cron de 6h). Trae el
// historial real (última venta, ventas 30d, módulos, usuarios, sucursales) y
// recalcula el health score. Devuelve la actividad para dar contexto inmediato.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { healthScoreV2 } from '../../../../lib/crm/health';

export const prerender = false;
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = import.meta.env.CRM_SYNC_SECRET || 'sacs-crm-sync-2026';
function json(o: any, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const companyId = body?.company_id;
  if (!companyId) return json({ error: 'company_id requerido' }, 400);
  const { data: co } = await supabase.from('companies').select('id, nombre, sacs_account, uso_sacs').eq('id', companyId).maybeSingle();
  if (!co) return json({ error: 'empresa no encontrada' }, 404);
  const acct = String(co.sacs_account || '').trim().toLowerCase();
  if (!acct) return json({ error: 'La empresa no tiene cuenta SACS ligada.' }, 400);
  try {
    const res = await fetch(SACS_API + '/interno/crm/actividad', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ accounts: [acct] }),
    });
    if (!res.ok) return json({ error: 'La API de SACS respondió ' + res.status }, 502);
    const j = await res.json();
    const a = (j.data || {})[acct];
    if (!a) return json({ ok: true, sin_datos: true, cuenta: acct, mensaje: 'Cuenta ligada, pero SACS aún no devuelve actividad de ese subdominio.' });

    const dias = a.ultima_venta ? Math.max(0, Math.floor((Date.now() - new Date(a.ultima_venta + 'T12:00:00Z').getTime()) / 86400000)) : null;
    const { score, factors } = healthScoreV2(a, (co as any).uso_sacs);
    const { error: ue } = await supabase.from('companies').update({
      actividad: a, ultima_venta_at: a.ultima_venta || null, dias_sin_venta: dias,
      actividad_sync_at: new Date().toISOString(), health_score: score, health_factors: factors, health_computed_at: new Date().toISOString(),
    }).eq('id', companyId);
    if (ue) return json({ error: ue.message }, 500);
    return json({ ok: true, cuenta: acct, actividad: a, dias_sin_venta: dias, health_score: score });
  } catch (e: any) { return json({ error: e?.message || String(e) }, 500); }
};
