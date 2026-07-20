// GET /api/cron/sync-sacs-activity?key=... — liga el CRM con la realidad y
// detecta señales de churn/sospecha. Corre por Vercel cron cada 6 horas.
//
// v2: además de guardar la actividad, calcula HEALTH SCORE (0-100) con factores
// y dispara ALERTAS (activities con dedup 7 días + WhatsApp al admin):
//  - caida_ventas: tendencia 30d vs previa cae >50%
//  - cancelada_pero_usando: sub cancelada y la cuenta sigue vendiendo (usa sin pagar)
//  - sucursales_excedidas: sucursales reales > contratadas (subcobro/upsell)
//  - entro_a_riesgo: cruzó los 15 días sin vender (churn probable)
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { sendWhatsApp } from '../../../lib/kapso';

export const prerender = false;

const CRON_KEY = import.meta.env.CRM_CRON_KEY || 'sacs-cron-2026';
const SACS_API = import.meta.env.SACS_API_URL || 'https://sacs-api-819604817289.us-central1.run.app/v1';
const SYNC_SECRET = import.meta.env.CRM_SYNC_SECRET || 'sacs-crm-sync-2026';
const ADMIN_WHATSAPP = (import.meta.env.CRM_ADMIN_WHATSAPP || '').trim();

const r0 = (n: number) => Math.round(n);

/** Health 0-100: recencia de venta (40) + tendencia (25) + amplitud de módulos (20) + equipo operando (15). */
function healthScore(a: any): { score: number; factors: Record<string, number> } {
  const dias = a.ultima_venta ? Math.max(0, Math.floor((Date.now() - new Date(a.ultima_venta + 'T12:00:00Z').getTime()) / 86400000)) : 99;
  const fRecencia = dias <= 1 ? 40 : dias <= 3 ? 32 : dias <= 7 ? 24 : dias <= 15 ? 12 : 0;
  const t = a.tendencia_pct;
  const fTendencia = t == null ? 12 : t >= 0 ? 25 : t >= -25 ? 18 : t >= -50 ? 8 : 0;
  const fModulos = Math.min(20, (a.modulos?.length || 0) * 5);
  const ops = a.usuarios_operando || 0;
  const fEquipo = ops >= 3 ? 15 : ops === 2 ? 10 : ops === 1 ? 5 : 0;
  return { score: fRecencia + fTendencia + fModulos + fEquipo, factors: { recencia: fRecencia, tendencia: fTendencia, modulos: fModulos, equipo: fEquipo } };
}

