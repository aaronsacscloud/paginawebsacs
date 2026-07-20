// GET /api/cron/sync-sacs-activity?key=sacs-cron-2026 — liga el CRM con la
// realidad: para cada company con sacs_account, pide a sacs_api la actividad
// real de la cuenta (última venta, ventas 7/30d, módulos usados, usuarios) y
// la guarda en companies. Corre por Vercel cron cada 6 horas.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const CRON_KEY = 'sacs-cron-2026';
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = import.meta.env.CRM_SYNC_SECRET || 'sacs-crm-sync-2026';

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== CRON_KEY) return new Response('Forbidden', { status: 403 });

  const { data: companies, error } = await supabase.from('companies')
    .select('id, sacs_account').not('sacs_account', 'is', null).is('archived_at', null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const cuentas = Array.from(new Set((companies || []).map(c => String(c.sacs_account).trim().toLowerCase()).filter(Boolean)));
  if (!cuentas.length) return new Response(JSON.stringify({ ok: true, cuentas: 0 }), { status: 200 });

  const out = { cuentas: cuentas.length, actualizadas: 0, sin_datos: 0, errores: [] as string[] };
  const hoy = new Date();

  // lotes de 25 para no saturar sacs_api
  for (let i = 0; i < cuentas.length; i += 25) {
    const lote = cuentas.slice(i, i + 25);
    try {
      const res = await fetch(SACS_API + '/interno/crm/actividad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-crm-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ accounts: lote }),
      });
      if (!res.ok) { out.errores.push('lote ' + i + ': HTTP ' + res.status); continue; }
      const j = await res.json();
      const porCuenta: Record<string, any> = j.data || {};
      for (const co of (companies || [])) {
        const acct = String(co.sacs_account || '').trim().toLowerCase();
        if (!lote.includes(acct)) continue;
        const a = porCuenta[acct];
        if (!a) { out.sin_datos++; continue; }
        const dias = a.ultima_venta
          ? Math.max(0, Math.floor((hoy.getTime() - new Date(a.ultima_venta + 'T12:00:00Z').getTime()) / 86400000))
          : null;
        const { error: ue } = await supabase.from('companies').update({
          actividad: a,
          ultima_venta_at: a.ultima_venta || null,
          dias_sin_venta: dias,
          actividad_sync_at: new Date().toISOString(),
        }).eq('id', co.id);
        if (ue) out.errores.push(acct + ': ' + ue.message);
        else out.actualizadas++;
      }
    } catch (e: any) {
      out.errores.push('lote ' + i + ': ' + (e?.message || String(e)));
    }
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
