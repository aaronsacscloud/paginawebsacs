// La sala de reunión (canal tipo 'sala'): agenda, sesión en curso, acuerdos e
// historial de actas.
//
// GET  /api/crm/espacio/sala?canal_id=&actas=  → todo lo que pinta el panel de la sala
//      `actas` (default 12, tope 120): cuántas actas del historial traer.
// POST /api/crm/espacio/sala { accion, … }
//   proponer   { canal_id, titulo, origen_mensaje_id?, contexto?, adjuntos? }
//   votar      { punto_id }                       (alterna mi voto)
//   editar     { punto_id, titulo }
//   retirar    { punto_id }                       (quien lo propuso o un founder)
//   iniciar    { canal_id, asistentes? }          (una sola abierta por sala)
//   asistentes { sesion_id, asistentes: uuid[] }
//   tratar     { sesion_id, punto_id | null }     (el punto que se está viendo)
//   marcar     { punto_id, estado: tratado|pospuesto|propuesto }
//   acordar    { sesion_id, punto_id?, texto, responsable_id, vence_at?, adjuntos? }
//   hecho      { acuerdo_id, hecho: bool }        (también cierra/abre la tarea de TI)
//   arrastrar  { acuerdo_id, sesion_id, vence_at? }  → lo incumplido pasa a HOY
//   cerrar     { sesion_id, nota?, asistentes? }   → acta, arrastres, tareas, resumen IA
//   resumen    { sesion_id, texto }               (editar el borrador de la IA, 24 h)
//   mover      { canal_id, ocurrencia_id, inicio_at, motivo? }  → reagendar UNA junta
//   saltar     { ocurrencia_id, motivo? }         → esta semana no hay, con motivo
//   reabrir    { ocurrencia_id }                  → deshacer un "no hay junta"
//   guion      { canal_id, guion: Bloque[] }      → el orden fijo de la junta
//   agendar    { punto_id, ocurrencia_id|null }   → apartar un tema para otra junta
//
// Reglas que valen aquí: un acuerdo exige responsable; lo pospuesto (o lo que
// no se alcanzó a ver) pasa a la siguiente con "arrastrado ×N"; cada acuerdo
// se vuelve una tarea de Trabajo inteligente (origen 'espacio') y "hecho" se
// lee de la tarea. El acta no se edita después de 24 h.
import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { json, quien, esUuid, emitir, canalDe, puedeVerCanal, personasPorId, equipo, darForma, limpiarAdjuntos, firmarAdjuntos, SELECT_MENSAJE } from '../../../../lib/crm/espacio.lib';
import { avisar } from '../../../../lib/crm/espacio-avisos';

export const prerender = false;

const SEL_PUNTO = 'id, canal_id, titulo, propuesto_por, origen_mensaje_id, contexto, votos, orden, estado, sesion_id, arrastres, para_ocurrencia_id, adjuntos, created_at, updated_at';
const SEL_SESION = 'id, canal_id, inicio_at, fin_at, asistentes, resumen_ia, acta, abierta_por, cerrada_por, punto_actual_id, nota_cierre';
const SEL_ACUERDO = 'id, sesion_id, punto_id, texto, responsable_id, vence_at, tarea_id, hecho_at, adjuntos, created_at, reemplazado_por';

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

/* ═══ LAS OCURRENCIAS ══════════════════════════════════════════════════════
   `regla_reunion` es un PATRÓN semanal, no un evento: no se puede mover, ni
   saltar, ni preparar. Y `proximaReunion` es una función pura de la regla y el
   reloj, así que en el instante en que se cumplía la hora le sumaba 7 días —la
   junta de hoy se evaporaba sin dejar rastro—. La ocurrencia es el sustantivo
   que faltaba: «la junta del lunes 7», con estado propio.
   Se materializan por demanda (al leer la sala y en el cron diario), solo de
   HOY hacia adelante: inventar ocurrencias del pasado sería mentir sobre
   juntas que quizá sí se hicieron antes de que esto existiera. */
const HORIZONTE_DIAS = 28;
/** El día de hoy en hora de México (YYYY-MM-DD). */
const ymdCdmx = (ms = Date.now()) => new Date(ms - 6 * 3600e3).toISOString().slice(0, 10);

/** Las juntas que la regla produce de hoy en adelante, con su hora real en UTC.
 *
 *  `cada_semanas` (1 por default) permite quincenal, cada tres o mensual-ish
 *  sin cambiar el modelo: la regla sigue siendo "tal día de la semana". Para
 *  saber CUÁL de las semanas toca hace falta un ancla —si no, "cada 2 semanas"
 *  no dice si es esta o la siguiente—, así que se guarda `ancla`: una fecha que
 *  SÍ es junta. Se compara por semanas completas transcurridas desde el ancla.
 *  Sin ancla se cae a semanal, que es lo que hacía antes: una regla vieja sigue
 *  comportándose igual. */
