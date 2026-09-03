// GET /api/crm/espacio/arbol
// Todo lo que el panel "Equipo" necesita para pintarse de una vez: secciones,
// canales visibles con sus no-leídos, el equipo con su presencia, y quién soy.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, equipo, puedeVerCanal, type Canal } from '../../../../lib/crm/espacio.lib';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);

  const [{ data: secciones }, { data: canales }, personas, { data: noLeidos }, { data: presencia }, { data: lecturas }] = await Promise.all([
    supabase.from('espacio_secciones').select('id, nombre, orden').is('archivada_at', null).order('orden'),
    supabase.from('espacio_canales').select('*').is('archivado_at', null).order('orden'),
    equipo(),
    supabase.rpc('espacio_no_leidos', { p_usuario: yo.id }),
    supabase.from('espacio_presencia').select('usuario_id, visto_at, estado, dispositivo'),
    supabase.from('espacio_lecturas').select('canal_id, silenciado, ultimo_leido_at').eq('usuario_id', yo.id),
  ]);

  const nl: Record<string, any> = {};
  for (const r of noLeidos || []) nl[r.canal_id] = r;
  const lec: Record<string, any> = {};
  for (const r of lecturas || []) lec[r.canal_id] = r;
  const pres: Record<string, any> = {};
  for (const r of presencia || []) pres[r.usuario_id] = r;

  const visibles = ((canales || []) as Canal[]).filter(c => puedeVerCanal(c, yo.id)).map(c => ({
    id: c.id, seccion_id: c.seccion_id, nombre: c.nombre, descripcion: c.descripcion, tipo: c.tipo,
    importante: c.importante, regla_reunion: c.regla_reunion, participantes: c.participantes, orden: c.orden,
    no_leidos: Number(nl[c.id]?.n || 0), menciones: Number(nl[c.id]?.menciones || 0),
    ultimo_at: nl[c.id]?.ultimo_at || null,
    silenciado: !!lec[c.id]?.silenciado,
    ultimo_leido_at: lec[c.id]?.ultimo_leido_at || null,
  }));

  return json({
    yo: { id: yo.id, nombre: yo.nombre, foto_url: yo.foto_url, role: yo.role },
    secciones: secciones || [],
    canales: visibles,
    personas: personas.map(p => ({
      id: p.id, nombre: p.nombre, foto_url: p.foto_url, rol: p.rol,
      visto_at: pres[p.id]?.visto_at || null, estado: pres[p.id]?.estado || 'fuera',
    })),
  });
};
