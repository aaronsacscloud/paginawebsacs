// POST /api/crm/espacio/secciones  { nombre }              → crea
// PUT  /api/crm/espacio/secciones  { id, nombre?, orden?, archivar?: true|false }   (archivar:false la restaura)
// DELETE /api/crm/espacio/secciones?id=…  → la borra; solo si no le queda ningún canal
//      (ni vivo ni archivado). La sección "Sistema" no se renombra ni se borra.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, emitir } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

const nombreOk = (n: any) => typeof n === 'string' && n.trim().length >= 2 && n.trim().length <= 30;
const esSistema = (s: { nombre: string } | null) => !!s && s.nombre.trim().toLowerCase() === 'sistema';

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
  const { data: sec } = await supabase.from('espacio_secciones').select('id, nombre, archivada_at').eq('id', b.id).maybeSingle();
  if (!sec) return json({ error: 'Sección no encontrada' }, 404);
  const patch: any = {};
  if (b.nombre !== undefined) {
    if (esSistema(sec)) return json({ error: 'La sección Sistema no se renombra: el CRM la busca por nombre' }, 400);
    if (!nombreOk(b.nombre)) return json({ error: 'El nombre lleva de 2 a 30 letras' }, 400);
    patch.nombre = b.nombre.trim();
  }
  if (Number.isFinite(b.orden)) patch.orden = Math.trunc(b.orden);
  if (b.archivar === true) {
    if (esSistema(sec)) return json({ error: 'La sección Sistema no se archiva' }, 400);
    // Archivar una sección con canales vivos los dejaría huérfanos e invisibles.
    const { count } = await supabase.from('espacio_canales').select('id', { count: 'exact', head: true }).eq('seccion_id', b.id).is('archivado_at', null);
    if (count) return json({ error: `Tiene ${count} canal${count === 1 ? '' : 'es'} activo${count === 1 ? '' : 's'}; archívalos o muévelos primero` }, 409);
    patch.archivada_at = new Date().toISOString();
  }
  if (b.archivar === false) patch.archivada_at = null;
  if (!Object.keys(patch).length) return json({ error: 'Nada que cambiar' }, 400);
  const { error } = await supabase.from('espacio_secciones').update(patch).eq('id', b.id);
  if (error) return json({ error: error.message }, 500);
  await emitir({ tipo: 'canal' });
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  if (yo.role !== 'founder') return json({ error: 'Solo un founder borra secciones' }, 403);
  const id = url.searchParams.get('id') || '';
  if (!esUuid(id)) return json({ error: 'Falta id' }, 400);
  const { data: sec } = await supabase.from('espacio_secciones').select('id, nombre').eq('id', id).maybeSingle();
  if (!sec) return json({ error: 'Sección no encontrada' }, 404);
  if (esSistema(sec)) return json({ error: 'La sección Sistema no se borra' }, 400);
  // Borrar con canales adentro los dejaría sin sección (FK set null) y perdidos en el árbol.
  const { count } = await supabase.from('espacio_canales').select('id', { count: 'exact', head: true }).eq('seccion_id', id);
  if (count) return json({ error: `Tiene ${count} canal${count === 1 ? '' : 'es'} (contando archivados); muévelos o bórralos primero` }, 409);
  const { error } = await supabase.from('espacio_secciones').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  await emitir({ tipo: 'canal' });
  return json({ ok: true });
};
