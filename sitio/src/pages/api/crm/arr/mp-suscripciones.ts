// GET  /api/crm/arr/mp-suscripciones → suscripciones que ya viven en Mercado Pago,
//      con el cliente del CRM que probablemente les corresponde.
// POST /api/crm/arr/mp-suscripciones
//      { subscription_id, mp_preapproval_id, payer_email? }  → vincula
//      { subscription_id, desvincular:true }                 → separa
//      { crear:true, company_id, mp_preapproval_id, ... }    → CREA la que falta y la vincula
//
// Por qué NO se vinculan solas: emparejar mal manda los cobros de un cliente a la
// suscripción de otro, y eso se descubre semanas después cuando a uno le cobran
// de más y al otro no. Se proponen candidatos con su razón y decide una persona.
//
// Y por qué existe `crear`: Mercado Pago es la verdad de lo que SE ESTÁ COBRANDO,
// el CRM solo de lo que alguien capturó. Cuando cobras algo que nunca se dio de
// alta, no hay con qué vincular — y sin esta salida esa suscripción queda fuera
// del ARR para siempre aunque el dinero esté entrando cada mes.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { conexionActiva, mpFetch } from '../../../../lib/pagos/mercadopago';
import { recalcCompany } from './subscriptions';
import { recordDelta } from '../../../../lib/crm/mrr-ledger';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const norm = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** El correo del pagador NO viene en la suscripción: hay que ir por sus cobros. */
async function correoDelPagador(preapprovalId: string, cx: any): Promise<string | null> {
  try {
    const r = await mpFetch(`/authorized_payments/search?preapproval_id=${preapprovalId}&limit=1`, {}, cx);
    const ap = (r.results || r.elements || [])[0];
    const pid = ap?.payment?.id || ap?.payment_id;
    if (!pid) return null;
    const pago = await mpFetch('/v1/payments/' + pid, {}, cx);
    return pago?.payer?.email || null;
  } catch { return null; }
}