function fechasDeRegla(regla: { dia_iso: number; hora: string; cada_semanas?: number; ancla?: string } | null, dias = HORIZONTE_DIAS) {
  if (!regla || !regla.dia_iso || !regla.hora) return [] as { fecha: string; inicio_at: string }[];
  const [hh, mm] = String(regla.hora).split(':').map(Number);
  const cada = Math.min(Math.max(Number(regla.cada_semanas) || 1, 1), 8);
  const anclaMs = cada > 1 && regla.ancla ? Date.parse(regla.ancla + 'T00:00:00Z') : NaN;
  const base = new Date(Date.now() - 6 * 3600e3);          // "ahora" en CDMX, leído como UTC
  const out: { fecha: string; inicio_at: string }[] = [];
  for (let i = 0; i <= dias; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (iso !== Number(regla.dia_iso)) continue;
    if (cada > 1 && !isNaN(anclaMs)) {
      const semanas = Math.round((d.getTime() - anclaMs) / (7 * 86400e3));
      if (((semanas % cada) + cada) % cada !== 0) continue;   // el % de JS puede dar negativo
    }
    const inicio = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh || 0, mm || 0) + 6 * 3600e3);
    out.push({ fecha: d.toISOString().slice(0, 10), inicio_at: inicio.toISOString() });
  }
  return out;
}

/** Suma un arrastre a los temas que esperaban esa junta. El contador contesta
 *  «¿cuánto lleva esto esperando?», se haya hecho la junta o no (decisión del
 *  dueño, 7-sep-2026): un tema de hace tres semanas no se puede ver igual que
 *  uno de ayer. Corre UNA vez por ocurrencia porque quien llama ya movió su
 *  estado y no vuelve a encontrarla pendiente. */
async function arrastrarPuntosDe(canalId: string, occId: string, corte: string) {
  const { data: ps } = await supabase.from('espacio_reunion_puntos')
    .select('id, arrastres').eq('canal_id', canalId).eq('estado', 'propuesto').is('sesion_id', null)
    .or(`para_ocurrencia_id.is.null,para_ocurrencia_id.eq.${occId}`).lt('created_at', corte).limit(300);
  for (const x of ps || []) {
    await supabase.from('espacio_reunion_puntos')
      .update({ arrastres: (x.arrastres || 0) + 1, para_ocurrencia_id: null, updated_at: ahora() }).eq('id', x.id);
  }
  return (ps || []).length;
}

/** Materializa las juntas que vienen y cierra las que ya se pasaron de día. */
export async function asegurarOcurrencias(canal: { id: string; regla_reunion: any }) {
  const hoy = ymdCdmx();
  const futuras = fechasDeRegla(canal.regla_reunion);
  if (futuras.length) {
    // ignoreDuplicates + la llave (canal_id, fecha): dos pestañas del CRM
    // materializando a la vez no duplican la junta.
    await supabase.from('espacio_reunion_ocurrencias').upsert(
      futuras.map(f => ({ canal_id: canal.id, fecha: f.fecha, inicio_at: f.inicio_at, programada_at: f.inicio_at })),
      { onConflict: 'canal_id,fecha', ignoreDuplicates: true });
  }
  // Se vence por DÍA y no por hora, a propósito: hasta la medianoche la junta
  // sigue viva y se puede iniciar tarde. Ese es el hueco que hoy no existía.
  const { data: vencidas } = await supabase.from('espacio_reunion_ocurrencias')
    .update({ estado: 'saltada', cerrada_at: ahora() })
    .eq('canal_id', canal.id).eq('estado', 'pendiente').lt('fecha', hoy)
    .select('id, inicio_at');
  for (const v of vencidas || []) await arrastrarPuntosDe(canal.id, v.id, v.inicio_at);
  return (vencidas || []).length;
}

function ordenarPuntos(ps: any[]) {
  return [...ps].sort((a, b) => (b.arrastres - a.arrastres) || ((b.votos?.length || 0) - (a.votos?.length || 0)) || (a.orden - b.orden) || a.created_at.localeCompare(b.created_at));
}

/* `actas` = cuántas actas traer. El default de 12 no era una decisión: a una
   junta por semana son tres meses, y más atrás la historia existía pero era
   invisible desde la app —sin manera de pedir más—. Ahora el panel las pide de
   doce en doce y el GET dice cuántas hay en total, para saber si queda algo. */
