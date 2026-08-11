// POST /api/revenue/quotes/eliminar
//   { id | ids[], motivo, motivo_detalle?, reemplazada_por_id? }   → archivar
//   { id | ids[], restaurar: true }                                → sacar del archivo
//
// Archivar NO es borrar: la cotización sale de la vista activa y se guarda POR
// QUÉ, QUIÉN y CUÁNDO. Es un documento que salió al cliente con folio, precio y
// vigencia; que se esfume sin rastro es justo lo que después impide explicar por
// qué se le cotizó dos veces o por qué cambió el precio.
//
// Se pueden archivar VARIAS de golpe hacia la misma cotización nueva: dos que se
// fusionan en una tercera es un caso real, y el vínculo queda en las dos
// direcciones —cada vieja apunta a su reemplazo y la nueva lista a TODAS las que
// sustituye—. Con el vínculo en un solo sentido, quien abra la nueva no se
// entera de que hubo anteriores.
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

const COLS = 'id, numero, estado, notas, total, empresa, contacto, email, company_id, contact_id, deal_id';

export const POST: APIRoute = async ({ request }) => {
  const b = await request.json().catch(() => ({} as any));
  const user = await getCurrentUser(request);
  const quien = user?.nombre || user?.email || 'admin';
  const ahora = new Date().toISOString();
  const ids: string[] = Array.isArray(b?.ids) && b.ids.length ? b.ids.map(String) : (b?.id ? [String(b.id)] : []);
  if (!ids.length) return json({ error: 'id requerido' }, 400);

  // ═══ Restaurar ═══
  // El archivo no es una papelera sin salida: si algo se archivó por error, debe
  // volver EXACTAMENTE al estado que tenía, no a "borrador".
  if (b?.restaurar) {
    const { data: filas } = await supabase.from('quotes').select(COLS).in('id', ids);
    let n = 0;
    for (const q of (filas || []).filter((x: any) => x.estado === 'deleted')) {
      const { text, meta } = parseMeta(q.notas);
      const previo = meta?.eliminada?.estado_previo || 'draft';
      // El registro del archivado NO se borra, se guarda en el histórico: que
      // algo se haya archivado y restaurado también es información.
      meta.eliminaciones_previas = [...(meta.eliminaciones_previas || []), meta.eliminada].filter(Boolean);
      delete meta.eliminada;
      meta.timeline = [...(meta.timeline || []), { event: 'restaurada', at: ahora, por: quien }];
      await supabase.from('quotes').update({ estado: previo, notas: serializeMeta(text, meta) }).eq('id', q.id);
      if (q.company_id || q.contact_id) {
        await supabase.from('activities').insert({
          tipo: 'sistema', automatico: true, company_id: q.company_id || null, contact_id: q.contact_id || null,
          titulo: `↩️ Cotización ${q.numero || ''} restaurada`.trim(),
          descripcion: `Vuelve a "${previo}" · por ${quien}`,
          metadata: { audit: 'quote_restore', quote_id: q.id, numero: q.numero },
        }).select().maybeSingle();
      }
      n++;
    }
    return json({ ok: true, restauradas: n });
  }

  // ═══ Archivar ═══
  const motivo = String(b?.motivo || '');
  if (!MOTIVOS[motivo]) return json({ error: 'Elige el motivo de la eliminación.' }, 400);
  const detalle = String(b?.motivo_detalle || '').trim();
  // "Otro" sin explicación no es un motivo: en tres meses no dice nada.
  if (motivo === 'otro' && !detalle) return json({ error: 'Escribe el motivo: "Otro" a secas no explica nada después.' }, 400);

  const { data: filas } = await supabase.from('quotes').select(COLS).in('id', ids);
  const cotis = (filas || []).filter((x: any) => x.estado !== 'deleted');
  if (!cotis.length) return json({ error: 'No encontré cotizaciones por archivar (¿ya estaban en el archivo?).' }, 404);

  // ── La que las reemplaza ──
  let reemplazo: any = null;
  if (motivo === 'nueva_cotizacion') {
    if (!b?.reemplazada_por_id) return json({ error: 'Indica cuál cotización las reemplaza.' }, 400);
    const nuevoId = String(b.reemplazada_por_id);
    if (ids.includes(nuevoId)) return json({ error: 'La cotización que reemplaza no puede ser una de las que se están archivando.' }, 400);
    const { data: r } = await supabase.from('quotes')
      .select('id, numero, estado, notas, company_id, email, empresa, total').eq('id', nuevoId).maybeSingle();
    if (!r) return json({ error: 'No encontré la cotización que las reemplaza.' }, 404);
    if (r.estado === 'deleted') return json({ error: 'Esa cotización también está archivada: elige otra.' }, 400);
    // TODAS deben ser del mismo cliente que el reemplazo. Ligar la de otro no es
    // un detalle cosmético: rompe los dos historiales.
    const mismoCliente = (x: any) => (x.company_id && r.company_id && x.company_id === r.company_id)
      || (!!x.email && !!r.email && String(x.email).toLowerCase() === String(r.email).toLowerCase());
    const ajena = cotis.find((x: any) => !mismoCliente(x));
    if (ajena) return json({ error: `La cotización ${ajena.numero} es de otro cliente: solo puede reemplazarla una del mismo.` }, 400);
    reemplazo = r;
  }

  const otras = (q: any) => cotis.filter((x: any) => x.id !== q.id).map((x: any) => x.numero);

  for (const q of cotis) {
    const { text, meta } = parseMeta(q.notas);
    meta.eliminada = {
      at: ahora, por: quien, por_id: user?.id || null,
      motivo, motivo_label: MOTIVOS[motivo], detalle: detalle || null,
      estado_previo: q.estado,
      reemplazada_por: reemplazo ? { id: reemplazo.id, numero: reemplazo.numero } : null,
      // Con quién se fue: es lo que después explica que las DOS se fusionaron
      // en una, en vez de leerse como dos archivados sueltos el mismo día.
      junto_con: cotis.length > 1 ? otras(q) : null,
    };
    meta.timeline = [...(meta.timeline || []), { event: 'eliminada', at: ahora, por: quien, motivo: MOTIVOS[motivo] }];
    await supabase.from('quotes').update({ estado: 'deleted', notas: serializeMeta(text, meta) }).eq('id', q.id);

    if (q.company_id || q.contact_id) {
      await supabase.from('activities').insert({
        tipo: 'sistema', automatico: true,
        company_id: q.company_id || null, contact_id: q.contact_id || null, deal_id: q.deal_id || null,
        titulo: `🗑 Cotización ${q.numero || ''} archivada`.trim() + (reemplazo ? ` · la reemplaza la ${reemplazo.numero}` : ''),
        descripcion: `${MOTIVOS[motivo]}${detalle ? ': ' + detalle : ''} · por ${quien}`
          + (q.total ? ` · $${Number(q.total).toLocaleString('es-MX')}` : '')
          + (cotis.length > 1 ? ` · junto con ${otras(q).join(', ')}` : ''),
        metadata: {
          audit: 'quote_delete', quote_id: q.id, numero: q.numero, motivo, detalle: detalle || null, por: quien,
          reemplazada_por: reemplazo ? { id: reemplazo.id, numero: reemplazo.numero } : null,
          junto_con: cotis.length > 1 ? otras(q) : null,
        },
      }).select().maybeSingle();
    }
  }

  // ── El vínculo, en las dos direcciones y en PLURAL ──
  // `reemplaza_a` es una LISTA: dos cotizaciones pueden fusionarse en una
  // tercera y quien abra la nueva tiene que ver las dos que sustituye. Se acepta
  // la forma vieja (un objeto) para no perder los vínculos ya guardados.
  if (reemplazo) {
    const { text: t2, meta: m2 } = parseMeta(reemplazo.notas);
    const previos = Array.isArray(m2.reemplaza_a) ? m2.reemplaza_a : (m2.reemplaza_a ? [m2.reemplaza_a] : []);
    const nuevos = cotis.filter((q: any) => !previos.some((x: any) => x.id === q.id))
      .map((q: any) => ({ id: q.id, numero: q.numero, at: ahora, por: quien }));
    m2.reemplaza_a = [...previos, ...nuevos];
    await supabase.from('quotes').update({ notas: serializeMeta(t2, m2) }).eq('id', reemplazo.id);
  }

  return json({
    ok: true, eliminadas: cotis.length,
    numeros: cotis.map((q: any) => q.numero),
    motivo: MOTIVOS[motivo],
    reemplazada_por: reemplazo ? { id: reemplazo.id, numero: reemplazo.numero } : null,
  });
};
