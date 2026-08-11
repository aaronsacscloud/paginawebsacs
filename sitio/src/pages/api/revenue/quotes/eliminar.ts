// POST /api/revenue/quotes/eliminar
//   { id, motivo, motivo_detalle?, reemplazada_por_id? }
//
// Eliminar una cotización NO la borra: la archiva (estado 'deleted', que la
// lista ya oculta) y guarda POR QUÉ, QUIÉN y CUÁNDO. Una cotización es un
// documento que se le mandó a un cliente —con folio, precio y vigencia—; que
// desaparezca sin dejar rastro es justo lo que impide después explicar por qué
// se le cotizó dos veces o por qué cambió el precio.
//
// Cuando el motivo es "se generó una nueva", se guarda el vínculo en LAS DOS
// direcciones: la vieja apunta a la que la reemplaza y la nueva sabe a cuál
// sustituye. Con el vínculo en un solo sentido, quien abra la nueva no tiene
// forma de enterarse de que hubo una anterior.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { parseMeta, serializeMeta } from '../../../../lib/quotes/meta';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export const MOTIVOS: Record<string, string> = {
  nueva_cotizacion: 'Se generó una nueva cotización',
  error_captura: 'Me equivoqué al generar la cotización',
  duplicada: 'La cotización está duplicada',
  cambios_cliente: 'El cliente solicitó cambios',
  operacion_cancelada: 'La operación fue cancelada',
  otro: 'Otro',
};

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const id = String(b?.id || '');
  const motivo = String(b?.motivo || '');
  if (!id) return json({ error: 'id requerido' }, 400);
  if (!MOTIVOS[motivo]) return json({ error: 'Elige el motivo de la eliminación.' }, 400);
  // "Otro" sin explicación no es un motivo: en tres meses no dice nada.
  const detalle = String(b?.motivo_detalle || '').trim();
  if (motivo === 'otro' && !detalle) return json({ error: 'Escribe el motivo: "Otro" a secas no explica nada después.' }, 400);

  const { data: q } = await supabase.from('quotes')
    .select('id, numero, estado, notas, total, empresa, contacto, email, company_id, contact_id, deal_id')
    .eq('id', id).maybeSingle();
  if (!q) return json({ error: 'No encontré esa cotización.' }, 404);
  if (q.estado === 'deleted') return json({ error: 'Esa cotización ya estaba eliminada.' }, 409);

  // ── La que la reemplaza ──
  let reemplazo: any = null;
  if (motivo === 'nueva_cotizacion') {
    if (!b?.reemplazada_por_id) return json({ error: 'Indica cuál cotización reemplaza a esta.' }, 400);
    if (String(b.reemplazada_por_id) === id) return json({ error: 'Una cotización no puede reemplazarse a sí misma.' }, 400);
    const { data: r } = await supabase.from('quotes')
      .select('id, numero, estado, notas, company_id, email, empresa, total').eq('id', b.reemplazada_por_id).maybeSingle();
    if (!r) return json({ error: 'No encontré la cotización que la reemplaza.' }, 404);
    if (r.estado === 'deleted') return json({ error: 'Esa cotización también está eliminada: elige otra.' }, 400);
    // Debe ser del MISMO cliente. Ligar la cotización de otro cliente no es un
    // detalle cosmético: rompe el historial de los dos.
    const mismoCliente = (q.company_id && r.company_id && q.company_id === r.company_id)
      || (!!q.email && !!r.email && q.email.toLowerCase() === r.email.toLowerCase());
    if (!mismoCliente) return json({ error: 'Esa cotización es de otro cliente. Solo puede reemplazarla una del mismo.' }, 400);
    reemplazo = r;
  }

  const user = await getCurrentUser(request);
  const quien = user?.nombre || user?.email || 'admin';
  const ahora = new Date().toISOString();

  // ── Se archiva, no se borra ──
  const { text, meta } = parseMeta(q.notas);
  meta.eliminada = {
    at: ahora, por: quien, por_id: user?.id || null,
    motivo, motivo_label: MOTIVOS[motivo], detalle: detalle || null,
    estado_previo: q.estado,
    reemplazada_por: reemplazo ? { id: reemplazo.id, numero: reemplazo.numero } : null,
  };
  meta.timeline = meta.timeline || [];
  meta.timeline.push({ event: 'eliminada', at: ahora, por: quien, motivo: MOTIVOS[motivo] });

  const { error } = await supabase.from('quotes')
    .update({ estado: 'deleted', notas: serializeMeta(text, meta) }).eq('id', id);
  if (error) return json({ error: error.message }, 500);

  // El vínculo en las dos direcciones.
  if (reemplazo) {
    const { text: t2, meta: m2 } = parseMeta(reemplazo.notas);
    m2.reemplaza_a = { id: q.id, numero: q.numero, at: ahora, por: quien };
    await supabase.from('quotes').update({ notas: serializeMeta(t2, m2) }).eq('id', reemplazo.id);
  }

  // ── Historial donde se lee: la Actividad del cliente ──
  if (q.company_id || q.contact_id) {
    await supabase.from('activities').insert({
      tipo: 'sistema', automatico: true,
      company_id: q.company_id || null, contact_id: q.contact_id || null, deal_id: q.deal_id || null,
      titulo: `🗑 Cotización ${q.numero || ''} eliminada`.trim()
        + (reemplazo ? ` · la reemplaza la ${reemplazo.numero}` : ''),
      descripcion: `${MOTIVOS[motivo]}${detalle ? ': ' + detalle : ''} · por ${quien}`
        + (q.total ? ` · $${Number(q.total).toLocaleString('es-MX')}` : ''),
      metadata: {
        audit: 'quote_delete', quote_id: q.id, numero: q.numero, motivo,
        detalle: detalle || null, por: quien,
        reemplazada_por: reemplazo ? { id: reemplazo.id, numero: reemplazo.numero } : null,
      },
    }).select().maybeSingle();
  }

  return json({
    ok: true, numero: q.numero,
    motivo: MOTIVOS[motivo],
    reemplazada_por: reemplazo ? { id: reemplazo.id, numero: reemplazo.numero } : null,
  });
};