/** Alerta con dedup: no repite la misma alerta para la misma company en 7 días. */
async function alertar(companyId: string, clave: string, titulo: string, metadata: any, avisos: string[]) {
  const hace7d = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: previa } = await supabase.from('activities').select('id')
    .eq('company_id', companyId).eq('automatico', true)
    .contains('metadata', { alerta: clave })
    .gte('created_at', hace7d).limit(1).maybeSingle();
  if (previa) return;
  await supabase.from('activities').insert({
    tipo: 'sistema', titulo, company_id: companyId, automatico: true,
    metadata: { ...metadata, alerta: clave },
  }).select().maybeSingle();
  avisos.push(titulo);
}

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('key') !== CRON_KEY) return new Response('Forbidden', { status: 403 });

  const { data: companies, error } = await supabase.from('companies')
    .select('id, nombre, sacs_account, sucursales, dias_sin_venta').not('sacs_account', 'is', null).is('archived_at', null);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // suscripciones para las alertas de "cancelada pero usando"
  const { data: subsAll } = await supabase.from('subscriptions').select('company_id, estado, arr, nombre_plan');
  const porCompany: Record<string, { activas: number; canceladas: number; arr: number; planes: string[] }> = {};
  (subsAll || []).forEach((s: any) => {
    if (!s.company_id) return;
    const e = (porCompany[s.company_id] = porCompany[s.company_id] || { activas: 0, canceladas: 0, arr: 0, planes: [] });
    if (s.estado === 'activa') { e.activas++; e.arr += Number(s.arr || 0); e.planes.push(String(s.nombre_plan || '')); }
    if (s.estado === 'cancelada') e.canceladas++;
  });

  const cuentas = Array.from(new Set((companies || []).map(c => String(c.sacs_account).trim().toLowerCase()).filter(Boolean)));
  const out = { cuentas: cuentas.length, actualizadas: 0, sin_datos: 0, alertas: 0, errores: [] as string[] };
  const avisos: string[] = [];
  const hoy = new Date();

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
        const diasPrev = co.dias_sin_venta;
        const { score, factors } = healthScore(a);

        const { error: ue } = await supabase.from('companies').update({
          actividad: a,
          ultima_venta_at: a.ultima_venta || null,
          dias_sin_venta: dias,
          actividad_sync_at: new Date().toISOString(),
          health_score: score,
          health_factors: factors,
          health_computed_at: new Date().toISOString(),
        }).eq('id', co.id);
        if (ue) { out.errores.push(acct + ': ' + ue.message); continue; }
        out.actualizadas++;

        // ── alertas ──
        const subInfo = porCompany[co.id] || { activas: 0, canceladas: 0, arr: 0 };
        if (a.tendencia_pct != null && a.tendencia_pct <= -50 && subInfo.activas > 0) {
          await alertar(co.id, 'caida_ventas',
            `📉 ${co.nombre}: ventas cayeron ${r0(Math.abs(a.tendencia_pct))}% vs los 30 días previos ($${r0(a.total_30d).toLocaleString()} vs $${r0(a.total_30d_prev).toLocaleString()}) — ${'$' + r0(subInfo.arr).toLocaleString()} ARR en juego`,
            { tendencia_pct: a.tendencia_pct, cuenta: acct }, avisos);
        }
        if (subInfo.activas === 0 && subInfo.canceladas > 0 && (a.ventas_30d || 0) > 0) {
          await alertar(co.id, 'cancelada_pero_usando',
            `🚨 ${co.nombre} (${acct}): canceló su suscripción pero SIGUE USANDO SACS (${a.ventas_30d} ventas / $${r0(a.total_30d).toLocaleString()} en 30d) — uso sin pagar`,
            { ventas_30d: a.ventas_30d, cuenta: acct }, avisos);
        }
        if (co.sucursales && a.sucursales && a.sucursales > co.sucursales && subInfo.activas > 0) {
          await alertar(co.id, 'sucursales_excedidas',
            `🏢 ${co.nombre}: usa ${a.sucursales} sucursales pero contrató ${co.sucursales} — posible subcobro / oportunidad de upsell`,
            { reales: a.sucursales, contratadas: co.sucursales, cuenta: acct }, avisos);
        }
        // Paga un plan con inventario (Controla/Automatiza) pero en 30 días no usó
        // NINGÚN módulo de inventario → no le ve valor a lo que paga = churn en
        // cámara lenta (o oportunidad de reactivar con capacitación).
        const pagaInventario = (subInfo.planes || []).some(pl => /controla|automatiza/i.test(pl));
        const usaInventario = (a.modulos || []).some((m: string) => /inventario|compra|Transferencias/i.test(m));
        if (pagaInventario && !usaInventario && (a.ventas_30d || 0) > 0) {
          await alertar(co.id, 'plan_sin_uso',
            `📦 ${co.nombre}: paga plan con INVENTARIO (${(subInfo.planes || []).filter(pl => /controla|automatiza/i.test(pl)).join(', ')}) pero en 30 días no usó órdenes de compra ni transferencias — no le está viendo valor: capacitar o riesgo de downgrade`,
            { planes: subInfo.planes, modulos: a.modulos, cuenta: acct }, avisos);
        }
        if (dias != null && dias > 15 && (diasPrev == null || diasPrev <= 15) && subInfo.activas > 0) {
          await alertar(co.id, 'entro_a_riesgo',
            `🔴 ${co.nombre} (${acct}) cruzó 15 días sin vender — churn probable, $${r0(subInfo.arr).toLocaleString()} ARR en riesgo`,
            { dias_sin_venta: dias, cuenta: acct }, avisos);
        }
      }
    } catch (e: any) {
      out.errores.push('lote ' + i + ': ' + (e?.message || String(e)));
    }
  }

  out.alertas = avisos.length;
  // WhatsApp al admin con el resumen de alertas nuevas (best-effort)
  if (avisos.length && ADMIN_WHATSAPP) {
    try {
      await sendWhatsApp(ADMIN_WHATSAPP, '⚠️ CRM SACS — ' + avisos.length + ' alerta(s) nueva(s):\n\n' + avisos.slice(0, 8).join('\n\n') + (avisos.length > 8 ? '\n\n…y ' + (avisos.length - 8) + ' más en el CRM.' : ''));
    } catch { /* el resumen queda en activities de todos modos */ }
  }

  return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
