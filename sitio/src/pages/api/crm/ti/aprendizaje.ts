// TRABAJO INTELIGENTE · pestaña «Aprendizaje»: lo que el agente ya tiene aprobado y lo que
// falta por revisar. Decisión del dueño (2026-09-02): todo lo que aprobó y envió vive como
// APROBADO; lo demás (ejemplos propuestos por el ciclo nocturno, dudosos, pares agente/consultor
// sin veredicto y mensajes que salieron solos al vencer la ventana) espera en POR REVISAR, donde
// puede cambiar el texto, poner criterio e imagen, y aprobar o rechazar.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const COLS = 'id, estado, giro, situacion, mensaje_lead, respuesta, pulida, por_que, fuente, imagen_id, contact_id, estado_rev, usos, created_at, revisado_at';
const criterioDe = (por_que?: string | null) => (String(por_que || '').match(/^CRITERIO:\s*([^\n]+)/) || [])[1]?.trim() || '';
const conCriterio = (por_que: string | null | undefined, criterio: string) => {
  const resto = String(por_que || '').replace(/^CRITERIO:[^\n]*\n?/, '');
  return criterio ? `CRITERIO: ${criterio}\n${resto}` : resto;
};

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const [{ data: porRevisar }, { data: aprobados }, { count: rechazados }, { data: enviosSolos }, { data: pares }, { data: enviosAprobados }, { data: gal }] = await Promise.all([
    supabase.from('ia_ejemplos').select(COLS).in('estado_rev', ['propuesta', 'dudoso']).order('created_at', { ascending: false }).limit(120),
    supabase.from('ia_ejemplos').select(COLS).eq('estado_rev', 'aprobado').order('revisado_at', { ascending: false, nullsFirst: false }).limit(200),
    supabase.from('ia_ejemplos').select('id', { count: 'exact', head: true }).eq('estado_rev', 'rechazado'),
    supabase.from('ti_envios').select('id, contact_id, origen, mensaje, salida, enviado_at, imagen_id, imagen_url').eq('estado', 'enviado').is('aprobado_por', null).is('revisado_at', null).is('editado_por', null).order('enviado_at', { ascending: false }).limit(60),
    supabase.from('ti_envios').select('id, contact_id, origen, mensaje, salida, humano_respuesta, humano_at, estado, created_at').not('humano_respuesta', 'is', null).is('veredicto_par', null).order('created_at', { ascending: false }).limit(40),
    supabase.from('ti_envios').select('id, contact_id, origen, mensaje, mensaje_original, salida, enviado_at, imagen_id, imagen_url, editado_por').eq('estado', 'enviado').not('aprobado_por', 'is', null).order('enviado_at', { ascending: false }).limit(120),
    supabase.from('ia_imagenes').select('id, nombre, url, descripcion, cuando').eq('activa', true).order('usos', { ascending: false }).limit(40),
  ]);
  const ids = [...new Set([...(enviosSolos || []), ...(pares || []), ...(enviosAprobados || []), ...(porRevisar || []), ...(aprobados || [])].map((x: any) => x.contact_id).filter(Boolean))];
  const { data: cs } = ids.length ? await supabase.from('contacts').select('id, nombre, giro').in('id', ids) : { data: [] as any[] };
  const por: Record<string, any> = {}; for (const c of cs || []) por[c.id] = c;
  const dec = (x: any) => ({ ...x, criterio: criterioDe(x.por_que), contacto: x.contact_id ? por[x.contact_id] || null : null });
  return json({
    galeria: gal || [],
    por_revisar: { ejemplos: (porRevisar || []).map(dec), envios_solos: (enviosSolos || []).map(dec), pares: (pares || []).map(dec) },
    aprobados: { ejemplos: (aprobados || []).map(dec), envios: (enviosAprobados || []).map(dec) },
    rechazados: rechazados || 0,
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const ahora = new Date().toISOString();
  const criterio = String(b.criterio || '').trim().slice(0, 600);
  const imagen_id = b.imagen_id ? String(b.imagen_id) : null;
  if (imagen_id) { const { data } = await supabase.from('ia_imagenes').select('id').eq('id', imagen_id).eq('activa', true).maybeSingle(); if (!data) return json({ error: 'Esa imagen no está en la galería' }, 404); }

  // Un ejemplo (propuesto, dudoso o ya aprobado): aprobar / rechazar / editar.
  if (b.accion === 'ejemplo') {
    const { data: ej } = await supabase.from('ia_ejemplos').select(COLS).eq('id', b.id).maybeSingle();
    if (!ej) return json({ error: 'No existe ese ejemplo' }, 404);
    const pulida = String(b.pulida ?? ej.pulida ?? ej.respuesta ?? '').trim();
    if (b.decision === 'rechazar') {
      await supabase.from('ia_ejemplos').update({ estado_rev: 'rechazado', revisado_at: ahora, por_que: conCriterio(ej.por_que, criterio ? `rechazado: ${criterio}` : criterioDe(ej.por_que)) }).eq('id', ej.id);
      await supabase.from('ia_log').insert({ accion: 'ejemplo_rechazado', contact_id: ej.contact_id, razon: criterio || 'rechazado por el dueño', detalle: { ejemplo_id: ej.id, por: user.id } });
      return json({ ok: true, estado_rev: 'rechazado' });
    }
    if (pulida.length < 2) return json({ error: 'La respuesta está vacía' }, 400);
    const cambios: any = { pulida, por_que: conCriterio(ej.por_que, criterio), revisado_at: ahora };
    if ('imagen_id' in b) cambios.imagen_id = imagen_id;
    if (b.decision === 'aprobar' || ej.estado_rev === 'aprobado') cambios.estado_rev = 'aprobado';
    if (b.decision === 'aprobar' && ej.fuente !== 'correccion_dueno' && pulida !== String(ej.pulida || ej.respuesta || '').trim()) cambios.fuente = 'correccion_dueno'; // lo reescribió: es su criterio
    const { error } = await supabase.from('ia_ejemplos').update(cambios).eq('id', ej.id);
    if (error) return json({ error: error.message }, 500);
    await supabase.from('ia_log').insert({ accion: b.decision === 'aprobar' ? 'ejemplo_aprobado' : 'ejemplo_editado', contact_id: ej.contact_id, contenido: pulida, razon: criterio || null, detalle: { ejemplo_id: ej.id, imagen_id: cambios.imagen_id ?? ej.imagen_id, por: user.id } });
    return json({ ok: true, estado_rev: cambios.estado_rev || ej.estado_rev });
  }

  // Un mensaje que salió solo (o ya aprobado): validarlo tal cual, corregirlo o descartarlo.
  if (b.accion === 'envio') {
    const { data: e } = await supabase.from('ti_envios').select('*').eq('id', b.id).maybeSingle();
    if (!e) return json({ error: 'No existe ese envío' }, 404);
    if (b.decision === 'descartar') {
      await supabase.from('ti_envios').update({ revisado_at: ahora, updated_at: ahora }).eq('id', e.id);
      return json({ ok: true });
    }
    const pulida = String(b.pulida ?? e.mensaje ?? '').trim();
    if (pulida.length < 2) return json({ error: 'La respuesta está vacía' }, 400);
    const corrigio = pulida !== String(e.mensaje || '').trim();
    const estadoGuion = (e.salida as any)?.estado || 'descubriendo';
    const { data: ej, error } = await supabase.from('ia_ejemplos').insert({
      estado: estadoGuion, situacion: (e.salida as any)?.objetivo || `Respuesta del agente (${e.origen})`,
      mensaje_lead: (e.salida as any)?.ultimo_mensaje || null, respuesta: e.mensaje, pulida,
      imagen_id: 'imagen_id' in b ? imagen_id : (e.imagen_id || null),
      por_que: conCriterio(corrigio ? `El dueño corrigió al agente desde Aprendizaje. Original: ${e.mensaje}` : 'El dueño validó esta respuesta del agente tal cual desde Aprendizaje.', criterio),
      fuente: 'correccion_dueno', contact_id: e.contact_id, conversation_id: e.conversation_id, estado_rev: 'aprobado', revisado_at: ahora,
    }).select('id').single();
    if (error) return json({ error: error.message }, 500);
    await supabase.from('ti_envios').update({ revisado_at: ahora, aprobado_por: e.aprobado_por || user.id, updated_at: ahora }).eq('id', e.id);
    await supabase.from('ia_log').insert({ accion: corrigio ? 'correccion_dueno' : 'envio_validado', contact_id: e.contact_id, contenido: pulida, razon: criterio || (corrigio ? 'corrección desde Aprendizaje' : 'validado desde Aprendizaje'), detalle: { envio_id: e.id, ejemplo_id: ej.id } });
    return json({ ok: true, ejemplo_id: ej.id });
  }
  return json({ error: 'Acción desconocida' }, 400);
};
