// La sala de reunión (canal tipo 'sala'): agenda, sesión en curso, acuerdos e
// historial de actas.
//
// GET  /api/crm/espacio/sala?canal_id=      → todo lo que pinta el panel de la sala
// POST /api/crm/espacio/sala { accion, … }
//   proponer   { canal_id, titulo, origen_mensaje_id?, contexto? }
//   votar      { punto_id }                       (alterna mi voto)
//   editar     { punto_id, titulo }
//   retirar    { punto_id }                       (quien lo propuso o un founder)
//   iniciar    { canal_id, asistentes? }          (una sola abierta por sala)
//   asistentes { sesion_id, asistentes: uuid[] }
//   tratar     { sesion_id, punto_id | null }     (el punto que se está viendo)
//   marcar     { punto_id, estado: tratado|pospuesto|propuesto }
//   acordar    { sesion_id, punto_id?, texto, responsable_id, vence_at? }
//   hecho      { acuerdo_id, hecho: bool }        (también cierra/abre la tarea de TI)
//   cerrar     { sesion_id, nota? }               → acta, arrastres, tareas, resumen IA
//   resumen    { sesion_id, texto }               (editar el borrador de la IA, 24 h)
//
// Reglas que valen aquí: un acuerdo exige responsable; lo pospuesto (o lo que
// no se alcanzó a ver) pasa a la siguiente con "arrastrado ×N"; cada acuerdo
// se vuelve una tarea de Trabajo inteligente (origen 'espacio') y "hecho" se
// lee de la tarea. El acta no se edita después de 24 h.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, emitir, canalDe, puedeVerCanal, personasPorId, equipo, darForma, SELECT_MENSAJE } from '../../../../lib/crm/espacio.lib';
import { avisar } from '../../../../lib/crm/espacio-avisos';

export const prerender = false;

const SEL_PUNTO = 'id, canal_id, titulo, propuesto_por, origen_mensaje_id, contexto, votos, orden, estado, sesion_id, arrastres, created_at, updated_at';
const SEL_SESION = 'id, canal_id, inicio_at, fin_at, asistentes, resumen_ia, acta, abierta_por, cerrada_por, punto_actual_id, nota_cierre';
const SEL_ACUERDO = 'id, sesion_id, punto_id, texto, responsable_id, vence_at, tarea_id, hecho_at, created_at';

/** La próxima reunión según la regla semanal (hora de México, UTC-6 fija). */
export function proximaReunion(regla: { dia_iso: number; hora: string } | null): string | null {
  if (!regla || !regla.dia_iso || !regla.hora) return null;
  const [hh, mm] = String(regla.hora).split(':').map(Number);
  const cdmx = new Date(Date.now() - 6 * 3600e3);                  // "ahora" leído como si fuera UTC
  const hoyIso = cdmx.getUTCDay() === 0 ? 7 : cdmx.getUTCDay();
  let dias = (regla.dia_iso - hoyIso + 7) % 7;
  const candidato = new Date(Date.UTC(cdmx.getUTCFullYear(), cdmx.getUTCMonth(), cdmx.getUTCDate() + dias, hh || 0, mm || 0));
  if (candidato.getTime() <= cdmx.getTime()) candidato.setUTCDate(candidato.getUTCDate() + 7);
  return new Date(candidato.getTime() + 6 * 3600e3).toISOString();   // de vuelta a UTC real
}

function ordenarPuntos(ps: any[]) {
  return [...ps].sort((a, b) => (b.arrastres - a.arrastres) || ((b.votos?.length || 0) - (a.votos?.length || 0)) || (a.orden - b.orden) || a.created_at.localeCompare(b.created_at));
}

