// POST /api/crm/espacio/canales  { seccion_id, nombre, descripcion?, tipo?: charla|sala, importante?, regla_reunion? }
// POST /api/crm/espacio/canales  { tipo:'directo', con: <usuario_id> }   → abre (o devuelve) el directo
// PUT  /api/crm/espacio/canales  { id, nombre?, descripcion?, tipo?, importante?, regla_reunion?, seccion_id?, orden?, archivar?: true|false }
//      archivar:false lo restaura. Un canal de Sistema solo cambia descripción, importante, sección y orden.
// DELETE /api/crm/espacio/canales?id=…   → lo borra DE VERDAD, con todos sus mensajes, hilos,
//      reacciones, lecturas, reuniones y archivos. Solo founders. Sistema no se borra.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, emitir, slug, canalDe, equipo, puedeVerCanal } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

function reglaOk(r: any): boolean {
  if (r === null || r === undefined) return true;
  return typeof r === 'object' && Number.isInteger(r.dia_iso) && r.dia_iso >= 1 && r.dia_iso <= 7
    && typeof r.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.hora);
}

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));

  if (b.tipo === 'directo') {
    if (!esUuid(b.con) || b.con === yo.id) return json({ error: 'Con quién' }, 400);
    const eq = await equipo();
    if (!eq.some(p => p.id === b.con)) return json({ error: 'Esa persona no está en el equipo' }, 404);
    const participantes = [yo.id, b.con].sort();
    const { data: ya } = await supabase.from('espacio_canales').select('*').eq('tipo', 'directo').contains('participantes', participantes).containedBy('participantes', participantes).maybeSingle();
    if (ya) return json({ ok: true, canal: ya, existia: true });
    const { data, error } = await supabase.from('espacio_canales')
      .insert({ nombre: 'directo', tipo: 'directo', participantes, creado_por: yo.id }).select('*').single();
    if (error) return json({ error: error.message }, 500);
    await emitir({ tipo: 'canal', canal_id: data.id });
    return json({ ok: true, canal: data });
  }

  if (!esUuid(b.seccion_id)) return json({ error: 'Falta la sección' }, 400);
  const nombre = slug(b.nombre);
  if (nombre.length < 2) return json({ error: 'El nombre lleva de 2 a 40 letras (minúsculas, números y guiones)' }, 400);
  const tipo = b.tipo === 'sala' ? 'sala' : 'charla';
  if (!reglaOk(b.regla_reunion)) return json({ error: 'La regla de reunión es {dia_iso: 1..7, hora: "HH:MM"}' }, 400);
  const { data: max } = await supabase.from('espacio_canales').select('orden').eq('seccion_id', b.seccion_id).order('orden', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from('espacio_canales').insert({
    seccion_id: b.seccion_id, nombre, descripcion: String(b.descripcion || '').slice(0, 200) || null,
    tipo, importante: !!b.importante, regla_reunion: tipo === 'sala' ? (b.regla_reunion || null) : null,
    orden: (max?.orden || 0) + 1, creado_por: yo.id,
  }).select('*').single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return json({ error: `Ya hay un canal #${nombre} en esa sección` }, 409);
    return json({ error: error.message }, 500);
  }
  await emitir({ tipo: 'canal', canal_id: data.id });
  return json({ ok: true, canal: data });
};

