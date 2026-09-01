// Cobrar una cotización tiene que dejar al cliente PAGADO, no "programado".
//
// Lo que pasaba: marcar una cotización como pagada cerraba la oportunidad y
// creaba la suscripción, pero la suscripción nacía 'programada' con
// proxima_factura = HOY y cero pagos. El dinero quedaba registrado contra la
// COTIZACIÓN (payments.quote_id) y nunca contra la LICENCIA, así que en la
// ficha del cliente se leía "programada · 0 pagos · $0 acumulado · próxima
// factura hoy" — de una venta que ya estaba cobrada. Caso FEELINGS (COT-78909,
// $5,850 anual): pagada el 21-ago-2026 y la próxima factura decía 21-ago-2026
// en vez de 21-ago-2027.
//
// Aquí se aplica el dinero de la cotización a las suscripciones que nacieron de
// ella: pasan a 'activa', se les recorre la próxima factura UN ciclo (anual →
// +1 año, mensual → +1 mes) desde la fecha del pago, y se les suman los
// contadores de pagos. El pago de la cotización se liga a la licencia para que
// deje de ser un cobro huérfano.
//
// Reparto cuando la cotización trae recurrente + pago único: primero se cubre
// el ciclo del recurrente (hasta su precio) y lo que sobra va al pago único
// (vitalicia). El sobrante final queda como saldo a favor del recurrente — el
// dinero nunca se pierde ni se regala.
//
// Idempotente: una suscripción que YA tiene pagos registrados no se vuelve a
// tocar (volver a marcar pagada, o el reintento de un webhook, no recorre la
// fecha dos veces).
import { notificar } from './notificaciones';
import { supabase } from '../supabase';
import { recordDelta } from './mrr-ledger';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Estados de payments que cuentan como dinero que SÍ entró. */
const PAGO_VALIDO = new Set(['confirmado', 'conciliado', 'pagado', '']);