async function salaCompleta(canalId: string, yo: string) {
  const [{ data: abierta }, { data: puntos }, { data: sesiones }] = await Promise.all([
    supabase.from('espacio_reunion_sesiones').select(SEL_SESION).eq('canal_id', canalId).is('fin_at', null).maybeSingle(),
    supabase.from('espacio_reunion_puntos').select(SEL_PUNTO).eq('canal_id', canalId).neq('estado', 'retirado').order('created_at', { ascending: true }).limit(300),
    supabase.from('espacio_reunion_sesiones').select(SEL_SESION).eq('canal_id', canalId).not('fin_at', 'is', null).order('inicio_at', { ascending: false }).limit(12),
  ]);
  const sesIds = [...(sesiones || []).map((s: any) => s.id), ...(abierta ? [abierta.id] : [])];
  const { data: acuerdos } = sesIds.length
    ? await supabase.from('espacio_acuerdos').select(SEL_ACUERDO).in('sesion_id', sesIds).order('created_at', { ascending: true })
    : { data: [] as any[] };
  // "Hecho" es de la tarea: si la cerraron desde Trabajo inteligente, aquí se ve.
  const tareaIds = (acuerdos || []).map((a: any) => a.tarea_id).filter(Boolean);
  const hechas: Record<string, string> = {};
  if (tareaIds.length) {
    const { data: ts } = await supabase.from('ti_tareas').select('id, estado, hecho_at').in('id', tareaIds);
    for (const t of ts || []) if (t.estado === 'hecha' && t.hecho_at) hechas[t.id] = t.hecho_at;
  }
  const ids = new Set<string>();
  for (const p of puntos || []) ids.add(p.propuesto_por);
  for (const a of acuerdos || []) ids.add(a.responsable_id);
  for (const s of [...(sesiones || []), ...(abierta ? [abierta] : [])]) { for (const x of s.asistentes || []) ids.add(x); ids.add(s.abierta_por); ids.add(s.cerrada_por); }
  const personas = await personasPorId(Array.from(ids).filter(Boolean) as string[]);
  const p = (id: string | null) => id && personas[id] ? { id, nombre: personas[id].nombre, foto_url: personas[id].foto_url } : null;

  // La agenda: lo propuesto que no pertenece a una sesión ya cerrada, más lo
  // de la sesión abierta en cualquier estado (para verlo tratarse en vivo).
  const agenda = ordenarPuntos((puntos || []).filter((x: any) => abierta ? (x.sesion_id === abierta.id || (x.estado === 'propuesto' && !x.sesion_id)) : (x.estado === 'propuesto' && !x.sesion_id)));
  const formaPunto = (x: any) => ({ ...x, propuesto_por: p(x.propuesto_por), votos: x.votos?.length || 0, vote: (x.votos || []).includes(yo) });
  const formaAcuerdo = (a: any) => ({ ...a, responsable: p(a.responsable_id), hecho_at: a.hecho_at || (a.tarea_id ? hechas[a.tarea_id] || null : null) });
  const acs = (acuerdos || []).map(formaAcuerdo);
  const pendientes = acs.filter((a: any) => !a.hecho_at);

  // Mensajes de la sesión abierta por punto: "3 mensajes sobre este punto".
  const porPunto: Record<string, number> = {};
  if (abierta) {
    const { data: ms } = await supabase.from('espacio_mensajes').select('punto_id').eq('sesion_id', abierta.id).is('borrado_at', null).not('punto_id', 'is', null);
    for (const m of ms || []) porPunto[m.punto_id] = (porPunto[m.punto_id] || 0) + 1;
  }
  return {
    abierta: abierta ? { ...abierta, asistentes_p: (abierta.asistentes || []).map(p).filter(Boolean), abierta_por: p(abierta.abierta_por), acuerdos: acs.filter((a: any) => a.sesion_id === abierta.id) } : null,
    agenda: agenda.map(x => ({ ...formaPunto(x), mensajes: porPunto[x.id] || 0 })),
    arrastrados: agenda.filter((x: any) => x.arrastres > 0).length,
    pendientes,
    historial: (sesiones || []).map((s: any) => ({
      ...s, asistentes_p: (s.asistentes || []).map(p).filter(Boolean), abierta_por: p(s.abierta_por), cerrada_por: p(s.cerrada_por),
      acuerdos: acs.filter((a: any) => a.sesion_id === s.id),
      puntos: ordenarPuntos((puntos || []).filter((x: any) => x.sesion_id === s.id)).map(formaPunto).concat(((s.acta?.puntos || []) as any[]).filter(ap => !(puntos || []).some((x: any) => x.id === ap.id && x.sesion_id === s.id)).map(ap => ({ ...ap, propuesto_por: null, votos: 0, vote: false, arrastrado: true }))),
    })),
  };
}

