// Una edición por dentro: preparación, gastos, registros, expositores a buscar y el embudo.
//
// GET  /api/crm/eventos/edicion?id=…
// POST /api/crm/eventos/edicion { accion, … }
//   tarea              { id, hecha }          agregar_tarea { edicion_id, titulo, fase, vence }   borrar_tarea { id }
//   gasto              { edicion_id, concepto, categoria, monto, fecha, nota }                    borrar_gasto { id }
//   retro              { edicion_id, que_funciono, que_no, aprendizajes, repetir }
//   cargar_expositores { edicion_id }         ← trae las cuentas objetivo que exponen ahí (por el contexto investigado)
//   visitado           { expositor_id, visitado }
//   registro           { …Registro }          ← modo stand / recorrido desde el CRM
//   borrar_registro    { id }
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar } from '../../../../lib/crm/abm.lib';
import { embudoDe, registrar, generarTareas, CATEGORIAS_GASTO } from '../../../../lib/crm/eventos.lib';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const id = url.searchParams.get('id') || '';
  if (!esUuid(id)) return json({ error: 'id' }, 400);
  const { data: ed, error } = await supabase.from('ev_ediciones').select('*, ev_eventos(*)').eq('id', id).maybeSingle();
  if (error || !ed) return json({ error: error?.message || 'no existe' }, error ? 500 : 404);
  const [{ data: tareas }, { data: gastos }, { data: registros }, { data: expositores }, embudo] = await Promise.all([
    supabase.from('ev_tareas').select('*').eq('edicion_id', id).order('vence').order('orden'),
    supabase.from('ev_gastos').select('*').eq('edicion_id', id).order('fecha', { ascending: false }),
    supabase.from('ev_registros').select('*, contacts(id, lifecycle_stage, estatus_lead, respondio_at, reuniones_agendadas, reuniones_completadas, eng_wa_respondidos)').eq('edicion_id', id).order('capturado_at', { ascending: false }).limit(1000),
    supabase.from('ev_expositores').select('*, abm_cuentas(id, giro, ciudad, puntaje, sucursales, etapa, tiene_email, tiene_wa)').eq('edicion_id', id).order('visitado').order('stand'),
    embudoDe(id),
  ]);
  return json({ edicion: ed, tareas: tareas || [], gastos: gastos || [], registros: registros || [], expositores: expositores || [], embudo, categorias_gasto: CATEGORIAS_GASTO });
};

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  let b: any; try { b = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const ahora = new Date().toISOString();

  if (b.accion === 'tarea') {
    if (!esUuid(b.id)) return json({ error: 'id' }, 400);
    const { error } = await supabase.from('ev_tareas').update({ hecha: !!b.hecha, hecha_at: b.hecha ? ahora : null, hecha_por: b.hecha ? yo.id : null }).eq('id', b.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.accion === 'agregar_tarea') {
    if (!esUuid(b.edicion_id) || !limpiar(b.titulo, 200)) return json({ error: 'edición y título' }, 400);
    const { error } = await supabase.from('ev_tareas').insert({ edicion_id: b.edicion_id, titulo: limpiar(b.titulo, 200), fase: ['antes', 'durante', 'despues'].includes(b.fase) ? b.fase : 'antes', vence: /^\d{4}-\d{2}-\d{2}$/.test(String(b.vence || '')) ? b.vence : null, orden: 99 });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.accion === 'borrar_tarea') {
    if (!esUuid(b.id)) return json({ error: 'id' }, 400);
    const { error } = await supabase.from('ev_tareas').delete().eq('id', b.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.accion === 'regenerar_tareas') {
    if (!esUuid(b.edicion_id)) return json({ error: 'edicion_id' }, 400);
    return json(await generarTareas(b.edicion_id));
  }

  if (b.accion === 'gasto') {
    if (!esUuid(b.edicion_id) || !limpiar(b.concepto, 160)) return json({ error: 'edición y concepto' }, 400);
    const monto = Number(b.monto); if (!(monto >= 0)) return json({ error: 'monto' }, 400);
    const { error } = await supabase.from('ev_gastos').insert({ edicion_id: b.edicion_id, concepto: limpiar(b.concepto, 160), categoria: CATEGORIAS_GASTO[b.categoria] ? b.categoria : 'otro', monto, fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(b.fecha || '')) ? b.fecha : ahora.slice(0, 10), nota: limpiar(b.nota, 400) || null, registrado_por: yo.id });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.accion === 'borrar_gasto') {
    if (!esUuid(b.id)) return json({ error: 'id' }, 400);
    const { error } = await supabase.from('ev_gastos').delete().eq('id', b.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (b.accion === 'retro') {
    if (!esUuid(b.edicion_id)) return json({ error: 'edicion_id' }, 400);
    // Las notas se pueden ir guardando desde antes; el cierre (cerrada_at + «fuimos»)
    // solo cuando la edición ya terminó, que es cuando los números están completos.
    const { data: edR } = await supabase.from('ev_ediciones').select('fin, inicio, retro, participacion').eq('id', b.edicion_id).maybeSingle();
    const termino = !!edR && (edR.fin || edR.inicio) < ahora.slice(0, 10);
    // Solo se cierra lo que se vivió: una edición en «no vamos» o «sin decidir» guarda
    // las notas pero no pasa a «fuimos» — si no, el histórico dice que fuimos a ferias
    // a las que nunca fuimos.
    const vivida = edR?.participacion === 'vamos' || edR?.participacion === 'fuimos';
    const cierra = termino && vivida && b.cerrar !== false;
    const previo = (edR?.retro || {}) as any;
    const retro = { que_funciono: limpiar(b.que_funciono, 2000) || null, que_no: limpiar(b.que_no, 2000) || null, aprendizajes: limpiar(b.aprendizajes, 2000) || null, repetir: b.repetir == null ? null : !!b.repetir, cerrada_at: cierra ? (previo.cerrada_at || ahora) : previo.cerrada_at || null, por: cierra ? (previo.por || yo.nombre) : previo.por || null };
    const { error } = await supabase.from('ev_ediciones').update({ retro, ...(cierra ? { participacion: 'fuimos' } : {}), updated_at: ahora }).eq('id', b.edicion_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (b.accion === 'cargar_expositores') {
    if (!esUuid(b.edicion_id)) return json({ error: 'edicion_id' }, 400);
    const { data: ed } = await supabase.from('ev_ediciones').select('id, nombre, ev_eventos(slug, nombre)').eq('id', b.edicion_id).maybeSingle();
    if (!ed) return json({ error: 'no existe' }, 404);
    const nombreCompleto = String((ed as any).ev_eventos?.nombre || '').trim();
    if (!nombreCompleto) return json({ error: 'el evento no tiene nombre' }, 400);
    // Las cuentas investigadas guardan «Expositor de Intermoda IM85, stand 9019, 9021» en su
    // contexto. Se cruza por el nombre completo y, si no hay nada, por la primera palabra —
    // salvo que sea una palabra que comparten media docena de ferias («Expo», «Feria»…):
    // ahí cruzar traería los expositores de otro evento.
    const primera = nombreCompleto.split(/\s+/)[0];
    const generica = /^(expo|feria|salón|salon|semana|congreso|festival|encuentro|foro)$/i.test(primera);
    const buscar = async (patron: string) => {
      let cuentas: any[] = []; let desde = 0;
      while (true) {
        const { data } = await supabase.from('abm_cuentas').select('id, nombre, contexto, puntaje').ilike('contexto', `%Expositor de ${patron}%`).neq('etapa', 'no_contactar').order('puntaje', { ascending: false }).range(desde, desde + 999);
        cuentas = cuentas.concat(data || []); if (!data || data.length < 1000) break; desde += 1000;
      }
      return cuentas;
    };
    let cuentas = await buscar(nombreCompleto);
    if (!cuentas.length && !generica) cuentas = await buscar(primera);
    const filas = cuentas.map(c => {
      const m = /stand[s]?\s*([^·\n]+)/i.exec(String(c.contexto || ''));
      const stand = m ? m[1].trim().slice(0, 60) : null;
      // El pabellón se deduce del primer dígito solo en stands de hasta 4 cifras: en
      // «11063» el pabellón es el 11, no el 1, y eso son 40 minutos al pabellón equivocado.
      const digitos = stand ? String(stand).replace(/\D/g, '') : '';
      const pab = digitos.length >= 3 && digitos.length <= 4 ? digitos.slice(0, 1) : null;
      return { edicion_id: b.edicion_id, abm_cuenta_id: c.id, nombre: c.nombre, stand, pabellon: pab ? `Pabellón ${pab}` : null };
    });
    // «Nuevas» se mide contando antes y después: el upsert con ignoreDuplicates no devuelve filas.
    const contar = async () => { const { count } = await supabase.from('ev_expositores').select('id', { count: 'exact', head: true }).eq('edicion_id', b.edicion_id); return count || 0; };
    const antes = await contar();
    for (let i = 0; i < filas.length; i += 200) {
      const { error } = await supabase.from('ev_expositores').upsert(filas.slice(i, i + 200), { onConflict: 'edicion_id,abm_cuenta_id', ignoreDuplicates: true });
      if (error) return json({ error: error.message }, 500);
    }
    return json({ ok: true, encontradas: filas.length, nuevas: Math.max(0, await contar() - antes) });
  }
  if (b.accion === 'visitado') {
    if (!esUuid(b.expositor_id)) return json({ error: 'expositor_id' }, 400);
    const { error } = await supabase.from('ev_expositores').update({ visitado: !!b.visitado, visitado_at: b.visitado ? ahora : null, visitado_por: b.visitado ? yo.id : null }).eq('id', b.expositor_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  if (b.accion === 'registro') {
    if (!esUuid(b.edicion_id)) return json({ error: 'edicion_id' }, 400);
    const r = await registrar({ ...b, modo: ['stand', 'recorrido'].includes(b.modo) ? b.modo : 'stand', capturado_por: yo.id, capturado_por_nombre: yo.nombre, abm_cuenta_id: esUuid(b.abm_cuenta_id) ? b.abm_cuenta_id : null });
    if (r.ok && r.id && esUuid(b.expositor_id)) await supabase.from('ev_expositores').update({ visitado: true, visitado_at: ahora, visitado_por: yo.id, registro_id: r.id }).eq('id', b.expositor_id);
    return json(r, r.ok ? 200 : 400);
  }
  if (b.accion === 'borrar_registro') {
    if (!esUuid(b.id)) return json({ error: 'id' }, 400);
    const { error } = await supabase.from('ev_registros').delete().eq('id', b.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  return json({ error: 'acción desconocida' }, 400);
};