export const PUT: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const c = await canalDe(b.id);
  if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Canal no encontrado' }, 404);
  if (c.tipo === 'directo') return json({ error: 'Un directo no se edita' }, 400);
  if (c.tipo === 'sistema' && (b.nombre !== undefined || b.tipo !== undefined || b.archivar !== undefined)) {
    return json({ error: 'Los canales de Sistema no se renombran, ni cambian de tipo, ni se archivan' }, 400);
  }
  const patch: any = {};
  if (b.nombre !== undefined) { const n = slug(b.nombre); if (n.length < 2) return json({ error: 'El nombre lleva de 2 a 40 letras (minúsculas, números y guiones)' }, 400); patch.nombre = n; }
  if (b.descripcion !== undefined) patch.descripcion = String(b.descripcion || '').slice(0, 200) || null;
  if (typeof b.importante === 'boolean') patch.importante = b.importante;
  if (b.tipo !== undefined) {
    if (b.tipo !== 'charla' && b.tipo !== 'sala') return json({ error: 'El tipo es charla o sala' }, 400);
    patch.tipo = b.tipo;
  }
  const tipoFinal = patch.tipo || c.tipo;
  if (b.regla_reunion !== undefined) { if (!reglaOk(b.regla_reunion)) return json({ error: 'La regla de reunión es {dia_iso: 1..7, hora: "HH:MM"}' }, 400); patch.regla_reunion = b.regla_reunion; }
  // Una charla no tiene regla de reunión: si deja de ser sala, la regla se va con ella.
  if (tipoFinal !== 'sala') patch.regla_reunion = null;
  if (b.seccion_id !== undefined) {
    if (!esUuid(b.seccion_id)) return json({ error: 'Sección inválida' }, 400);
    const { data: sec } = await supabase.from('espacio_secciones').select('id').eq('id', b.seccion_id).is('archivada_at', null).maybeSingle();
    if (!sec) return json({ error: 'Esa sección no existe o está archivada' }, 404);
    patch.seccion_id = b.seccion_id;
    // Al cambiar de sección va al final de la nueva, no a competir con el orden viejo.
    if (b.seccion_id !== c.seccion_id && !Number.isFinite(b.orden)) {
      const { data: max } = await supabase.from('espacio_canales').select('orden').eq('seccion_id', b.seccion_id).order('orden', { ascending: false }).limit(1).maybeSingle();
      patch.orden = (max?.orden || 0) + 1;
    }
  }
  if (Number.isFinite(b.orden)) patch.orden = Math.trunc(b.orden);
  if (b.archivar === true) patch.archivado_at = new Date().toISOString();
  if (b.archivar === false) patch.archivado_at = null;
  if (!Object.keys(patch).length) return json({ error: 'Nada que cambiar' }, 400);
  const { error } = await supabase.from('espacio_canales').update(patch).eq('id', c.id);
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return json({ error: `Ya hay un canal #${patch.nombre || c.nombre} en esa sección` }, 409);
    return json({ error: error.message }, 500);
  }
  await emitir({ tipo: 'canal', canal_id: c.id });
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const c = await canalDe(url.searchParams.get('id') || '');
  if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Canal no encontrado' }, 404);
  if (c.tipo === 'sistema') return json({ error: 'Los canales de Sistema no se borran: el CRM escribe en ellos' }, 400);
  // Un directo lo cierra cualquiera de sus dos personas; lo demás, solo un founder.
  if (c.tipo !== 'directo' && yo.role !== 'founder') return json({ error: 'Solo un founder borra canales' }, 403);

  // 1. Los archivos del bucket no caen en cascada: hay que juntarlos antes de borrar.
  const { data: filas } = await supabase.from('espacio_mensajes').select('adjuntos').eq('canal_id', c.id).is('borrado_at', null);
  const paths = (filas || []).flatMap((r: any) => (Array.isArray(r.adjuntos) ? r.adjuntos : []).flatMap((a: any) => [a.path, a.thumb])).filter(Boolean) as string[];
  const { count: mensajes } = await supabase.from('espacio_mensajes').select('id', { count: 'exact', head: true }).eq('canal_id', c.id);

  // 2. Los avisos que apuntaban aquí quedarían como ligas rotas en la campana.
  await supabase.from('crm_notificaciones').delete().eq('metadata->>canal_id', c.id);

  // 3. El canal: mensajes, hilos, reacciones, lecturas, seguimientos, sesiones y puntos caen en cascada (FK).
  const { error } = await supabase.from('espacio_canales').delete().eq('id', c.id);
  if (error) return json({ error: error.message }, 500);

  // 4. Los archivos, en tandas (Storage acepta hasta ~1000 por llamada; vamos sobrados).
  for (let i = 0; i < paths.length; i += 200) {
    await supabase.storage.from('espacio').remove(paths.slice(i, i + 200)).catch(() => null);
  }
  await emitir({ tipo: 'canal', canal_id: c.id });
  return json({ ok: true, mensajes: mensajes || 0, archivos: paths.length });
};