export const GET: APIRoute = async ({ request, url }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const c = await canalDe(url.searchParams.get('canal_id') || '');
  if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Sala no encontrada' }, 404);
  if (c.tipo !== 'sala') return json({ error: 'Este canal no es una sala' }, 400);
  const sala = await salaCompleta(c.id, yo.id);
  // "Esta semana con clientes": las citas agendadas de los próximos 7 días.
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const en7 = new Date(Date.now() - 6 * 3600e3 + 7 * 86400e3).toISOString().slice(0, 10);
  const { data: citas } = await supabase.from('bookings').select('id, fecha, hora_inicio, invitee_nombre, invitee_empresa, host_id, estado')
    .gte('fecha', hoy).lte('fecha', en7).in('estado', ['confirmada', 'pendiente', 'reagendada']).order('fecha').order('hora_inicio').limit(30);
  const hosts = await personasPorId((citas || []).map((x: any) => x.host_id).filter(Boolean));
  return json({
    ok: true, proxima: proximaReunion(c.regla_reunion), regla: c.regla_reunion, ...sala,
    citas: (citas || []).map((x: any) => ({ id: x.id, fecha: x.fecha, hora: String(x.hora_inicio || '').slice(0, 5), nombre: x.invitee_nombre, empresa: x.invitee_empresa, con: hosts[x.host_id]?.nombre || null, estado: x.estado })),
  });
};

async function puntoDe(id: any) {
  if (!esUuid(id)) return null;
  const { data } = await supabase.from('espacio_reunion_puntos').select(SEL_PUNTO).eq('id', id).maybeSingle();
  return data;
}
async function sesionDe(id: any) {
  if (!esUuid(id)) return null;
  const { data } = await supabase.from('espacio_reunion_sesiones').select(SEL_SESION).eq('id', id).maybeSingle();
  return data;
}
const ahora = () => new Date().toISOString();

/** Cinco líneas del Agente sobre lo que se habló; borrador, editable. Sin llave o con error: null. */
async function resumenIA(sala: string, puntos: any[], acuerdos: any[], mensajes: { quien: string; texto: string }[]): Promise<string | null> {
  const key = (import.meta.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key || (!mensajes.length && !acuerdos.length)) return null;
  try {
    const { anthropic, MODELS } = await import('../../../../lib/ai/client');
    const cuerpo = [
      `Sala: #${sala}`,
      `Puntos: ${puntos.map(p => `${p.titulo} [${p.estado}]`).join(' · ') || 'ninguno'}`,
      `Acuerdos: ${acuerdos.map(a => `${a.texto} (${a.responsable})`).join(' · ') || 'ninguno'}`,
      'Chat de la sesión:', ...mensajes.slice(-120).map(m => `${m.quien}: ${m.texto}`),
    ].join('\n').slice(0, 14000);
    const r = await anthropic.messages.create({
      model: MODELS.haiku, max_tokens: 400, temperature: 0.2,
      system: 'Eres el Agente del CRM de Sacscloud. Resume una reunión interna del equipo (dos personas) en máximo 5 líneas, en español de México, directo y sin adornos: qué se decidió, qué quedó pendiente y qué sigue. Sin encabezados, sin viñetas numeradas; una línea por idea. No inventes nada que no esté en el chat.',
      messages: [{ role: 'user', content: cuerpo }],
    });
    const t = r.content.map((c: any) => c.type === 'text' ? c.text : '').join('').trim();
    return t.slice(0, 1500) || null;
  } catch { return null; }
}

