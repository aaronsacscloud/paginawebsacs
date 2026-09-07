// Una edición por dentro: preparación, gastos, registros, expositores a buscar y el embudo.
//
// GET  /api/crm/eventos/edicion?id=…
// POST /api/crm/eventos/edicion { accion, … }
//   tarea              { id, hecha }          agregar_tarea { edicion_id, titulo, fase, vence }   borrar_tarea { id }
//   gasto              { edicion_id, concepto, categoria, monto, fecha, nota }                    borrar_gasto { id }
//   retro              { edicion_id, que_funciono, que_no, aprendizajes, repetir }
//   cargar_expositores { edicion_id }         ← trae las cuentas objetivo que exponen ahí (por el contexto investigado)
//   visitado           { expositor_id, visitado }
//   registro           { …Registro }          ← modo stand / recorrido desde el CRM (con cita_id si venía con cita)
//   borrar_registro    { id }
//   ── los 10 puntos ──
//   contactado         { registro_id }        respondio { registro_id }      ← la bandeja de después de la feria
//   agendar_demo       { registro_id, fecha, hora, duracion, en_stand, nota }
//   turno              { edicion_id, usuario_id, dia, desde, hasta }   borrar_turno { id }
//   expositor          { expositor_id, nota?, asignado_a? }           ← la ruta del recorrido
//   cita               { edicion_id, dia, hora, nombre, empresa, whatsapp, email, giro, nota, contact_id }
//   cita_estado        { cita_id, estado }    cita_llego { cita_id, …campos del registro }
//   invitar            { edicion_id, plantilla_id, giro, estado, params? } ← masivo de "agenda 15 min en el stand"
// GET  ?id=…&audiencia=1&giro=…&estado=…   → a quién se invitaría
// GET  ?id=…&huecos=YYYY-MM-DD             → huecos del stand ese día
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, limpiar } from '../../../../lib/crm/abm.lib';
import { embudoDe, registrar, generarTareas, CATEGORIAS_GASTO } from '../../../../lib/crm/eventos.lib';
import { marcarContactado, marcarRespondio } from '../../../../lib/crm/estatus-live';
import { agendarDemo, crearCita, citaLlego, huecosDelStand } from '../../../../lib/crm/eventos-agenda.lib';
import { telefonoWhatsApp } from '../../../../lib/telefono';

export const prerender = false;

