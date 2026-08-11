// GET  /api/revenue/quotes/actividad?id=…   → todo lo que le ha pasado a UNA cotización
// POST { id, nota }                          → nota interna
// POST { id, nota_id, borrar: true }         → quitarla
//
// Todo lo que la fila de la tabla ya no muestra vive aquí: a quién reemplaza,
// quién la editó y qué cambió, cuándo la abrió el cliente, sus abonos y su
// historial completo. La tabla es para barrer 35 cotizaciones de un vistazo; el
// detalle de una sola no cabe ahí sin volverla ilegible.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { parseMeta, serializeMeta } from '../../../../lib/quotes/meta';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id') || '';
  if (!id) return json({ error: 'id requerido' }, 400);

  const { data: q } = await supabase.from('quotes')
    .select('id, numero, empresa, contacto, email, whatsapp, total, moneda, estado, vigencia, created_at, pagado_fecha, aceptado_fecha, rechazado_fecha, notas, company_id, contact_id, deal_id, items')
    .eq('id', id).maybeSingle();
  if (!q) return json({ error: 'No encontré esa cotización.' }, 404);

  const { meta } = parseMeta(q.notas);

  // ── Los vínculos, resueltos con datos frescos ──
  // Se guarda el folio al momento de ligar, pero se relee la cotización: si
  // cambió de estado o de monto, el panel tiene que decir cómo está HOY.
  const reemplazaIds: string[] = (Array.isArray(meta.reemplaza_a) ? meta.reemplaza_a : (meta.reemplaza_a ? [meta.reemplaza_a] : [])).map((x: any) => x.id).filter(Boolean);
  const reemplazadaPorId = meta.eliminada?.reemplazada_por?.id || null;
  const idsRel = [...reemplazaIds, ...(reemplazadaPorId ? [reemplazadaPorId] : [])];
  const { data: rel } = idsRel.length
    ? await supabase.from('quotes').select('id, numero, total, estado, created_at').in('id', idsRel)
    : { data: [] as any[] };
  const relPorId = new Map((rel || []).map((r: any) => [r.id, r]));

  // ── Abonos ──
  const { data: pagos } = await supabase.from('payments')
    .select('id, fecha, monto, metodo, referencia, estado, numero_acuse, notas, created_at')
    .eq('quote_id', id).order('fecha', { ascending: true });
  const totalPagado = (pagos || []).reduce((a: number, p: any) => a + Number(p.monto || 0), 0);

  // ── Actividades del CRM que hablan de esta cotización ──
  const { data: acts } = await supabase.from('activities')
    .select('id, tipo, titulo, descripcion, created_at, metadata')
    .contains('metadata', { quote_id: id }).order('created_at', { ascending: false }).limit(50);

  return json({
    quote: {
      id: q.id, numero: q.numero, empresa: q.empresa, contacto: q.contacto, email: q.email, whatsapp: q.whatsapp,
      total: Number(q.total || 0), moneda: q.moneda || 'MXN', estado: q.estado, vigencia: q.vigencia,
      created_at: q.created_at, pagado_fecha: q.pagado_fecha, aceptado_fecha: q.aceptado_fecha,
      rechazado_fecha: q.rechazado_fecha, company_id: q.company_id, items: q.items || [],
    },
    vistas: {
      total: meta.views || 0,
      primera: meta.first_viewed_at || null,
      ultima: meta.last_viewed_at || null,
      // Cada apertura tal cual se registró. Sin canal: se decidió no marcarlo.
      eventos: (meta.timeline || []).filter((t: any) => t.event === 'viewed'),
    },
    // Plan de parcialidades pactado al cotizar, cruzado contra lo que de verdad
    // entró. Se cubre EN ORDEN de fecha: sin recibo por parcialidad, aplicar el
    // dinero a la más vieja es la única regla que no inventa nada.
    plan_pagos: (() => {
      const plan = Array.isArray(meta.plan_pagos) ? [...meta.plan_pagos].sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha))) : [];
      let restante = totalPagado;
      const hoyStr = new Date().toISOString().slice(0, 10);
      return plan.map((x: any) => {
        const cubierto = Math.min(Number(x.monto || 0), Math.max(0, restante));
        restante -= cubierto;
        const pagada = cubierto >= Number(x.monto || 0) - 0.01;
        return { ...x, cubierto: Math.round(cubierto * 100) / 100, pagada, vencida: !pagada && String(x.fecha) < hoyStr };
      });
    })(),
    cambios: meta.cambios || [],
    notas_internas: meta.notas_internas || [],
    archivado: meta.eliminada || null,
    archivados_previos: meta.eliminaciones_previas || [],
    reemplaza_a: (Array.isArray(meta.reemplaza_a) ? meta.reemplaza_a : (meta.reemplaza_a ? [meta.reemplaza_a] : []))
      .map((x: any) => ({ ...x, actual: relPorId.get(x.id) || null })),
    reemplazada_por: reemplazadaPorId ? { ...(meta.eliminada?.reemplazada_por || {}), actual: relPorId.get(reemplazadaPorId) || null } : null,
    pagos: pagos || [],
    total_pagado: Math.round(totalPagado * 100) / 100,
    saldo: Math.round((Number(q.total || 0) - totalPagado) * 100) / 100,
    timeline: meta.timeline || [],
    actividades: acts || [],
  });
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  if (!b?.id) return json({ error: 'id requerido' }, 400);
  const user = await getCurrentUser(request);
  const quien = user?.nombre || user?.email || 'admin';

  const { data: q } = await supabase.from('quotes').select('id, notas').eq('id', b.id).maybeSingle();
  if (!q) return json({ error: 'No encontré esa cotización.' }, 404);
  const { text, meta } = parseMeta(q.notas);

  // Notas internas: el contexto que hoy se pierde ("pidió descuento por
  // volumen", "lo ve con su socio el viernes"). Nunca salen al cliente.
  if (b.borrar && b.nota_id) {
    meta.notas_internas = (meta.notas_internas || []).filter((n: any) => n.id !== b.nota_id);
  } else {
    const nota = String(b.nota || '').trim();
    if (!nota) return json({ error: 'Escribe la nota.' }, 400);
    meta.notas_internas = [
      { id: 'n' + Date.now().toString(36), texto: nota.slice(0, 1000), por: quien, at: new Date().toISOString() },
      ...(meta.notas_internas || []),
    ].slice(0, 100);
  }
  const { error } = await supabase.from('quotes').update({ notas: serializeMeta(text, meta) }).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, notas_internas: meta.notas_internas });
};
