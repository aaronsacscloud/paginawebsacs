// Reportes de trabajo de una cuenta.
//
// GET  ?company_id=            → los reportes ya generados, con sus aperturas
// POST { company_id, desde, hasta, tipo?, narrativa? }  → genera y GUARDA uno
//
// Dos tipos de documento, una sola maquinaria:
//   · trabajo  (RT-) — el periodo completo: entregas, soporte, uso, oportunidades
//   · entregas (RE-) — solo lo entregado, con el VIDEO de cada mejora
//
// El POST guarda una FOTO de los hechos. Es la diferencia con el reporte que se
// ve en el CRM, que se calcula cada vez: la liga que el cliente recibe tiene que
// decir en diciembre lo mismo que decía en septiembre, o no se puede defender en
// una junta.
import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../../lib/auth/scope';
import { reunirHechos, reunirEntregas, reunirEnCurso, reunirLead } from '../../../lib/crm/reporte-hechos';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const UUID = /^[0-9a-f-]{36}$/i;

export const GET: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const companyId = String(url.searchParams.get('company_id') || '');
  if (!UUID.test(companyId)) return json({ error: 'Falta la cuenta.' }, 400);

  const { data, error } = await supabase.from('reportes_trabajo')
    .select('id, tipo, folio, desde, hasta, estado, enviado_at, enviado_a, vistas, primera_vista_at, ultima_vista_at, reaccion, reaccion_at, created_at, creado_por')
    .eq('company_id', companyId).order('created_at', { ascending: false }).limit(30);
  if (error) return json({ error: error.message }, 500);

  // Cuánto TIEMPO le dedicó. Es la diferencia entre "lo abrió" y "lo leyó":
  // treinta segundos es un vistazo, cuatro minutos es que se lo tomó en serio.
  const ids = (data || []).map(r => r.id);
  const tiempos: Record<string, { segundos: number; aperturas: number }> = {};
  if (ids.length) {
    const { data: vistas } = await supabase.from('reporte_vistas')
      .select('reporte_id, segundos').in('reporte_id', ids);
    for (const v of (vistas || [])) {
      const t = tiempos[v.reporte_id] || (tiempos[v.reporte_id] = { segundos: 0, aperturas: 0 });
      t.aperturas++;
      t.segundos += Number(v.segundos || 0);
    }
  }

  return json({
    reportes: (data || []).map(r => ({ ...r, ...(tiempos[r.id] || { segundos: 0, aperturas: 0 }) })),
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);

  const b = await request.json().catch(() => ({} as any));
  const pedido = String(b?.tipo || 'trabajo');
  const tipo = pedido === 'entregas' ? 'entregas' : pedido === 'curso' ? 'curso'
    : pedido === 'lead' ? 'lead' : 'trabajo';

  /* ── El reporte de un LEAD ──
     No lleva periodo ni empresa: lleva una JUNTA. Sale antes del bloque de
     abajo porque ahí todo se ordena alrededor de `company_id` y de un rango de
     fechas, y este documento no tiene ninguno de los dos: tiene la minuta de
     una sesión y el nombre de quien la tomó. */
  if (tipo === 'lead') {
    const booking_id = String(b?.booking_id || '');
    if (!booking_id) return json({ error: 'Falta la reunión.' }, 400);
    const hechos = await reunirLead(booking_id, {
      descuento: b?.descuento != null ? Number(b.descuento) : undefined,
      vigencia: b?.vigencia || null,
    });
    if (!hechos) return json({ error: 'Esa reunión no tiene minuta. El reporte sale de lo que se levantó en la junta.' }, 400);
    if (!hechos.hoy.length && !hechos.pedidos.length) {
      return json({ error: 'La minuta está vacía: sin «cómo opera hoy» ni «qué le interesó» no hay nada que enseñarle.' }, 400);
    }
    const { data: bk } = await supabase.from('bookings').select('contact_id, company_id, fecha').eq('id', booking_id).maybeSingle();
    const { data, error } = await supabase.from('reportes_trabajo').insert({
      company_id: bk?.company_id || null, contact_id: bk?.contact_id || null,
      // Un reporte de lead no tiene rango: la sesión es el día y punto.
      desde: bk?.fecha, hasta: bk?.fecha, tipo,
      hechos, creado_por: (user as any)?.email || (user as any)?.nombre || null,
    }).select('id, tipo, folio').single();
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, id: data.id, tipo: data.tipo, folio: data.folio, hechos });
  }

  /* Los otros tres documentos sí son de un cliente y de un periodo. La guardia
     va DESPUÉS de la rama del lead y no antes, porque ese no tiene ninguno de
     los dos y con ella arriba nunca llegaba a su rama. */
  const companyId = String(b?.company_id || '');
  const desde = String(b?.desde || '').slice(0, 10);
  const hasta = String(b?.hasta || '').slice(0, 10);
  if (!UUID.test(companyId) || !desde || !hasta) return json({ error: 'Falta el cliente o el periodo.' }, 400);
  if (desde > hasta) return json({ error: 'El periodo está al revés.' }, 400);

  const modulos = Array.isArray(b?.modulos) ? b.modulos.map(String).slice(0, 40) : null;
  const hechos = tipo === 'entregas' ? await reunirEntregas(companyId, desde, hasta, modulos)
    : tipo === 'curso' ? await reunirEnCurso(companyId, desde, hasta)
    : await reunirHechos(companyId, desde, hasta);
  if (!hechos) return json({ error: 'Ese cliente ya no existe.' }, 404);

  /* Un reporte de entregas VACÍO no se publica. La liga existiría, el cliente
     la abriría y encontraría un documento que dice «se te entregaron 0 cosas»
     — que es peor que no mandarlo. El de trabajo sí puede ir vacío de entregas:
     trae soporte, uso y oportunidades. */
  if (tipo === 'entregas' && !(hechos as any).total) {
    return json({ error: 'En ese periodo no hay ninguna entrega visible para el cliente. Cambia las fechas o revisa que estén marcadas como «se le puede mostrar al cliente».' }, 400);
  }
  /* Y uno EN CURSO vacío tampoco: «no te estamos construyendo nada» es un
     documento que no se manda, se conversa. */
  if (tipo === 'curso' && !(hechos as any).total) {
    return json({ error: 'Esta cuenta no tiene nada vivo en el taller. Un reporte de trabajo en curso sin trabajos no se manda.' }, 400);
  }

  const { data, error } = await supabase.from('reportes_trabajo').insert({
    company_id: companyId, desde, hasta, tipo,
    hechos, narrativa: b?.narrativa || null,
    creado_por: (user as any)?.email || (user as any)?.nombre || null,
  }).select('id, tipo, folio').single();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, id: data.id, tipo: data.tipo, folio: data.folio, hechos });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'No autenticado' }, 401);
  const id = String(url.searchParams.get('id') || '');
  if (!UUID.test(id)) return json({ error: 'Falta el reporte.' }, 400);
  const { error } = await supabase.from('reportes_trabajo').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
