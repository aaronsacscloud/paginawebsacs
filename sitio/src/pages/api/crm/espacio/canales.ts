// POST /api/crm/espacio/canales  { seccion_id, nombre, descripcion?, tipo?: charla|sala, importante?, regla_reunion? }
// POST /api/crm/espacio/canales  { tipo:'directo', con: <usuario_id> }   → abre (o devuelve) el directo
// PUT  /api/crm/espacio/canales  { id, nombre?, descripcion?, importante?, regla_reunion?, seccion_id?, orden?, archivar? }
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
  if (c.tipo === 'sistema' && (b.nombre !== undefined || b.archivar)) return json({ error: 'Los canales de Sistema no se renombran ni archivan' }, 400);
  const patch: any = {};
  if (b.nombre !== undefined) { const n = slug(b.nombre); if (n.length < 2) return json({ error: 'Nombre inválido' }, 400); patch.nombre = n; }
  if (b.descripcion !== undefined) patch.descripcion = String(b.descripcion || '').slice(0, 200) || null;
  if (typeof b.importante === 'boolean') patch.importante = b.importante;
  if (b.regla_reunion !== undefined) { if (!reglaOk(b.regla_reunion)) return json({ error: 'Regla inválida' }, 400); patch.regla_reunion = b.regla_reunion; }
  if (b.seccion_id !== undefined) { if (!esUuid(b.seccion_id)) return json({ error: 'Sección inválida' }, 400); patch.seccion_id = b.seccion_id; }
  if (Number.isFinite(b.orden)) patch.orden = Math.trunc(b.orden);
  if (b.archivar === true) patch.archivado_at = new Date().toISOString();
  if (!Object.keys(patch).length) return json({ error: 'Nada que cambiar' }, 400);
  const { error } = await supabase.from('espacio_canales').update(patch).eq('id', c.id);
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return json({ error: 'Ya hay un canal con ese nombre en esa sección' }, 409);
    return json({ error: error.message }, 500);
  }
  await emitir({ tipo: 'canal', canal_id: c.id });
  return json({ ok: true });
};
