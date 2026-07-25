// GET /api/cron/sync-sacs-uso?key=... — sincroniza el USO PROFUNDO de cada
// cuenta SACS (transferencias, lealtad, conteos, facturación, administración,
// módulos nunca activados) hacia companies.uso_sacs.
//
// Corre UNA vez al día en la MADRUGADA (3am CDMX) y es PROGRESIVO: cada corrida
// toma las N cuentas más desactualizadas (uso_sync_at asc, nulls primero), así
// que la base completa se refresca cada ~N días sin saturar al servidor de SACS.
// Solo cuentas con suscripción ACTIVA: un cliente cancelado no gasta barrido.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

const CRON_KEY = import.meta.env.CRM_CRON_KEY || 'sacs-cron-2026';
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = import.meta.env.CRM_SYNC_SECRET || 'sacs-crm-sync-2026';

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== CRON_KEY) return new Response('Forbidden', { status: 403 });

  const limit = Math.min(60, Number(url.searchParams.get('limit')) || 30);

  // Companies con cuenta SACS y AL MENOS una suscripción activa, las más
  // desactualizadas primero (cursor progresivo).
  const { data: companies, error } = await supabase.from('companies')
    .select('id, nombre, sacs_account, uso_sync_at, actividad, dias_sin_venta, health_score, subscriptions!inner(estado)')
    .not('sacs_account', 'is', null).is('archived_at', null)
    .eq('subscriptions.estado', 'activa')
    .order('uso_sync_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const cuentas = Array.from(new Set((companies || []).map(c => String(c.sacs_account).trim().toLowerCase()).filter(Boolean)));
  const out = { cuentas: cuentas.length, actualizadas: 0, sin_datos: 0, errores: [] as string[] };

  // Lotes de 15 — el endpoint de sacs_api procesa cada lote SECUENCIALMENTE
  // (una cuenta a la vez) para no golpear Mongo.
  for (let i = 0; i < cuentas.length; i += 15) {
    const lote = cuentas.slice(i, i + 15);
    try {
      const res = await fetch(SACS_API + '/interno/crm/uso', {
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
        const uso = porCuenta[acct];
        if (!uso) { out.sin_datos++; continue; }
        const { error: ue } = await supabase.from('companies').update({
          uso_sacs: uso,
          uso_sync_at: new Date().toISOString(),
        }).eq('id', co.id);
        if (ue) { out.errores.push(acct + ': ' + ue.message); continue; }
        out.actualizadas++;

        // ── HISTÓRICO: snapshot del día (upsert por company+fecha, no duplica) ──
        // SOLO campos de USO: los de ventas/salud (ventas_30d, health, etc.) los
        // escribe el cron de actividad con datos FRESCOS — si los mandáramos aquí
        // (leídos de companies al inicio de la corrida) pisaríamos el snapshot
        // fresco con valores viejos. El upsert deja intactas las columnas que no van.
        try {
          const { error: se } = await supabase.from('uso_snapshots').upsert({
            company_id: co.id,
            fecha: new Date().toISOString().slice(0, 10),
            clientes_total: uso.clientes?.total ?? null,
            lealtad_inscritos: uso.lealtad?.inscritos ?? null,
            conteos_7d: uso.conteos?.total_7d ?? null,
            transferencias_7d: uso.transferencias?.total_7d ?? null,
            facturas_7d: uso.facturacion?.timbradas_7d ?? null,
            clientes_nuevos_7d: uso.clientes?.nuevos_7d ?? null,
            uso,
          }, { onConflict: 'company_id,fecha' });
          if (se) console.warn('[sync-sacs-uso] snapshot:', acct, se.message);
        } catch { /* el snapshot nunca bloquea el sync */ }
      }
    } catch (e: any) {
      out.errores.push('lote ' + i + ': ' + (e?.message || String(e)));
    }
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
