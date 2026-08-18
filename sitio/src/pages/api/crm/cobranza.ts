// Cobranza: solo lo que está pendiente de cobro.
//
// GET  → vencidas separadas por ciclo, tramos de atraso, planes de pago y lo
//        recuperado del mes.
// POST → crea un plan de parcialidades para una anualidad.
// PUT  → registra la gestión (contactado, promesa de pago) o cobra una
//        exhibición.
//
// Dos verdades que gobiernan los montos:
//
//  · En una MENSUAL la deuda se acumula. Una cuenta con nueve meses vencidos no
//    debe una mensualidad: debe nueve. Mostrar el precio del plan como si fuera
//    la deuda es cobrar mal y quedarse corto por $8,100.
//  · Cuando hay PLAN DE PAGOS, la deuda es la exhibición vencida, no la
//    anualidad completa. Reclamar el total de algo que ya se acordó partir es
//    la forma más rápida de perder la conversación.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hoy = () => new Date().toISOString().slice(0, 10);
const num = (x: any) => Number(x || 0);
const dias = (f: string) => Math.floor((Date.parse(hoy()) - Date.parse(String(f).slice(0, 10))) / 86400000);

export const GET: APIRoute = async () => {
  const [subsQ, compQ, cobrosQ, pagosQ] = await Promise.all([
    supabase.from('subscriptions')
      .select('id, company_id, nombre_plan, ciclo, precio, monto_proximo, proxima_factura, estado, total_pagado, pagos_realizados, mp_link_pago, cobranza_estado, cobranza_promesa, cobranza_nota')
      .in('estado', ['activa', 'pendiente_pago']),
    supabase.from('companies').select('id, nombre, nombre_comercial, sacs_account, dias_sin_venta, ultima_venta_at').is('archived_at', null),
    supabase.from('cobros_programados').select('*').neq('estado', 'cancelada').order('numero'),
    supabase.from('payments').select('monto, fecha, subscription_id').gte('fecha', hoy().slice(0, 8) + '01').neq('estado', 'reembolsado'),
  ]);

  const empresas = Object.fromEntries((compQ.data || []).map((c: any) => [c.id, c]));
  const cobros = cobrosQ.data || [];
  const porSub: Record<string, any[]> = {};
  cobros.forEach((c: any) => { (porSub[c.subscription_id] = porSub[c.subscription_id] || []).push(c); });

  const filas = (subsQ.data || [])
    .filter((s: any) => s.ciclo !== 'vitalicia' && s.proxima_factura)
    .map((s: any) => {
      const co = empresas[s.company_id] || {};
      const plan = (porSub[s.id] || []).sort((a: any, b: any) => a.numero - b.numero);
      const precio = num(s.monto_proximo ?? s.precio);

      // Con plan, la deuda es la exhibición vencida más vieja; sin plan, el
      // cargo del periodo (y en mensual, todos los periodos acumulados).
      let deuda = 0, vence: string | null = null, detalle = '', exhibicion: any = null;
      if (plan.length) {
        const pend = plan.filter((x: any) => x.estado === 'pendiente');
        const vencida = pend.find((x: any) => String(x.fecha) < hoy());
        exhibicion = vencida || pend[0] || null;
        deuda = exhibicion ? num(exhibicion.monto) : 0;
        vence = exhibicion?.fecha || null;
        detalle = exhibicion ? `exhibición ${exhibicion.numero} de ${exhibicion.total}` : 'plan liquidado';
      } else {
        vence = String(s.proxima_factura).slice(0, 10);
        const d = dias(vence);
        if (s.ciclo === 'mensual' && d > 0) {
          const meses = Math.floor(d / 30) + 1;
          deuda = precio * meses;
          detalle = meses > 1 ? `${meses} meses × ${Math.round(precio).toLocaleString('es-MX')}` : '1 mes';
        } else {
          deuda = precio;
          detalle = '';
        }
      }

      const d = vence ? dias(vence) : 0;
      return {
        id: s.id, company_id: s.company_id,
        cliente: co.nombre_comercial || co.nombre || 'Cuenta', cuenta: co.sacs_account || null,
        plan: s.nombre_plan, ciclo: s.ciclo, vence, dias: d, deuda: Math.round(deuda), detalle,
        precio: Math.round(precio), pagado: Math.round(num(s.total_pagado)), pagos: num(s.pagos_realizados),
        link: s.mp_link_pago || null,
        gestion: s.cobranza_estado || 'sin_contactar', promesa: s.cobranza_promesa, nota: s.cobranza_nota,
        dias_sin_venta: co.dias_sin_venta ?? null,
        // La señal de uso cambia la conversación: si sigue operando hay con qué
        // cobrar; si ya no usa el sistema, esto no es cobranza, es una baja.
        senal: co.dias_sin_venta == null ? null : co.dias_sin_venta <= 2 ? 'vendiendo' : co.dias_sin_venta <= 10 ? 'tibia' : 'sin vender',
        plan_pagos: plan.map((x: any) => ({ id: x.id, numero: x.numero, total: x.total, fecha: x.fecha, monto: Math.round(num(x.monto)), estado: x.estado, link: x.link_pago })),
        exhibicion_id: exhibicion?.id || null,
      };
    });

  const vencidas = filas.filter((f: any) => f.dias > 0 && f.deuda > 0);
  const porVencer = filas.filter((f: any) => f.dias <= 0 && f.dias >= -30 && f.deuda > 0);
  const tramo = (a: number, b: number) => vencidas.filter((f: any) => f.dias >= a && f.dias <= b);
  const suma = (a: any[]) => Math.round(a.reduce((x: number, f: any) => x + f.deuda, 0));

  const recuperado = (pagosQ.data || []).reduce((a: number, p: any) => a + num(p.monto), 0);
  const conPlan = filas.filter((f: any) => f.plan_pagos.length);

  return json({
    kpis: {
      por_cobrar: suma(vencidas), cuentas: vencidas.length,
      atraso_prom: vencidas.length ? Math.round(vencidas.reduce((a: number, f: any) => a + f.dias, 0) / vencidas.length) : 0,
      atraso_max: vencidas.length ? Math.max(...vencidas.map((f: any) => f.dias)) : 0,
      en_parcialidades: Math.round(conPlan.reduce((a: number, f: any) => a + f.plan_pagos.filter((x: any) => x.estado === 'pendiente').reduce((y: number, x: any) => y + x.monto, 0), 0)),
      planes: conPlan.length,
      exhibiciones_pendientes: conPlan.reduce((a: number, f: any) => a + f.plan_pagos.filter((x: any) => x.estado === 'pendiente').length, 0),
      recuperado: Math.round(recuperado),
      promesas: vencidas.filter((f: any) => f.gestion === 'promesa').length,
      promesas_monto: suma(vencidas.filter((f: any) => f.gestion === 'promesa')),
    },
    tramos: [
      { k: '+90 días', a: 91, b: 99999, monto: suma(tramo(91, 99999)), n: tramo(91, 99999).length },
      { k: '31 a 90', a: 31, b: 90, monto: suma(tramo(31, 90)), n: tramo(31, 90).length },
      { k: '8 a 30 días', a: 8, b: 30, monto: suma(tramo(8, 30)), n: tramo(8, 30).length },
      { k: '1 a 7 días', a: 1, b: 7, monto: suma(tramo(1, 7)), n: tramo(1, 7).length },
    ],
    // La más vieja primero: es la que más cuesta y la que menos se cobra sola.
    anuales: vencidas.filter((f: any) => f.ciclo === 'anual').sort((a: any, b: any) => b.dias - a.dias),
    mensuales: vencidas.filter((f: any) => f.ciclo === 'mensual').sort((a: any, b: any) => b.dias - a.dias),
    por_vencer: porVencer.sort((a: any, b: any) => a.dias - b.dias),
    con_plan: conPlan,
  });
};

