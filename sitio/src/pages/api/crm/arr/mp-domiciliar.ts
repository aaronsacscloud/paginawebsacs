// POST /api/crm/arr/mp-domiciliar { subscription_id, payer_email?, forzar_nuevo? }
//
// Crea la DOMICILIACIÓN en Mercado Pago desde el CRM: el cliente autoriza una
// vez y a partir de ahí se le cobra solo cada mes. Es lo contrario del link de
// `cobrar-mercadopago`, que cobra UN periodo y hay que volver a mandarlo.
//
// Por qué importa que se cree desde aquí y no en el panel de Mercado Pago: la
// que se crea allá nace huérfana —sin `external_reference`— y hay que acordarse
// de venir a vincularla a mano. Las 7 que están cobrándose sin vincular nacieron
// así. Creada desde el CRM lleva `sub:<id>` desde el primer cobro.
//
// Lo que NO hace: cobrar. Devuelve el link que el cliente tiene que autorizar
// con su propia cuenta de Mercado Pago. Nadie puede domiciliarle una tarjeta a
// otro sin que ese otro lo apruebe, y así debe ser.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { conexionActiva, mpFetch } from '../../../../lib/pagos/mercadopago';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const subId = b?.subscription_id;
  if (!subId) return json({ error: 'subscription_id requerido' }, 400);

  let cx;
  try { cx = await conexionActiva(); }
  catch (e: any) { return json({ error: e?.message || String(e) }, 500); }
  if (!cx) return json({ error: 'Conecta tu cuenta de Mercado Pago en Sistema → Cobro con Mercado Pago.' }, 400);

  const { data: sub } = await supabase.from('subscriptions')
    .select('id, nombre_plan, ciclo, estado, precio, proxima_factura, company_id, mp_preapproval_id, mp_domiciliacion_link, mp_domiciliacion_at, companies(nombre, sacs_account), contacts(nombre, email)')
    .eq('id', subId).maybeSingle();
  if (!sub) return json({ error: 'Suscripción no encontrada' }, 404);
  if (sub.estado === 'cancelada') return json({ error: 'Esa suscripción está cancelada.' }, 400);
  if (sub.estado === 'pausada') return json({ error: 'Esa licencia está pausada — reactívala antes de domiciliarla.' }, 400);
  // Domiciliar una vitalicia no tiene sentido: es un pago único que no renueva.
  if (sub.ciclo === 'vitalicia') return json({ error: 'Una licencia vitalicia es un pago único: no se domicilia.' }, 400);
  if (sub.mp_preapproval_id && !b?.forzar_nuevo) {
    return json({ error: 'Esa suscripción ya está vinculada a una domiciliación de Mercado Pago. Sepárala primero si quieres crear otra.' }, 409);
  }

  const precio = Number(sub.precio) || 0;
  if (precio <= 0) return json({ error: 'La suscripción no tiene precio.' }, 400);

  const contacto: any = Array.isArray(sub.contacts) ? sub.contacts[0] : sub.contacts;
  const correo = String(b?.payer_email || contacto?.email || '').trim();
  // Mercado Pago exige a QUIÉN se le va a cobrar. Sin correo el link se puede
  // crear pero lo autoriza cualquiera que lo abra, y entonces se estaría
  // domiciliando la tarjeta de quien no es.
  if (!correo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    return json({ error: 'Falta el correo del cliente con el que paga en Mercado Pago. Captúralo en su contacto o escríbelo aquí.' }, 400);
  }

  // Reusar el link vigente: si cada clic creara otra domiciliación, el cliente
  // podría autorizar dos y terminar con doble cargo mensual.
  if (!b?.forzar_nuevo && sub.mp_domiciliacion_link && sub.mp_domiciliacion_at) {
    const dias = (Date.now() - new Date(sub.mp_domiciliacion_at).getTime()) / 86400000;
    if (dias < 30) return json({ ok: true, reusado: true, link: sub.mp_domiciliacion_link, modo: cx.modo });
  }

  const empresa: any = Array.isArray(sub.companies) ? sub.companies[0] : sub.companies;
  const origen = new URL(request.url).origin;
  const anual = sub.ciclo === 'anual';

  try {
    const pre = await mpFetch('/preapproval', {
      method: 'POST',
      body: JSON.stringify({
        reason: `${sub.nombre_plan} · ${empresa?.sacs_account || empresa?.nombre || 'SACS'}`.slice(0, 255),
        // La referencia es lo que hace que el PRIMER cobro ya llegue
        // identificado, sin depender de que alguien venga a vincular después.
        external_reference: `sub:${sub.id}`,
        payer_email: correo,
        back_url: origen + '/gracias',
        auto_recurring: {
          frequency: anual ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: precio,
          currency_id: 'MXN',
          // Arranca cuando toca la próxima factura, no hoy: si no, al autorizar
          // se le cobra de inmediato un periodo que quizá ya pagó.
          ...(sub.proxima_factura && Date.parse(sub.proxima_factura) > Date.now()
            ? { start_date: new Date(sub.proxima_factura + 'T12:00:00.000Z').toISOString() }
            : {}),
        },
        // `pending` = esperando que el cliente la autorice. `authorized` exigiría
        // un token de tarjeta, que solo se puede generar con la tarjeta enfrente.
        status: 'pending',
      }),
    }, cx);

    const link = pre?.init_point || pre?.sandbox_init_point;
    if (!pre?.id || !link) return json({ error: 'Mercado Pago no devolvió el link de la domiciliación.' }, 502);

    await supabase.from('subscriptions').update({
      mp_preapproval_id: String(pre.id),
      mp_payer_email: correo,
      mp_domiciliacion_link: link,
      mp_domiciliacion_at: new Date().toISOString(),
      pasarela_cobro: 'mercadopago',
      updated_at: new Date().toISOString(),
    }).eq('id', sub.id);

    await supabase.from('activities').insert({
      tipo: 'sistema', company_id: sub.company_id, automatico: true,
      titulo: `Domiciliación creada en Mercado Pago: ${sub.nombre_plan} · $${precio.toLocaleString('es-MX')}/${anual ? 'año' : 'mes'}`,
      descripcion: `Falta que ${correo} la autorice. Hasta entonces no se le cobra nada.`,
      metadata: { audit: 'mp_domiciliacion', subscription_id: sub.id, mp_preapproval_id: pre.id },
    }).select().maybeSingle();

    return json({
      ok: true, link, mp_preapproval_id: pre.id, correo, monto: precio,
      ciclo: sub.ciclo, modo: cx.modo,
      arranca: sub.proxima_factura || 'al autorizar',
    });
  } catch (e: any) {
    return json({ error: 'Mercado Pago rechazó la domiciliación: ' + (e?.message || e) }, 502);
  }
};