export const GET: APIRoute = async ({ url }) => {
  let cx;
  try { cx = await conexionActiva(); } catch (e: any) { return json({ error: e?.message }, 500); }
  if (!cx) return json({ error: 'Conecta tu cuenta de Mercado Pago primero.' }, 400);

  const soloActivas = url.searchParams.get('todas') !== '1';
  // Buscar desde el detalle de UN cliente: mismo motor, pero solo sus
  // suscripciones como candidatas. Sin esto había que salir a la pantalla
  // general y encontrarlo entre 38.
  const soloEmpresa = url.searchParams.get('company_id') || null;
  let mpSubs: any[] = [];
  try {
    const r = await mpFetch('/preapproval/search?limit=100&sort=date_created:desc', {}, cx);
    mpSubs = r.results || [];
  } catch (e: any) { return json({ error: e?.message || String(e) }, 502); }
  if (soloActivas) mpSubs = mpSubs.filter(p => p.status === 'authorized' || p.status === 'paused' || p.status === 'pending');

  // Suscripciones del CRM candidatas + las ya vinculadas.
  const { data: subs } = await supabase.from('subscriptions')
    .select('id, nombre_plan, ciclo, estado, precio, proxima_factura, mp_preapproval_id, mp_payer_email, company_id, companies(nombre, sacs_account), contacts(email, nombre)')
    .in('estado', ['activa', 'pendiente_pago', 'programada', 'pausada']).range(0, 999);
  const yaLigadas = new Map<string, any>();
  for (const s of subs || []) if (s.mp_preapproval_id) yaLigadas.set(String(s.mp_preapproval_id), s);

  // El correo solo se busca para las que aún no están ligadas: son 3 llamadas a
  // MP por suscripción y no tiene caso repetirlas para las ya resueltas.
  const pendientes = mpSubs.filter(p => !yaLigadas.has(String(p.id)));
  const correos = new Map<string, string | null>();
  const lote = pendientes.slice(0, 25);
  await Promise.all(lote.map(async p => correos.set(String(p.id), await correoDelPagador(String(p.id), cx))));

  // Para poder CREAR la que falta hace falta saber a qué empresa. El correo del
  // pagador identifica a la empresa aunque ninguna de sus suscripciones cuadre:
  // es justo el caso de un cliente al que se le cobra algo que nunca se capturó.
  const { data: empresas } = await supabase.from('companies')
    .select('id, nombre, sacs_account, contacts(email)').is('archived_at', null).range(0, 1999);
  const empresaPorCorreo = new Map<string, any>();
  for (const e of empresas || []) {
    for (const c of (Array.isArray(e.contacts) ? e.contacts : e.contacts ? [e.contacts] : []) as any[]) {
      if (c?.email) empresaPorCorreo.set(norm(c.email), e);
    }
  }

  const salida = mpSubs.map((p: any) => {
    const monto = Number(p.auto_recurring?.transaction_amount || 0);
    const ciclo = p.auto_recurring?.frequency_type === 'years' || p.auto_recurring?.frequency === 12 ? 'anual' : 'mensual';
    const ligada = yaLigadas.get(String(p.id));
    const correo = ligada?.mp_payer_email || correos.get(String(p.id)) || null;

    // Puntaje: el correo manda porque es identidad; el monto y el plan solo
    // acompañan. Nunca se vincula solo, se propone.
    const candidatos = (subs || [])
      .filter((s: any) => !s.mp_preapproval_id && (!soloEmpresa || s.company_id === soloEmpresa))
      .map((s: any) => {
        const ct: any = Array.isArray(s.contacts) ? s.contacts[0] : s.contacts;
        let pts = 0; const porque: string[] = [];
        if (correo && ct?.email && norm(ct.email) === norm(correo)) { pts += 100; porque.push('mismo correo'); }
        if (monto > 0 && Number(s.precio) === monto) { pts += 55; porque.push('mismo monto'); }
        if (s.ciclo === ciclo) { pts += 10; porque.push('mismo ciclo'); }
        const rp = norm(p.reason), np = norm(s.nombre_plan);
        if (rp && np && (np.includes(rp) || rp.includes(np))) { pts += 25; porque.push('plan parecido'); }
        else if (rp && np && ['vende', 'controla', 'fideliza', 'automatiza'].some(k => rp.includes(k) && np.includes(k))) { pts += 18; porque.push('mismo plan'); }
        if (p.next_payment_date && s.proxima_factura) {
          const d = Math.abs((Date.parse(String(p.next_payment_date).slice(0, 10)) - Date.parse(s.proxima_factura)) / 86400000);
          if (d <= 7) { pts += 15; porque.push('renovación en la misma semana'); }
        }
        const co: any = Array.isArray(s.companies) ? s.companies[0] : s.companies;
        return { subscription_id: s.id, cliente: co?.sacs_account || co?.nombre, nombre_plan: s.nombre_plan, ciclo: s.ciclo, precio: Number(s.precio), correo: ct?.email || null, puntos: pts, porque };
      })
      // Desde el detalle de un cliente el umbral baja: ya acotaste tú a quién
      // pertenece, así que un parecido flojo sigue siendo útil. En la lista
      // general 40 filtra el ruido de 130 suscripciones.
      .filter(c => c.puntos >= (soloEmpresa ? 10 : 40))
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, soloEmpresa ? 8 : 4);

    const coL: any = ligada && (Array.isArray(ligada.companies) ? ligada.companies[0] : ligada.companies);
    // Empresa sugerida para dar de alta la que falta: primero por el correo del
    // pagador (identidad), si no la del mejor candidato (ya está emparejado).
    const eC = correo ? empresaPorCorreo.get(norm(correo)) : null;
    const mejor: any = candidatos[0];
    const sug = eC
      ? { company_id: eC.id, cliente: eC.sacs_account || eC.nombre, porque: 'es el cliente de ese correo' }
      : (mejor ? { company_id: (subs || []).find((s: any) => s.id === mejor.subscription_id)?.company_id, cliente: mejor.cliente, porque: mejor.porque.join(', ') } : null);

    return {
      mp_id: p.id, estado_mp: p.status, concepto: p.reason, monto, ciclo,
      correo_pagador: correo,
      desde: p.date_created ? String(p.date_created).slice(0, 10) : null,
      empresa_sugerida: sug?.company_id ? sug : null,
      proximo_cobro: p.next_payment_date ? String(p.next_payment_date).slice(0, 10) : null,
      cobros_hechos: p.summarized?.charged_quantity ?? null,
      total_cobrado: p.summarized?.charged_amount ?? null,
      ultimo_cobro: p.summarized?.last_charged_date ? String(p.summarized.last_charged_date).slice(0, 10) : null,
      vinculada: ligada ? { subscription_id: ligada.id, cliente: coL?.sacs_account || coL?.nombre, nombre_plan: ligada.nombre_plan } : null,
      candidatos,
    };
  }).sort((a, b) => (a.vinculada ? 1 : 0) - (b.vinculada ? 1 : 0) || (b.candidatos[0]?.puntos || 0) - (a.candidatos[0]?.puntos || 0))
    // Buscando desde un cliente, lo que no tiene nada que ver con él es ruido.
    .filter((s: any) => !soloEmpresa || (!s.vinculada && (s.candidatos.length || s.empresa_sugerida?.company_id === soloEmpresa)));

  return json({
    modo: cx.modo, total: salida.length,
    vinculadas: salida.filter(s => s.vinculada).length,
    sin_vincular: salida.filter(s => !s.vinculada).length,
    // Lo que se está cobrando en MP y el CRM no tiene: es ARR real que no se
    // está reportando.
    arr_no_capturado: Math.round(salida
      .filter(s => !s.vinculada && s.estado_mp === 'authorized')
      .reduce((a, s) => a + (s.ciclo === 'anual' ? s.monto : s.monto * 12), 0)),
    empresas: (empresas || []).map((e: any) => ({ id: e.id, nombre: e.sacs_account || e.nombre }))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))),
    data: salida,
  });
};

