// Publicaciones de un canal: notas, checklists y proyectos que se trabajan
// entre los dos dentro del canal (como los posts de Discord).
//
// GET  /api/crm/espacio/publicaciones?canal_id=          → las del canal (con sus renglones)
// GET  /api/crm/espacio/publicaciones?id=                → una
// POST /api/crm/espacio/publicaciones { accion, … }
//   crear        { canal_id, tipo, titulo, cuerpo?, responsable_id?, vence_at?, items?: [{texto, grupo?}] }
//   editar       { id, titulo?, cuerpo?, tipo?, responsable_id?, vence_at? }
//   estado       { id, estado: abierta|cerrada }
//   fijar        { id, fijada: bool }
//   borrar       { id }                                  (quien la creó o un founder)
//   item_agregar { id, texto, grupo?, responsable_id?, vence_at? }
//   item_editar  { item_id, texto?, grupo?, responsable_id?, vence_at? }
//   item_hecho   { item_id, hecho: bool }
//   item_borrar  { item_id }
//   item_orden   { id, orden: uuid[] }
//
// Cada publicación deja una tarjeta en la conversación (mensaje con
// metadata.publicacion) que se actualiza con el avance; su hilo son los
// comentarios. Los dos founders pueden palomear y editar cualquier renglón.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, emitir, canalDe, puedeVerCanal, personasPorId } from '../../../../lib/crm/espacio.lib';
import { avisar } from '../../../../lib/crm/espacio-avisos';

export const prerender = false;

const SEL_PUB = 'id, canal_id, tipo, titulo, cuerpo, estado, responsable_id, vence_at, fijada, autor_id, mensaje_id, cerrada_at, created_at, updated_at';
const SEL_ITEM = 'id, publicacion_id, texto, grupo, orden, responsable_id, vence_at, hecho_at, hecho_por, created_at';
const TIPOS = new Set(['nota', 'checklist', 'proyecto']);
const ETIQ: Record<string, string> = { nota: 'Nota', checklist: 'Checklist', proyecto: 'Proyecto' };

const limpiar = (v: any, max: number) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const fecha = (v: any): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null;
const grupoDe = (v: any): string | null => { const g = limpiar(v, 80); return g || null; };

async function conForma(pubs: any[], items: any[]) {
  const ids = new Set<string>();
  for (const p of pubs) { ids.add(p.autor_id); if (p.responsable_id) ids.add(p.responsable_id); }
  for (const i of items) { if (i.responsable_id) ids.add(i.responsable_id); if (i.hecho_por) ids.add(i.hecho_por); }
  const personas = await personasPorId(Array.from(ids));
  const per = (id: string | null) => id && personas[id] ? { id, nombre: personas[id].nombre, foto_url: personas[id].foto_url } : null;
  const porPub: Record<string, any[]> = {};
  for (const i of items) (porPub[i.publicacion_id] ||= []).push({ ...i, responsable: per(i.responsable_id), hecho_por_p: per(i.hecho_por) });
  return pubs.map(p => {
    const its = (porPub[p.id] || []).sort((a, b) => (a.orden - b.orden) || a.created_at.localeCompare(b.created_at));
    return { ...p, autor: per(p.autor_id), responsable: per(p.responsable_id), items: its, n: its.length, hechos: its.filter(i => i.hecho_at).length };
  });
}

async function itemsDe(pubIds: string[]) {
  if (!pubIds.length) return [] as any[];
  const { data } = await supabase.from('espacio_publicacion_items').select(SEL_ITEM).in('publicacion_id', pubIds).limit(2000);
  return data || [];
}

async function una(id: string) {
  const { data: p } = await supabase.from('espacio_publicaciones').select(SEL_PUB).eq('id', id).maybeSingle();
  if (!p) return null;
  return (await conForma([p], await itemsDe([p.id])))[0];
}

