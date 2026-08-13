// POST /api/revenue/quotes/recuperar-oportunidades  { incluir_perdidas?: boolean, dry?: boolean }
//
// Recuperación de una sola vez. El puente que crea la oportunidad solo corría
// para borrador / enviada / aceptada, así que toda cotización que se ligó a un
// cliente cuando YA estaba pagada nunca generó nada: la venta entró y en el
// tablero no existió. De 11 pagadas, 8 estaban así.
//
// Dos cuidados que hacen la diferencia entre reparar y ensuciar:
//
//   · Se cierra con la FECHA REAL (pago, rechazo o vencimiento), no con la de
//     hoy. Una venta de julio recuperada en agosto no puede aparecer cerrada en
//     agosto: desplazaría el mes en todo reporte.
//   · Solo se tocan las que tienen cliente ligado. Una oportunidad sin empresa
//     no aparece en ninguna ficha —es basura en el tablero— y ligar por
//     adivinanza es peor que no ligar.
//
// Es idempotente: correrlo dos veces no duplica nada, porque salta las que ya
// tienen deal_id.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const incluirPerdidas = b?.incluir_perdidas !== false;
  const dry = !!b?.dry;

  const estados = incluirPerdidas ? ['paid', 'expired', 'rejected'] : ['paid'];
  // ── Pagadas cuya oportunidad existe pero NO está cerrada ──
  // Las que se cobraron ANTES de que existiera la cadena de cierre quedaron con
  // el deal en "cotización enviada", el cliente como prospecto y sin
  // suscripción: la venta entró y no dejó nada.
  const cerradas: any[] = [];
  if (!dry) {
    const { data: pendientes } = await supabase.from('quotes')
      .select('id, numero, empresa, total, deal_id, pagado_fecha')
      .eq('estado', 'paid').not('deal_id', 'is', null);
    const { syncQuoteToDeal: sync2 } = await import('../../../../lib/crm/sync-quote-deal');
    for (const q of pendientes || []) {
      const { data: deal } = await supabase.from('deals').select('*').eq('id', q.deal_id).maybeSingle();
      if (!deal || deal.stage === 'cerrada_ganada') continue;
      await sync2(q.id, {
        targetStage: 'cerrada_ganada', valor_total: Math.round(Number(q.total || 0)),
        trigger: 'recuperacion_cierre', closed_at: q.pagado_fecha || undefined,
      });
      const { data: fresco } = await supabase.from('deals').select('*').eq('id', q.deal_id).maybeSingle();
      let cierre: any = null;
      if (fresco) {
        try {
          const { materializarDealGanado } = await import('../../../../lib/crm/deal-cierre');
          cierre = await materializarDealGanado(fresco);
        } catch (e: any) { cierre = { error: String(e?.message || e) }; }
      }
      cerradas.push({ numero: q.numero, empresa: q.empresa, total: q.total, cierre });
    }
  }

  const { data: qs, error } = await supabase.from('quotes')
    .select('id, numero, empresa, total, estado, company_id, deal_id, pagado_fecha, rechazado_fecha, vigencia, created_at')
    .in('estado', estados).is('deal_id', null).not('company_id', 'is', null)
    .order('created_at', { ascending: true });
  if (error) return json({ error: error.message }, 500);

  const { etapaParaEstado, syncQuoteToDeal } = await import('../../../../lib/crm/sync-quote-deal');

  const hechas: any[] = [];
  const fallidas: any[] = [];
  // Las que NO se pueden recuperar se reportan con su motivo: callarlas haría
  // creer que quedó todo cubierto cuando no fue así.
  const { data: sinCliente } = await supabase.from('quotes')
    .select('numero, empresa, total, estado').in('estado', estados).is('deal_id', null).is('company_id', null);

  for (const q of qs || []) {
    const etapa = etapaParaEstado(String(q.estado));
    if (!etapa) continue;
    const closed = q.pagado_fecha || q.rechazado_fecha || q.vigencia || q.created_at;
    if (dry) { hechas.push({ numero: q.numero, empresa: q.empresa, total: q.total, etapa, closed_at: closed }); continue; }
    try {
      const r = await syncQuoteToDeal(q.id, {
        targetStage: etapa,
        valor_total: Math.round(Number(q.total || 0)),
        trigger: 'recuperacion_historica',
        closed_at: closed ? new Date(closed).toISOString() : undefined,
        motivo_perdida: q.estado === 'expired' ? 'Venció sin respuesta' : q.estado === 'rejected' ? 'Rechazada por el cliente' : undefined,
      });
      if (r.dealId) hechas.push({ numero: q.numero, empresa: q.empresa, total: q.total, etapa, deal_id: r.dealId, closed_at: closed });
      else fallidas.push({ numero: q.numero, motivo: 'no se pudo crear la oportunidad' });
    } catch (e: any) {
      fallidas.push({ numero: q.numero, motivo: String(e?.message || e) });
    }
  }

  return json({
    dry,
    cerradas: cerradas.length,
    cerradas_detalle: cerradas,
    recuperadas: hechas.length,
    ganadas: hechas.filter(h => h.etapa === 'cerrada_ganada').length,
    perdidas: hechas.filter(h => h.etapa === 'cerrada_perdida').length,
    detalle: hechas,
    fallidas,
    // Sin cliente ligado no hay nada que recuperar: hay que ligarlas a mano
    // desde la lista, y al hacerlo la oportunidad ya nace sola.
    sin_cliente_ligado: (sinCliente || []).map(q => ({ numero: q.numero, empresa: q.empresa, total: q.total, estado: q.estado })),
  });
};
