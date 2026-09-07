// Ferias y eventos · el catálogo y el calendario.
//
// GET  /api/crm/eventos            → eventos con sus ediciones (pasadas recientes + 18 meses) y resumen
// POST /api/crm/eventos { accion, … }
//   decision        { evento_id, decision: ir|evaluar|no_ir, nota }
//   guardar_evento  { evento_id?, …campos }           (sin evento_id crea uno nuevo)
//   crear_edicion   { evento_id, nombre, inicio, fin, ciudad, sede, estado_fecha, url_registro }
//   guardar_edicion { edicion_id, …campos }           (participación, rol, metas, presupuesto, stand, plantilla…)
//   borrar_edicion  { edicion_id }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar } from '../../../../lib/crm/abm.lib';
import { generarTareas, tokenPublico, diaMX } from '../../../../lib/crm/eventos.lib';

export const prerender = false;

const CAMPOS_EVENTO = ['nombre', 'tipo', 'organizador', 'sede', 'ciudad', 'estado_geo', 'sitio_web', 'instagram', 'correo_contacto', 'telefono', 'frecuencia', 'fuente_cifras', 'perfil_expositor', 'perfil_visitante', 'costo_stand', 'costo_entrada', 'fuente_costos', 'como_participar', 'descripcion', 'quien_es_prospecto', 'fit_por_que', 'rol_recomendado', 'prospectos_alcanzables', 'huecos'];
const CAMPOS_EDICION = ['nombre', 'inicio', 'fin', 'estado_fecha', 'fuente_fecha', 'ciudad', 'sede', 'limite_registro', 'url_registro', 'participacion', 'rol', 'stand_numero', 'notas', 'plantilla_wa'];
const ENTEROS_EDICION = ['meta_registros', 'meta_demos', 'meta_clientes'];

