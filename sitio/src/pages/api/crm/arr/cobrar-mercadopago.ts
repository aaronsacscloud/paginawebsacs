// POST /api/crm/arr/cobrar-mercadopago { subscription_id, forzar_nuevo? }
//
// Genera el link de cobro del periodo que toca y lo guarda en la suscripción.
// Acepta tarjeta, OXXO y transferencia — por eso es el camino que sirve para
// TODOS los clientes, no solo para quien acepte domiciliar.
//
// La referencia `sub:<id>:<periodo>` es lo único que amarra el pago con la
// suscripción cuando Mercado Pago avisa. Sin ella el webhook recibe un pago que
// no sabe de quién es y termina en la bandeja para que alguien lo asigne a mano.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { conexionActiva, mpFetch } from '../../../../lib/pagos/mercadopago';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Los links no viven para siempre: uno de hace seis meses con el monto viejo,
// reenviado por error, cobra lo que no es.
const VIGENCIA_DIAS = 30;

export const POST: APIRoute = async ({ request, url }) => {
  const b = await request.json().catch(() => ({} as any));
  const subId = b?.subscription_id;
  if (!subId) return json({ error: 'subscription_id requerido' }, 400);

  let cx;
  try { cx = await conexionActiva(); }
  catch (e: any) { return json({ error: e?.message || String(e) }, 500); }
  if (!cx) return json({ error: 'Conecta tu cuenta de Mercado Pago en Sistema → Cobro con Mercado Pago.' }, 400);

  const { data: sub, error } = await supabase.from('subscriptions')
    .select('id, nombre_plan, ciclo, estado, precio, monto_proximo, proxima_factura, company_id, contact_id, mp_link_pago, mp_link_periodo, mp_link_at, companies(nombre, sacs_account), contacts(nombre, email)')
    .eq('id', subId).maybeSingle();
  if (error || !sub) return json({ error: 'Suscripción no encontrada' }, 404);
  if (sub.estado === 'cancelada') return json({ error: 'Esa suscripción está cancelada.' }, 400);
  if (sub.estado === 'pausada') return json({ error: 'Esa licencia está pausada — reactívala antes de cobrarle.' }, 400);

  const monto = Number(sub.monto_proximo ?? sub.precio) || 0;
  if (monto <= 0) return json({ error: 'La suscripción no tiene un monto por cobrar.' }, 400);

  // El periodo es la factura que se está cobrando. Sirve para no generar dos
  // links del mismo cobro y para que el acuse diga a qué corresponde.
  const periodo = sub.proxima_factura || new Date().toISOString().slice(0, 10);

  // Reusar el link vigente del MISMO periodo: si cada clic generara uno nuevo,
  // el cliente acabaría con tres links del mismo cobro y pagando el que no era.
  if (!b?.forzar_nuevo && sub.mp_link_pago && sub.mp_link_periodo === periodo && sub.mp_link_at) {
    const dias = (Date.now() - new Date(sub.mp_link_at).getTime()) / 86400000;
    if (dias < VIGENCIA_DIAS) {
      return json({ ok: true, reusado: true, link: sub.mp_link_pago, periodo, monto, modo: cx.modo });
    }
  }

  const empresa: any = Array.isArray(sub.companies) ? sub.companies[0] : sub.companies;
  const contacto: any = Array.isArray(sub.contacts) ? sub.contacts[0] : sub.contacts;
  const origen = new URL(request.url).origin;

  try {
    const pref = await mpFetch('/checkout/preferences', {
      method: 'POST',
      body: JSON.stringify({
        items: [{
          title: `${sub.nombre_plan} · ${sub.ciclo}`,
          description: `${empresa?.nombre || empresa?.sacs_account || 'Cliente'} · periodo ${periodo}`,
          quantity: 1, currency_id: 'MXN', unit_price: monto,
        }],
        // Lo que el webhook usa para saber de quién es el pago.
        external_reference: `sub:${sub.id}:${periodo}`,
        payer: contacto?.email ? { email: contacto.email, name: contacto?.nombre || undefined } : undefined,
        // Se manda aunque la app ya tenga webhook configurado: si alguien toca esa
        // config, los cobros ya emitidos siguen avisando.
        notification_url: origen + '/api/revenue/mercadopago-webhook',
        back_urls: { success: origen + '/gracias', pending: origen + '/gracias', failure: origen + '/gracias' },
        statement_descriptor: 'SACSCLOUD',
        expires: true,
        expiration_date_to: new Date(Date.now() + VIGENCIA_DIAS * 86400000).toISOString(),
      }),
    }, cx);

    // En modo prueba MP devuelve `sandbox_init_point`; usar el de producción ahí
    // manda al cliente a pagar de verdad.
    const link = cx.modo === 'prueba' ? (pref.sandbox_init_point || pref.init_point) : pref.init_point;
    if (!link) return json({ error: 'Mercado Pago no devolvió un link de pago.' }, 502);

    await supabase.from('subscriptions').update({
      mp_link_pago: link, mp_link_periodo: periodo, mp_link_at: new Date().toISOString(),
      pasarela_cobro: 'mercadopago', updated_at: new Date().toISOString(),
    }).eq('id', sub.id);

    await supabase.from('activities').insert({
      tipo: 'sistema', company_id: sub.company_id, automatico: true,
      titulo: `Link de cobro generado (${sub.nombre_plan}): $${monto.toLocaleString('es-MX')} · periodo ${periodo}${cx.modo === 'prueba' ? ' · MODO PRUEBA' : ''}`,
      metadata: { audit: 'mp_link', subscription_id: sub.id, preference_id: pref.id, periodo, modo: cx.modo },
    }).select().maybeSingle();

    return json({ ok: true, link, periodo, monto, modo: cx.modo, preference_id: pref.id });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 502);
  }
};