export function addCiclo(fecha: string, ciclo: string): string {
  const d = new Date(fecha + 'T12:00:00Z');
  if (ciclo === 'anual') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export type SubCobrada = {
  id: string;
  nombre_plan: string;
  ciclo: string;
  estado_antes: string;
  estado: string;
  asignado: number;
  proxima_factura_antes: string | null;
  proxima_factura: string | null;
  parcial: boolean;
};

export type ResultadoCobro = {
  aplicado: boolean;
  motivo?: string;
  quote_id: string;
  numero?: string | null;
  dinero: number;
  fecha_pago?: string;
  subs: SubCobrada[];
  sobrante: number;
  avisos: string[];
  dry_run?: boolean;
};

/**
 * Aplica el dinero cobrado de una cotización a sus suscripciones.
 * Nunca lanza hacia afuera del llamador: quien cobra no puede fallar por esto.
 *
 * @param quoteId  cotización ya marcada 'paid'
 * @param opts.dryRun  simula y reporta sin escribir nada
 * @param opts.actor   quién lo dispara (queda en el ledger de MRR)
 */
export async function aplicarCobroDeCotizacion(
  quoteId: string,
  opts: { dryRun?: boolean; actor?: string } = {},
): Promise<ResultadoCobro> {
  const dry = !!opts.dryRun;
  const out: ResultadoCobro = { aplicado: false, quote_id: quoteId, dinero: 0, subs: [], sobrante: 0, avisos: [], ...(dry ? { dry_run: true } : {}) };

  const { data: q } = await supabase.from('quotes')
    .select('id, numero, estado, total, company_id, contact_id, deal_id, pagado_fecha, partner_id')
    .eq('id', quoteId).maybeSingle();
  if (!q) { out.motivo = 'cotización no encontrada'; return out; }
  out.numero = q.numero;
  if (q.estado !== 'paid') { out.motivo = `la cotización está ${q.estado}, no pagada`; return out; }
  if (!q.company_id) { out.motivo = 'la cotización no tiene cliente ligado'; return out; }

  // ── El dinero que entró por esta cotización ──
  const { data: pagos } = await supabase.from('payments')
    .select('id, fecha, monto, estado, subscription_id, company_id, contact_id')
    .eq('quote_id', quoteId);
  const validos = (pagos || []).filter((p: any) => PAGO_VALIDO.has(String(p.estado ?? '').toLowerCase()));
  const dinero = r2(validos.reduce((s: number, p: any) => s + (Number(p.monto) || 0), 0));
  out.dinero = dinero;
  if (dinero <= 0) { out.motivo = 'la cotización no tiene pagos registrados'; return out; }

  const fechas = validos.map((p: any) => String(p.fecha || '').slice(0, 10)).filter(Boolean).sort();
  const fechaPago = fechas[fechas.length - 1] || String(q.pagado_fecha || new Date().toISOString()).slice(0, 10);
  out.fecha_pago = fechaPago;

  // ── Las licencias que nacieron de ESTA cotización ──
  // Solo por vínculo explícito (quote_id o el deal de la cotización). Un cliente
  // puede tener varias licencias; adivinar cuál cobrar por parecido de precio
  // es justo como se activa la que no era.
  const { data: subsCo } = await supabase.from('subscriptions')
    .select('*').eq('company_id', q.company_id).limit(100);
  const ligadas = (subsCo || []).filter((s: any) =>
    s.quote_id === quoteId || (q.deal_id && s.deal_id === q.deal_id));
  if (!ligadas.length) {
    out.motivo = 'no hay ninguna suscripción ligada a esta cotización';
    return out;
  }

  // Recurrente primero, pago único después: el ciclo que se renueva es el que
  // tiene que quedar al corriente.
  const orden = [...ligadas].sort((a: any, b: any) =>
    (a.ciclo === 'vitalicia' ? 1 : 0) - (b.ciclo === 'vitalicia' ? 1 : 0));

  // ── El dinero de una cotización solo se puede aplicar UNA vez ──
  // Caso Okulany: el cobro se registró a mano (licencia activa, próxima factura
  // 2027) y minutos después el cierre de la cotización creó una SEGUNDA licencia
  // igual, programada. Sin este descuento, aplicar el cobro la activaría también
  // y el cliente aparecería pagando $5,850 dos veces — con el doble de ARR.
  const yaAplicado = r2(ligadas.reduce((sum: number, s: any) =>
    sum + (Number(s.pagos_realizados || 0) > 0 ? Number(s.total_pagado || 0) : 0), 0));
  if (yaAplicado > 0) out.avisos.push(`Ya había $${yaAplicado.toLocaleString('es-MX')} registrados en las licencias de esta cotización; solo se aplica la diferencia.`);

  let restante = r2(dinero - yaAplicado);
  if (restante <= 0) {
    out.motivo = 'el dinero de esta cotización ya está registrado en sus licencias';
    return out;
  }
  for (const sub of orden) {
    if (restante <= 0) break;
    // Idempotencia: si ya se le registró un pago, esta cotización ya se aplicó
    // (o se cobró a mano). No se recorre la fecha dos veces.
    if (Number(sub.pagos_realizados || 0) > 0) {
      out.avisos.push(`${sub.nombre_plan}: ya tenía ${sub.pagos_realizados} pago(s) registrado(s), no se tocó.`);
      continue;
    }
    if (sub.estado === 'cancelada') {
      out.avisos.push(`${sub.nombre_plan}: está cancelada, no se reactiva sola.`);
      continue;
    }

    const precio = Number(sub.monto_proximo ?? sub.precio) || 0;
    const asignado = precio > 0 ? Math.min(restante, precio) : restante;
    if (asignado <= 0) continue;
    restante = r2(restante - asignado);

    // Con tolerancia de un peso: $5,849.50 de $5,850 es el periodo pagado.
    const parcial = precio > 0 && asignado + 1 < precio;
    const baseVieja = sub.proxima_factura ? String(sub.proxima_factura).slice(0, 10) : null;
    // ── La anualidad corre desde el DÍA DEL PAGO ──
    // Es lo que dice el contrato ("la anualidad comenzará a correr a partir del
    // día en que se realice el pago") y lo que el cliente espera ver.
    //
    // La única fecha que se respeta por encima del pago es una pactada A FUTURO
    // de verdad (un alta programada para el mes que entra). Ojo con la trampa:
    // una licencia recién creada por el cierre nace con proxima_factura = HOY,
    // así que comparar solo contra el pago mandaba la renovación al aniversario
    // del DÍA EN QUE SE REPARÓ, no del día en que pagaron — Giacca pagó el
    // 12-ago y le tocaba renovar el 21-ago. Por eso se exige que la fecha vieja
    // sea posterior a HOY, no solo al pago.
    const hoyIso = new Date().toISOString().slice(0, 10);
    const pactadaAFuturo = !!(baseVieja && baseVieja > fechaPago && baseVieja > hoyIso);
    const base = pactadaAFuturo ? (baseVieja as string) : fechaPago;
    const proxima = sub.ciclo === 'vitalicia' ? null
      : (parcial ? baseVieja : addCiclo(base, sub.ciclo));

    const fila: SubCobrada = {
      id: sub.id, nombre_plan: sub.nombre_plan, ciclo: sub.ciclo,
      estado_antes: sub.estado, estado: parcial ? 'pendiente_pago' : 'activa',
      asignado, proxima_factura_antes: baseVieja, proxima_factura: proxima, parcial,
    };
    out.subs.push(fila);
    if (parcial) out.avisos.push(`${sub.nombre_plan}: pago PARCIAL ($${asignado.toLocaleString('es-MX')} de $${precio.toLocaleString('es-MX')}), la fecha no se recorrió.`);
    if (dry) continue;

    // Cuántos "pagos" lleva la licencia: si absorbió TODO el dinero de la
    // cotización, fueron todos sus abonos (una cotización liquidada en dos
    // transferencias son dos pagos, no uno). Si el dinero se repartió entre
    // varias licencias, cuenta como uno.
    const nPagos = asignado === r2(dinero - yaAplicado) ? Math.max(1, validos.length) : 1;
    const upd: any = {
      estado: fila.estado,
      proxima_factura: proxima,
      pagos_realizados: nPagos,
      total_pagado: asignado,
      updated_at: new Date().toISOString(),
    };
    // La licencia arrancó el día del pago, no el día en que el CRM la creó.
    // Sin esto, una venta que se materializa días después nace con antigüedad
    // falsa y el histórico del cliente miente.
    if (!pactadaAFuturo && (!sub.fecha_inicio || String(sub.fecha_inicio).slice(0, 10) > fechaPago)) {
      upd.fecha_inicio = fechaPago;
    }
    // Columnas de SQL-4: si el deploy va antes que el SQL, se reintenta sin ellas.
    const updExtra = { ...upd, cancela_al_vencer: false };
    let res = await supabase.from('subscriptions').update(updExtra).eq('id', sub.id).select('*').maybeSingle();
    if (res.error && /column .* does not exist|schema cache/i.test(res.error.message || '')) {
      res = await supabase.from('subscriptions').update(upd).eq('id', sub.id).select('*').maybeSingle();
    }
    if (res.error) { out.avisos.push(`${sub.nombre_plan}: ${res.error.message}`); out.subs.pop(); continue; }

    // Ledger MRR: programada→activa es un ALTA. Sin esto, la venta cobrada no
    // aparece en NRR/GRR aunque el dinero ya esté en la caja.
    try {
      await recordDelta({
        subscription_id: sub.id, company_id: q.company_id, fecha: fechaPago,
        mrr_anterior: (sub.estado === 'activa' || sub.estado === 'pendiente_pago') ? Number(sub.mrr || 0) : 0,
        mrr_nuevo: fila.estado === 'activa' ? Number(sub.mrr || 0) : 0,
        motivo: `cobro de cotización ${q.numero || ''}`.trim(),
        actor: opts.actor || 'sistema',
      });
    } catch { /* el ledger nunca bloquea el cobro */ }

    await supabase.from('activities').insert({
      tipo: 'pago_recibido', automatico: true,
      company_id: q.company_id, contact_id: q.contact_id || sub.contact_id || null,
      deal_id: q.deal_id || null,
      titulo: parcial
        ? `Cobro parcial de la cotización ${q.numero || ''}: $${asignado.toLocaleString('es-MX')} — ${sub.nombre_plan}`
        : `Licencia ACTIVA por la cotización ${q.numero || ''}: ${sub.nombre_plan} · $${asignado.toLocaleString('es-MX')}${proxima ? ` · próxima factura ${proxima}` : ' · sin renovación (pago único)'}`,
      metadata: { audit: 'cobro_cotizacion', quote_id: quoteId, subscription_id: sub.id, monto: asignado, proxima_factura: proxima },
    }).select().maybeSingle();
  }

  out.sobrante = restante;

  if (!dry && out.subs.length) {
    // ── El pago deja de ser huérfano ──
    // Siempre se le pone empresa/contacto (sin eso no aparece en el 360 de
    // nadie). El subscription_id solo cuando NO hay ambigüedad: si el dinero se
    // repartió entre dos licencias, apuntarlo a una sola mentiría sobre cuánto
    // cobró esa licencia.
    const unica = out.subs.length === 1 ? out.subs[0] : null;
    for (const p of validos) {
      const upd: any = {};
      if (!p.company_id) upd.company_id = q.company_id;
      if (!p.contact_id && q.contact_id) upd.contact_id = q.contact_id;
      if (unica && !p.subscription_id) {
        upd.subscription_id = unica.id;
        upd.periodo_cubierto = unica.ciclo === 'anual' ? fechaPago.slice(0, 4) : fechaPago.slice(0, 7);
      }
      if (Object.keys(upd).length) await supabase.from('payments').update(upd).eq('id', p.id);
    }
    if (!unica) out.avisos.push('El pago cubrió más de una licencia: queda ligado al cliente, no a una licencia sola.');

    // Sobrante: queda como saldo a favor del recurrente (se descuenta del
    // siguiente cobro). Regalarlo sería cobrarle de más al cliente después.
    if (restante > 0) {
      const rec = out.subs.find(s => s.ciclo !== 'vitalicia') || out.subs[0];
      const previo = Number((ligadas.find((s: any) => s.id === rec.id) || {}).saldo_favor || 0);
      const { error } = await supabase.from('subscriptions')
        .update({ saldo_favor: r2(previo + restante) }).eq('id', rec.id);
      if (!error) out.avisos.push(`Sobraron $${restante.toLocaleString('es-MX')}: quedan como saldo a favor de ${rec.nombre_plan}.`);
    }

    const { recalcCompany } = await import('../../pages/api/crm/arr/subscriptions');
    await recalcCompany(q.company_id);
    await supabase.from('companies').update({ last_payment_at: new Date().toISOString() }).eq('id', q.company_id);
  }

  out.aplicado = out.subs.length > 0;
  if (!out.aplicado && !out.motivo) out.motivo = 'no había ninguna licencia por activar (todas ya tenían pagos)';

  /* ══ EL PASO QUE FALTABA: la cuenta de SACS ══
     Cobrar dejaba al cliente pagado… y su cuenta a la memoria de alguien.
     Aquí se cierra el circuito: si la empresa quedó SIN cuenta ligada, sale
     el pendiente a la campana (con el botón de la ficha como destino); si la
     cuenta ligada venía de prueba, se avisa que hay que activarla. Y se
     intenta abrir el onboarding — que solo abre si el interruptor global
     está encendido; apagado, no pasa nada y no estorba. Best-effort: nada de
     esto puede tumbar un cobro que ya se aplicó. */
  /* `!dry` a propósito: /api/crm/arr/aplicar-cobros trae dry_run en TRUE por
     omisión y recorre hasta 500 cotizaciones. Sin este candado, una simple
     «vista previa» insertaba una alerta por empresa y abría casos de
     onboarding de verdad — en una función cuyo contrato dice que simula sin
     escribir nada. */
  if (out.aplicado && !dry && q.company_id) {
    try {
      const { data: liga } = await supabase.from('company_sacs_accounts').select('cuenta').eq('company_id', q.company_id).limit(1);
      const { data: co2 } = await supabase.from('companies').select('nombre, nombre_comercial, sacs_account').eq('id', q.company_id).maybeSingle();
      const cuenta = liga?.[0]?.cuenta || co2?.sacs_account || null;
      const nombreCo = co2?.nombre_comercial || co2?.nombre || 'el cliente';
      if (!cuenta) {
        /* Por `notificar()` y con CLAVE: reintentar un alta que falla tres
           veces dejaba tres campanadas idénticas, y si el insert fallaba el
           «pendiente que no muere» moría sin ruido. */
        await notificar({
          clave: `onb-sin-cuenta:${q.company_id}`,
          tipo: 'onboarding_sin_cuenta', nivel: 'alerta', destino: 'clientes', company_id: q.company_id,
          titulo: `${nombreCo} ya pagó y no tiene cuenta de SACS`,
          detalle: 'Crear la cuenta (o ligar la que ya exista) es el paso obligatorio al ganar un cliente. Se hace desde su ficha, botón «Cuenta SACS».',
          metadata: { quote_id: q.id },
        });
        out.avisos.push('El cliente no tiene cuenta de SACS ligada: quedó el pendiente en la campana.');
      } else {
        const { data: enPrueba } = await supabase.from('contacts').select('id')
          .eq('company_id', q.company_id).eq('prueba_cuenta', cuenta)
          .neq('prueba_estado', 'convertida').not('prueba_estado', 'is', null).limit(1);
        if (enPrueba?.length) {
          await notificar({
            clave: `onb-activar:${q.company_id}:${cuenta}`,
            tipo: 'onboarding_activar_pendiente', nivel: 'alerta', destino: 'clientes', company_id: q.company_id,
            titulo: `${nombreCo} pagó y su cuenta sigue marcada como prueba`,
            detalle: `Actívala desde su ficha para que quede indefinida: mientras tanto, el vencimiento de la prueba sigue corriendo sobre «${cuenta}».`,
            metadata: { cuenta, quote_id: q.id },
          });
          out.avisos.push('Su cuenta sigue marcada como prueba: actívala desde la ficha.');
        }
        const { abrirOnboardingSiAplica } = await import('./onboarding.lib');
        await abrirOnboardingSiAplica(q.company_id, { quien: 'cobro de cotización' });
      }
    } catch { /* el cobro ya está aplicado; el pendiente saldrá en el barrido */ }
  }
  return out;
}

/**
 * El cierre COMPLETO de una cotización pagada, en un solo lugar.
 *
 * Marcar pagada podía pasar por cuatro puertas distintas (el botón "Cobrar",
 * registrar un abono que completa el total, el webhook de Stripe y el PUT de la
 * cotización) y solo UNA de ellas cerraba la oportunidad. Las otras tres
 * dejaban la venta cobrada sin cliente, sin licencia y sin fecha de renovación.
 *
 * Los tres pasos, en orden, y ninguno puede tumbar al cobro:
 *   1. La oportunidad queda GANADA con la fecha real del pago.
 *   2. Se materializa: cliente + suscripción del recurrente + pago único.
 *   3. Se aplica el dinero: la licencia queda ACTIVA con su próxima factura.
 */
export async function cerrarCotizacionPagada(
  quoteId: string,
  opts: { actor?: string; closed_at?: string } = {},
): Promise<{ deal_id?: string | null; cierre?: any; cobro?: ResultadoCobro; error?: string }> {
  try {
    const { data: q } = await supabase.from('quotes')
      .select('id, total, pagado_fecha, deal_id').eq('id', quoteId).maybeSingle();
    const { syncQuoteToDeal } = await import('./sync-quote-deal');
    const r = await syncQuoteToDeal(quoteId, {
      targetStage: 'cerrada_ganada',
      valor_total: Math.round(Number(q?.total || 0)),
      trigger: 'quote_paid',
      closed_at: opts.closed_at || q?.pagado_fecha || new Date().toISOString(),
    });

    let cierre: any = null;
    if (r.dealId) {
      const { data: deal } = await supabase.from('deals').select('*').eq('id', r.dealId).maybeSingle();
      if (deal) {
        const { materializarDealGanado } = await import('./deal-cierre');
        cierre = await materializarDealGanado(deal);
      }
    }

    const cobro = await aplicarCobroDeCotizacion(quoteId, { actor: opts.actor });
    return { deal_id: r.dealId, cierre: { ...(cierre || {}), deal_id: r.dealId, oportunidad_creada: r.created }, cobro };
  } catch (e: any) {
    console.error('[cobro-cotizacion] cierre:', e?.message || e);
    return { error: String(e?.message || e) };
  }
}