export const POST: APIRoute = async ({ request }) => {
  const yo = await quien(request);
  if (!yo) return json({ error: 'Sin sesión' }, 401);
  const b = await request.json().catch(() => ({}));
  const accion = String(b.accion || '');

  if (accion === 'proponer') {
    const c = await canalDe(b.canal_id);
    if (!c || c.tipo !== 'sala' || !puedeVerCanal(c, yo.id)) return json({ error: 'Sala no encontrada' }, 404);
    const titulo = String(b.titulo || '').replace(/\s+/g, ' ').trim();
    if (titulo.length < 3 || titulo.length > 120) return json({ error: 'El punto va de 3 a 120 caracteres' }, 400);
    let origen: string | null = null, contexto: any[] = [];
    if (b.origen_mensaje_id) {
      if (!esUuid(b.origen_mensaje_id)) return json({ error: 'Mensaje inválido' }, 400);
      const { data: m } = await supabase.from('espacio_mensajes').select('id, canal_id, hilo_de, autor_id, texto').eq('id', b.origen_mensaje_id).maybeSingle();
      const cm = m ? await canalDe(m.canal_id) : null;
      if (!m || !cm || !puedeVerCanal(cm, yo.id)) return json({ error: 'Mensaje no encontrado' }, 404);
      origen = m.id;
      contexto.push({ tipo: 'mensaje', id: m.id, canal_id: m.canal_id, hilo_de: m.hilo_de, canal: cm.tipo === 'directo' ? 'directo' : cm.nombre, texto: String(m.texto || '').slice(0, 200) });
    }
    if (Array.isArray(b.contexto)) for (const x of b.contexto.slice(0, 5)) if (x && typeof x.tipo === 'string' && typeof x.id === 'string') contexto.push({ tipo: x.tipo.slice(0, 20), id: x.id.slice(0, 80), nombre: String(x.nombre || '').slice(0, 120) });
    const { data: abierta } = await supabase.from('espacio_reunion_sesiones').select('id').eq('canal_id', c.id).is('fin_at', null).maybeSingle();
    const { data: ult } = await supabase.from('espacio_reunion_puntos').select('orden').eq('canal_id', c.id).order('orden', { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabase.from('espacio_reunion_puntos').insert({
      canal_id: c.id, titulo, propuesto_por: yo.id, origen_mensaje_id: origen, contexto, votos: [yo.id], orden: (ult?.orden || 0) + 1,
      sesion_id: abierta?.id || null,   // si la reunión ya va, entra a la de hoy
    }).select(SEL_PUNTO).single();
    if (error) return json({ error: error.message }, 500);
    await emitir({ tipo: 'reunion', canal_id: c.id });
    return json({ ok: true, punto: data, sala: c.nombre });
  }

  if (accion === 'votar' || accion === 'editar' || accion === 'retirar' || accion === 'marcar') {
    const pt = await puntoDe(b.punto_id);
    if (!pt) return json({ error: 'Punto no encontrado' }, 404);
    const c = await canalDe(pt.canal_id);
    if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Punto no encontrado' }, 404);
    let cambios: any = { updated_at: ahora() };
    if (accion === 'votar') {
      const v: string[] = pt.votos || [];
      cambios.votos = v.includes(yo.id) ? v.filter(x => x !== yo.id) : [...v, yo.id];
    } else if (accion === 'editar') {
      const titulo = String(b.titulo || '').replace(/\s+/g, ' ').trim();
      if (titulo.length < 3 || titulo.length > 120) return json({ error: 'El punto va de 3 a 120 caracteres' }, 400);
      if (pt.propuesto_por !== yo.id && yo.role !== 'founder') return json({ error: 'Solo quien lo propuso lo edita' }, 403);
      cambios.titulo = titulo;
    } else if (accion === 'retirar') {
      if (pt.propuesto_por !== yo.id && yo.role !== 'founder') return json({ error: 'Solo quien lo propuso lo retira' }, 403);
      if (pt.estado !== 'propuesto') return json({ error: 'Ya se trató: no se puede retirar' }, 400);
      cambios.estado = 'retirado';
    } else {
      const estado = String(b.estado || '');
      if (!['tratado', 'pospuesto', 'propuesto'].includes(estado)) return json({ error: 'Estado inválido' }, 400);
      const { data: abierta } = await supabase.from('espacio_reunion_sesiones').select('id').eq('canal_id', c.id).is('fin_at', null).maybeSingle();
      if (!abierta) return json({ error: 'No hay reunión abierta: inicia una para marcar puntos' }, 400);
      cambios.estado = estado; cambios.sesion_id = abierta.id;
    }
    const { data, error } = await supabase.from('espacio_reunion_puntos').update(cambios).eq('id', pt.id).select(SEL_PUNTO).single();
    if (error) return json({ error: error.message }, 500);
    await emitir({ tipo: 'reunion', canal_id: c.id });
    return json({ ok: true, punto: data });
  }

  if (accion === 'iniciar') {
    const c = await canalDe(b.canal_id);
    if (!c || c.tipo !== 'sala' || !puedeVerCanal(c, yo.id)) return json({ error: 'Sala no encontrada' }, 404);
    const { data: ya } = await supabase.from('espacio_reunion_sesiones').select('id').eq('canal_id', c.id).is('fin_at', null).maybeSingle();
    if (ya) return json({ error: 'Ya hay una reunión abierta en esta sala' }, 409);
    // Asistentes: quienes están conectados ahora (visto en los últimos 5 min) y yo.
    let asistentes: string[] = Array.isArray(b.asistentes) ? b.asistentes.filter(esUuid) : [];
    if (!asistentes.length) {
      const { data: pres } = await supabase.from('espacio_presencia').select('usuario_id').gte('visto_at', new Date(Date.now() - 5 * 60_000).toISOString());
      asistentes = (pres || []).map((x: any) => x.usuario_id);
    }
    if (!asistentes.includes(yo.id)) asistentes.push(yo.id);
    const eq = await equipo(); asistentes = asistentes.filter(a => eq.some(p => p.id === a));
    const { data, error } = await supabase.from('espacio_reunion_sesiones').insert({ canal_id: c.id, asistentes, abierta_por: yo.id }).select(SEL_SESION).single();
    if (error) return json({ error: /unique|duplicate/i.test(error.message) ? 'Ya hay una reunión abierta en esta sala' : error.message }, 500);
    // La agenda de hoy: todo lo propuesto entra a esta sesión.
    await supabase.from('espacio_reunion_puntos').update({ sesion_id: data.id, updated_at: ahora() }).eq('canal_id', c.id).eq('estado', 'propuesto').is('sesion_id', null);
    await emitir({ tipo: 'reunion', canal_id: c.id });
    return json({ ok: true, sesion: data });
  }

  if (accion === 'asistentes' || accion === 'tratar' || accion === 'cerrar' || accion === 'resumen' || accion === 'acordar') {
    const s = await sesionDe(b.sesion_id);
    if (!s) return json({ error: 'Sesión no encontrada' }, 404);
    const c = await canalDe(s.canal_id);
    if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Sesión no encontrada' }, 404);

    if (accion === 'resumen') {
      const texto = String(b.texto || '').trim().slice(0, 1500);
      if (Date.now() - new Date(s.fin_at || s.inicio_at).getTime() > 24 * 3600e3) return json({ error: 'El acta ya no se edita (pasaron 24 h): agrega notas en el chat' }, 400);
      const { error } = await supabase.from('espacio_reunion_sesiones').update({ resumen_ia: texto || null }).eq('id', s.id);
      if (error) return json({ error: error.message }, 500);
      await emitir({ tipo: 'reunion', canal_id: c.id });
      return json({ ok: true });
    }
    if (s.fin_at) return json({ error: 'Esa reunión ya se cerró' }, 400);

    if (accion === 'asistentes') {
      const eq = await equipo();
      const asistentes = (Array.isArray(b.asistentes) ? b.asistentes : []).filter((x: any) => esUuid(x) && eq.some(p => p.id === x));
      if (!asistentes.length) return json({ error: 'Alguien tiene que estar en la reunión' }, 400);
      await supabase.from('espacio_reunion_sesiones').update({ asistentes }).eq('id', s.id);
      await emitir({ tipo: 'reunion', canal_id: c.id });
      return json({ ok: true });
    }
    if (accion === 'tratar') {
      let punto_actual_id: string | null = null;
      if (b.punto_id) {
        const pt = await puntoDe(b.punto_id);
        if (!pt || pt.canal_id !== c.id) return json({ error: 'Punto no encontrado' }, 404);
        punto_actual_id = pt.id;
        // Abrir un punto lo marca "tratado" si estaba solo propuesto; nada más.
        await supabase.from('espacio_reunion_puntos').update({ sesion_id: s.id, updated_at: ahora(), ...(pt.estado === 'propuesto' ? { estado: 'tratado' } : {}) }).eq('id', pt.id);
      }
      await supabase.from('espacio_reunion_sesiones').update({ punto_actual_id }).eq('id', s.id);
      await emitir({ tipo: 'reunion', canal_id: c.id });
      return json({ ok: true });
    }
    if (accion === 'acordar') {
      const texto = String(b.texto || '').replace(/\s+/g, ' ').trim();
      if (texto.length < 3 || texto.length > 500) return json({ error: 'El acuerdo va de 3 a 500 caracteres' }, 400);
      const eq = await equipo();
      if (!esUuid(b.responsable_id) || !eq.some(p => p.id === b.responsable_id && p.rol !== 'soporte')) return json({ error: 'Un acuerdo necesita responsable' }, 400);
      let vence_at: string | null = null;
      if (b.vence_at) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.vence_at))) return json({ error: 'Fecha inválida' }, 400); vence_at = b.vence_at; }
      let punto_id: string | null = null;
      if (b.punto_id) { const pt = await puntoDe(b.punto_id); if (!pt || pt.canal_id !== c.id) return json({ error: 'Punto no encontrado' }, 404); punto_id = pt.id; }
      const { data, error } = await supabase.from('espacio_acuerdos').insert({ sesion_id: s.id, punto_id, texto, responsable_id: b.responsable_id, vence_at }).select(SEL_ACUERDO).single();
      if (error) return json({ error: error.message }, 500);
      if (punto_id) await supabase.from('espacio_reunion_puntos').update({ estado: 'acordado', sesion_id: s.id, updated_at: ahora() }).eq('id', punto_id);
      await emitir({ tipo: 'reunion', canal_id: c.id });
      return json({ ok: true, acuerdo: data });
    }

    // ── cerrar ───────────────────────────────────────────────────────────
    const fin = ahora();
    const [{ data: puntos }, { data: acuerdos }, { data: msgs }] = await Promise.all([
      supabase.from('espacio_reunion_puntos').select(SEL_PUNTO).eq('sesion_id', s.id).neq('estado', 'retirado'),
      supabase.from('espacio_acuerdos').select(SEL_ACUERDO).eq('sesion_id', s.id).order('created_at'),
      supabase.from('espacio_mensajes').select('id, autor_id, texto, punto_id, adjuntos, created_at').eq('sesion_id', s.id).is('borrado_at', null).order('created_at').limit(400),
    ]);
    const personas = await personasPorId([...(acuerdos || []).map((a: any) => a.responsable_id), ...(msgs || []).map((m: any) => m.autor_id), ...(s.asistentes || [])]);
    const nombre = (id: string) => personas[id]?.nombre || 'Alguien';
    const porPunto: Record<string, { n: number; primero: string | null }> = {};
    for (const m of msgs || []) if (m.punto_id) { const e = (porPunto[m.punto_id] ||= { n: 0, primero: null }); e.n++; e.primero ||= m.id; }

    // Lo que no se acordó ni se dio por tratado pasa a la siguiente, arrastrado.
    const arrastran = (puntos || []).filter((p: any) => p.estado === 'pospuesto' || p.estado === 'propuesto');
    for (const p of arrastran) await supabase.from('espacio_reunion_puntos').update({ estado: 'propuesto', sesion_id: null, arrastres: (p.arrastres || 0) + 1, updated_at: fin }).eq('id', p.id);

    // Cada acuerdo es una tarea de Trabajo inteligente para su responsable.
    const fecha = new Date(s.inicio_at).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short' });
    for (const a of acuerdos || []) {
      if (a.tarea_id) continue;
      const vence = a.vence_at ? new Date(`${a.vence_at}T23:59:59-06:00`).toISOString() : new Date(Date.now() + 7 * 86400e3).toISOString();
      const { data: t } = await supabase.from('ti_tareas').insert({
        owner_id: a.responsable_id, familia: 'acuerdo', tipo: 'acuerdo', prioridad: 3, vence_at: vence, origen: 'espacio',
        payload: { instruccion: a.texto, porque: `Acordado en #${c.nombre} el ${fecha}${a.vence_at ? ` · para el ${a.vence_at}` : ''}`, canal_id: c.id, sesion_id: s.id, acuerdo_id: a.id, sala: c.nombre },
      }).select('id').single();
      if (t) await supabase.from('espacio_acuerdos').update({ tarea_id: t.id }).eq('id', a.id);
      if (a.responsable_id !== yo.id) await avisar({ para: a.responsable_id, tipo: 'espacio_acuerdo', titulo: `Te tocó: ${a.texto.slice(0, 80)}`, detalle: `Acuerdo de #${c.nombre}${a.vence_at ? ` · para el ${a.vence_at}` : ''}. Ya está en tu Trabajo inteligente.`, canal_id: c.id, nivel: 'alerta' });
    }

    const puntosActa = ordenarPuntos(puntos || []).map((p: any) => ({
      id: p.id, titulo: p.titulo, estado: arrastran.some((x: any) => x.id === p.id) ? 'pospuesto' : p.estado, arrastres: p.arrastres,
      mensajes: porPunto[p.id]?.n || 0, primer_mensaje: porPunto[p.id]?.primero || null,
      acuerdos: (acuerdos || []).filter((a: any) => a.punto_id === p.id).map((a: any) => ({ id: a.id, texto: a.texto, responsable: nombre(a.responsable_id), vence_at: a.vence_at })),
    }));
    const sueltos = (acuerdos || []).filter((a: any) => !a.punto_id).map((a: any) => ({ id: a.id, texto: a.texto, responsable: nombre(a.responsable_id), vence_at: a.vence_at }));
    const duracion_min = Math.max(1, Math.round((new Date(fin).getTime() - new Date(s.inicio_at).getTime()) / 60000));
    const resumen = await resumenIA(c.nombre, puntosActa, [...puntosActa.flatMap(p => p.acuerdos), ...sueltos],
      (msgs || []).map((m: any) => ({ quien: nombre(m.autor_id), texto: String(m.texto || '').replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1') || ((m.adjuntos || []).map((a: any) => a.transcripcion).filter(Boolean).join(' ') || '[adjunto]') })));
    const acta = { puntos: puntosActa, acuerdos_sueltos: sueltos, asistentes: (s.asistentes || []).map((id: string) => ({ id, nombre: nombre(id) })), duracion_min, mensajes: (msgs || []).length, nota: String(b.nota || '').slice(0, 500) || null };
    const { error } = await supabase.from('espacio_reunion_sesiones').update({ fin_at: fin, cerrada_por: yo.id, acta, resumen_ia: resumen, punto_actual_id: null, nota_cierre: acta.nota }).eq('id', s.id);
    if (error) return json({ error: error.message }, 500);

    // El acta también vive en el chat, fijada: quien no estuvo la ve sin buscar.
    const lineas = [
      `**Acta · ${fecha} · ${duracion_min} min · ${acta.asistentes.map((a: any) => a.nombre.split(' ')[0]).join(', ')}**`,
      ...(resumen ? [resumen] : []),
      ...puntosActa.map((p, i) => `${i + 1}. ${p.titulo} — ${p.estado === 'acordado' ? 'acordado' : p.estado === 'tratado' ? 'tratado' : p.estado === 'pospuesto' ? 'pasa a la siguiente' : p.estado}${p.acuerdos.length ? ': ' + p.acuerdos.map(a => `${a.texto} (${a.responsable.split(' ')[0]}${a.vence_at ? ', ' + a.vence_at : ''})`).join('; ') : ''}`),
      ...sueltos.map(a => `• ${a.texto} (${a.responsable.split(' ')[0]}${a.vence_at ? ', ' + a.vence_at : ''})`),
      ...(acta.nota ? [`Nota: ${acta.nota}`] : []),
    ];
    const { data: m } = await supabase.from('espacio_mensajes').insert({
      canal_id: c.id, autor_id: yo.id, texto: lineas.join('\n').slice(0, 4000), sesion_id: s.id, citas: [{ tipo: 'reunion', id: s.id, nombre: 'Acta' }],
      fijado_at: fin, fijado_por: yo.id, metadata: { acta: true },
    }).select(SELECT_MENSAJE).single();
    if (m) await emitir({ tipo: 'msg', canal_id: c.id, id: m.id, autor_id: yo.id, hilo_de: null });
    await emitir({ tipo: 'reunion', canal_id: c.id });
    return json({ ok: true, acta, resumen, mensaje: m ? (await darForma([m], yo.id))[0] : null, arrastrados: arrastran.length, tareas: (acuerdos || []).length });
  }

  if (accion === 'hecho') {
    if (!esUuid(b.acuerdo_id)) return json({ error: 'Acuerdo inválido' }, 400);
    const { data: aRow } = await supabase.from('espacio_acuerdos').select(SEL_ACUERDO + ', espacio_reunion_sesiones!inner(canal_id)').eq('id', b.acuerdo_id).maybeSingle();
    const a: any = aRow;
    if (!a) return json({ error: 'Acuerdo no encontrado' }, 404);
    const canalId = a.espacio_reunion_sesiones?.canal_id;
    const c = await canalDe(canalId);
    if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Acuerdo no encontrado' }, 404);
    const hecho = b.hecho !== false;
    await supabase.from('espacio_acuerdos').update({ hecho_at: hecho ? ahora() : null }).eq('id', a.id);
    if (a.tarea_id) {
      await supabase.from('ti_tareas').update(hecho
        ? { estado: 'hecha', hecho_at: ahora(), hecho_por: yo.id, resultado: 'acuerdo_cumplido', updated_at: ahora() }
        : { estado: 'pendiente', hecho_at: null, hecho_por: null, resultado: null, updated_at: ahora() }).eq('id', a.tarea_id).eq('origen', 'espacio');
    }
    await emitir({ tipo: 'reunion', canal_id: c.id });
    return json({ ok: true });
  }

  return json({ error: 'Acción desconocida' }, 400);
};
