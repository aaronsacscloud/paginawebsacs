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
const COLS = 'id, estado, giro, situacion, mensaje_lead, respuesta, pulida, por_que, fuente, imagen_id, adjuntos, contact_id, estado_rev, usos, created_at, revisado_at';
const criterioDe = (por_que?: string | null) => (String(por_que || '').match(/^CRITERIO:\s*([^\n]+)/) || [])[1]?.trim() || '';
const evitarDe = (por_que?: string | null) => (String(por_que || '').match(/^EVITAR:\s*([^\n]+)/m) || [])[1]?.trim() || '';
const conCriterio = (por_que: string | null | undefined, criterio: string, evitar = '') => {
  const resto = String(por_que || '').replace(/^CRITERIO:[^\n]*\n?/, '').replace(/^EVITAR:[^\n]*\n?/m, '');
  return `${criterio ? `CRITERIO: ${criterio}\n` : ''}${evitar ? `EVITAR: ${evitar}\n` : ''}${resto}`;
};

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const [{ data: porRevisar }, { data: aprobados }, { count: rechazados }, { data: enviosSolos }, { data: pares }, { data: enviosAprobados }, { data: gal }] = await Promise.all([
    supabase.from('ia_ejemplos').select(COLS).in('estado_rev', ['propuesta', 'dudoso']).order('created_at', { ascending: false }).limit(120),
    supabase.from('ia_ejemplos').select(COLS).eq('estado_rev', 'aprobado').order('revisado_at', { ascending: false, nullsFirst: false }).limit(200),
    supabase.from('ia_ejemplos').select('id', { count: 'exact', head: true }).eq('estado_rev', 'rechazado'),
    supabase.from('ti_envios').select('id, contact_id, origen, mensaje, salida, enviado_at, imagen_id, imagen_url, adjuntos').eq('estado', 'enviado').is('aprobado_por', null).is('revisado_at', null).is('editado_por', null).order('enviado_at', { ascending: false }).limit(60),
    supabase.from('ti_envios').select('id, contact_id, origen, mensaje, salida, humano_respuesta, humano_at, estado, created_at').not('humano_respuesta', 'is', null).is('veredicto_par', null).order('created_at', { ascending: false }).limit(40),
    supabase.from('ti_envios').select('id, contact_id, origen, mensaje, mensaje_original, salida, enviado_at, imagen_id, imagen_url, adjuntos, editado_por').eq('estado', 'enviado').not('aprobado_por', 'is', null).order('enviado_at', { ascending: false }).limit(120),
    supabase.from('ia_imagenes').select('id, nombre, url, descripcion, cuando, tipo, mime, bytes, usos, grupo').eq('activa', true).is('error', null).order('usos', { ascending: false }).limit(60),
  ]);
  const ids = [...new Set([...(enviosSolos || []), ...(pares || []), ...(enviosAprobados || []), ...(porRevisar || []), ...(aprobados || [])].map((x: any) => x.contact_id).filter(Boolean))];
  const { data: cs } = ids.length ? await supabase.from('contacts').select('id, nombre, giro').in('id', ids) : { data: [] as any[] };
  const por: Record<string, any> = {}; for (const c of cs || []) por[c.id] = c;
  const dec = (x: any) => ({ ...x, criterio: criterioDe(x.por_que), evitar: evitarDe(x.por_que), contacto: x.contact_id ? por[x.contact_id] || null : null });
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
  const evitar = String(b.evitar || '').trim().slice(0, 400);
  // Adjuntos (ids de la galería, máx. 2) → objetos {id,tipo,url,nombre}; `imagen_id` viejo se acepta como un adjunto.
  const ids: string[] = (Array.isArray(b.adjuntos) ? b.adjuntos.map(String) : b.imagen_id ? [String(b.imagen_id)] : []).slice(0, 5);
  const { data: recs } = ids.length ? await supabase.from('ia_imagenes').select('id, url, nombre, tipo').in('id', ids).eq('activa', true) : { data: [] as any[] };
  const adjuntos = ids.map(i => (recs || []).find((r: any) => r.id === i)).filter(Boolean).map((r: any) => ({ id: r.id, tipo: r.tipo || 'image', url: r.url, nombre: r.nombre }));
  if (adjuntos.length !== ids.length) return json({ error: 'Alguno de esos recursos ya no está en la galería' }, 404);
  const imagen_id = (adjuntos.find(a => a.tipo === 'image') || null)?.id || null;
  const tocaAdjuntos = 'adjuntos' in b || 'imagen_id' in b;

  // El agente REESCRIBE ese momento con el criterio del dueño (no envía nada): así se comprueba que entendió.
  if (b.accion === 'reescribir') {
    const { reescribirRespuesta } = await import('../../../../lib/crm/ti/agente');
    let base: any = {};
    if (b.tipo === 'envio') {
      const { data: e } = await supabase.from('ti_envios').select('contact_id, mensaje, salida').eq('id', b.id).maybeSingle();
      if (!e) return json({ error: 'No existe ese envío' }, 404);
      base = { contactId: e.contact_id, estado: (e.salida as any)?.estado, mensajeLead: (e.salida as any)?.ultimo_mensaje, situacion: (e.salida as any)?.objetivo, original: e.mensaje };
    } else {
      const { data: ej } = await supabase.from('ia_ejemplos').select(COLS).eq('id', b.id).maybeSingle();
      if (!ej) return json({ error: 'No existe ese ejemplo' }, 404);
      base = { contactId: ej.contact_id, estado: ej.estado, mensajeLead: ej.mensaje_lead, situacion: ej.situacion, original: ej.respuesta || ej.pulida };
    }
    const r = await reescribirRespuesta({ ...base, versionDueno: String(b.pulida || ''), criterio, evitar, enDos: !!b.en_dos, adjuntos: adjuntos.map(a => ({ nombre: a.nombre, tipo: a.tipo })) });
    if (!r.mensaje) return json({ error: 'El agente no devolvió una versión válida; intenta de nuevo.' }, 502);
    return json({ ok: true, mensaje: r.mensaje, que_cambie: r.que_cambie, costo: r.costo });
  }

  // Un ejemplo (propuesto, dudoso o ya aprobado): aprobar / rechazar / editar.
  if (b.accion === 'ejemplo') {
    const { data: ej } = await supabase.from('ia_ejemplos').select(COLS).eq('id', b.id).maybeSingle();
    if (!ej) return json({ error: 'No existe ese ejemplo' }, 404);
    const pulida = String(b.pulida ?? ej.pulida ?? ej.respuesta ?? '').trim();
    if (b.decision === 'rechazar') {
      await supabase.from('ia_ejemplos').update({ estado_rev: 'rechazado', revisado_at: ahora, por_que: conCriterio(ej.por_que, criterio ? `rechazado: ${criterio}` : criterioDe(ej.por_que), evitar || evitarDe(ej.por_que)) }).eq('id', ej.id);
      await supabase.from('ia_log').insert({ accion: 'ejemplo_rechazado', contact_id: ej.contact_id, razon: criterio || 'rechazado por el dueño', detalle: { ejemplo_id: ej.id, por: user.id } });
      return json({ ok: true, estado_rev: 'rechazado' });
    }
    if (pulida.length < 2) return json({ error: 'La respuesta está vacía' }, 400);
    const cambios: any = { pulida, por_que: conCriterio(ej.por_que, criterio || criterioDe(ej.por_que), evitar || evitarDe(ej.por_que)), revisado_at: ahora };
    if (b.reescrita_por_agente) cambios.lo_humano = 'aprobada la versión reescrita por el agente con el criterio del dueño';
    if (tocaAdjuntos) { cambios.imagen_id = imagen_id; cambios.adjuntos = adjuntos; }
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
      imagen_id: tocaAdjuntos ? imagen_id : (e.imagen_id || null), adjuntos: tocaAdjuntos ? adjuntos : (e.adjuntos || []),
      por_que: conCriterio(corrigio ? `El dueño corrigió al agente desde Aprendizaje${b.reescrita_por_agente ? ' (versión reescrita por el agente con su criterio)' : ''}. Original: ${e.mensaje}` : 'El dueño validó esta respuesta del agente tal cual desde Aprendizaje.', criterio, evitar),
      fuente: 'correccion_dueno', contact_id: e.contact_id, conversation_id: e.conversation_id, estado_rev: 'aprobado', revisado_at: ahora,
    }).select('id').single();
    if (error) return json({ error: error.message }, 500);
    await supabase.from('ti_envios').update({ revisado_at: ahora, aprobado_por: e.aprobado_por || user.id, updated_at: ahora }).eq('id', e.id);
    await supabase.from('ia_log').insert({ accion: corrigio ? 'correccion_dueno' : 'envio_validado', contact_id: e.contact_id, contenido: pulida, razon: criterio || (corrigio ? 'corrección desde Aprendizaje' : 'validado desde Aprendizaje'), detalle: { envio_id: e.id, ejemplo_id: ej.id } });
    return json({ ok: true, ejemplo_id: ej.id });
  }
  return json({ error: 'Acción desconocida' }, 400);
};
