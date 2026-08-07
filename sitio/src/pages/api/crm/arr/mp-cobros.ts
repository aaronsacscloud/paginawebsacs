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
import { conexionActiva, mpFetch, obtenerPago } from '../../../../lib/pagos/mercadopago';
import { anotarCobro, identidadDePago } from '../../../../lib/pagos/cobros-mp';

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
    // La búsqueda ya trae el pago completo: se guarda TODO lo que dice de quién
    // es, no solo el correo (que en los recurrentes viene vacío).
    const id = identidadDePago(p);
    const ok = await anotarCobro({
      mp_payment_id: String(p.id),
      monto: Number(p.transaction_amount || 0), moneda: p.currency_id,
      estado: 'approved', metodo: p.payment_method_id || null,
      fecha: p.date_approved || p.date_created || null,
      preapproval_id: id.preapproval_id,
      payer_email: id.payer_email, payer_nombre: id.payer_nombre, payer_id: id.payer_id,
      tarjeta: id.tarjeta, descripcion: id.descripcion,
      external_reference: id.external_reference,
    });
    if (ok) nuevos++;
  }
  return { revisados: cobros.length, nuevos, propios };
}

/**
 * Le pregunta a Mercado Pago QUIÉN fue cada cobro que aquí no dice de quién es.
 *
 * El aviso del webhook trae poco: en los cargos recurrentes `payer.email` viene
 * vacío seguido, y así un rebote de $8,500 se queda como "sin identificar" —que
 * es lo mismo que no tenerlo, porque no se le puede llamar a nadie—. El pago
 * completo sí trae el titular, los últimos 4 y la descripción, y en las
 * domiciliadas también el `metadata.preapproval_id`, que ES el vínculo con la
 * suscripción. Con eso, la mayoría deja de ser anónima.
 */
