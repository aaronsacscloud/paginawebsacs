// GET /api/partner-portal/clientes — los clientes REALES del partner logueado,
// con datos reales (nada estimado): MRR/ARR de la suscripción, estado real (pago
// + actividad SACS), última venta / tendencia / sucursales / usuarios, comisión
// real (partner_commissions) y SEÑALES de venta (qué ofrecerle).
//
// Lee SOLO de Supabase (companies.actividad la llena el cron sync-sacs-activity
// cada 6h, en lotes) → cero carga al servidor de SACS.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';

export const prerender = false;
const j = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

// Deal "ganado" (cliente real): stage cerrada_ganada / won legacy, o cerrado y no perdido.
const esGanado = (d: any) => d.stage === 'cerrada_ganada' || d.stage === 'won' || (!!d.closed_at && d.stage !== 'cerrada_perdida' && d.stage !== 'lost');
const hoy = () => new Date().toISOString().slice(0, 10);

/* Señales de venta/riesgo derivadas de la realidad SACS. Cada una dice QUÉ ofrecer. */
function señales(co: any, sub: any): { tipo: string; nivel: 'oportunidad' | 'riesgo'; titulo: string; detalle: string }[] {
  const a = co.actividad || {};
  const out: any[] = [];
  const dias = co.dias_sin_venta;
  const sucReales = Number(a.sucursales || 0);
  const sucPlan = Number(co.sucursales || 0);
  const tend = a.tendencia_pct;

  // Riesgo: dejó de vender → retención.
  if (dias != null && dias > 15) out.push({ tipo: 'riesgo_churn', nivel: 'riesgo', titulo: 'Lleva ' + dias + ' días sin vender', detalle: 'Contáctalo pronto: es señal de abandono. Ofrécele ayuda/capacitación para reactivarlo.' });
  else if ((co.health_score != null && co.health_score < 40)) out.push({ tipo: 'salud_baja', nivel: 'riesgo', titulo: 'Salud baja (' + co.health_score + ')', detalle: 'Está usando poco el sistema. Una llamada de seguimiento evita que se vaya.' });

  // Oportunidad: usa más sucursales de las que paga → ampliar sucursales.
  if (sucReales > 0 && sucPlan > 0 && sucReales > sucPlan) out.push({ tipo: 'sucursales', nivel: 'oportunidad', titulo: 'Usa ' + sucReales + ' sucursales y su plan cubre ' + sucPlan, detalle: 'Ofrécele ampliar sucursales en su plan — ya las está operando.' });

  // Oportunidad: creciendo fuerte → subir de plan / módulos.
  if (tend != null && tend >= 20) out.push({ tipo: 'creciendo', nivel: 'oportunidad', titulo: 'Sus ventas subieron ' + tend + '% vs. el mes anterior', detalle: 'Va en crecimiento — buen momento para proponerle un plan superior o módulos nuevos.' });

  // Oportunidad: equipo creciendo (muchos usuarios operando) → plan más grande.
  if (Number(a.usuarios_operando || 0) >= 4 && (co.plan === 'vende' || co.plan === 'controla')) out.push({ tipo: 'equipo', nivel: 'oportunidad', titulo: a.usuarios_operando + ' personas operando el sistema', detalle: 'Equipo grande en un plan básico: candidato a Fideliza/Automatiza (más control y automatización).' });

  // Cross-sell: pocos módulos activos → capacitación / activar módulos.
  const nMod = Array.isArray(a.modulos) ? a.modulos.length : 0;
  if (nMod > 0 && nMod <= 2 && (co.plan === 'controla' || co.plan === 'automatiza' || co.plan === 'fideliza')) out.push({ tipo: 'modulos', nivel: 'oportunidad', titulo: 'Solo usa ' + nMod + ' módulo(s) de su plan', detalle: 'Está desaprovechando lo que paga: ofrécele capacitación para activar más módulos (más valor = menos churn).' });

  return out;
}

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return j({ error: 'unauthorized' }, 401);

  // 1) Deals ganados del partner con company ligada.
  const { data: deals, error: eDeals } = await supabase.from('deals')
    .select('id, nombre, company_id, stage, closed_at, valor_total, valor_mensual, created_at')
    .eq('referrer_partner_id', user.id).is('archived_at', null).range(0, 9999);
  if (eDeals) return j({ error: eDeals.message }, 500);

  const ganados = (deals || []).filter(esGanado);
  const companyIds = Array.from(new Set(ganados.map(d => d.company_id).filter(Boolean)));
  const dealIds = ganados.map(d => d.id);

  if (!companyIds.length) return j({ clientes: [], resumen: { total: 0, mrr: 0, comision: 0, en_riesgo: 0, oportunidades: 0 } });

  // 2) Datos reales en paralelo (todo Supabase).
  const [coRes, subRes, comRes] = await Promise.all([
    supabase.from('companies').select('id, nombre, ciudad, plan, sucursales, mrr, arr, estado_cuenta, health_score, dias_sin_venta, ultima_venta_at, last_payment_at, actividad, sacs_account').in('id', companyIds),
    supabase.from('subscriptions').select('company_id, estado, nombre_plan, ciclo, mrr, arr, proxima_factura, monto_proximo, pagos_realizados, total_pagado').in('company_id', companyIds),
    dealIds.length ? supabase.from('partner_commissions').select('deal_id, commission_amount, status').eq('partner_id', user.id).in('deal_id', dealIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const companies = coRes.data || [];
  const subs = subRes.data || [];
  const comis = (comRes as any).data || [];

  const coById: Record<string, any> = {}; companies.forEach(c => coById[c.id] = c);
  const subsByCo: Record<string, any[]> = {}; subs.forEach(s => { (subsByCo[s.company_id] = subsByCo[s.company_id] || []).push(s); });
  // Comisión real por company (vía deal → company).
  const comByDeal: Record<string, { paid: number; pend: number }> = {};
  comis.forEach((c: any) => { const t = comByDeal[c.deal_id] = comByDeal[c.deal_id] || { paid: 0, pend: 0 }; if (c.status === 'paid') t.paid += Number(c.commission_amount || 0); else if (c.status !== 'cancelled') t.pend += Number(c.commission_amount || 0); });
  const comByCo: Record<string, { paid: number; pend: number }> = {};
  ganados.forEach(d => { if (!d.company_id) return; const dc = comByDeal[d.id]; if (!dc) return; const t = comByCo[d.company_id] = comByCo[d.company_id] || { paid: 0, pend: 0 }; t.paid += dc.paid; t.pend += dc.pend; });

  const clientes = companyIds.map(cid => {
    const co = coById[cid];
    if (!co) return null;
    const cs = subsByCo[cid] || [];
    const activas = cs.filter(s => s.estado === 'activa');
    const pendPago = cs.some(s => s.estado === 'pendiente_pago');
    const a = co.actividad || {};
    const dias = co.dias_sin_venta;

    // Estado REAL (nada de idx%7): pago pendiente / venció, o inactividad, o al corriente.
    const vencida = co.estado_cuenta === 'vencido' || activas.some(s => s.proxima_factura && s.proxima_factura < hoy());
    let estado: 'al_corriente' | 'pendiente' | 'en_riesgo';
    if (dias != null && dias > 15) estado = 'en_riesgo';
    else if (pendPago || vencida) estado = 'pendiente';
    else if (co.health_score != null && co.health_score < 40) estado = 'en_riesgo';
    else estado = 'al_corriente';

    const mrr = activas.reduce((s, x) => s + Number(x.mrr || 0), 0) || Number(co.mrr || 0);
    const arr = activas.reduce((s, x) => s + Number(x.arr || 0), 0) || Number(co.arr || 0);
    const com = comByCo[cid] || { paid: 0, pend: 0 };
    const sig = señales(co, activas[0] || cs[0]);

    return {
      company_id: cid,
      nombre: co.nombre,
      ciudad: co.ciudad || '',
      sacs_account: co.sacs_account || '',
      plan: co.plan || '',
      estado,
      mrr, arr,
      comision_pagada: Math.round(com.paid),
      comision_pendiente: Math.round(com.pend),
      health_score: co.health_score,
      dias_sin_venta: dias,
      // Actividad real de SACS (del cron):
      ultima_venta: a.ultima_venta || co.ultima_venta_at || null,
      ventas_30d: a.ventas_30d ?? null,
      total_30d: a.total_30d ?? null,
      tendencia_pct: a.tendencia_pct ?? null,
      sucursales: a.sucursales ?? co.sucursales ?? null,
      usuarios: a.usuarios ?? null,
      usuarios_operando: a.usuarios_operando ?? null,
      modulos: a.modulos || [],
      proxima_factura: activas.map(s => s.proxima_factura).filter(Boolean).sort()[0] || null,
      ultimo_pago: co.last_payment_at || null,
      total_pagado: cs.reduce((s, x) => s + Number(x.total_pagado || 0), 0),
      pagos_realizados: cs.reduce((s, x) => s + Number(x.pagos_realizados || 0), 0),
      señales: sig,
    };
  }).filter(Boolean).sort((a: any, b: any) => (b.mrr - a.mrr));

  const resumen = {
    total: clientes.length,
    mrr: Math.round((clientes as any[]).reduce((s, c) => s + c.mrr, 0)),
    comision: Math.round((clientes as any[]).reduce((s, c) => s + c.comision_pagada, 0)),
    en_riesgo: (clientes as any[]).filter(c => c.estado === 'en_riesgo').length,
    oportunidades: (clientes as any[]).reduce((s, c) => s + c.señales.filter((x: any) => x.nivel === 'oportunidad').length, 0),
  };

  return j({ clientes, resumen });
};