async function salaCompleta(canalId: string, yo: string, actas = 12) {
  const [{ data: abierta }, { data: puntos }, { data: sesiones }] = await Promise.all([
    supabase.from('espacio_reunion_sesiones').select(SEL_SESION).eq('canal_id', canalId).is('fin_at', null).maybeSingle(),
    supabase.from('espacio_reunion_puntos').select(SEL_PUNTO).eq('canal_id', canalId).neq('estado', 'retirado').order('created_at', { ascending: true }).limit(300),
    supabase.from('espacio_reunion_sesiones').select(SEL_SESION).eq('canal_id', canalId).not('fin_at', 'is', null).order('inicio_at', { ascending: false }).limit(Math.min(Math.max(actas, 1), 120)),
  ]);
  const { count: actasTotal } = await supabase.from('espacio_reunion_sesiones')
    .select('id', { count: 'exact', head: true }).eq('canal_id', canalId).not('fin_at', 'is', null);
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
  // Los adjuntos del bucket privado salen firmados, todos en UN viaje.
  await firmarAdjuntos([...(puntos || []), ...(acuerdos || [])] as any[]);
  const ids = new Set<string>();
  for (const p of puntos || []) ids.add(p.propuesto_por);
  for (const a of acuerdos || []) ids.add(a.responsable_id);
  for (const s of [...(sesiones || []), ...(abierta ? [abierta] : [])]) { for (const x of s.asistentes || []) ids.add(x); ids.add(s.abierta_por); ids.add(s.cerrada_por); }
  const personas = await personasPorId(Array.from(ids).filter(Boolean) as string[]);
  const p = (id: string | null) => id && personas[id] ? { id, nombre: personas[id].nombre, foto_url: personas[id].foto_url } : null;

  // La agenda: lo propuesto que no pertenece a una sesión ya cerrada, más lo
  // de la sesión abierta en cualquier estado (para verlo tratarse en vivo).
  const agenda = ordenarPuntos((puntos || []).filter((x: any) => abierta ? (x.sesion_id === abierta.id || (x.estado === 'propuesto' && !x.sesion_id && !x.para_ocurrencia_id)) : (x.estado === 'propuesto' && !x.sesion_id && !x.para_ocurrencia_id)));
  /* Lo apartado para una junta POSTERIOR se lista aparte, no en la agenda de
     hoy: apartar un tema para el 3 de octubre y que igual salga en la junta de
     hoy sería no haber apartado nada. Sin junta asignada (lo normal) siguen
     cayendo en la agenda de siempre. */
  const proximas = ordenarPuntos((puntos || []).filter((x: any) => x.estado === 'propuesto' && !x.sesion_id && x.para_ocurrencia_id));
  const formaPunto = (x: any) => ({ ...x, propuesto_por: p(x.propuesto_por), votos: x.votos?.length || 0, vote: (x.votos || []).includes(yo) });
  /* Cuántas veces se ha arrastrado este acuerdo. Es LA pregunta cuando algo
     lleva un mes sin cumplirse: «se pasó a la próxima» tres veces seguidas
     significa otra cosa que la primera vez, y sin el número las tres se ven
     iguales. Se cuenta hacia atrás por la cadena de `reemplazado_por`. */
  const previo = new Map<string, string>();   // acuerdo → el que lo reemplazó
  for (const a of acuerdos || []) if ((a as any).reemplazado_por) previo.set((a as any).reemplazado_por, a.id);
  const arrastresDe = (id: string) => { let n = 0, cur = previo.get(id); while (cur && n < 20) { n++; cur = previo.get(cur); } return n; };
  const formaAcuerdo = (a: any) => ({ ...a, responsable: p(a.responsable_id), arrastres: arrastresDe(a.id), hecho_at: a.hecho_at || (a.tarea_id ? hechas[a.tarea_id] || null : null) });
  const acs = (acuerdos || []).map(formaAcuerdo);
  /* Pendiente = no está hecho Y no fue arrastrado a otra junta. Sin lo segundo,
     pasar un acuerdo a la reunión de hoy lo contaría DOS veces —el viejo y su
     continuación—, y a la tercera junta serían tres. */
  const pendientes = acs.filter((a: any) => !a.hecho_at && !a.reemplazado_por);

  /* Las juntas del calendario: la de hoy si toca (aunque ya pasó la hora), las
     que vienen, y las últimas saltadas para que la ausencia deje rastro. Es lo
     que antes no existía: el panel calculaba "la próxima" y la de hoy
     desaparecía en el instante en que se cumplía su hora. */
  const hoyYmd = ymdCdmx();
  const { data: occs } = await supabase.from('espacio_reunion_ocurrencias')
    .select('id, fecha, inicio_at, programada_at, estado, motivo, sesion_id, movida_por')
    .eq('canal_id', canalId).gte('fecha', new Date(Date.now() - 6 * 3600e3 - 21 * 86400e3).toISOString().slice(0, 10))
    .order('fecha', { ascending: true }).limit(40);
  const ocurrencias = (occs || []).map((o: any) => ({ ...o, movida: o.inicio_at !== o.programada_at, movida_por: p(o.movida_por) }));
  /* La junta VIGENTE: la de hoy si sigue pendiente —haya pasado la hora o no—,
     y si no, la siguiente pendiente. Devolverla aparte evita que el front tenga
     que repetir esta decisión, que es donde estaba el bug. */
  const actual = ocurrencias.find((o: any) => o.estado === 'pendiente' && o.fecha === hoyYmd)
    || ocurrencias.find((o: any) => o.estado === 'pendiente' && o.fecha > hoyYmd) || null;
  const puntosPorOcurrencia: Record<string, number> = {};
  for (const x of puntos || []) if (x.para_ocurrencia_id && x.estado === 'propuesto' && !x.sesion_id) puntosPorOcurrencia[x.para_ocurrencia_id] = (puntosPorOcurrencia[x.para_ocurrencia_id] || 0) + 1;

  // Mensajes de la sesión abierta por punto: "3 mensajes sobre este punto".
  const porPunto: Record<string, number> = {};
  if (abierta) {
    const { data: ms } = await supabase.from('espacio_mensajes').select('punto_id').eq('sesion_id', abierta.id).is('borrado_at', null).not('punto_id', 'is', null);
    for (const m of ms || []) porPunto[m.punto_id] = (porPunto[m.punto_id] || 0) + 1;
  }
  return {
    ocurrencias, actual, puntos_por_ocurrencia: puntosPorOcurrencia, actas_total: actasTotal || 0,
    proximas: proximas.map(formaPunto),
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
  /* Materializar y barrer ANTES de leer: si el panel calculara sobre datos sin
     barrer, una junta saltada seguiría viéndose pendiente hasta que corriera el
     cron. Es barato (un upsert idempotente y un update por índice parcial). */
  await asegurarOcurrencias(c as any);
  const sala = await salaCompleta(c.id, yo.id, parseInt(url.searchParams.get('actas') || '12', 10) || 12);
  // "Esta semana con clientes": las citas agendadas de los próximos 7 días.
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const en7 = new Date(Date.now() - 6 * 3600e3 + 7 * 86400e3).toISOString().slice(0, 10);
  const { data: citas } = await supabase.from('bookings').select('id, fecha, hora_inicio, invitee_nombre, invitee_empresa, host_id, estado')
    .gte('fecha', hoy).lte('fecha', en7).in('estado', ['confirmada', 'pendiente', 'reagendada']).order('fecha').order('hora_inicio').limit(30);
  const hosts = await personasPorId((citas || []).map((x: any) => x.host_id).filter(Boolean));
  return json({
    ok: true, proxima: proximaReunion(c.regla_reunion), regla: c.regla_reunion,
    /* El GUION: lo fijo de esta junta, quién presenta qué. No son puntos de
       agenda —esos se consumen al tratarlos— sino el orden que se repite cada
       semana, para que nadie llegue preguntándose de qué se habla. */
    guion: (c as any).guion || null,
    ...sala,
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
    /* Adjuntos del punto: MISMO validador que los mensajes (espacio.lib). Un
       punto como "revisar la portada nueva" tiene que poder traer la portada;
       antes solo cargaba `contexto`, que son referencias a mensajes. */
    const adj = limpiarAdjuntos(b.adjuntos);
    if (typeof adj === 'string') return json({ error: adj }, 400);
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
      canal_id: c.id, titulo, propuesto_por: yo.id, origen_mensaje_id: origen, contexto, adjuntos: adj, votos: [yo.id], orden: (ult?.orden || 0) + 1,
      sesion_id: abierta?.id || null,   // si la reunión ya va, entra a la de hoy
    }).select(SEL_PUNTO).single();
    if (error) return json({ error: error.message }, 500);
    await emitir({ tipo: 'reunion', canal_id: c.id });

    /* AVISO A LOS DEMÁS (5-sep-2026, pedido del dueño). Un punto nuevo es de
       las pocas cosas del chat que le cambian el día a otra persona: mañana
       hay que llegar con eso preparado. Antes no avisaba nada — el punto
       aparecía en la sala y se descubría al entrar a la junta.
       A los DEMÁS, no a quien lo propuso: nadie necesita que le avisen de lo
       que acaba de escribir. Best-effort: el aviso nunca tumba el punto. */
    try {
      const { puedeEmpujar, tagDe } = await import('../../../../lib/crm/push-reglas');
      if (puedeEmpujar('reunion_punto')) {
        const { pushA } = await import('../../../../lib/crm/push-crm');
        const eq = await equipo();
        const quienEs = eq.find(x => x.id === yo.id)?.nombre?.split(' ')[0] || 'Alguien';
        for (const persona of eq) {
          if (persona.id === yo.id || persona.rol === 'soporte') continue;
          await pushA(persona.id, {
            title: `Punto nuevo en ${c.descripcion || '#' + c.nombre}`,
            body: `${quienEs}: ${titulo}`,
            tag: tagDe.sala(c.id),
            url: `/admin/crm?tab=equipo&canal=${c.id}&sala=1`,
            requireInteraction: false,
            data: { canal_id: c.id, clase: 'reunion_punto' },
          }).catch(() => null);
        }
      }
    } catch (e) { console.warn('[sala] aviso de punto nuevo:', e); }

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

  /* Avisar al EQUIPO de un cambio de calendario. Sin esto, mover o saltar una
     junta solo refrescaba los paneles que estuvieran abiertos en ese momento:
     quien no entrara a la sala se enteraba el día que llegaba y no había nadie.
     Un cambio de horario es justo lo que le cambia el día a otra persona. */
  const avisarCalendario = async (canal: any, titulo: string, detalle: string) => {
    try {
      const eq = await equipo();
      for (const per of eq) {
        if (per.id === yo.id) continue;                    // el que lo movió ya lo sabe
        await avisar({ para: per.id, tipo: 'espacio_reunion', titulo, detalle, canal_id: canal.id, nivel: 'alerta' });
      }
    } catch { /* la campana no puede tumbar el cambio de calendario */ }
  };

  /* ── mover: reagendar UNA junta sin tocar la regla ───────────────────────
     Antes esto no se podía: solo existía la regla semanal, así que mover el
     lunes 10:00 al martes 4 p.m. "solo esta semana" obligaba a cambiar la regla
     y acordarse de regresarla — y mientras tanto el aviso de la noche anterior
     salía con la regla nueva. `programada_at` conserva dónde la había puesto la
     regla, para poder decir "movida de las 10:00". */
  if (accion === 'mover') {
    const c = await canalDe(b.canal_id);
    if (!c || c.tipo !== 'sala' || !puedeVerCanal(c, yo.id)) return json({ error: 'Sala no encontrada' }, 404);
    const nuevo = new Date(String(b.inicio_at || ''));
    if (isNaN(nuevo.getTime())) return json({ error: 'Fecha y hora no válidas' }, 400);
    await asegurarOcurrencias(c as any);
    const { data: occ } = await supabase.from('espacio_reunion_ocurrencias')
      .select('id, estado, programada_at').eq('canal_id', c.id).eq('id', b.ocurrencia_id).maybeSingle();
    if (!occ) return json({ error: 'Esa junta no existe' }, 404);
    if (occ.estado !== 'pendiente') return json({ error: 'Esa junta ya se cerró: solo se pueden mover las que siguen pendientes' }, 409);
    // La fecha sigue al día en que de verdad va a pasar. Si ya hay otra junta
    // ese día, se avisa en vez de reventar contra la llave única.
    const fecha = ymdCdmx(nuevo.getTime());
    const { data: choca } = await supabase.from('espacio_reunion_ocurrencias')
      .select('id').eq('canal_id', c.id).eq('fecha', fecha).neq('id', occ.id).maybeSingle();
    if (choca) return json({ error: 'Ya hay una junta de esta sala ese día' }, 409);
    const { error } = await supabase.from('espacio_reunion_ocurrencias')
      .update({ fecha, inicio_at: nuevo.toISOString(), motivo: (b.motivo || '').trim().slice(0, 300) || null, movida_por: yo.id })
      .eq('id', occ.id);
    if (error) return json({ error: error.message }, 500);
    const cuando = nuevo.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    await avisarCalendario(c, `Se movió la junta de #${c.nombre}`, `Ahora es el ${cuando}.${b.motivo ? ` ${String(b.motivo).slice(0, 140)}` : ''}`);
    await emitir({ tipo: 'reunion', canal_id: c.id });
    return json({ ok: true });
  }

  /* ── saltar: decir en voz alta que esta semana no hay junta ──────────────
     Distinto de dejarla morir: queda el motivo y sus temas suman arrastre, así
     que la próxima ya sabe que llevan una semana más esperando. */
  if (accion === 'saltar') {
    const { data: occ } = await supabase.from('espacio_reunion_ocurrencias')
      .select('id, canal_id, estado, inicio_at').eq('id', b.ocurrencia_id).maybeSingle();
    if (!occ) return json({ error: 'Esa junta no existe' }, 404);
    const c = await canalDe(occ.canal_id);
    if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Sala no encontrada' }, 404);
    if (occ.estado !== 'pendiente') return json({ error: 'Esa junta ya se cerró' }, 409);
    await supabase.from('espacio_reunion_ocurrencias')
      .update({ estado: 'saltada', motivo: (b.motivo || '').trim().slice(0, 300) || null, cerrada_at: ahora() }).eq('id', occ.id);
    const n = await arrastrarPuntosDe(occ.canal_id, occ.id, occ.inicio_at);
    const dia = new Date(occ.inicio_at).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long' });
    await avisarCalendario(c, `No hay junta de #${c.nombre}`, `Se saltó la del ${dia}.${b.motivo ? ` ${String(b.motivo).slice(0, 140)}` : ''}${n ? ` ${n} tema${n === 1 ? '' : 's'} pasan a la siguiente.` : ''}`);
    await emitir({ tipo: 'reunion', canal_id: occ.canal_id });
    return json({ ok: true, arrastrados: n });
  }

  /* ── guion: editar el orden fijo de la junta ─────────────────────────────
     Era una columna jsonb del canal SIN editor: lo que hace que la junta corra
     igual cada semana solo se podía cambiar metiendo mano a la base. Se valida
     aquí y no se confía en el front: es la única puerta.
     Bloques con su responsable, sus minutos y sus puntos. Un guion vacío
     (arreglo sin elementos) lo apaga, y la pestaña deja de salir. */
  if (accion === 'guion') {
    const c = await canalDe(b.canal_id);
    if (!c || c.tipo !== 'sala' || !puedeVerCanal(c, yo.id)) return json({ error: 'Sala no encontrada' }, 404);
    if (!Array.isArray(b.guion)) return json({ error: 'Guion inválido' }, 400);
    if (b.guion.length > 12) return json({ error: 'Máximo 12 bloques' }, 400);
    /* ⚠️ LA `fuente` DE CADA PUNTO SE CONSERVA.
       Un punto del guion puede ser texto suelto o {t, fuente} —"de dónde sale
       el número", que es lo que evita que cada quien llegue con cifras
       distintas—. El editor manda los puntos como TEXTO PLANO (un renglón por
       punto), así que guardar tal cual BORRABA las fuentes: medido, 12 de 12 se
       perdieron en un guardado que ni siquiera cambió nada.
       Se rescatan por TEXTO, no por posición: mover un bloque de lugar o
       reordenar los puntos no debe costar su fuente, y un punto reescrito la
       pierde a propósito (ya no es el mismo punto). */
    const { data: canalPrev } = await supabase.from('espacio_canales').select('guion').eq('id', c.id).maybeSingle();
    const fuentePrevia = new Map<string, string>();
    for (const bl of ((canalPrev?.guion as any[]) || [])) {
      for (const q of (bl?.puntos || [])) if (q && typeof q !== 'string' && q.t && q.fuente) fuentePrevia.set(String(q.t).trim(), String(q.fuente));
    }
    const limpio = [];
    for (const x of b.guion) {
      const bloque = String(x?.bloque || '').trim().slice(0, 80);
      if (!bloque) continue;                                   // un bloque sin nombre no es un bloque
      const puntos = (Array.isArray(x.puntos) ? x.puntos : [])
        .map((q: any) => (typeof q === 'string' ? q : String(q?.t || '')).trim().slice(0, 200))
        .filter(Boolean).slice(0, 20)
        .map((t: string) => {
          // Si el front ya mandó la fuente, esa manda; si no, la que tenía.
          const dada = (Array.isArray(x.puntos) ? x.puntos : []).find((q: any) => q && typeof q !== 'string' && String(q.t || '').trim() === t)?.fuente;
          const f = dada || fuentePrevia.get(t);
          return f ? { t, fuente: String(f).slice(0, 80) } : t;
        });
      const min = Number(x.minutos);
      limpio.push({
        bloque, quien: String(x?.quien || '').trim().slice(0, 60),
        ...(min > 0 && min <= 240 ? { minutos: Math.round(min) } : {}),
        puntos,
      });
    }
    const { error } = await supabase.from('espacio_canales').update({ guion: limpio.length ? limpio : null }).eq('id', c.id);
    if (error) return json({ error: error.message }, 500);
    await emitir({ tipo: 'reunion', canal_id: c.id });
    return json({ ok: true, guion: limpio });
  }

  /* ── reabrir: deshacer un "no hay junta" ─────────────────────────────────
     Marcar saltada por error, o que el barrido la cerrara porque ese día nadie
     alcanzó a abrirla, no tenía vuelta atrás: la junta se quedaba cerrada para
     siempre. Solo las `saltada` — una `hecha` tiene sesión y acta detrás, y
     "deshacerla" sería borrar el acta, que es otra cosa y no se hace de un
     clic. Los arrastres que sumó al saltarse NO se deshacen: el tiempo que el
     tema estuvo esperando sí pasó. */
  if (accion === 'reabrir') {
    const { data: occ } = await supabase.from('espacio_reunion_ocurrencias')
      .select('id, canal_id, estado').eq('id', b.ocurrencia_id).maybeSingle();
    if (!occ) return json({ error: 'Esa junta no existe' }, 404);
    const c = await canalDe(occ.canal_id);
    if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Sala no encontrada' }, 404);
    if (occ.estado === 'hecha') return json({ error: 'Esa junta sí se hizo: tiene acta. No se puede reabrir desde aquí.' }, 409);
    if (occ.estado !== 'saltada') return json({ error: 'Esa junta ya está pendiente' }, 409);
    await supabase.from('espacio_reunion_ocurrencias')
      .update({ estado: 'pendiente', motivo: null, cerrada_at: null }).eq('id', occ.id);
    await emitir({ tipo: 'reunion', canal_id: occ.canal_id });
    return json({ ok: true });
  }

  /* ── agendar: apartar un tema para una junta POSTERIOR ───────────────────
     null = «a la próxima que toque», que es como se comportaba todo antes. Con
     ocurrencia, el tema no entra a la junta de hoy aunque se le dé play. */
  if (accion === 'agendar') {
    const { data: pt } = await supabase.from('espacio_reunion_puntos').select('id, canal_id, sesion_id').eq('id', b.punto_id).maybeSingle();
    if (!pt) return json({ error: 'Ese punto no existe' }, 404);
    const c = await canalDe(pt.canal_id);
    if (!c || !puedeVerCanal(c, yo.id)) return json({ error: 'Sala no encontrada' }, 404);
    if (pt.sesion_id) return json({ error: 'Ese punto ya está en una reunión' }, 409);
    let occId: string | null = null;
    if (b.ocurrencia_id) {
      const { data: occ } = await supabase.from('espacio_reunion_ocurrencias')
        .select('id, estado').eq('id', b.ocurrencia_id).eq('canal_id', pt.canal_id).maybeSingle();
      if (!occ) return json({ error: 'Esa junta no existe' }, 404);
      if (occ.estado !== 'pendiente') return json({ error: 'Esa junta ya pasó' }, 409);
      occId = occ.id;
    }
    await supabase.from('espacio_reunion_puntos').update({ para_ocurrencia_id: occId, updated_at: ahora() }).eq('id', pt.id);
    await emitir({ tipo: 'reunion', canal_id: pt.canal_id });
    return json({ ok: true });
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
    /* ¿A qué junta del calendario pertenece este play? A la de HOY, si toca.
       El botón NUNCA se bloquea (decisión del dueño, 7-sep-2026): una junta que
       arranca 20 min tarde es lo normal, y bloquear el play lograría que la
       gente deje de usarlo y el acta no exista. Pero si hoy había junta, la
       sesión queda amarrada a ella y esa junta se marca hecha — así «el día se
       marca» cuando le das play, no cuando pasa la hora. Si le das play un día
       sin junta programada, es una sesión extraordinaria y no toca el
       calendario. */
    await asegurarOcurrencias(c as any);
    const { data: occHoy } = await supabase.from('espacio_reunion_ocurrencias')
      .select('id').eq('canal_id', c.id).eq('fecha', ymdCdmx()).eq('estado', 'pendiente').maybeSingle();
    if (occHoy) await supabase.from('espacio_reunion_ocurrencias')
      .update({ estado: 'hecha', sesion_id: data.id, cerrada_at: ahora() }).eq('id', occHoy.id);
    /* Los puntos que entran: los de siempre (sin junta apartada) MÁS los que
       alguien apartó para esta junta. Los apartados para una junta posterior no
       entran — ese es justamente el sentido de poder prepararla. */
    const base = supabase.from('espacio_reunion_puntos').update({ sesion_id: data.id, updated_at: ahora() })
      .eq('canal_id', c.id).eq('estado', 'propuesto').is('sesion_id', null);
    if (occHoy) await base.or(`para_ocurrencia_id.is.null,para_ocurrencia_id.eq.${occHoy.id}`);
    else await base.is('para_ocurrencia_id', null);
    await emitir({ tipo: 'reunion', canal_id: c.id });
    return json({ ok: true, sesion: data });
  }

  if (accion === 'asistentes' || accion === 'tratar' || accion === 'cerrar' || accion === 'resumen' || accion === 'acordar' || accion === 'arrastrar') {
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
    /* ARRASTRAR · lo que no se cumplió pasa a ser acuerdo de HOY, con un clic.
       Antes esto era «lo vemos la próxima» dicho en voz alta: el compromiso
       seguía vivo en pendientes, nadie volvía a ponerle fecha y a los dos meses
       nadie sabía de qué junta venía.
       Se copia el texto y el responsable —lo que no cambió— y se le pone fecha
       nueva; el viejo queda apuntando al nuevo, así sale de pendientes sin
       borrarse ni darse por hecho. No se hizo, y eso tiene que poder verse. */
    if (accion === 'arrastrar') {
      const { data: viejo } = await supabase.from('espacio_acuerdos').select(SEL_ACUERDO).eq('id', b.acuerdo_id).maybeSingle();
      if (!viejo) return json({ error: 'Ese acuerdo no existe' }, 404);
      if (viejo.hecho_at) return json({ error: 'Ese acuerdo ya está hecho: no hay qué arrastrar' }, 400);
      if (viejo.reemplazado_por) return json({ error: 'Ese acuerdo ya se pasó a otra reunión' }, 400);
      if (viejo.sesion_id === s.id) return json({ error: 'Ese acuerdo ya es de esta reunión' }, 400);

      let vence_at: string | null = b.vence_at || null;
      if (vence_at && !/^\d{4}-\d{2}-\d{2}$/.test(String(vence_at))) return json({ error: 'Fecha inválida' }, 400);
      // Sin fecha nueva, una semana: arrastrarlo sin plazo lo deja igual de
      // huérfano que estaba.
      if (!vence_at) vence_at = new Date(Date.now() + 7 * 86400e3 - 6 * 3600e3).toISOString().slice(0, 10);

      const { data: nuevo, error } = await supabase.from('espacio_acuerdos')
        // El archivo viaja con el compromiso: si se arrastra sin sus adjuntos,
        // a la segunda junta nadie encuentra de qué se hablaba.
        .insert({ sesion_id: s.id, punto_id: null, texto: viejo.texto, responsable_id: viejo.responsable_id, vence_at, adjuntos: (viejo as any).adjuntos || [] })
        .select(SEL_ACUERDO).single();
      if (error) return json({ error: error.message }, 500);
      await supabase.from('espacio_acuerdos').update({ reemplazado_por: nuevo.id }).eq('id', viejo.id);
      await emitir({ tipo: 'reunion', canal_id: c.id });
      return json({ ok: true, acuerdo: nuevo });
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
      /* "Mandar el comparativo" tiene que poder llevar el comparativo: sin
         esto el acta terminaba mandando a buscar el archivo en el chat. */
      const adjA = limpiarAdjuntos(b.adjuntos);
      if (typeof adjA === 'string') return json({ error: adjA }, 400);
      const { data, error } = await supabase.from('espacio_acuerdos').insert({ sesion_id: s.id, punto_id, texto, responsable_id: b.responsable_id, vence_at, adjuntos: adjA }).select(SEL_ACUERDO).single();
      if (error) return json({ error: error.message }, 500);
      if (punto_id) await supabase.from('espacio_reunion_puntos').update({ estado: 'acordado', sesion_id: s.id, updated_at: ahora() }).eq('id', punto_id);
      await emitir({ tipo: 'reunion', canal_id: c.id });
      return json({ ok: true, acuerdo: data });
    }

    // ── cerrar ───────────────────────────────────────────────────────────
    /* Asistentes CONFIRMADOS. Al iniciar se toma a quien esté en línea en los
       últimos 5 min, que es una suposición: el que llega tarde no aparece y el
       que dejó la pestaña abierta sí. Y de esa lista salen los responsables de
       los acuerdos, así que la suposición se propaga al acta. Al cerrar hay un
       humano mirando y sí puede decir quién estuvo. Si no manda nada, queda lo
       de antes: cerrar nunca se bloquea por esto. */
    if (Array.isArray(b.asistentes)) {
      const eqCerrar = await equipo();
      const conf = b.asistentes.filter(esUuid).filter((x: string) => eqCerrar.some(pp => pp.id === x));
      await supabase.from('espacio_reunion_sesiones').update({ asistentes: conf }).eq('id', s.id);
      (s as any).asistentes = conf;
    }
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
