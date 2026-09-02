// TRABAJO INTELIGENTE · «Próximos envíos» del agente SDR (N2: auto con veto).
// GET  → { pendientes, recientes, config }   lo que va a salir y lo que ya pasó
// POST { id, accion: 'vetar'|'editar'|'enviar_ya', mensaje?, motivo? }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { getCurrentUser } from '../../../../lib/auth/scope';
import { leerConfig } from '../../../../lib/crm/ti/motor';

export const prerender = false;
const json = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const cfg: any = await leerConfig();
  const [{ data: pend }, { data: rec }] = await Promise.all([
    supabase.from('ti_envios').select('id, contact_id, conversation_id, telefono, origen, estado, mensaje, mensaje_original, salida, sale_at, created_at, imagen_id, imagen_url')
      .eq('estado', 'pendiente').order('sale_at', { ascending: true }).limit(50),
    supabase.from('ti_envios').select('id, contact_id, telefono, origen, estado, mensaje, mensaje_original, salida, sale_at, enviado_at, motivo_veto, error, created_at, editado_por, humano_respuesta, humano_at, veredicto_par, imagen_id, imagen_url')
      .neq('estado', 'pendiente').order('updated_at', { ascending: false }).limit(30),
  ]);
  const ids = [...new Set([...(pend || []), ...(rec || [])].map((x: any) => x.contact_id).filter(Boolean))];
  const { data: cs } = ids.length ? await supabase.from('contacts').select('id, nombre, giro, lifecycle_stage').in('id', ids) : { data: [] as any[] };
  const por: Record<string, any> = {}; for (const c of cs || []) por[c.id] = c;
  const decorar = (x: any) => ({ ...x, contacto: por[x.contact_id] || null });
  // Lo que el agente ha aprendido de ti: para que se vea que las correcciones cuentan.
  const hace7 = new Date(Date.now() - 7 * 86400e3).toISOString();
  const [{ count: ejemplosDueno }, { count: ejemplos7 }, { count: vetos7 }, { count: ediciones7 }, { data: ultimos }] = await Promise.all([
    supabase.from('ia_ejemplos').select('id', { count: 'exact', head: true }).eq('fuente', 'correccion_dueno').eq('estado_rev', 'aprobado'),
    supabase.from('ia_ejemplos').select('id', { count: 'exact', head: true }).eq('fuente', 'correccion_dueno').gte('created_at', hace7),
    supabase.from('ti_envios').select('id', { count: 'exact', head: true }).eq('estado', 'vetado').gte('updated_at', hace7),
    supabase.from('ti_envios').select('id', { count: 'exact', head: true }).not('editado_por', 'is', null).gte('updated_at', hace7),
    supabase.from('ia_ejemplos').select('estado, situacion, pulida, created_at').eq('fuente', 'correccion_dueno').order('created_at', { ascending: false }).limit(3),
  ]);
  const { galeriaActiva } = await import('../../../../lib/crm/ti/imagenes-agente');
  const galeria = await galeriaActiva().catch(() => []);
  return json({
    galeria,
    pendientes: (pend || []).map(decorar), recientes: (rec || []).map(decorar),
    config: { agente_activo: cfg.agente_activo === true, veto_min: Number(cfg.agente_veto_min ?? 10), modo: cfg.agente_modo || 'sombra', pruebas: cfg.agente_prueba_telefonos || [] },
    aprendizaje: { ejemplos_dueno: ejemplosDueno || 0, ejemplos_7d: ejemplos7 || 0, vetos_7d: vetos7 || 0, ediciones_7d: ediciones7 || 0, ultimos: ultimos || [] },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getCurrentUser(request);
  if (!user) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const { id, accion } = b || {};
  // La GALERÍA del agente (imágenes que puede mandar) se administra desde aquí mismo.
  if (accion === 'galeria_agregar') {
    const nombre = String(b.nombre || '').trim().slice(0, 120), url = String(b.url || '').trim();
    if (nombre.length < 2 || !/^https?:\/\//.test(url)) return json({ error: 'Falta el nombre o la URL de la imagen' }, 400);
    const { data, error } = await supabase.from('ia_imagenes').insert({ nombre, url, descripcion: String(b.descripcion || '').trim().slice(0, 300) || null, cuando: String(b.cuando || '').trim().slice(0, 300) || null, giros: Array.isArray(b.giros) ? b.giros.slice(0, 10) : [], temas: Array.isArray(b.temas) ? b.temas.slice(0, 10) : [], created_by: user.id }).select('*').single();
    if (error) return json({ error: error.message }, 500);
    await supabase.from('ia_log').insert({ accion: 'galeria_imagen', razon: nombre, detalle: { imagen_id: data.id, por: user.id } });
    return json({ ok: true, imagen: data });
  }
  if (accion === 'galeria_quitar') {
    if (!b.imagen_id) return json({ error: 'Falta imagen_id' }, 400);
    await supabase.from('ia_imagenes').update({ activa: false }).eq('id', b.imagen_id);
    return json({ ok: true });
  }
  if (!id || !['vetar', 'editar', 'enviar_ya', 'par', 'imagen'].includes(accion)) return json({ error: 'Falta id o la acción no existe' }, 400);
  const { data: e } = await supabase.from('ti_envios').select('*').eq('id', id).maybeSingle();
  if (!e) return json({ error: 'No existe ese envío' }, 404);
  const ahora = new Date().toISOString();
  if (accion === 'par') {
    // El dueño juzga el par agente/humano: cuál debe aprender el agente.
    const v = String(b.veredicto || '');
    if (!['humano_mejor', 'agente_mejor', 'empate'].includes(v)) return json({ error: 'Veredicto inválido' }, 400);
    await supabase.from('ti_envios').update({ veredicto_par: v, updated_at: ahora }).eq('id', id);
    const estadoGuion = (e.salida as any)?.estado || 'descubriendo';
    // Los ejemplos dudosos del par se resuelven según el veredicto.
    await supabase.from('ia_ejemplos').update({ estado_rev: v === 'humano_mejor' ? 'aprobado' : 'rechazado', revisado_at: ahora }).eq('fuente', 'humano_antes').ilike('por_que', `%envio:${id}%`);
    if (v === 'agente_mejor') {
      await supabase.from('ia_ejemplos').insert({ estado: estadoGuion, situacion: 'El dueño prefirió la respuesta del agente sobre la del consultor', mensaje_lead: (e.salida as any)?.ultimo_mensaje || null, respuesta: e.mensaje, pulida: e.mensaje, por_que: `Validado por el dueño (par agente/humano · envio:${id}). El consultor había escrito: ${String(e.humano_respuesta || '').slice(0, 200)}`, fuente: 'correccion_dueno', contact_id: e.contact_id, conversation_id: e.conversation_id, estado_rev: 'aprobado', revisado_at: ahora });
    }
    await supabase.from('ia_log').insert({ accion: 'par_veredicto', contact_id: e.contact_id, razon: v, detalle: { envio_id: id, por: user.id } });
    return json({ ok: true, veredicto: v });
  }
  if (e.estado !== 'pendiente') return json({ error: `El envío ya está ${e.estado}` }, 409);
  if (accion === 'imagen') {
    // Adjuntar o quitar la imagen del envío pendiente. Es una corrección: queda como ejemplo (con o sin imagen).
    let img: any = null;
    if (b.imagen_id) { const { data } = await supabase.from('ia_imagenes').select('id, url, nombre').eq('id', b.imagen_id).eq('activa', true).maybeSingle(); img = data; if (!img) return json({ error: 'Esa imagen no está en la galería' }, 404); }
    await supabase.from('ti_envios').update({ imagen_id: img?.id || null, imagen_url: img?.url || null, editado_por: user.id, updated_at: ahora }).eq('id', id);
    const estadoGuion = (e.salida as any)?.estado || 'descubriendo';
    await supabase.from('ia_ejemplos').insert({ estado: estadoGuion, situacion: `El dueño ${img ? 'adjuntó la imagen «' + img.nombre + '»' : 'quitó la imagen'} a una respuesta del agente (${e.origen})`, mensaje_lead: (e.salida as any)?.ultimo_mensaje || null, respuesta: e.mensaje, pulida: e.mensaje, imagen_id: img?.id || null, por_que: `CRITERIO: ${img ? 'en este momento conviene mandar la imagen «' + img.nombre + '»' : 'aquí no hacía falta imagen'}\nEl dueño ajustó la imagen del envío ${id}.`, fuente: 'correccion_dueno', contact_id: e.contact_id, conversation_id: e.conversation_id, estado_rev: 'aprobado', revisado_at: ahora });
    await supabase.from('ia_log').insert({ accion: 'correccion_dueno', contact_id: e.contact_id, razon: img ? `imagen adjunta: ${img.nombre}` : 'imagen quitada', detalle: { envio_id: id, imagen_id: img?.id || null } });
    return json({ ok: true, imagen_id: img?.id || null, imagen_url: img?.url || null });
  }

  if (accion === 'vetar') {
    await supabase.from('ti_envios').update({ estado: 'vetado', vetado_por: user.id, motivo_veto: String(b.motivo || '').slice(0, 300) || null, updated_at: ahora }).eq('id', id);
    // El veto es señal de la rampa y lección del ciclo nocturno.
    await supabase.from('ia_log').insert({ accion: 'agente_vetado', contact_id: e.contact_id, razon: b.motivo || 'vetado por el humano', contenido: e.mensaje, detalle: { envio_id: id, por: user.id } });
    return json({ ok: true });
  }
  if (accion === 'editar') {
    const mensaje = String(b.mensaje || '').trim();
    if (mensaje.length < 2) return json({ error: 'El mensaje está vacío' }, 400);
    // «Qué debe considerar el agente»: la REGLA detrás del cambio, no solo el texto. Va al ejemplo (por_que) y de ahí a las reglas del ciclo nocturno.
    const criterio = String(b.criterio || '').trim().slice(0, 600);
    await supabase.from('ti_envios').update({ mensaje, mensaje_original: e.mensaje_original || e.mensaje, editado_por: user.id, updated_at: ahora }).eq('id', id);
    // La edición es una lección: lo que el humano hubiera dicho, con el contexto.
    const estadoGuion = (e.salida as any)?.estado || 'descubriendo';
    const { data: ej } = await supabase.from('ia_ejemplos').insert({
      estado: estadoGuion, situacion: `Edición del humano sobre una respuesta del agente (${e.origen})`,
      mensaje_lead: (e.salida as any)?.ultimo_mensaje || null, respuesta: mensaje, pulida: mensaje, imagen_id: e.imagen_id || null,
      por_que: `${criterio ? `CRITERIO: ${criterio}\n` : ''}El humano corrigió al agente. Original: ${e.mensaje}`, fuente: 'correccion_dueno', contact_id: e.contact_id, conversation_id: e.conversation_id,
      estado_rev: 'aprobado', revisado_at: ahora,
    }).select('id').single();
    await supabase.from('ia_log').insert({ accion: 'correccion_dueno', contact_id: e.contact_id, contenido: mensaje, razon: 'edición en Próximos envíos', detalle: { envio_id: id, ejemplo_id: ej?.id, estado: estadoGuion, original: e.mensaje, criterio: criterio || null } });
    if (b.enviar) {
      const { despacharEnvios } = await import('../../../../lib/crm/ti/agente');
      await supabase.from('ti_envios').update({ sale_at: ahora, updated_at: ahora }).eq('id', id);
      const r = await despacharEnvios({ forzar: true, soloId: id });
      return json({ ok: true, aprendido: { ejemplo_id: ej?.id, estado: estadoGuion }, enviado: r?.enviados === 1 });
    }
    return json({ ok: true, aprendido: { ejemplo_id: ej?.id, estado: estadoGuion } });
  }
  // enviar_ya
  await supabase.from('ti_envios').update({ sale_at: ahora, updated_at: ahora }).eq('id', id);
  try {
    const { despacharEnvios } = await import('../../../../lib/crm/ti/agente');
    const r = await despacharEnvios({ forzar: true, soloId: id });
    return json({ ok: true, ...r });
  } catch (err: any) { return json({ error: String(err?.message || err) }, 500); }
};