/** La tarjeta en la conversación refleja el avance: se reescribe en cada cambio. */
async function reflejar(pub: any, yoId: string) {
  const snap = { id: pub.id, tipo: pub.tipo, titulo: pub.titulo, estado: pub.estado, n: pub.n, hechos: pub.hechos, responsable: pub.responsable, vence_at: pub.vence_at };
  const texto = `${ETIQ[pub.tipo] || 'Publicación'}: ${pub.titulo}`;
  const { data: m0 } = pub.mensaje_id ? await supabase.from('espacio_mensajes').select('metadata, borrado_at').eq('id', pub.mensaje_id).maybeSingle() : { data: null };
  if (m0 && !m0.borrado_at) {
    await supabase.from('espacio_mensajes').update({ texto, metadata: { ...(m0.metadata || {}), publicacion: snap } }).eq('id', pub.mensaje_id);
    await emitir({ tipo: 'msg_upd', canal_id: pub.canal_id, id: pub.mensaje_id, hilo_de: null });
  } else {
    // Sin tarjeta (o la borraron del chat): se vuelve a poner.
    const { data: m } = await supabase.from('espacio_mensajes').insert({ canal_id: pub.canal_id, autor_id: yoId, texto, metadata: { publicacion: snap } }).select('id').single();
    if (m) {
      await supabase.from('espacio_publicaciones').update({ mensaje_id: m.id }).eq('id', pub.id);
      pub.mensaje_id = m.id;
      await emitir({ tipo: 'msg', canal_id: pub.canal_id, id: m.id, autor_id: yoId, hilo_de: null });
    }
  }
  await supabase.from('espacio_publicaciones').update({ updated_at: new Date().toISOString() }).eq('id', pub.id);
  await emitir({ tipo: 'pub', canal_id: pub.canal_id, id: pub.id });
}

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request); if (!yo) return json({ error: 'No autorizado' }, 401);
  const id = url.searchParams.get('id');
  if (id) {
    if (!esUuid(id)) return json({ error: 'id inválido' }, 400);
    const p = await una(id); if (!p) return json({ error: 'No existe' }, 404);
    const c = await canalDe(p.canal_id); if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'No existe' }, 404);
    return json({ publicacion: p });
  }
  const canalId = url.searchParams.get('canal_id') || '';
  const c = await canalDe(canalId); if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Canal no encontrado' }, 404);
  const { data: pubs } = await supabase.from('espacio_publicaciones').select(SEL_PUB).eq('canal_id', c.id)
    .order('fijada', { ascending: false }).order('updated_at', { ascending: false }).limit(300);
  const lista = await conForma(pubs || [], await itemsDe((pubs || []).map((p: any) => p.id)));
  return json({ publicaciones: lista });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request); if (!yo) return json({ error: 'No autorizado' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const accion = String(b?.accion || '');

  // Carga la publicación (por id o por item) y verifica que el canal se pueda ver.
  const cargar = async (pubId: string) => {
    if (!esUuid(pubId)) return null;
    const p = await una(pubId); if (!p) return null;
    const c = await canalDe(p.canal_id); if (!c || !puedeVerCanal(c, yo.id)) return null;
    return { p, c };
  };
  const cargarPorItem = async (itemId: string) => {
    if (!esUuid(itemId)) return null;
    const { data: it } = await supabase.from('espacio_publicacion_items').select(SEL_ITEM).eq('id', itemId).maybeSingle();
    if (!it) return null;
    const r = await cargar(it.publicacion_id); return r ? { ...r, it } : null;
  };
  const responder = async (pubId: string) => { const p = await una(pubId); if (p) await reflejar(p, yo.id); return json({ publicacion: p ? await una(pubId) : null }); };
  const avisarResponsable = async (rid: string | null, c: any, titulo: string, detalle: string) => {
    if (rid && rid !== yo.id) await avisar({ para: rid, tipo: 'espacio_publicacion', titulo, detalle, canal_id: c.id, nivel: 'info' });
  };

  if (accion === 'crear') {
    const c = await canalDe(b.canal_id); if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Canal no encontrado' }, 404);
    if (c.tipo === 'sistema') return json({ error: 'En los canales del sistema no hay publicaciones' }, 400);
    const titulo = limpiar(b.titulo, 160); if (!titulo) return json({ error: 'Falta el título' }, 400);
    const tipo = TIPOS.has(b.tipo) ? b.tipo : 'nota';
    const responsable_id = esUuid(b.responsable_id) ? b.responsable_id : null;
    const { data: p, error } = await supabase.from('espacio_publicaciones').insert({
      canal_id: c.id, tipo, titulo, cuerpo: limpiar(b.cuerpo, 8000), responsable_id, vence_at: fecha(b.vence_at), autor_id: yo.id,
    }).select(SEL_PUB).single();
    if (error || !p) return json({ error: error?.message || 'No se pudo crear' }, 500);
    const items = Array.isArray(b.items) ? b.items.slice(0, 200) : [];
    const filas = items.map((it: any, i: number) => ({ publicacion_id: p.id, texto: limpiar(it?.texto, 500), grupo: grupoDe(it?.grupo), orden: i, responsable_id: esUuid(it?.responsable_id) ? it.responsable_id : null, vence_at: fecha(it?.vence_at) })).filter((f: any) => f.texto);
    if (filas.length) await supabase.from('espacio_publicacion_items').insert(filas);
    await avisarResponsable(responsable_id, c, `Te asignaron: ${titulo.slice(0, 80)}`, `${ETIQ[tipo]} en #${c.nombre}${p.vence_at ? ` · para el ${p.vence_at}` : ''}.`);
    return responder(p.id);
  }

  if (accion === 'editar') {
    const r = await cargar(b.id); if (!r) return json({ error: 'No existe' }, 404);
    const u: any = {};
    if (b.titulo !== undefined) { u.titulo = limpiar(b.titulo, 160); if (!u.titulo) return json({ error: 'Falta el título' }, 400); }
    if (b.cuerpo !== undefined) u.cuerpo = limpiar(b.cuerpo, 8000);
    if (b.tipo !== undefined && TIPOS.has(b.tipo)) u.tipo = b.tipo;
    if (b.responsable_id !== undefined) u.responsable_id = esUuid(b.responsable_id) ? b.responsable_id : null;
    if (b.vence_at !== undefined) u.vence_at = fecha(b.vence_at);
    if (!Object.keys(u).length) return json({ error: 'Nada que cambiar' }, 400);
    const { error } = await supabase.from('espacio_publicaciones').update(u).eq('id', r.p.id);
    if (error) return json({ error: error.message }, 500);
    if (u.responsable_id && u.responsable_id !== r.p.responsable_id) await avisarResponsable(u.responsable_id, r.c, `Te asignaron: ${(u.titulo || r.p.titulo).slice(0, 80)}`, `${ETIQ[u.tipo || r.p.tipo]} en #${r.c.nombre}.`);
    return responder(r.p.id);
  }

  if (accion === 'estado') {
    const r = await cargar(b.id); if (!r) return json({ error: 'No existe' }, 404);
    const estado = b.estado === 'cerrada' ? 'cerrada' : 'abierta';
    await supabase.from('espacio_publicaciones').update({ estado, cerrada_at: estado === 'cerrada' ? new Date().toISOString() : null }).eq('id', r.p.id);
    return responder(r.p.id);
  }

  if (accion === 'fijar') {
    const r = await cargar(b.id); if (!r) return json({ error: 'No existe' }, 404);
    await supabase.from('espacio_publicaciones').update({ fijada: !!b.fijada }).eq('id', r.p.id);
    return responder(r.p.id);
  }

  if (accion === 'borrar') {
    const r = await cargar(b.id); if (!r) return json({ error: 'No existe' }, 404);
    if (r.p.autor_id !== yo.id && yo.role !== 'founder') return json({ error: 'Solo quien la creó puede borrarla' }, 403);
    // La tarjeta se va con ella (y con la tarjeta, sus comentarios).
    if (r.p.mensaje_id) await supabase.from('espacio_mensajes').delete().eq('id', r.p.mensaje_id);
    await supabase.from('espacio_publicaciones').delete().eq('id', r.p.id);
    await emitir({ tipo: 'pub', canal_id: r.c.id, id: r.p.id });
    if (r.p.mensaje_id) await emitir({ tipo: 'msg_upd', canal_id: r.c.id, id: r.p.mensaje_id, hilo_de: null });
    return json({ ok: true });
  }

  if (accion === 'item_agregar') {
    const r = await cargar(b.id); if (!r) return json({ error: 'No existe' }, 404);
    const texto = limpiar(b.texto, 500); if (!texto) return json({ error: 'Falta el texto' }, 400);
    if (r.p.n >= 200) return json({ error: 'Máximo 200 renglones por publicación' }, 400);
    const orden = r.p.items.length ? Math.max(...r.p.items.map((i: any) => i.orden)) + 1 : 0;
    const responsable_id = esUuid(b.responsable_id) ? b.responsable_id : null;
    const { error } = await supabase.from('espacio_publicacion_items').insert({ publicacion_id: r.p.id, texto, grupo: grupoDe(b.grupo), orden, responsable_id, vence_at: fecha(b.vence_at) });
    if (error) return json({ error: error.message }, 500);
    await avisarResponsable(responsable_id, r.c, `Te tocó: ${texto.slice(0, 80)}`, `De "${r.p.titulo}" en #${r.c.nombre}.`);
    return responder(r.p.id);
  }

  if (accion === 'item_editar') {
    const r = await cargarPorItem(b.item_id); if (!r) return json({ error: 'No existe' }, 404);
    const u: any = {};
    if (b.texto !== undefined) { u.texto = limpiar(b.texto, 500); if (!u.texto) return json({ error: 'Falta el texto' }, 400); }
    if (b.grupo !== undefined) u.grupo = grupoDe(b.grupo);
    if (b.responsable_id !== undefined) u.responsable_id = esUuid(b.responsable_id) ? b.responsable_id : null;
    if (b.vence_at !== undefined) u.vence_at = fecha(b.vence_at);
    if (!Object.keys(u).length) return json({ error: 'Nada que cambiar' }, 400);
    const { error } = await supabase.from('espacio_publicacion_items').update(u).eq('id', r.it.id);
    if (error) return json({ error: error.message }, 500);
    if (u.responsable_id && u.responsable_id !== r.it.responsable_id) await avisarResponsable(u.responsable_id, r.c, `Te tocó: ${(u.texto || r.it.texto).slice(0, 80)}`, `De "${r.p.titulo}" en #${r.c.nombre}.`);
    return responder(r.p.id);
  }

  if (accion === 'item_hecho') {
    const r = await cargarPorItem(b.item_id); if (!r) return json({ error: 'No existe' }, 404);
    const hecho = !!b.hecho;
    await supabase.from('espacio_publicacion_items').update({ hecho_at: hecho ? new Date().toISOString() : null, hecho_por: hecho ? yo.id : null }).eq('id', r.it.id);
    return responder(r.p.id);
  }

  if (accion === 'item_borrar') {
    const r = await cargarPorItem(b.item_id); if (!r) return json({ error: 'No existe' }, 404);
    await supabase.from('espacio_publicacion_items').delete().eq('id', r.it.id);
    return responder(r.p.id);
  }

  if (accion === 'item_orden') {
    const r = await cargar(b.id); if (!r) return json({ error: 'No existe' }, 404);
    const orden: string[] = Array.isArray(b.orden) ? b.orden.filter(esUuid) : [];
    const mios = new Set(r.p.items.map((i: any) => i.id));
    let k = 0;
    for (const id of orden) if (mios.has(id)) await supabase.from('espacio_publicacion_items').update({ orden: k++ }).eq('id', id);
    return responder(r.p.id);
  }

  return json({ error: 'Acción desconocida' }, 400);
};