export const GET: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const hoy = diaMX(null);
  const desde = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  const hasta = new Date(Date.now() + 550 * 864e5).toISOString().slice(0, 10);
  const [{ data: eventos, error: e1 }, { data: ediciones, error: e2 }] = await Promise.all([
    supabase.from('ev_eventos').select('*').order('fit_puntaje', { ascending: false }).order('nombre'),
    supabase.from('ev_ediciones').select('id, evento_id, nombre, inicio, fin, estado_fecha, ciudad, sede, limite_registro, url_registro, participacion, rol, stand_numero, meta_registros, meta_demos, meta_clientes, presupuesto, token_publico, retro').gte('inicio', desde).lte('inicio', hasta).order('inicio'),
  ]);
  if (e1 || e2) return json({ error: (e1 || e2)!.message }, 500);
  // Cuántos registros trae cada edición. Se pagina a mano: PostgREST corta en 1000
  // filas sin avisar y el KPI se congelaba ahí.
  const ids = (ediciones || []).map(e => e.id);
  const conteo: Record<string, number> = {};
  for (let i = 0; i < ids.length; i += 150) {
    for (let desde = 0; ; desde += 1000) {
      const { data } = await supabase.from('ev_registros').select('edicion_id').in('edicion_id', ids.slice(i, i + 150)).order('id').range(desde, desde + 999);
      for (const r of data || []) conteo[r.edicion_id] = (conteo[r.edicion_id] || 0) + 1;
      if (!data || data.length < 1000) break;
    }
  }
  // Lo que urge: plazos para apartar en los próximos 30 días (de eventos que vamos o que
  // encajan) y tareas vencidas de las ediciones a las que vamos. Es lo primero que se ve.
  const vamosIds = (ediciones || []).filter(e => e.participacion === 'vamos' && (e.fin || e.inicio) >= hoy).map(e => e.id);
  const vencidas: Record<string, number> = {};
  if (vamosIds.length) {
    const { data: tv } = await supabase.from('ev_tareas').select('edicion_id').in('edicion_id', vamosIds).eq('hecha', false).lt('vence', hoy);
    for (const t of tv || []) vencidas[t.edicion_id] = (vencidas[t.edicion_id] || 0) + 1;
  }
  const en30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), en60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const porEventoId = new Map((eventos || []).map(e => [e.id, e]));
  const urge = (ediciones || []).flatMap(ed => {
    const ev: any = porEventoId.get(ed.evento_id); const out: any[] = [];
    const encaja = ev && (ev.decision === 'ir' || Number(ev.fit_puntaje || 0) >= 8 || ed.participacion === 'vamos');
    if (encaja && ed.participacion !== 'no_vamos' && ed.limite_registro && ed.limite_registro >= hoy && ed.limite_registro <= en30)
      out.push({ tipo: 'plazo', edicion_id: ed.id, evento: ev.nombre, edicion: ed.nombre, fecha: ed.limite_registro, participacion: ed.participacion });
    // Encaja, es en menos de 60 días y nadie ha dicho si vamos: eso también urge, aunque
    // no haya plazo capturado (la mayoría de las ferias no lo publican).
    else if (encaja && ed.participacion === 'sin_decidir' && ed.inicio >= hoy && ed.inicio <= en60)
      out.push({ tipo: 'decidir', edicion_id: ed.id, evento: ev.nombre, edicion: ed.nombre, fecha: ed.inicio, participacion: ed.participacion });
    if (vencidas[ed.id]) out.push({ tipo: 'tareas', edicion_id: ed.id, evento: ev?.nombre, edicion: ed.nombre, n: vencidas[ed.id], inicio: ed.inicio });
    return out;
  }).sort((a, b) => String(a.fecha || a.inicio).localeCompare(String(b.fecha || b.inicio)));
  const porEvento: Record<string, any[]> = {};
  for (const ed of ediciones || []) (porEvento[ed.evento_id] ||= []).push({ ...ed, registros: conteo[ed.id] || 0 });
  const lista = (eventos || []).map(ev => ({ ...ev, ediciones: porEvento[ev.id] || [] }));
  const resumen = {
    eventos: lista.length,
    vamos: lista.filter(e => e.decision === 'ir').length,
    por_evaluar: lista.filter(e => e.decision === 'evaluar').length,
    proximas: (ediciones || []).filter(e => e.inicio >= hoy).length,
    con_participacion: (ediciones || []).filter(e => e.participacion === 'vamos' && e.inicio >= hoy).length,
    registros_total: Object.values(conteo).reduce((a, b) => a + b, 0),
  };
  return json({ eventos: lista, resumen, hoy, urge });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const ahora = new Date().toISOString();

  if (b.accion === 'decision') {
    if (!esUuid(b.evento_id) || !['ir', 'evaluar', 'no_ir'].includes(b.decision)) return json({ error: 'datos' }, 400);
    const { error } = await supabase.from('ev_eventos').update({ decision: b.decision, decision_nota: limpiar(b.nota, 500) || null, decision_por: yo.id, decision_at: ahora, updated_at: ahora }).eq('id', b.evento_id);
    // La decisión del evento arrastra a la siguiente edición que nadie ha tocado:
    // decir "vamos" al evento y ver "sin decidir" en la fecha era una contradicción
    // en pantalla y una lista de preparación que no se generaba.
    if (!error && b.decision !== 'evaluar') {
      const { data: ev } = await supabase.from('ev_eventos').select('rol_recomendado').eq('id', b.evento_id).maybeSingle();
      const { data: prox } = await supabase.from('ev_ediciones').select('id, participacion').eq('evento_id', b.evento_id).gte('inicio', ahora.slice(0, 10)).order('inicio').limit(1).maybeSingle();
      if (prox && prox.participacion === 'sin_decidir') {
        const rol = ev?.rol_recomendado && ev.rol_recomendado !== 'ninguno' ? ev.rol_recomendado : 'recorrido';
        await supabase.from('ev_ediciones').update(b.decision === 'ir' ? { participacion: 'vamos', rol, updated_at: ahora } : { participacion: 'no_vamos', updated_at: ahora }).eq('id', prox.id);
        if (b.decision === 'ir') await generarTareas(prox.id);
      }
    }
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (b.accion === 'guardar_evento') {
    const fila: any = { updated_at: ahora };
    for (const k of CAMPOS_EVENTO) if (k in b) fila[k] = limpiar(b[k], 4000) || null;
    if ('giros' in b) fila.giros = Array.isArray(b.giros) ? b.giros.map((g: any) => limpiar(g, 40)).filter(Boolean).slice(0, 12) : [];
    for (const k of ['expositores_n', 'visitantes_n', 'fit_puntaje']) if (k in b) fila[k] = b[k] === '' || b[k] == null ? null : Math.max(0, Math.round(Number(b[k]) || 0));
    if ('area_tecnologia' in b) fila.area_tecnologia = b.area_tecnologia == null ? null : !!b.area_tecnologia;
    if (esUuid(b.evento_id)) {
      const { error } = await supabase.from('ev_eventos').update(fila).eq('id', b.evento_id);
      return error ? json({ error: error.message }, 500) : json({ ok: true, id: b.evento_id });
    }
    if (!fila.nombre) return json({ error: 'el nombre es obligatorio' }, 400);
    fila.slug = limpiar(b.slug, 60) || String(fila.nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    fila.tipo = fila.tipo || 'feria_comercial';
    const { data, error } = await supabase.from('ev_eventos').insert(fila).select('id').single();
    return error ? json({ error: error.message }, 500) : json({ ok: true, id: data.id });
  }

  if (b.accion === 'crear_edicion') {
    if (!esUuid(b.evento_id) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.inicio || ''))) return json({ error: 'evento y fecha de inicio' }, 400);
    const fila: any = { evento_id: b.evento_id, inicio: b.inicio, token_publico: tokenPublico() };
    for (const k of CAMPOS_EDICION) if (k in b && k !== 'inicio') fila[k] = limpiar(b[k], 400) || null;
    if (!fila.nombre) { const { data: ev } = await supabase.from('ev_eventos').select('nombre').eq('id', b.evento_id).maybeSingle(); fila.nombre = `${ev?.nombre || 'Edición'} ${b.inicio.slice(0, 7)}`; }
    fila.estado_fecha = ['confirmada', 'estimada', 'pasada'].includes(fila.estado_fecha) ? fila.estado_fecha : 'estimada';
    // Plazo para apartar: 90 días antes si eso todavía está en el futuro; si ya pasó, se
    // deja vacío — un plazo "vencido" de fábrica ni avisa ni sirve para decidir.
    if (!fila.limite_registro) { const d = new Date(b.inicio + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 90); const lim = d.toISOString().slice(0, 10); fila.limite_registro = lim > diaMX(null) ? lim : null; }
    fila.participacion = 'sin_decidir';
    const { data, error } = await supabase.from('ev_ediciones').insert(fila).select('id').single();
    return error ? json({ error: error.message }, 500) : json({ ok: true, id: data.id });
  }

  if (b.accion === 'guardar_edicion') {
    if (!esUuid(b.edicion_id)) return json({ error: 'edicion_id' }, 400);
    const fila: any = { updated_at: ahora };
    for (const k of CAMPOS_EDICION) if (k in b) fila[k] = limpiar(b[k], 2000) || null;
    for (const k of ENTEROS_EDICION) if (k in b) fila[k] = b[k] === '' || b[k] == null ? null : Math.max(0, Math.round(Number(b[k]) || 0));
    if ('presupuesto' in b) fila.presupuesto = b.presupuesto === '' || b.presupuesto == null ? null : Math.max(0, Number(b.presupuesto) || 0);
    if ('email_bienvenida' in b) fila.email_bienvenida = !!b.email_bienvenida;
    if ('horario_stand' in b) {
      const h = b.horario_stand || {};
      const hora = (v: any, def: string) => /^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : def;
      fila.horario_stand = b.horario_stand ? { desde: hora(h.desde, '10:00'), hasta: hora(h.hasta, '18:00'), duracion: Math.min(60, Math.max(10, Number(h.duracion) || 15)), cupo: Math.min(6, Math.max(1, Number(h.cupo) || 1)) } : null;
    }
    if ('equipo' in b) fila.equipo = Array.isArray(b.equipo) ? b.equipo.slice(0, 20).map((p: any) => ({ id: esUuid(p?.id) ? p.id : null, nombre: limpiar(p?.nombre, 80) })) : [];
    if (fila.participacion && !['sin_decidir', 'vamos', 'no_vamos', 'fuimos'].includes(fila.participacion)) delete fila.participacion;
    if (fila.rol && !['stand', 'recorrido', 'visitante', 'patrocinio'].includes(fila.rol)) delete fila.rol;
    if (fila.estado_fecha && !['confirmada', 'estimada', 'pasada'].includes(fila.estado_fecha)) delete fila.estado_fecha;
    if (fila.inicio && !/^\d{4}-\d{2}-\d{2}$/.test(fila.inicio)) delete fila.inicio;
    if ('fin' in fila && fila.fin && !/^\d{4}-\d{2}-\d{2}$/.test(fila.fin)) delete fila.fin;
    if ('limite_registro' in fila && fila.limite_registro && !/^\d{4}-\d{2}-\d{2}$/.test(fila.limite_registro)) delete fila.limite_registro;
    const { error } = await supabase.from('ev_ediciones').update(fila).eq('id', b.edicion_id);
    if (error) return json({ error: error.message }, 500);
    // Decir «vamos» arma la lista de preparación en el acto: las fechas cuentan desde el
    // evento, y lo que ya habría vencido se corre a partir de mañana (ver generarTareas).
    let tareas: any = null;
    if (fila.participacion === 'vamos' || (fila.rol && b.regenerar_tareas)) tareas = await generarTareas(b.edicion_id);
    return json({ ok: true, tareas });
  }

  if (b.accion === 'borrar_edicion') {
    if (!esUuid(b.edicion_id)) return json({ error: 'edicion_id' }, 400);
    const { count } = await supabase.from('ev_registros').select('id', { count: 'exact', head: true }).eq('edicion_id', b.edicion_id);
    if ((count || 0) > 0) return json({ error: `esta edición tiene ${count} registros; no se borra` }, 409);
    const { error } = await supabase.from('ev_ediciones').delete().eq('id', b.edicion_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  return json({ error: 'acción desconocida' }, 400);
};
