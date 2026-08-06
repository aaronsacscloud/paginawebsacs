// GET  /api/crm/arr/mp-cobros → cobros de Mercado Pago que no terminaron en un
//      pago registrado: los que nadie pudo atribuir y los que rebotaron.
// POST { id, subscription_id }   → acredita ese pago a esa suscripción
// POST { id, descartar:true, nota? } → lo saca de la bandeja sin acreditarlo
//
// Un pago aprobado que el sistema no supo de quién era es lo peor que puede
// pasar en cobranza: el dinero ya está en la cuenta y el cliente aparece como
// moroso. Solo una persona puede resolverlo, así que lo importante es que la
// lista exista y que asignar cueste un clic.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { POST as registrarPago } from './register-payment';
import { conexionActiva, mpFetch } from '../../../../lib/pagos/mercadopago';
import { anotarCobro } from '../../../../lib/pagos/cobros-mp';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const norm = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Rastrea en Mercado Pago los cobros que el CRM nunca vio y los mete a la
 * bandeja. El webhook solo se entera de lo que pasa a partir de hoy; todo lo
 * cobrado ANTES de conectar la pasarela es invisible, y ahí es justo donde
 * están los pagos sueltos de clientes viejos.
 */
async function escanear(dias: number): Promise<{ revisados: number; nuevos: number; propios: number; error?: string }> {
  let cx;
  try { cx = await conexionActiva(); } catch (e: any) { return { revisados: 0, nuevos: 0, propios: 0, error: e?.message }; }
  if (!cx) return { revisados: 0, nuevos: 0, propios: 0, error: 'Conecta tu cuenta de Mercado Pago primero.' };

  const { data: px } = await supabase.from('crm_pasarelas').select('mp_user_id').eq('pasarela', 'mercadopago').maybeSingle();
  const nuestro = String(px?.mp_user_id || '');
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  let pagos: any[] = [];
  try {
    for (let offset = 0; offset < 1000; offset += 50) {
      const r = await mpFetch(`/v1/payments/search?sort=date_created&criteria=desc&limit=50&offset=${offset}`
        + `&range=date_created&begin_date=${encodeURIComponent(desde)}&end_date=NOW`, {}, cx);
      const rs = r.results || [];
      pagos = pagos.concat(rs);
      if (rs.length < 50 || pagos.length >= (r.paging?.total || 0)) break;
    }
  } catch (e: any) { return { revisados: 0, nuevos: 0, propios: 0, error: 'Mercado Pago: ' + (e?.message || e) }; }

  // Solo los COBROS. La misma cuenta se usa para pagar cosas, y meter el súper
  // en la bandeja de pendientes la vuelve inservible.
  const cobros = pagos.filter(p => p.status === 'approved'
    && (!nuestro || p.collector_id == null || String(p.collector_id) === nuestro));
  const propios = pagos.length - cobros.length;

  // Lo que ya está registrado o ya se anotó no se vuelve a meter.
  const ids = cobros.map(p => String(p.id));
  const [{ data: yaPagos }, { data: yaBitacora }] = await Promise.all([
    supabase.from('payments').select('mp_payment_id').in('mp_payment_id', ids),
    supabase.from('crm_cobros_mp').select('mp_payment_id').in('mp_payment_id', ids),
  ]);
  const vistos = new Set([...(yaPagos || []), ...(yaBitacora || [])].map((r: any) => String(r.mp_payment_id)));

  let nuevos = 0;
  for (const p of cobros) {
    if (vistos.has(String(p.id))) continue;
    const ok = await anotarCobro({
      mp_payment_id: String(p.id), payer_email: p.payer?.email || null,
      monto: Number(p.transaction_amount || 0), moneda: p.currency_id,
      estado: 'approved', metodo: p.payment_method_id || null,
      fecha: p.date_approved || p.date_created || null,
      external_reference: p.external_reference || null,
    });
    if (ok) nuevos++;
  }
  return { revisados: cobros.length, nuevos, propios };
}

