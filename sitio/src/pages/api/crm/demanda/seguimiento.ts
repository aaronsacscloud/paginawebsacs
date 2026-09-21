// GET  /api/crm/demanda/seguimiento            — cada pieza con sus señales y sus pendientes
// GET  /api/crm/demanda/seguimiento?id=…       — una pieza con todo
// POST /api/crm/demanda/seguimiento  { pendiente_id, estado }         — tachar / descartar / reabrir
// POST /api/crm/demanda/seguimiento  { id, accion: especialista|autoridad|angulos } — encolar una revisión ahora
//
// La pestaña «Seguimiento» del motor: el loop de contenido visto desde el
// dueño. Por cada pieza: en qué estado va, qué dijo el referee, qué le falta
// según los especialistas (y a quién le toca), qué autoridad tiene ya y qué
// piezas hermanas salieron de ella.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { encolar } from '../../../../lib/demanda/cola';
import { giroDe } from '../../../../lib/demanda/publicar';
import { palabras as contarPalabras } from '../../../../lib/demanda/bloques';

export const prerender = false;
const json = (b: any, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

function resumenPieza(p: any, pendientes: any[], hijas: any[]) {
  const ref = p.auditorias?.referee;
  const vals = ref?.puntajes ? Object.values(ref.puntajes as Record<string, number>) : [];
  const esp = p.auditorias?.especialista;
  const aut = p.auditorias?.autoridad;
  const pend = pendientes.filter(x => x.contenido_id === p.id);
  return {
    id: p.id, seccion: p.seccion, slug: p.slug, titulo: p.titulo, estado: p.estado,
    url: `/${p.seccion}/${p.slug}/`, preview: `/${p.seccion}/${p.slug}/?borrador=1`,
    publicado_at: p.publicado_at, actualizado_at: p.actualizado_at,
    palabras: contarPalabras(p.cuerpo || []),
    pregunta: p.brief?.pregunta || null, giro: giroDe(p.brief)?.label || null, portada: p.brief?.portada?.url || null,
    referee: ref ? { promedio: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null, probabilidad_cita: ref.probabilidad_cita ?? null, criterios_ok: (ref.criterios || []).filter((k: any) => k.ok).length, criterios: (ref.criterios || []).length, video_sugerido: ref.video_sugerido || '', necesita_del_dueno: ref.necesita_del_dueno || [] } : null,
    especialista: esp ? { seo: esp.seo, geo: esp.geo, cuando: esp.cuando } : null,
    autoridad: aut ? { score: aut.score, resumen: aut.resumen, senales: aut.senales, cuando: aut.cuando } : null,
    pendientes: pend.map(x => ({ id: x.id, origen: x.origen, titulo: x.titulo, detalle: x.detalle, quien: x.quien, prioridad: x.prioridad, impacto: x.impacto, estado: x.estado })),
    pendientes_abiertos: pend.filter(x => x.estado === 'pendiente').length,
    angulos: (p.brief?.angulos || []).map((a: any) => {
      const h = hijas.find(x => x.slug === a.slug);
      return { ...a, estado: h ? h.estado : 'en cola' };
    }),
    angulos_generados: p.brief?.angulos_generados || null,
  };
}

export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id');
  let q = supabase.from('de_contenido')
    .select('id, seccion, slug, titulo, estado, brief, cuerpo, auditorias, publicado_at, actualizado_at, created_at')
    .in('estado', ['aprobado', 'publicado', 'refrescar'])
    .order('publicado_at', { ascending: false, nullsFirst: true })
    .limit(80);
  if (id) q = q.eq('id', id);
  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, 500);
  const ids = (data || []).map(p => p.id);
  const { data: pendientes } = ids.length ? await supabase.from('de_contenido_pendientes').select('*').in('contenido_id', ids).order('prioridad').order('created_at') : { data: [] as any[] };
  // Las piezas hermanas que salieron de los ángulos, para decir en qué van.
  const slugsHijas = (data || []).flatMap(p => (p.brief as any)?.angulos?.map((a: any) => a.slug) || []).filter(Boolean);
  const { data: hijas } = slugsHijas.length ? await supabase.from('de_contenido').select('slug, estado').in('slug', slugsHijas) : { data: [] as any[] };
  const piezas = (data || []).map(p => resumenPieza(p, pendientes || [], hijas || []));
  const totales = {
    piezas: piezas.length,
    publicadas: piezas.filter(p => p.estado === 'publicado').length,
    pendientes_dueno: (pendientes || []).filter(x => x.estado === 'pendiente' && x.quien === 'dueno').length,
    pendientes_motor: (pendientes || []).filter(x => x.estado === 'pendiente' && x.quien === 'motor').length,
    hechos: (pendientes || []).filter(x => x.estado === 'hecho').length,
  };
  return json({ ok: true, piezas, totales });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ ok: false, error: 'sin sesión' }, 401);
  const b = (await request.json().catch(() => ({}))) as any;

  if (b.pendiente_id && b.estado) {
    if (!['pendiente', 'hecho', 'descartado'].includes(b.estado)) return json({ ok: false, error: 'estado inválido' }, 400);
    const { error } = await supabase.from('de_contenido_pendientes').update({ estado: b.estado, hecho_at: b.estado === 'pendiente' ? null : new Date().toISOString() }).eq('id', b.pendiente_id);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true });
  }

  if (b.id && ['especialista', 'autoridad', 'angulos'].includes(b.accion)) {
    /* Se ENCOLA, no se corre aquí: cada revisión son dos llamadas largas al
       modelo y una API de Vercel no vive tanto. El worker la toma en minutos. */
    const r = await encolar({
      tipo: `contenido.${b.accion}`,
      clave_idem: `contenido.${b.accion}:${b.id}:${new Date().toISOString().slice(0, 13)}`,
      payload: { contenido_id: b.id, limite: 1 },
      prioridad: 60, creada_por: `bandeja:${user.id}`, motivo: 'pedida desde Seguimiento',
    });
    return json({ ok: true, encolada: r });
  }

  return json({ ok: false, error: 'faltan parámetros' }, 400);
};