// ── Crear el plan de parcialidades ──────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const subId = String(b?.subscription_id || '');
  const n = Math.max(2, Math.min(24, Number(b?.exhibiciones) || 0));
  const inicio = String(b?.primera || '').slice(0, 10);
  const cada = b?.cada === 'quincena' ? 15 : 30;
  const montos: number[] = Array.isArray(b?.montos) ? b.montos.map(Number) : [];
  if (!subId || !n || !inicio) return json({ error: 'Falta la suscripción, el número de exhibiciones o la primera fecha.' }, 400);

  const { data: sub } = await supabase.from('subscriptions').select('id, company_id, monto_proximo, precio, ciclo').eq('id', subId).maybeSingle();
  if (!sub) return json({ error: 'Esa suscripción ya no existe.' }, 404);

  const total = num(b?.total) || num(sub.monto_proximo ?? sub.precio);
  // Reparto igual con el sobrante en la PRIMERA: si se deja en la última, el
  // cliente ve un pago distinto justo al final y llama a preguntar por qué.
  const base = Math.floor(total / n);
  const filas = Array.from({ length: n }, (_, i) => {
    const f = new Date(inicio + 'T12:00:00');
    f.setDate(f.getDate() + cada * i);
    return {
      subscription_id: subId, company_id: sub.company_id,
      numero: i + 1, total: n, fecha: f.toISOString().slice(0, 10),
      monto: montos[i] != null ? montos[i] : (i === 0 ? total - base * (n - 1) : base),
      estado: 'pendiente',
    };
  });

  // Un plan nuevo reemplaza al anterior: dos planes vivos sobre la misma
  // suscripción harían que la deuda se cuente dos veces.
  await supabase.from('cobros_programados').delete().eq('subscription_id', subId).eq('estado', 'pendiente');
  const { data, error } = await supabase.from('cobros_programados').insert(filas).select();
  if (error) return json({ error: error.message }, 500);
  await supabase.from('subscriptions').update({ cobranza_estado: 'plan_pagos', cobranza_at: new Date().toISOString() }).eq('id', subId);
  return json({ ok: true, plan: data }, 201);
};

// ── Gestión: contactado, promesa de pago, o marcar una exhibición pagada ────
export const PUT: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));

  if (b?.exhibicion_id) {
    const { error } = await supabase.from('cobros_programados')
      .update({ estado: 'pagada', pago_id: b.pago_id || null, updated_at: new Date().toISOString() })
      .eq('id', b.exhibicion_id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  const subId = String(b?.subscription_id || '');
  if (!subId) return json({ error: 'Falta la suscripción.' }, 400);
  const p: any = { cobranza_at: new Date().toISOString() };
  if (['sin_contactar', 'contactado', 'promesa', 'negociando', 'incobrable', 'plan_pagos'].includes(b?.estado)) p.cobranza_estado = b.estado;
  if ('promesa' in b) p.cobranza_promesa = b.promesa || null;
  if ('nota' in b) p.cobranza_nota = String(b.nota || '').slice(0, 500) || null;
  const { error } = await supabase.from('subscriptions').update(p).eq('id', subId);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