export const GET: APIRoute = async ({ url }) => {
  const dias = Math.min(365, Number(url.searchParams.get('dias')) || 90);
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  // ?escanear=1 → primero se sale a buscar a Mercado Pago, y luego se responde
  // la bandeja ya con lo encontrado.
  let barrido = null;
  if (url.searchParams.get('escanear') === '1') barrido = await escanear(dias);

  const [{ data: cobros }, { data: subs }] = await Promise.all([
    supabase.from('crm_cobros_mp')
      .select('*, companies(nombre, sacs_account), subscriptions(nombre_plan, precio)')
      .gte('fecha', desde).order('fecha', { ascending: false }).limit(300),
    supabase.from('subscriptions')
      .select('id, nombre_plan, ciclo, precio, proxima_factura, company_id, companies(nombre, sacs_account), contacts(email)')
      .in('estado', ['activa', 'pendiente_pago', 'programada', 'pausada']).range(0, 999),
  ]);

  // Sin identificar: entró el dinero y no se sabe de quién. Se proponen
  // candidatos con la misma lógica del vínculo — correo primero, monto después.
  const sinIdentificar = (cobros || [])
    .filter(c => c.estado === 'approved' && !c.subscription_id && !c.resolucion)
    .map(c => {
      const candidatos = (subs || []).map((s: any) => {
        const ct: any = Array.isArray(s.contacts) ? s.contacts[0] : s.contacts;
        let pts = 0; const porque: string[] = [];
        if (c.payer_email && ct?.email && norm(ct.email) === norm(c.payer_email)) { pts += 100; porque.push('mismo correo'); }
        if (Number(c.monto) > 0 && Number(s.precio) === Number(c.monto)) { pts += 55; porque.push('mismo monto'); }
        if (s.proxima_factura && c.fecha) {
          const d = Math.abs((Date.parse(s.proxima_factura) - Date.parse(String(c.fecha).slice(0, 10))) / 86400000);
          if (d <= 10) { pts += 20; porque.push('le tocaba pagar esos días'); }
        }
        const co: any = Array.isArray(s.companies) ? s.companies[0] : s.companies;
        return { subscription_id: s.id, cliente: co?.sacs_account || co?.nombre, nombre_plan: s.nombre_plan, precio: Number(s.precio), puntos: pts, porque };
      }).filter(x => x.puntos >= 40).sort((a, b) => b.puntos - a.puntos).slice(0, 4);
      return { ...c, candidatos };
    });

  // Rechazos: no son un pendiente que se resuelve aquí, son cobranza. Se listan
  // para poder llamar, y se agrupan por cliente porque tres rebotes del mismo
  // son un problema, no tres.
  const rechazos = (cobros || []).filter(c => c.estado === 'rejected' || c.estado === 'cancelled');

  return json({
    barrido,
    sin_identificar: sinIdentificar,
    total_sin_identificar: sinIdentificar.reduce((a, c) => a + Number(c.monto || 0), 0),
    rechazos,
    total_rechazado: rechazos.reduce((a, c) => a + Number(c.monto || 0), 0),
    clientes_con_rechazo: new Set(rechazos.map(r => r.company_id).filter(Boolean)).size,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.id) return json({ error: 'id requerido' }, 400);

  const { data: cobro } = await supabase.from('crm_cobros_mp').select('*').eq('id', b.id).maybeSingle();
  if (!cobro) return json({ error: 'No encontré ese cobro.' }, 404);
  if (cobro.resolucion) return json({ error: 'Ese cobro ya se resolvió (' + cobro.resolucion + ').' }, 409);

  if (b.descartar) {
    await supabase.from('crm_cobros_mp').update({
      resolucion: 'descartado', resuelto_at: new Date().toISOString(),
      resuelto_por: 'admin', nota: b?.nota || null,
    }).eq('id', b.id);
    return json({ ok: true, descartado: true });
  }

  if (!b?.subscription_id) return json({ error: 'subscription_id requerido' }, 400);
  const { data: sub } = await supabase.from('subscriptions').select('id, company_id, nombre_plan').eq('id', b.subscription_id).maybeSingle();
  if (!sub) return json({ error: 'No encontré esa suscripción.' }, 404);

  // Se acredita por el MISMO camino que un cobro automático: register-payment
  // avanza la próxima factura, recalcula el ARR y genera el acuse. Duplicar esa
  // lógica aquí sería tener dos formas de cobrar que se van separando.
  const r = await registrarPago({
    request: new Request(new URL('/api/crm/arr/register-payment', request.url), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription_id: b.subscription_id, monto: Number(cobro.monto || 0),
        fecha: String(cobro.fecha || '').slice(0, 10) || undefined,
        metodo: 'mercadopago', referencia: String(cobro.mp_payment_id),
        notas: `Asignado a mano desde la bandeja de Mercado Pago${cobro.payer_email ? ' · pagó ' + cobro.payer_email : ''}.`,
        pasarela: 'mercadopago', mp_payment_id: String(cobro.mp_payment_id),
      }),
    }),
  } as any) as Response;
  const j = await r.json().catch(() => ({} as any));
  // El guard de duplicado de register-payment contesta 409: no es un fallo, es
  // que ese pago ya estaba acreditado. Se cierra igual el pendiente.
  if (!r.ok && !(r.status === 409 && j?.duplicado)) return json({ error: j?.error || ('No se pudo registrar (HTTP ' + r.status + ')') }, 500);

  await supabase.from('crm_cobros_mp').update({
    resolucion: 'asignado', resuelto_at: new Date().toISOString(), resuelto_por: 'admin',
    subscription_id: sub.id, company_id: sub.company_id,
  }).eq('id', b.id);

  await supabase.from('activities').insert({
    tipo: 'sistema', company_id: sub.company_id, automatico: true,
    titulo: `Pago de Mercado Pago asignado a mano: $${Number(cobro.monto || 0).toLocaleString('es-MX')} → ${sub.nombre_plan}`,
    metadata: { audit: 'mp_cobro_asignado', subscription_id: sub.id, mp_payment_id: cobro.mp_payment_id },
  }).select().maybeSingle();

  return json({ ok: true, asignado: true, duplicado: !!j?.duplicado });
};
