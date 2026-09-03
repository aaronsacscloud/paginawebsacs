// POST /api/crm/espacio/secciones  { nombre }              → crea
// PUT  /api/crm/espacio/secciones  { id, nombre?, orden?, archivar? }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, emitir } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

const nombreOk = (n: any) => typeof n === 'string' && n.trim().length >= 2 && n.trim().length <= 30;

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!nombreOk(b.nombre)) return json({ error: 'El nombre lleva de 2 a 30 letras' }, 400);
  const { data: max } = await supabase.from('espacio_secciones').select('orden').order('orden', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from('espacio_secciones')
    .insert({ nombre: b.nombre.trim(), orden: (max?.orden || 0) + 1, creada_por: yo.id }).select('id, nombre, orden').single();
  if (error) return json({ error: error.message }, 500);
  await emitir({ tipo: 'canal' });
  return json({ ok: true, seccion: data });
};

export const PUT: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  if (!esUuid(b.id)) return json({ error: 'Falta id' }, 400);
  const patch: any = {};
  if (b.nombre !== undefined) { if (!nombreOk(b.nombre)) return json({ error: 'El nombre lleva de 2 a 30 letras' }, 400); patch.nombre = b.nombre.trim(); }
  if (Number.isFinite(b.orden)) patch.orden = Math.trunc(b.orden);
  if (b.archivar === true) {
    // Archivar una sección con canales vivos los dejaría huérfanos e invisibles.
    const { count } = await supabase.from('espacio_canales').select('id', { count: 'exact', head: true }).eq('seccion_id', b.id).is('archivado_at', null);
    if (count) return json({ error: `Tiene ${count} canal${count === 1 ? '' : 'es'} activo${count === 1 ? '' : 's'}; archívalos o muévelos primero` }, 409);
    patch.archivada_at = new Date().toISOString();
  }
  if (!Object.keys(patch).length) return json({ error: 'Nada que cambiar' }, 400);
  const { error } = await supabase.from('espacio_secciones').update(patch).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  await emitir({ tipo: 'canal' });
  return json({ ok: true });
};