/** A quién invitar a citas en el stand: contactos con WhatsApp, sin baja, del giro y estado pedidos. */
async function audienciaInvitacion(giro: string, estado: string) {
  let q = supabase.from('contacts').select('id, nombre, apellido, whatsapp, telefono, giro, company_id, lifecycle_stage, companies(nombre, giro, estado_geo, ciudad)').is('archived_at', null).eq('wa_optout', false).limit(3000);
  const { data } = await q;
  const g = giro.trim().toLowerCase(), e = estado.trim().toLowerCase();
  const { enCicloAgente } = await import('../../../../lib/crm/ti/semaforo');
  const enCiclo = await enCicloAgente((data || []).map((c: any) => c.id));
  const vistos = new Set<string>();
  return (data || []).map((c: any) => ({
    contact_id: c.id, company_id: c.company_id, nombre: `${c.nombre || ''} ${c.apellido || ''}`.trim() || '(sin nombre)',
    empresa: c.companies?.nombre || null, giro: c.giro || c.companies?.giro || null, estado: c.companies?.estado_geo || null, ciudad: c.companies?.ciudad || null,
    etapa: c.lifecycle_stage, telefono: telefonoWhatsApp(c.whatsapp) || telefonoWhatsApp(c.telefono), en_ciclo: enCiclo.has(c.id),
  })).filter(c => c.telefono && !c.en_ciclo && c.etapa !== 'cliente')
    .filter(c => !g || String(c.giro || '').toLowerCase().includes(g))
    .filter(c => !e || String(c.estado || '').toLowerCase().includes(e) || String(c.ciudad || '').toLowerCase().includes(e))
    .filter(c => !vistos.has(c.telefono!) && vistos.add(c.telefono!));
}

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  const id = url.searchParams.get('id') || '';
  if (!esUuid(id)) return json({ error: 'id' }, 400);
  const { data: ed, error } = await supabase.from('ev_ediciones').select('*, ev_eventos(*)').eq('id', id).maybeSingle();
  if (error || !ed) return json({ error: error?.message || 'no existe' }, error ? 500 : 404);
  const huecos = url.searchParams.get('huecos');
  if (huecos) return json({ huecos: await huecosDelStand(id, huecos) });
  if (url.searchParams.get('audiencia') === '1') return json({ audiencia: await audienciaInvitacion(url.searchParams.get('giro') || '', url.searchParams.get('estado') || '') });
  const [{ data: tareas }, { data: gastos }, { data: registros }, { data: expositores }, embudo, { data: turnos }, { data: citas }, { data: equipo }, { data: invitacion }] = await Promise.all([
    supabase.from('ev_tareas').select('*').eq('edicion_id', id).order('vence').order('orden'),
    supabase.from('ev_gastos').select('*').eq('edicion_id', id).order('fecha', { ascending: false }),
    supabase.from('ev_registros').select('*, contacts(id, lifecycle_stage, estatus_lead, respondio_at, reuniones_agendadas, reuniones_completadas, eng_wa_respondidos)').eq('edicion_id', id).order('capturado_at', { ascending: false }).limit(1000),
    supabase.from('ev_expositores').select('*, abm_cuentas(id, giro, ciudad, puntaje, sucursales, etapa, tiene_email, tiene_wa)').eq('edicion_id', id).order('visitado').order('stand'),
    embudoDe(id),
    supabase.from('ev_turnos').select('*').eq('edicion_id', id).order('dia').order('desde'),
    supabase.from('ev_citas').select('*, bookings(estado, token_cancelar)').eq('edicion_id', id).order('dia').order('hora'),
    // Sin partners ni bots: los turnos del stand son de la gente que va a la feria.
    supabase.from('team_members').select('id, nombre, rol').eq('activo', true).not('rol', 'in', '("partner")').order('nombre'),
    ed.invitacion_broadcast_id ? supabase.from('wa_broadcasts').select('id, nombre, status, total, enviados, entregados, leidos, respondidos, fallidos, created_at').eq('id', ed.invitacion_broadcast_id).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);
  // Cuántos de los invitados acabaron en el stand: el dato que dice si el masivo sirvió.
  let invitados_llegaron = 0;
  if (ed.invitacion_broadcast_id) {
    const { data: dest } = await supabase.from('wa_broadcast_destinatarios').select('contact_id').eq('broadcast_id', ed.invitacion_broadcast_id).not('contact_id', 'is', null).limit(5000);
    const inv = new Set((dest || []).map((d: any) => d.contact_id));
    invitados_llegaron = (registros || []).filter((r: any) => r.contact_id && inv.has(r.contact_id)).length;
  }
  return json({ edicion: ed, tareas: tareas || [], gastos: gastos || [], registros: registros || [], expositores: expositores || [], embudo, categorias_gasto: CATEGORIAS_GASTO, turnos: turnos || [], citas: citas || [], equipo: (equipo || []).filter((m: any) => !/agente ia/i.test(m.nombre || '')), invitacion: invitacion ? { ...invitacion, llegaron: invitados_llegaron } : null });
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
    if (esUuid(b.cita_id)) { const r = await citaLlego(b.cita_id, b, yo); return json(r, r.ok ? 200 : 400); }
    const r = await registrar({ ...b, capturado_via: ['gafete_qr', 'tarjeta'].includes(b.capturado_via) ? b.capturado_via : 'manual', modo: ['stand', 'recorrido'].includes(b.modo) ? b.modo : 'stand', capturado_por: yo.id, capturado_por_nombre: yo.nombre, abm_cuenta_id: esUuid(b.abm_cuenta_id) ? b.abm_cuenta_id : null });
    if (r.ok && r.id && esUuid(b.expositor_id)) await supabase.from('ev_expositores').update({ visitado: true, visitado_at: ahora, visitado_por: yo.id, registro_id: r.id }).eq('id', b.expositor_id);
    return json(r, r.ok ? 200 : 400);
  }
  if (b.accion === 'borrar_registro') {
    if (!esUuid(b.id)) return json({ error: 'id' }, 400);
    const { error } = await supabase.from('ev_registros').delete().eq('id', b.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  // ── Punto 1 · la bandeja de después de la feria ──
  if (b.accion === 'contactado' || b.accion === 'respondio') {
    if (!esUuid(b.registro_id)) return json({ error: 'registro_id' }, 400);
    const { data: r } = await supabase.from('ev_registros').select('id, contact_id, nombre, ev_ediciones(nombre)').eq('id', b.registro_id).maybeSingle();
    if (!r) return json({ error: 'no existe' }, 404);
    if (b.accion === 'contactado') {
      await supabase.from('ev_registros').update({ contactado_at: ahora, contactado_por: yo.id, updated_at: ahora }).eq('id', r.id);
      await marcarContactado(r.contact_id).catch(() => {});
      if (r.contact_id) await supabase.from('activities').insert({ contact_id: r.contact_id, tipo: 'whatsapp', titulo: `Le escribí después de ${(r as any).ev_ediciones?.nombre || 'la feria'}`, automatico: false, metadata: { registro_id: r.id, actor: yo.id, evento: true } }).then(() => {}, () => {});
    } else {
      await supabase.from('ev_registros').update({ respondio_at: ahora, contactado_at: (await supabase.from('ev_registros').select('contactado_at').eq('id', r.id).maybeSingle()).data?.contactado_at || ahora, updated_at: ahora }).eq('id', r.id);
      await marcarRespondio(r.contact_id).catch(() => {});
    }
    return json({ ok: true });
  }
  // ── Punto 2 · demo agendada desde el stand ──
  if (b.accion === 'agendar_demo') {
    if (!esUuid(b.registro_id)) return json({ error: 'registro_id' }, 400);
    const r = await agendarDemo(b.registro_id, { fecha: String(b.fecha || ''), hora: String(b.hora || ''), duracion: Number(b.duracion) || undefined, en_stand: !!b.en_stand, host_id: esUuid(b.host_id) ? b.host_id : null, nota: limpiar(b.nota, 400) || null }, yo);
    return json(r, r.ok ? 200 : 400);
  }
  // ── Punto 7 · turnos del equipo ──
  if (b.accion === 'turno') {
    if (!esUuid(b.edicion_id) || !esUuid(b.usuario_id)) return json({ error: 'edición y persona' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.dia || ''))) return json({ error: 'día' }, 400);
    const hora = (v: any, def: string) => /^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : def;
    const desde = hora(b.desde, '10:00'), hasta = hora(b.hasta, '18:00');
    if (hasta <= desde) return json({ error: 'El turno termina antes de empezar.' }, 400);
    const { data: m } = await supabase.from('team_members').select('nombre').eq('id', b.usuario_id).maybeSingle();
    const { error } = await supabase.from('ev_turnos').insert({ edicion_id: b.edicion_id, usuario_id: b.usuario_id, nombre: m?.nombre || null, dia: b.dia, desde, hasta });
    if (error) return json({ error: error.message }, 500);
    // El equipo de la edición se mantiene solo: quien tiene turno está en el equipo.
    const { data: edE } = await supabase.from('ev_ediciones').select('equipo').eq('id', b.edicion_id).maybeSingle();
    const eq: any[] = Array.isArray(edE?.equipo) ? edE!.equipo : [];
    if (!eq.some(x => x?.id === b.usuario_id)) await supabase.from('ev_ediciones').update({ equipo: [...eq, { id: b.usuario_id, nombre: m?.nombre || null }], updated_at: ahora }).eq('id', b.edicion_id);
    return json({ ok: true });
  }
  if (b.accion === 'borrar_turno') {
    if (!esUuid(b.id)) return json({ error: 'id' }, 400);
    const { error } = await supabase.from('ev_turnos').delete().eq('id', b.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  // ── Punto 8 · la ruta: nota y asignado por expositor ──
  if (b.accion === 'expositor') {
    if (!esUuid(b.expositor_id)) return json({ error: 'expositor_id' }, 400);
    const cambios: any = { };
    if ('nota' in b) cambios.nota = limpiar(b.nota, 500) || null;
    if ('asignado_a' in b) {
      if (b.asignado_a && esUuid(b.asignado_a)) { const { data: m } = await supabase.from('team_members').select('nombre').eq('id', b.asignado_a).maybeSingle(); cambios.asignado_a = b.asignado_a; cambios.asignado_nombre = m?.nombre || null; }
      else { cambios.asignado_a = null; cambios.asignado_nombre = null; }
    }
    if ('stand' in b) cambios.stand = limpiar(b.stand, 60) || null;
    if ('pabellon' in b) cambios.pabellon = limpiar(b.pabellon, 60) || null;
    const { error } = await supabase.from('ev_expositores').update(cambios).eq('id', b.expositor_id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  // ── Punto 3 · citas en el stand ──
  if (b.accion === 'cita') {
    if (!esUuid(b.edicion_id)) return json({ error: 'edicion_id' }, 400);
    const r = await crearCita(b.edicion_id, { dia: String(b.dia || ''), hora: String(b.hora || ''), nombre: b.nombre, empresa: b.empresa, whatsapp: b.whatsapp, email: b.email, giro: b.giro, nota: b.nota, origen: 'crm', contact_id: esUuid(b.contact_id) ? b.contact_id : null }, yo.nombre || 'CRM', yo.id);
    return json(r, r.ok ? 200 : 400);
  }
  if (b.accion === 'cita_estado') {
    if (!esUuid(b.cita_id) || !['agendada', 'no_llego', 'cancelada'].includes(b.estado)) return json({ error: 'cita y estado' }, 400);
    const { data: c } = await supabase.from('ev_citas').select('booking_id').eq('id', b.cita_id).maybeSingle();
    const { error } = await supabase.from('ev_citas').update({ estado: b.estado, updated_at: ahora }).eq('id', b.cita_id);
    if (error) return json({ error: error.message }, 500);
    if (c?.booking_id) {
      const est = b.estado === 'no_llego' ? 'no_asistio' : b.estado === 'cancelada' ? 'cancelada' : 'agendada';
      await supabase.from('bookings').update({ estado: est, ...(est === 'cancelada' ? { cancelado_por: 'crm', cancelacion_motivo: 'Cancelada desde Eventos' } : {}) }).eq('id', c.booking_id);
    }
    return json({ ok: true });
  }
  if (b.accion === 'cita_llego') {
    if (!esUuid(b.cita_id)) return json({ error: 'cita_id' }, 400);
    const r = await citaLlego(b.cita_id, b, yo);
    return json(r, r.ok ? 200 : 400);
  }
  if (b.accion === 'invitar') {
    if (!esUuid(b.edicion_id) || !b.plantilla_id) return json({ error: 'edición y plantilla' }, 400);
    const { data: ed } = await supabase.from('ev_ediciones').select('id, nombre, stand_numero, token_publico, inicio, fin, invitacion_broadcast_id, ev_eventos(nombre)').eq('id', b.edicion_id).maybeSingle();
    if (!ed) return json({ error: 'no existe' }, 404);
    if (ed.invitacion_broadcast_id && !b.otra) return json({ error: 'Esta edición ya tiene su invitación. Si quieres otra, dilo explícitamente.' }, 409);
    const audiencia = await audienciaInvitacion(String(b.giro || ''), String(b.estado || ''));
    const elegidos = Array.isArray(b.contact_ids) && b.contact_ids.length ? audiencia.filter(c => b.contact_ids.includes(c.contact_id)) : audiencia;
    if (!elegidos.length) return json({ error: 'No hay a quién invitar con ese filtro.' }, 400);
    const { data: pl } = await supabase.from('wa_plantillas').select('variables').eq('id', b.plantilla_id).maybeSingle();
    const n = pl ? Number(pl.variables || 0) : 0;
    const evento = (ed as any).ev_eventos?.nombre || ed.nombre;
    const liga = ed.token_publico ? `https://www.sacscloud.com/e/${ed.token_publico}/cita` : '';
    const { crearMasivo } = await import('../../../../lib/whatsapp/masivos.lib');
    // {{1}} nombre · {{2}} feria · {{3}} stand · {{4}} liga para agendar. La plantilla dice cuántas trae.
    const r = await crearMasivo({
      nombre: `Invitación al stand · ${evento} · ${ed.nombre}`.slice(0, 120), plantilla_id: b.plantilla_id,
      destinatarios: elegidos.map(c => ({ telefono: c.telefono, contact_id: c.contact_id, company_id: c.company_id, params: [c.nombre.split(/\s+/)[0] || 'Hola', evento, ed.stand_numero || 'Sacscloud', liga].slice(0, n) })),
    });
    if (r.cuerpo?.ok) await supabase.from('ev_ediciones').update({ invitacion_broadcast_id: r.cuerpo.id, updated_at: ahora }).eq('id', ed.id);
    return json(r.cuerpo, r.status);
  }

  return json({ error: 'acción desconocida' }, 400);
};
