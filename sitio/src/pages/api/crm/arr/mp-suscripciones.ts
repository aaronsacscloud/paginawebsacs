// GET  /api/crm/arr/mp-suscripciones → suscripciones que ya viven en Mercado Pago,
//      con el cliente del CRM que probablemente les corresponde.
// POST /api/crm/arr/mp-suscripciones { subscription_id, mp_preapproval_id, payer_email? }
//      → las vincula.  { subscription_id, desvincular:true } → las separa.
//
// Por qué NO se vinculan solas: emparejar mal manda los cobros de un cliente a la
// suscripción de otro, y eso se descubre semanas después cuando a uno le cobran
// de más y al otro no. Se proponen candidatos con su razón y decide una persona.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { conexionActiva, mpFetch } from '../../../../lib/pagos/mercadopago';

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

  const salida = mpSubs.map((p: any) => {
    const monto = Number(p.auto_recurring?.transaction_amount || 0);
    const ciclo = p.auto_recurring?.frequency_type === 'years' || p.auto_recurring?.frequency === 12 ? 'anual' : 'mensual';
    const ligada = yaLigadas.get(String(p.id));
    const correo = ligada?.mp_payer_email || correos.get(String(p.id)) || null;

    // Puntaje: el correo manda porque es identidad; el monto y el plan solo
    // acompañan. Nunca se vincula solo, se propone.
    const candidatos = (subs || [])
      .filter((s: any) => !s.mp_preapproval_id)
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
      .filter(c => c.puntos >= 40)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, 4);

    const coL: any = ligada && (Array.isArray(ligada.companies) ? ligada.companies[0] : ligada.companies);
    return {
      mp_id: p.id, estado_mp: p.status, concepto: p.reason, monto, ciclo,
      correo_pagador: correo,
      proximo_cobro: p.next_payment_date ? String(p.next_payment_date).slice(0, 10) : null,
      cobros_hechos: p.summarized?.charged_quantity ?? null,
      total_cobrado: p.summarized?.charged_amount ?? null,
      ultimo_cobro: p.summarized?.last_charged_date ? String(p.summarized.last_charged_date).slice(0, 10) : null,
      vinculada: ligada ? { subscription_id: ligada.id, cliente: coL?.sacs_account || coL?.nombre, nombre_plan: ligada.nombre_plan } : null,
      candidatos,
    };
  }).sort((a, b) => (a.vinculada ? 1 : 0) - (b.vinculada ? 1 : 0) || (b.candidatos[0]?.puntos || 0) - (a.candidatos[0]?.puntos || 0));

  return json({
    modo: cx.modo, total: salida.length,
    vinculadas: salida.filter(s => s.vinculada).length,
    sin_vincular: salida.filter(s => !s.vinculada).length,
    data: salida,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.subscription_id) return json({ error: 'subscription_id requerido' }, 400);

  if (b.desvincular) {
    const { error } = await supabase.from('subscriptions')
      .update({ mp_preapproval_id: null, mp_payer_email: null, updated_at: new Date().toISOString() })
      .eq('id', b.subscription_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true, desvinculada: true });
  }

  const mpId = String(b?.mp_preapproval_id || '').trim();
  if (!mpId) return json({ error: 'mp_preapproval_id requerido' }, 400);

  // Una suscripción de MP no puede alimentar a dos clientes: si no, sus cobros
  // se registrarían en el que se ligó primero y el otro seguiría apareciendo
  // como moroso.
  const { data: ocupada } = await supabase.from('subscriptions')
    .select('id, companies(nombre, sacs_account)').eq('mp_preapproval_id', mpId).neq('id', b.subscription_id).maybeSingle();
  if (ocupada) {
    const co: any = Array.isArray(ocupada.companies) ? ocupada.companies[0] : ocupada.companies;
    return json({ error: `Esa suscripción de Mercado Pago ya está vinculada a ${co?.sacs_account || co?.nombre}. Desvincúlala de allá primero.` }, 409);
  }

  const { data, error } = await supabase.from('subscriptions').update({
    mp_preapproval_id: mpId, mp_payer_email: b?.payer_email || null,
    pasarela_cobro: 'mercadopago', updated_at: new Date().toISOString(),
  }).eq('id', b.subscription_id).select('id, company_id, nombre_plan').single();
  if (error) return json({ error: error.message }, 500);

  await supabase.from('activities').insert({
    tipo: 'sistema', company_id: data.company_id, automatico: true,
    titulo: `Suscripción vinculada a Mercado Pago (${data.nombre_plan}) · ${mpId}`,
    metadata: { audit: 'mp_vinculo', subscription_id: data.id, mp_preapproval_id: mpId },
  }).select().maybeSingle();

  return json({ ok: true, vinculada: true });
};