async function enriquecer(dias: number): Promise<{ revisados: number; con_datos: number; ligados: number; error?: string }> {
  let cx;
  try { cx = await conexionActiva(); } catch (e: any) { return { revisados: 0, con_datos: 0, ligados: 0, error: e?.message }; }
  if (!cx) return { revisados: 0, con_datos: 0, ligados: 0, error: 'Conecta tu cuenta de Mercado Pago primero.' };

  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const { data: filas } = await supabase.from('crm_cobros_mp')
    .select('id, mp_payment_id, subscription_id, company_id, payer_email, payer_nombre')
    .gte('fecha', desde)
    .or('subscription_id.is.null,payer_email.is.null,payer_nombre.is.null')
    .order('fecha', { ascending: false }).limit(120);

  let revisados = 0, con_datos = 0, ligados = 0;
  for (const f of filas || []) {
    let pago: any;
    try { pago = await obtenerPago(String(f.mp_payment_id), cx); } catch { continue; }
    revisados++;
    const id = identidadDePago(pago);
    const upd: any = { enriquecido_at: new Date().toISOString() };
    // Solo se RELLENA lo que falta: lo que ya se corrigió a mano no se pisa.
    if (!f.payer_email && id.payer_email) upd.payer_email = id.payer_email;
    if (!f.payer_nombre && id.payer_nombre) upd.payer_nombre = id.payer_nombre;
    if (id.payer_id) upd.payer_id = id.payer_id;
    if (id.tarjeta) upd.tarjeta = id.tarjeta;
    if (id.descripcion) upd.descripcion = id.descripcion;
    if (id.external_reference) upd.external_reference = id.external_reference;
    if (id.preapproval_id) upd.preapproval_id = id.preapproval_id;
    if (upd.payer_email || upd.payer_nombre || upd.tarjeta || upd.descripcion) con_datos++;

    // Ligar SOLO con lo que es certeza: el preapproval o la referencia que puso
    // el CRM. Adivinar por correo parecido no liga nada — para eso están los
    // candidatos, que los decide una persona.
    if (!f.subscription_id) {
      let sub: any = null;
      if (id.preapproval_id) {
        const { data } = await supabase.from('subscriptions').select('id, company_id').eq('mp_preapproval_id', id.preapproval_id).maybeSingle();
        sub = data;
      }
      if (!sub) {
        const m = String(id.external_reference || '').match(/^sub:([0-9a-f-]{36})/i);
        if (m) {
          const { data } = await supabase.from('subscriptions').select('id, company_id').eq('id', m[1]).maybeSingle();
          sub = data;
        }
      }
      if (sub) { upd.subscription_id = sub.id; upd.company_id = sub.company_id; ligados++; }
    }
    await supabase.from('crm_cobros_mp').update(upd).eq('id', f.id);
  }
  return { revisados, con_datos, ligados };
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

  // Quién puede ser: correo primero, monto después, fecha de cobro al final.
  // También sirve para los REBOTES: un rebote que no dice de quién es no se
  // puede cobrar, y "sin identificar · $8,500" no es información, es un susto.
  const candidatosPara = (c: any) => (subs || []).map((s: any) => {
    const ct: any = Array.isArray(s.contacts) ? s.contacts[0] : s.contacts;
    const co: any = Array.isArray(s.companies) ? s.companies[0] : s.companies;
    let pts = 0; const porque: string[] = [];
    if (c.payer_email && ct?.email && norm(ct.email) === norm(c.payer_email)) { pts += 100; porque.push('mismo correo'); }
    if (Number(c.monto) > 0 && Number(s.precio) === Number(c.monto)) { pts += 55; porque.push('mismo monto'); }
    if (s.proxima_factura && c.fecha) {
      const d = Math.abs((Date.parse(s.proxima_factura) - Date.parse(String(c.fecha).slice(0, 10))) / 86400000);
      if (d <= 10) { pts += 20; porque.push('le tocaba pagar esos días'); }
    }
    // La descripción del cobro en MP suele traer el plan y la cuenta del cliente
    // ("Plan Controla · urbanshoes"): cuando el correo viene vacío —que en los
    // cargos recurrentes es lo normal— esto es lo único que queda.
    const desc = norm(c.descripcion);
    if (desc && co?.sacs_account && desc.includes(norm(co.sacs_account))) { pts += 90; porque.push('la descripción trae su cuenta'); }
    else if (desc && co?.nombre && norm(co.nombre).length > 3 && desc.includes(norm(co.nombre))) { pts += 70; porque.push('la descripción trae su nombre'); }
    if (desc && s.nombre_plan && desc.includes(norm(s.nombre_plan))) { pts += 25; porque.push('mismo plan en la descripción'); }
    return { subscription_id: s.id, cliente: co?.sacs_account || co?.nombre, nombre_plan: s.nombre_plan, precio: Number(s.precio), puntos: pts, porque };
  }).filter((x: any) => x.puntos >= 40).sort((a: any, b: any) => b.puntos - a.puntos).slice(0, 4);

  // Sin identificar: entró el dinero y no se sabe de quién.
  const sinIdentificar = (cobros || [])
    .filter(c => c.estado === 'approved' && !c.subscription_id && !c.resolucion)
    .map(c => ({ ...c, candidatos: candidatosPara(c) }));

  // Rechazos: no son un pendiente que se resuelve aquí, son cobranza. Se listan
  // para poder llamar, y se agrupan por cliente porque tres rebotes del mismo
  // son un problema, no tres.
  const rechazos = (cobros || [])
    .filter(c => c.estado === 'rejected' || c.estado === 'cancelled')
    .map(c => (c.subscription_id ? { ...c, candidatos: [] } : { ...c, candidatos: candidatosPara(c) }));
  // Cuántos rebotes siguen sin poder atribuirse a nadie: es el número que dice
  // si esta lista sirve para llamar o solo para asustarse.
  const rechazosSinDueno = rechazos.filter((r: any) => !r.company_id && !r.subscription_id).length;

  return json({
    barrido,
    sin_identificar: sinIdentificar,
    total_sin_identificar: sinIdentificar.reduce((a, c) => a + Number(c.monto || 0), 0),
    rechazos,
    total_rechazado: rechazos.reduce((a, c) => a + Number(c.monto || 0), 0),
    clientes_con_rechazo: new Set(rechazos.map((r: any) => r.company_id).filter(Boolean)).size,
    rechazos_sin_dueno: rechazosSinDueno,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));

  // { enriquecer: true } → sale a Mercado Pago a preguntar quién fue cada cobro
  // anónimo. Va aparte del barrido: aquel BUSCA cobros nuevos, este identifica
  // los que ya están.
  if (b?.enriquecer) {
    const r = await enriquecer(Math.min(365, Number(b.dias) || 90));
    if (r.error) return json({ error: r.error }, 400);
    return json({ ok: true, ...r });
  }

  if (!b?.id) return json({ error: 'id requerido' }, 400);

  const { data: cobro } = await supabase.from('crm_cobros_mp').select('*').eq('id', b.id).maybeSingle();
  if (!cobro) return json({ error: 'No encontré ese cobro.' }, 404);
  if (cobro.resolucion) return json({ error: 'Ese cobro ya se resolvió (' + cobro.resolucion + ').' }, 409);

  if (b.descartar) {
    await supabase.from('crm_cobros_mp').update({
      resolucion: 'descartado', resuelto_at: new Date().toISOString(),
      resuelto_por: 'admin', nota: b?.nota || null,
    }).eq('id', b.id);
    // Descartar es decir "este dinero no es de nadie": si el cobro ya tenía
    // cliente, tiene que quedar escrito en su expediente quién lo descartó y
    // por qué. Un pago que desaparece sin explicación es el peor pendiente.
    if (cobro.company_id) {
      await supabase.from('activities').insert({
        tipo: 'sistema', company_id: cobro.company_id, automatico: true,
        titulo: `Cobro de Mercado Pago descartado: $${Number(cobro.monto || 0).toLocaleString('es-MX')}`,
        descripcion: (b?.nota ? 'Motivo: ' + b.nota + '. ' : '') + 'Se sacó de la bandeja sin acreditarlo a ninguna suscripción.',
        metadata: { audit: 'mp_cobro_descartado', mp_payment_id: cobro.mp_payment_id },
      }).select().maybeSingle();
    }
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