/** ¿Esa suscripción de MP ya está ligada a otra? Una sola no puede alimentar a
 *  dos clientes: sus cobros se registrarían en el que se ligó primero y el otro
 *  seguiría apareciendo como moroso. */
async function yaOcupada(mpId: string, exceptoSubId?: string) {
  let q = supabase.from('subscriptions').select('id, companies(nombre, sacs_account)').eq('mp_preapproval_id', mpId);
  if (exceptoSubId) q = q.neq('id', exceptoSubId);
  const { data } = await q.maybeSingle();
  if (!data) return null;
  const co: any = Array.isArray(data.companies) ? data.companies[0] : data.companies;
  return co?.sacs_account || co?.nombre || 'otro cliente';
}

/** Vincula una sola. Devuelve el error en texto en vez de lanzar, para que el
 *  lote pueda reportar cuáles sí y cuáles no en vez de morirse en la primera. */
async function vincularUna(subscriptionId: string, mpId: string, payerEmail?: string | null): Promise<string | null> {
  const ocupada = await yaOcupada(mpId, subscriptionId);
  if (ocupada) return `ya está vinculada a ${ocupada}`;
  const { data, error } = await supabase.from('subscriptions').update({
    mp_preapproval_id: mpId, mp_payer_email: payerEmail || null,
    pasarela_cobro: 'mercadopago', updated_at: new Date().toISOString(),
  }).eq('id', subscriptionId).select('id, company_id, nombre_plan').single();
  if (error) return error.message;
  await supabase.from('activities').insert({
    tipo: 'sistema', company_id: data.company_id, automatico: true,
    titulo: `Suscripción vinculada a Mercado Pago (${data.nombre_plan}) · ${mpId}`,
    metadata: { audit: 'mp_vinculo', subscription_id: data.id, mp_preapproval_id: mpId },
  }).select().maybeSingle();
  return null;
}

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));

  // ── Vincular varias de un golpe ──
  // Los empates de 100 puntos (correo idéntico) no merecen un clic cada uno. Se
  // hacen EN SERIE a propósito: en paralelo, dos que apunten a la misma
  // suscripción de MP pasarían las dos el candado de "ya ocupada".
  if (Array.isArray(b?.lote)) {
    const hechas: string[] = []; const fallidas: any[] = [];
    for (const it of b.lote.slice(0, 50)) {
      if (!it?.subscription_id || !it?.mp_preapproval_id) { fallidas.push({ ...it, error: 'faltan datos' }); continue; }
      const err = await vincularUna(String(it.subscription_id), String(it.mp_preapproval_id), it.payer_email);
      if (err) fallidas.push({ mp_preapproval_id: it.mp_preapproval_id, cliente: it.cliente, error: err });
      else hechas.push(String(it.mp_preapproval_id));
    }
    return json({ ok: true, vinculadas: hechas.length, fallidas });
  }

  // ── Alta de la suscripción que se cobra en MP y el CRM no tenía ──
  if (b?.crear) {
    const mpId = String(b?.mp_preapproval_id || '').trim();
    if (!mpId || !b?.company_id) return json({ error: 'mp_preapproval_id y company_id requeridos' }, 400);
    const ocupada = await yaOcupada(mpId);
    if (ocupada) return json({ error: `Esa suscripción de Mercado Pago ya está vinculada a ${ocupada}.` }, 409);

    // Los datos NO se toman del navegador: se releen de Mercado Pago. El front
    // solo dice CUÁL y DE QUIÉN es — el monto y el ciclo los pone quien cobra,
    // que es la única fuente que no puede estar desactualizada.
    let pre: any;
    let cx;
    try {
      cx = await conexionActiva();
      if (!cx) return json({ error: 'Conecta tu cuenta de Mercado Pago primero.' }, 400);
      pre = await mpFetch('/preapproval/' + mpId, {}, cx);
    } catch (e: any) { return json({ error: 'No se pudo leer esa suscripción en Mercado Pago: ' + (e?.message || e) }, 502); }
    if (!pre?.id) return json({ error: 'Mercado Pago no encontró esa suscripción.' }, 404);

    const precio = Number(pre.auto_recurring?.transaction_amount || 0);
    if (!(precio > 0)) return json({ error: 'Esa suscripción de Mercado Pago no tiene monto: no se puede dar de alta.' }, 400);
    const ciclo = pre.auto_recurring?.frequency_type === 'years' || pre.auto_recurring?.frequency === 12 ? 'anual' : 'mensual';
    const mrr = ciclo === 'anual' ? precio / 12 : precio;
    // El estado sale del de MP: `authorized` es dinero entrando hoy, y ponerla
    // en cualquier otro estado dejaría fuera del ARR algo que sí se está cobrando.
    const estado = pre.status === 'authorized' ? 'activa' : pre.status === 'paused' ? 'pausada' : 'programada';

    const correo = b?.payer_email || await correoDelPagador(mpId, cx);
    // Se liga al contacto de ese correo si ya existe en el cliente; si no, el
    // correo queda en la suscripción y no se inventa un contacto.
    let contactId: string | null = null;
    if (correo) {
      const { data: ct } = await supabase.from('contacts').select('id')
        .eq('company_id', b.company_id).ilike('email', correo).limit(1).maybeSingle();
      contactId = ct?.id || null;
    }

    const cobros = pre.summarized?.charged_quantity ?? null;
    const cobrado = pre.summarized?.charged_amount ?? null;
    const { data: sub, error } = await supabase.from('subscriptions').insert({
      company_id: b.company_id, contact_id: contactId,
      nombre_plan: String(b?.nombre_plan || pre.reason || 'Suscripción Mercado Pago').slice(0, 160),
      ciclo, estado, precio,
      mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100,
      monto_proximo: precio,
      fecha_inicio: pre.date_created ? String(pre.date_created).slice(0, 10) : null,
      proxima_factura: pre.next_payment_date ? String(pre.next_payment_date).slice(0, 10) : null,
      pasarela_cobro: 'mercadopago', mp_preapproval_id: mpId, mp_payer_email: correo || null,
      // El historial se deja ESCRITO pero no se cargan pagos falsos: importar
      // los cobros viejos es otra cosa (conciliación), y unos contadores
      // inflados aquí no cuadrarían nunca contra la tabla de pagos.
      notas: `Alta desde Mercado Pago (${mpId}). Ya se venía cobrando allá${pre.date_created ? ' desde ' + String(pre.date_created).slice(0, 10) : ''}`
        + (cobros ? `: ${cobros} cobros por $${Number(cobrado || 0).toLocaleString('es-MX')}` : '') + '.',
    }).select('id, company_id, nombre_plan, estado, mrr, precio, ciclo').single();
    if (error) return json({ error: error.message }, 500);

    await recalcCompany(sub.company_id);
    await recordDelta({
      subscription_id: sub.id, company_id: sub.company_id,
      mrr_anterior: 0, mrr_nuevo: sub.estado === 'activa' || sub.estado === 'pendiente_pago' ? Number(sub.mrr || 0) : 0,
      motivo: 'alta desde Mercado Pago (ya se cobraba)', actor: 'admin',
    });
    await supabase.from('activities').insert({
      tipo: 'sistema', company_id: sub.company_id, automatico: true,
      titulo: `Suscripción dada de alta desde Mercado Pago: ${sub.nombre_plan} · $${precio.toLocaleString('es-MX')}/${ciclo === 'anual' ? 'año' : 'mes'}`,
      metadata: { audit: 'mp_alta', subscription_id: sub.id, mp_preapproval_id: mpId },
    }).select().maybeSingle();

    return json({ ok: true, creada: true, subscription_id: sub.id, estado: sub.estado, precio, ciclo });
  }

  if (!b?.subscription_id) return json({ error: 'subscription_id requerido' }, 400);

  if (b.desvincular) {
    const { error } = await supabase.from('subscriptions')
      .update({ mp_preapproval_id: null, mp_payer_email: null, updated_at: new Date().toISOString() })
      .eq('id', b.subscription_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true, desvinculada: true });
  }

  const mpId = String(b?.mp_preapproval_id || '').trim();
  if (!mpId) return json({ error: 'mp_preapproval_id requerido' }, 400);

  const err = await vincularUna(String(b.subscription_id), mpId, b?.payer_email);
  if (err) return json({ error: err.startsWith('ya está vinculada') ? `Esa suscripción de Mercado Pago ${err}. Desvincúlala de allá primero.` : err }, err.startsWith('ya está') ? 409 : 500);
  return json({ ok: true, vinculada: true });
};
