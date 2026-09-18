// LLAMADAS INTELIGENTES · El motor del marcador automático.
//
// Cómo funciona, de principio a fin:
//   1. El vendedor arma una LISTA con los filtros del inbox → `crearSesion`.
//   2. Le da «Empezar»: su navegador entra a una SALA de conferencia de Twilio
//      (`sesion-<id>`) con el micrófono apagado → `iniciarSesion` + voz.ts.
//   3. El servidor ORIGINA la llamada al primer contacto por la API REST y la
//      mete a la misma sala, con transcripción en vivo → `marcarSiguiente`.
//   4. Lo que dice el contacto pasa por los oídos (`oidos.ts`): persona → se
//      le abre el micrófono al vendedor y se le enseña la ficha; buzón → se
//      cuelga; portero → se le dicta la presentación y se sigue escuchando.
//   5. Al colgar, si no hubo persona se marca al siguiente SOLO; si la hubo,
//      se espera el cierre del vendedor (nota, resultado) y luego sigue.
//
// Todo estado vive en `tel_sesiones` / `tel_sesion_items`. Los webhooks de
// Twilio llegan en cualquier orden y repetidos: cada transición es un UPDATE
// condicional (`where estado = …`), y el que no gana la carrera no hace nada.
import { supabase } from '../supabase';
import { twilioRest, NUMERO } from './twilio';
import { callerIdSaliente } from './caller-id';
import { juzgar, textoOido, dialogoOido, fraseClave, compilarReglas, type Oido, type ReglasExtra } from './oidos';
import { telefonoWhatsApp, telefonoLegible } from '../telefono';
import { registrarBitacoraLlamada } from './bitacora';
import { ladaDe, zonaDeLada, horaLocal, fechaHoraEn, instanteEnZona } from './zonas';
// Fernanda al teléfono: el aviso a la central de voz se carga aparte (solo lo usan las sesiones con IA).
const voz = () => import('./voz');
/** ¿Habla Fernanda en esta sesión? («ia» sola, «asistido» con el vendedor escuchando). */
export const conFernanda = (s: any) => !!s?.modo && s.modo !== 'manual';
/** En modo «ia» no hace falta el vendedor en la sala para marcar ni para seguir. */
const sinSala = (s: any) => s?.modo === 'ia';
// `./cierre` arrastra googleapis, pdfkit y el SDK de IA: se carga solo cuando hace falta (los webhooks TwiML importan este módulo y deben arrancar rápido).
const cierre = () => import('./cierre');

export const BASE = 'https://www.sacscloud.com';
const ahora = () => new Date().toISOString();
const ms = (iso?: string | null) => (iso ? Date.now() - new Date(iso).getTime() : 0);

export type ItemEntrada = {
  contact_id?: string | null; company_id?: string | null; conversation_id?: string | null;
  nombre?: string | null; empresa?: string | null; telefono: string;
};
export type Config = { horario?: { desde: string; hasta: string; dias?: number[] } | null; tope_intentos?: number; wrapup_seg?: number; auto_continuar?: boolean; disyuntor_fallidas?: number; reintentos_buzon?: number; lineas?: number };

const CONFIG_BASE: Required<Config> = { horario: { desde: '09:00', hasta: '19:00', dias: [1, 2, 3, 4, 5, 6] }, tope_intentos: 3, wrapup_seg: 8, auto_continuar: true, disyuntor_fallidas: 8, reintentos_buzon: 0, lineas: 1 };

/* ══ MARCAR EN PARALELO (18-sep-2026) ═══════════════════════════════════════
   Pedido del dueño: «se estarían marcando tres personas al mismo tiempo desde
   esa vista y, una vez que alguien responda, ya se paran las otras dos, tomo la
   llamada, termino, y de ahí siguen otra vez».

   Es lo que hacen los marcadores buenos del mundo (Orum, Nooks): el tiempo que
   se pierde no es hablando, es timbrando — contesta uno de cada cinco y cada
   intento se lleva media vuelta de reloj. Con varias líneas, el vendedor sólo
   oye a los que SÍ contestaron.

   Lo que lo hace posible aquí sin colgarle a la gente: ya sabemos en 1.5-3 s si
   del otro lado hay una persona (reglas sobre la transcripción + AMD). Nadie se
   conecta a la sala hasta ese veredicto.

   LAS TRES REGLAS QUE NO SE NEGOCIAN
   1. En paralelo el contacto NO entra a la sala del vendedor: espera en su
      propio cuarto, en silencio, hasta que se le pasa. Si entrara, el vendedor
      oiría tres tonos encimados.
   2. Gana el primero que dice «bueno»: se le pasa al vendedor y a las demás
      líneas se les cuelga MIENTRAS TIMBRAN — antes de que nadie levante.
   3. Si dos contestan casi a la vez, al segundo NO se le cuelga mudo: se le
      dice quién llamaba y se le vuelve a marcar en quince minutos. Eso es una
      llamada abandonada y se cuenta, porque es lo que hay que mantener abajo.
   Con `lineas: 1` (lo de siempre) nada de esto corre: el camino es el mismo de
   antes, línea por línea y con el vendedor oyendo el timbre. */
const LINEAS_MAX = 3;
export const lineasDe = (s: any) => Math.max(1, Math.min(LINEAS_MAX, Number(s?.config?.lineas || 1)));
/** Las llamadas de esta sesión que están vivas ahora mismo (marcando, timbrando,
 *  escuchando, con portero o ya en línea). En una línea es cero o una. */
export async function itemsVivos(sesionId: string) {
  const { data } = await supabase.from('tel_sesion_items').select('*')
    .eq('sesion_id', sesionId).in('estado', ['marcando', 'timbrando', 'escuchando', 'portero', 'en_linea'])
    .order('marcado_at');
  return data || [];
}

/* ══ REINTENTAR CUANDO TIMBRÓ Y SE FUE AL BUZÓN ═══════════════════════════
   Pedido del dueño (17-sep-2026): «si suena y manda a buzón, que yo tenga
   opción de decidir si reintentar automáticamente 1, 2 o 3 veces antes de
   pasar a la siguiente. Si sólo manda a buzón en automático, ahí no aplica
   porque el teléfono está apagado».

   La distinción es exacta y vale oro: un teléfono QUE SUENA está encendido y
   con alguien cerca — no contestó esta vez, puede contestar en veinte minutos.
   Uno que va derecho al buzón está apagado o sin señal, y reintentarlo es
   quemar llamadas contra una grabadora.

   Cómo se sabe cuál fue, sin datos nuevos: el TIEMPO entre marcar y
   «contestar». Está medido en producción y escrito tres líneas más abajo —
   3.3 s cuando cae directo al buzón—. Con diez segundos de margen no hay
   confusión posible: menos de eso no sonó, más de eso sí. */
const TIMBRE_REAL_MS = 10000;
const REINTENTO_BUZON_MIN = 25;   // ni tan pronto que moleste, ni tan tarde que se olvide

/* ══ EL REINTENTO VA A OTRA FRANJA DEL DÍA (17-sep-2026) ══════════════════
   Volver a marcar veinticinco minutos después es marcarle a la misma persona
   en la misma situación: si a las diez de la mañana está abriendo la tienda, a
   las diez y veinticinco sigue abriendo la tienda. Lo que sí cambia el
   resultado es cambiar de FRANJA — es de lo más medido que hay en telefonía de
   ventas: quien no contesta en la mañana contesta en la tarde, y al revés.

   Regla: mañana (antes de las 13) → esa misma tarde a las 16:30. Tarde → al
   día siguiente a las 10:30. Todo en la hora DEL CONTACTO, que para eso está
   `zonas.ts`, y respetando el horario de la sesión (si la tarde ya se pasó,
   cae al día siguiente). */
function otraFranja(telefono: string, lada?: string | null): Date {
  const zona = zonaDeLada(lada || ladaDe(telefono));
  const ahoraAlla = fechaHoraEn(zona, new Date());
  const h = Number(ahoraAlla.hora.slice(0, 2));
  if (h < 13) return instanteEnZona(ahoraAlla.fecha, '16:30', zona);
  const manana = fechaHoraEn(zona, new Date(Date.now() + 86400e3)).fecha;
  return instanteEnZona(manana, '10:30', zona);
}
/** Los resultados que significan que SÍ se habló con alguien. */
export const CONVERSACION = ['contesto', 'volver_llamar', 'no_interesa', 'dieron_datos'];

/* Tiempos de espera del motor, en ms. Medido en producción (E0, 11-sep):
   timbre→contesta 3.3 s cuando cae al buzón, veredicto de reglas a 2.9 s,
   transcripción final del saludo de Telcel a 11.9 s. */
export const ESPERA = {
  juicio: 9000,      // contestaron y nadie dijo nada claro → duda (se le pasa al vendedor)
  buzon: 30000,      // buzón sin el tono del AMD → se deja el mensaje de todos modos (Telcel: saludo de ~12 s)
  portero: 40000,    // portero que no pasa la llamada → se cuelga
  timbre: 55000,     // marcando/timbrando sin noticias de Twilio → se pregunta y se cierra
  cierre: 8000,      // wrap-up por defecto tras hablar con una persona
  caida: 30000,      // el vendedor se cayó en línea y no volvió → se cuelga con disculpa (la TwiML de espera lo hace a los ~20 s; esto es la red)
  caida_remarcar: 10, // minutos para volver a marcar al que se le cortó
  prometida_reintento: 15, // minutos entre reintentos de una llamada que el contacto pidió («márcame en diez minutos») y no contestó
  prometida_max: 2,        // cuántos reintentos antes de darse por vencido (queda para el vendedor en Mi día)
};

/** ¿Es hora de llamar… en la zona del contacto? (la lada decide el huso) */
const enHorario = (h: Config['horario'], zona = 'America/Mexico_City') => {
  if (!h?.desde || !h?.hasta) return true;
  const n = new Date(new Date().toLocaleString('en-US', { timeZone: zona }));
  const dias = Array.isArray(h.dias) && h.dias.length ? h.dias : [1, 2, 3, 4, 5];
  if (!dias.includes(n.getDay())) return false;
  const min = n.getHours() * 60 + n.getMinutes();
  const [hd, md] = String(h.desde).split(':').map(Number), [hh, mh] = String(h.hasta).split(':').map(Number);
  return min >= hd * 60 + (md || 0) && min < hh * 60 + (mh || 0);
};

/** ¿Ese instante cae antes de que cierre el horario de HOY (hora del centro)? Si no, la sesión no tiene por qué seguir viva esperándolo. */
const dentroDeHoy = (iso: string, h: Config['horario']) => {
  const fin = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const cuando = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  if (cuando.toDateString() !== fin.toDateString()) return false;
  if (!h?.hasta) return true;
  const [hh, mh] = String(h.hasta).split(':').map(Number);
  return cuando.getHours() * 60 + cuando.getMinutes() < hh * 60 + (mh || 0);
};

/** La lista se agotó: se cierra sola (solo si sigue activa; una pausada la cierra el vendedor). */
async function agotarSesion(sesionId: string) {
  await supabase.from('tel_sesiones').update({ estado: 'terminada', terminada_at: ahora(), item_actual: null, updated_at: ahora() }).eq('id', sesionId).eq('estado', 'activa');
  await recontar(sesionId);
}

/* Las reglas aprendidas (`tel_reglas` activas) se leen una vez por minuto. */
let reglasCache: { en: number; r: ReglasExtra } | null = null;
export async function reglasAprendidas(): Promise<ReglasExtra | null> {
  if (reglasCache && Date.now() - reglasCache.en < 60000) return reglasCache.r;
  const { data } = await supabase.from('tel_reglas').select('tipo, patron').eq('estado', 'activa').limit(500);
  reglasCache = { en: Date.now(), r: compilarReglas(data || []) };
  return reglasCache.r;
}
export const olvidarReglas = () => { reglasCache = null; };

export const getSesion = async (id: string) => (await supabase.from('tel_sesiones').select('*').eq('id', id).maybeSingle()).data as any;
const getItem = async (id: string) => (await supabase.from('tel_sesion_items').select('*').eq('id', id).maybeSingle()).data as any;

// ─────────────────────────────────────────────────────────────────────────────
// 1 · ARMAR LA LISTA
// ─────────────────────────────────────────────────────────────────────────────
export async function crearSesion(ownerId: string | null, o: {
  nombre?: string; origen?: any; items: ItemEntrada[];
  presentacion_nombre?: string; presentacion_motivo?: string; buzon_dejar_mensaje?: boolean; config?: Config; modo?: 'manual' | 'ia' | 'asistido';
}) {
  const config = { ...CONFIG_BASE, ...(o.config || {}) };
  const vistos = new Set<string>();
  const filas: any[] = [];
  const excluidos: { nombre: string; telefono: string; motivo: string }[] = [];

  // Teléfonos de «no me llames» y los que ya se marcaron 3 veces esta semana.
  const ids = o.items.map(i => i.contact_id).filter(Boolean) as string[];
  const noLlamar = new Set<string>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('contacts').select('id').in('id', ids.slice(i, i + 150)).eq('no_llamar', true);
    (data || []).forEach(c => noLlamar.add(c.id));
  }
  const tels = Array.from(new Set(o.items.map(i => telefonoWhatsApp(i.telefono)).filter(Boolean))) as string[];
  /* El tope cuenta solo los INTENTOS sin conversación (buzón, no contestó,
     portero). Si en la semana ya se habló con él y pidió que se le vuelva a
     llamar, el tope se reinicia; si dijo que no le interesa, se respeta esa
     semana. Antes contaba todo y escondía justo a los que pidieron la llamada. */
  const intentosSemana = new Map<string, number>();
  const pidioLlamada = new Set<string>();
  const dijoNo = new Map<string, string>();
  const desde = new Date(Date.now() - 7 * 864e5).toISOString();
  for (let i = 0; i < tels.length; i += 150) {
    const { data } = await supabase.from('wa_llamadas').select('telefono, resultado, duracion_seg, started_at')
      .eq('canal', 'telefono').eq('direccion', 'saliente').gte('started_at', desde).in('telefono', tels.slice(i, i + 150)).order('started_at').limit(2000);
    for (const l of data || []) {
      const hablo = CONVERSACION.includes(String(l.resultado || '')) || Number(l.duracion_seg || 0) >= 20;
      if (l.resultado === 'volver_llamar') { pidioLlamada.add(l.telefono); intentosSemana.set(l.telefono, 0); continue; }
      if (l.resultado === 'no_interesa') { dijoNo.set(l.telefono, String(l.started_at).slice(0, 10)); pidioLlamada.delete(l.telefono); continue; }
      if (!hablo) intentosSemana.set(l.telefono, (intentosSemana.get(l.telefono) || 0) + 1);
    }
  }

  for (const it of o.items) {
    const nombre = String(it.nombre || '').trim() || null;
    const e164 = telefonoWhatsApp(it.telefono);
    const base = { contact_id: it.contact_id || null, company_id: it.company_id || null, conversation_id: it.conversation_id || null, nombre, empresa: it.empresa || null };
    let motivo: string | null = null;
    if (!e164) motivo = 'teléfono inválido';
    else if (e164 === NUMERO) motivo = 'es el número del negocio';
    else if (vistos.has(e164)) motivo = 'repetido en la lista';
    else if (it.contact_id && noLlamar.has(it.contact_id)) motivo = 'pidió que no se le llame';
    else if (dijoNo.has(e164) && !pidioLlamada.has(e164)) motivo = `dijo que no le interesa el ${dijoNo.get(e164)}`;
    else if ((intentosSemana.get(e164) || 0) >= config.tope_intentos) motivo = `ya se le marcó ${intentosSemana.get(e164)} veces sin contestar en 7 días`;
    if (e164) vistos.add(e164);
    if (motivo) { excluidos.push({ nombre: nombre || telefonoLegible(e164 || it.telefono), telefono: e164 || it.telefono, motivo }); }
    filas.push({ ...base, telefono: e164 || String(it.telefono || '').slice(0, 30), lada: ladaDe(e164), orden: filas.length, estado: motivo ? 'excluido' : 'pendiente', motivo_exclusion: motivo, prioridad: e164 && pidioLlamada.has(e164) ? 1 : 0 });
  }
  const pendientes = filas.filter(f => f.estado === 'pendiente').length;

  const { data: s, error } = await supabase.from('tel_sesiones').insert({
    owner_id: ownerId, nombre: o.nombre || `Sesión ${new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'short' })}`,
    origen: o.origen || {}, presentacion_nombre: o.presentacion_nombre || null, presentacion_motivo: o.presentacion_motivo || null,
    buzon_dejar_mensaje: !!o.buzon_dejar_mensaje, config, estado: 'lista', total: pendientes, invalidos: excluidos.length,
    modo: ['ia', 'asistido'].includes(String(o.modo)) ? o.modo : 'manual',
  }).select('id').single();
  if (error || !s) throw new Error(error?.message || 'No se pudo crear la sesión');
  for (let i = 0; i < filas.length; i += 200) {
    const { error: e2 } = await supabase.from('tel_sesion_items').insert(filas.slice(i, i + 200).map(f => ({ ...f, sesion_id: s.id })));
    if (e2) throw new Error(e2.message);
  }
  // Las fichas se escriben en segundo plano: la sesión ya se puede abrir.
  prepararFichas(s.id).catch(() => {});
  return { id: s.id, total: pendientes, excluidos };
}

/**
 * La ficha de cada contacto: lo que se enseña al vendedor en el segundo en
 * que le pasan a una persona. Sin IA y sin red externa: sale de lo que el
 * CRM ya sabe, para que esté lista ANTES de marcar.
 */
export async function prepararFichas(sesionId: string) {
  const { data: items } = await supabase.from('tel_sesion_items').select('id, contact_id, conversation_id, nombre, empresa, telefono')
    .eq('sesion_id', sesionId).is('resumen', null).neq('estado', 'excluido').limit(500);
  const s = await getSesion(sesionId);
  for (const it of items || []) {
    try {
      const partes: string[] = [];
      let ct: any = null;
      if (it.contact_id) {
        ct = (await supabase.from('contacts').select('nombre, apellido, lifecycle_stage, proximo_paso, resumen_ia, resumen_ia_at, companies(nombre_comercial, plan, giro)').eq('id', it.contact_id).maybeSingle()).data;
      }
      const emp: any = ct?.companies;
      const quien = [it.nombre || [ct?.nombre, ct?.apellido].filter(Boolean).join(' '), it.empresa || emp?.nombre_comercial].filter(Boolean).join(' · ');
      if (quien) partes.push(quien);
      const etapa = [ct?.lifecycle_stage, emp?.plan ? `plan ${emp.plan}` : null, emp?.giro].filter(Boolean).join(' · ');
      if (etapa) partes.push(etapa);
      if (ct?.resumen_ia) {
        const titular = String(ct.resumen_ia).match(/\*\*(.+?)\*\*/)?.[1];
        if (titular) partes.push(`Hoy: ${titular}`);
      }
      if (ct?.proximo_paso) partes.push(`Quedó pendiente: ${ct.proximo_paso}`);
      if (it.conversation_id) {
        const { data: m } = await supabase.from('wa_mensajes').select('direccion, cuerpo, transcript, created_at')
          .eq('conversation_id', it.conversation_id).not('cuerpo', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (m) partes.push(`Último mensaje (${String(m.created_at).slice(0, 10)}, ${m.direccion === 'entrante' ? 'él' : 'nosotros'}): ${String(m.cuerpo || m.transcript || '').slice(0, 160)}`);
        const { data: ll } = await supabase.from('wa_llamadas').select('estado, duracion_seg, started_at, payload, minuta, siguiente_paso')
          .eq('conversation_id', it.conversation_id).eq('canal', 'telefono').order('started_at', { ascending: false }).limit(1).maybeSingle();
        if (ll) {
          const buzon = /^machine_/.test(String(ll.payload?.answered_by || ''));
          partes.push(`Última llamada (${String(ll.started_at).slice(0, 10)}): ${buzon ? 'cayó al buzón' : ll.estado === 'terminada' && Number(ll.duracion_seg) > 0 ? `hablaron ${Math.round(Number(ll.duracion_seg) / 60)} min` : 'no contestó'}${ll.siguiente_paso ? ` · siguiente paso: ${ll.siguiente_paso}` : ''}`);
        }
      }
      const primer = String(it.nombre || ct?.nombre || '').trim().split(/\s+/)[0];
      const apertura = `${primer ? `Hola ${primer}, ` : 'Hola, '}${s?.presentacion_nombre ? `soy ${s.presentacion_nombre}` : 'le llamo de Sacscloud'}${s?.presentacion_motivo ? `, ${s.presentacion_motivo}` : ''}.`;
      await supabase.from('tel_sesion_items').update({ resumen: partes.join('\n') || 'Sin historial en el CRM.', apertura }).eq('id', it.id);
    } catch { /* una ficha que falle no detiene la lista */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · LA SESIÓN: empezar, pausar, seguir, terminar
// ─────────────────────────────────────────────────────────────────────────────
export async function iniciarSesion(id: string, identity: string) {
  const s = await getSesion(id);
  if (!s || !['lista', 'pausada'].includes(s.estado)) return false;
  /* Si cambió de navegador, la sala vieja ya no cuenta: `agente_en_sala` se
     vuelve a poner cuando el nuevo entre. Si es el mismo, se conserva. */
  const cambio: any = { estado: 'activa', identity, pausa_motivo: null, fallidas_seguidas: 0, iniciada_at: s.iniciada_at || ahora(), updated_at: ahora(), config: { ...(s.config || {}), aviso: null } };
  if (s.identity !== identity) { cambio.agente_en_sala = false; cambio.agente_call_sid = null; }
  const { data } = await supabase.from('tel_sesiones').update(cambio).eq('id', id).in('estado', ['lista', 'pausada']).select('id');
  return !!data?.length;
}

/** El navegador del vendedor pidió entrar a la sala (voz.ts). */
export async function agenteEntra(id: string, callSid: string, identity: string) {
  const s = await getSesion(id);
  if (!s || s.estado !== 'activa' || s.identity !== identity) return false;
  await supabase.from('tel_sesiones').update({ agente_call_sid: callSid, updated_at: ahora() }).eq('id', id);
  return true;
}

export async function pausarSesion(id: string, motivo?: string, tipo: 'manual' | 'sala' | 'horario' | 'caida' | 'disyuntor' = 'manual') {
  const s = await getSesion(id);
  if (!s || s.estado !== 'activa') return;
  await supabase.from('tel_sesiones').update({ estado: 'pausada', pausa_motivo: tipo, updated_at: ahora(), config: { ...(s.config || {}), aviso: motivo || null } }).eq('id', id);
  // Lo que esté timbrando se cancela; lo que esté en línea se respeta.
  if (s.item_actual) {
    const it = await getItem(s.item_actual);
    if (it && ['marcando', 'timbrando', 'escuchando', 'portero'].includes(it.estado)) await colgarItem(it, 'saltado');
  }
}

export async function terminarSesion(id: string) {
  const s = await getSesion(id);
  if (!s) return;
  if (s.item_actual) { const it = await getItem(s.item_actual); if (it && !['hecho', 'cierre', 'saltado', 'excluido'].includes(it.estado)) await colgarItem(it, 'saltado'); }
  await supabase.from('tel_sesiones').update({ estado: 'terminada', terminada_at: ahora(), item_actual: null, agente_en_sala: false, updated_at: ahora() }).eq('id', id);
  await recontar(id);
}

/** Cuelga la pata del contacto. El `completed` que llega después cierra el item. */
async function colgarItem(it: any, resultado?: string) {
  if (resultado) await supabase.from('tel_sesion_items').update({ resultado, updated_at: ahora() }).eq('id', it.id).is('resultado', null);
  if (it.call_sid) { try { await twilioRest(`/Calls/${it.call_sid}.json`, { Status: 'completed' }); } catch { /* ya colgó */ } }
}

/** Recalcula los contadores de la sesión a partir de sus items. */
export async function recontar(id: string) {
  const { data } = await supabase.from('tel_sesion_items').select('estado, resultado, duracion_seg, costo_usd').eq('sesion_id', id).limit(2000);
  const its = data || [];
  const n = (f: (i: any) => boolean) => its.filter(f).length;
  await supabase.from('tel_sesiones').update({
    costo_usd: Math.round(its.reduce((a, i) => a + Number(i.costo_usd || 0), 0) * 10000) / 10000,
    total: n(i => i.estado !== 'excluido'),
    contestadas: n(i => ['contesto', 'volver_llamar', 'no_interesa', 'dieron_datos'].includes(i.resultado)),
    buzon: n(i => i.resultado === 'buzon'),
    sin_contestar: n(i => ['no_contesto', 'ocupado'].includes(i.resultado)),
    porteros: n(i => i.resultado === 'portero'),
    invalidos: n(i => i.resultado === 'invalido'),
    segundos_hablados: its.reduce((a, i) => a + (['contesto', 'volver_llamar', 'no_interesa', 'dieron_datos'].includes(i.resultado) ? Number(i.duracion_seg || 0) : 0), 0),
    updated_at: ahora(),
  }).eq('id', id);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · MARCAR AL SIGUIENTE
// ─────────────────────────────────────────────────────────────────────────────
export async function marcarSiguiente(sesionId: string): Promise<{ ok: boolean; motivo?: string; item?: any }> {
  for (let vuelta = 0; vuelta < 8; vuelta++) {
    const s = await getSesion(sesionId);
    if (!s) return { ok: false, motivo: 'no existe' };
    if (s.estado !== 'activa') return { ok: false, motivo: `la sesión está ${s.estado}` };
    if (!s.agente_en_sala && !sinSala(s)) return { ok: false, motivo: 'el vendedor no está en la sala' };
    if (s.item_actual) return { ok: false, motivo: 'ya hay una llamada en curso' };

    /* ══ CUÁNTAS LÍNEAS CABEN AHORA ════════════════════════════════════════
       En una línea manda `item_actual`, como siempre. En paralelo el freno es
       cuántas llamadas hay vivas: se rellena hasta el número elegido y ni una
       más. Puede pasar que dos latidos entren a la vez y salga una de sobra
       durante unos segundos — el candado de verdad está en el ITEM (sólo uno
       gana el `pendiente → marcando`), así que nunca se le marca dos veces a la
       misma persona, que es lo que no se puede permitir. */
    const lineas = lineasDe(s);
    if (lineas > 1) {
      const vivos = await itemsVivos(sesionId);
      if (vivos.length >= lineas) return { ok: false, motivo: 'las líneas están llenas' };
    }

    /* A quién le toca: primero los compromisos cuya hora ya llegó (`volver_at`),
       luego los prioritarios, luego el orden de la lista. Los compromisos
       futuros esperan su hora y nadie se marca fuera de SU horario (la lada
       dice en qué huso vive). */
    const tope = Number(s.config?.tope_intentos || 3);
    const { data: cand } = await supabase.from('tel_sesion_items').select('*').eq('sesion_id', sesionId).eq('estado', 'pendiente')
      .lt('intentos', tope).or(`volver_at.is.null,volver_at.lte.${ahora()}`)
      /* `cortes` antes que el orden de la lista: entre dos a los que ya les toca,
         primero el que nunca se ha quedado sin hablar por culpa nuestra. Sin
         esto, con varias líneas el mismo contacto podía quedar siempre en el
         lugar del que se corta. */
      .order('volver_at', { ascending: true, nullsFirst: false }).order('prioridad', { ascending: false }).order('cortes').order('orden').limit(60);
    const it = (cand || []).find(c => enHorario(s.config?.horario, zonaDeLada(c.lada || ladaDe(c.telefono))));
    if (!it) {
      // Nadie marcable ahora. ¿Queda alguien? Se mira TODO lo pendiente (no la muestra de 60): sus zonas y sus horas.
      const { data: pend } = await supabase.from('tel_sesion_items').select('lada, telefono, volver_at').eq('sesion_id', sesionId).eq('estado', 'pendiente').lt('intentos', tope).limit(2000);
      const listos = (pend || []).filter(c => !c.volver_at || c.volver_at <= ahora());
      const futuros = (pend || []).filter(c => c.volver_at && c.volver_at > ahora());
      if (!listos.length && !futuros.length) {
        await agotarSesion(sesionId);
        return { ok: false, motivo: 'se acabó la lista' };
      }
      if (listos.length) { await pausarSesion(sesionId, 'Fuera del horario de llamadas en la zona de los que faltan. Se reanuda sola cuando sea hora.', 'horario'); return { ok: false, motivo: 'fuera de horario' }; }
      // Solo compromisos con hora. Si el más próximo cae después del horario de hoy, la sesión termina:
      // el compromiso ya vive en la agenda y en Mi día; una sesión nueva lo retoma ese día.
      const proximo = futuros.map(c => String(c.volver_at)).sort()[0];
      if (!dentroDeHoy(proximo, s.config?.horario)) { await agotarSesion(sesionId); return { ok: false, motivo: 'la lista terminó; el compromiso queda en la agenda' }; }
      return { ok: false, motivo: 'esperando un compromiso con hora' };
    }

    // Reclamar el item y el turno de la sesión: si alguien más ganó, no pasa nada.
    const { data: gane } = await supabase.from('tel_sesion_items').update({ estado: 'marcando', marcado_at: ahora(), intentos: it.intentos + 1, call_sid: null, veredicto: null, veredicto_fuente: null, oido: [], agente_salio_at: null, volver_at: null, updated_at: ahora() })
      .eq('id', it.id).eq('estado', 'pendiente').select('id');
    if (!gane?.length) continue;
    /* `item_actual` es EL CONTACTO QUE ESTÁ CON EL VENDEDOR, no «el que se está
       marcando». En una línea son lo mismo y se reclama aquí. En paralelo se
       queda vacío hasta que alguien contesta: lo reclama `alVeredicto`, y ése
       es justo el candado que decide quién se lleva al vendedor. */
    if (lineas === 1) {
      const { data: turno } = await supabase.from('tel_sesiones').update({ item_actual: it.id, updated_at: ahora() }).eq('id', sesionId).is('item_actual', null).select('id');
      if (!turno?.length) { await supabase.from('tel_sesion_items').update({ estado: 'pendiente', intentos: it.intentos }).eq('id', it.id); return { ok: false, motivo: 'ya hay una llamada en curso' }; }
    }

    try {
      const q = `item=${it.id}`;
      const c = await twilioRest('/Calls.json', {
        To: it.telefono, From: await callerIdSaliente(),
        Url: `${BASE}/api/telefonia/marcador/twiml?${q}`, Method: 'POST',
        StatusCallback: `${BASE}/api/telefonia/marcador/estado?${q}`, StatusCallbackMethod: 'POST',
        StatusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        MachineDetection: 'DetectMessageEnd', AsyncAmd: 'true', MachineDetectionTimeout: '30',
        AsyncAmdStatusCallback: `${BASE}/api/telefonia/marcador/amd?${q}`, AsyncAmdStatusCallbackMethod: 'POST',
        Timeout: '30',
      });
      await Promise.all([
        supabase.from('tel_sesion_items').update({ call_sid: c.sid, updated_at: ahora() }).eq('id', it.id),
        // La llamada del marcador es una llamada más del historial del contacto.
        supabase.from('wa_llamadas').upsert({
          call_id: c.sid, canal: 'telefono', conversation_id: it.conversation_id, telefono: it.telefono, direccion: 'saliente',
          estado: 'timbrando', started_at: ahora(), sesion_item_id: it.id, atendida_por: s.owner_id,
          payload: { from: NUMERO, to: it.telefono, marcador: true, sesion_id: sesionId },
        }, { onConflict: 'call_id' }),
      ]);
      /* Con varias líneas se sigue rellenando en la misma vuelta: marcar de a
         una por latido daría un goteo de tres segundos entre líneas y se
         perdería justo la ventaja. */
      if (lineas > 1 && (await itemsVivos(sesionId)).length < lineas) continue;
      return { ok: true, item: { ...it, estado: 'marcando', call_sid: c.sid } };
    } catch (e: any) {
      // Twilio no quiso (número mal formado, país bloqueado…): se anota y se sigue.
      await supabase.from('tel_sesion_items').update({ estado: 'hecho', resultado: 'invalido', nota: `Twilio: ${String(e?.message || e).slice(0, 160)}`, terminado_at: ahora(), updated_at: ahora() }).eq('id', it.id);
      await supabase.from('tel_sesiones').update({ item_actual: null, updated_at: ahora() }).eq('id', sesionId).eq('item_actual', it.id);
      if (await disyuntor(sesionId, true)) return { ok: false, motivo: 'disyuntor' };
    }
  }
  return { ok: false, motivo: 'demasiados intentos fallidos seguidos' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · LO QUE CUENTA TWILIO: estado de la llamada, AMD, transcripción, sala
// ─────────────────────────────────────────────────────────────────────────────
const ESTADO_WA: Record<string, string> = { completed: 'terminada', busy: 'perdida', 'no-answer': 'perdida', canceled: 'perdida', failed: 'fallida' };

export async function procesarEstado(itemId: string, p: Record<string, string>) {
  const it = await getItem(itemId);
  if (!it || (it.call_sid && p.CallSid && it.call_sid !== p.CallSid)) return;
  const st = String(p.CallStatus || '');

  if (st === 'ringing' || st === 'initiated') {
    await supabase.from('tel_sesion_items').update({ estado: 'timbrando', updated_at: ahora() }).eq('id', itemId).eq('estado', 'marcando');
    return;
  }
  if (st === 'answered' || st === 'in-progress') {
    await supabase.from('tel_sesion_items').update({ estado: 'escuchando', contestado_at: ahora(), updated_at: ahora() }).eq('id', itemId).in('estado', ['marcando', 'timbrando']);
    await supabase.from('wa_llamadas').update({ estado: 'aceptada', answered_at: ahora() }).eq('call_id', it.call_sid || p.CallSid).eq('estado', 'timbrando');
    return;
  }
  if (!['completed', 'busy', 'no-answer', 'canceled', 'failed'].includes(st)) return;

  // ── Se acabó la llamada: qué pasó y qué sigue ──
  const fin = ahora();
  const previo = String(it.estado);
  let resultado = it.resultado as string | null;
  let estado = 'hecho';
  /* Se cayó el vendedor y no volvió: la TwiML de espera ya se disculpó y
     colgó. No es «contestó»: es «volver a llamar» en 10 minutos, con prioridad. */
  const caida = previo === 'en_linea' && !!it.agente_salio_at;
  if (caida) { resultado = 'volver_llamar'; }
  /* ══ UN BUZÓN NO TIENE CIERRE ══════════════════════════════════════════
     Pedido del dueño (17-sep-2026): «cuando es buzón debe considerarlo buzón y
     pasarlo ya a la otra llamada, porque no hay mucho que hacer y sólo
     complica el tema — elimina el flujo».

     Tenía razón y el camino era éste: un buzón al que se le dejó mensaje pasa
     por `en_linea` (la llamada está viva mientras habla la grabadora), así que
     caía en la rama de arriba y se iba a `cierre` a esperar a que la IA leyera
     la llamada. No hay nada que leer: del otro lado no hubo nadie. Ocho
     segundos de wrap-up por cada buzón, en una lista de cien, son minutos
     mirando una pantalla que no tiene nada que decir.

     Va directo a `hecho`, y el latido marca al siguiente sin que nadie toque
     nada. Se pone ANTES de la rama de `en_linea` porque el veredicto manda
     sobre por dónde pasó la llamada. */
  if (it.veredicto === 'buzon') { estado = 'hecho'; resultado = 'buzon'; }
  else if (previo === 'en_linea') { estado = 'cierre'; resultado = resultado || 'contesto'; }
  else if (['escuchando', 'portero'].includes(previo)) {
    resultado = resultado || (it.veredicto === 'buzon' ? 'buzon' : it.veredicto === 'portero' || previo === 'portero' ? 'portero' : 'no_contesto');
  } else {
    resultado = resultado || (st === 'busy' ? 'ocupado' : st === 'failed' ? 'invalido' : 'no_contesto');
  }
  if (['hecho', 'cierre', 'saltado'].includes(previo)) return;   // ya lo cerró otro webhook
  /* ══ 🔴 Y TAMPOCO SE CIERRA LO QUE YA VOLVIÓ A LA LISTA (18-sep-2026) ═════
     Encontrado en el repaso de la marcación en paralelo, y se habría comido
     contactos en silencio: cuando alguien contesta, a las otras líneas se les
     cuelga y se les devuelve a `pendiente` para marcarles en diez minutos. El
     aviso de Twilio de que ESA llamada terminó llega un segundo después —y
     esta función, que no sabía nada, las cerraba como «no contestó».
     Resultado: el contacto al que le colgamos nosotros quedaba marcado como si
     no hubiera contestado, fuera de la lista y sin que nadie le volviera a
     marcar nunca.
     Un item en `pendiente` está ahí porque alguien lo puso ahí a propósito
     (esto, `reprogramar`, o la caída del vendedor). Un webhook tardío no tiene
     nada que decir sobre él. */
  if (previo === 'pendiente') return;

  /* ══ 🔴 CONTESTÓ Y COLGÓ SIN QUE ALCANZARAS A HABLAR (18-sep-2026) ═══════
     Reporte del dueño, sobre Kike: «parecía que quería seguir hablando, pero
     de alguna forma se cortó; creo que hay personas que responden y lo
     detectas como buzón y lo cortas».

     No era el detector: su llamada quedó `veredicto: persona` por voz, a los
     1.7 s. Lo que enseña la base es otra cosa, y es peor:

       contestó 17:04:52.6 · se le pasó la llamada 17:04:54.3
       él dijo «bueno» a los 3.2 s · colgó a los 5.5 s
       lo que se oyó del vendedor: NADA, en toda la llamada

     Y no fue un caso suelto: de las 26 conversaciones de esa jornada, nueve
     duraron menos de quince segundos, y en otra se oye entero el patrón —
     «bueno» (2.7 s), «bueno» (8.3 s), y hasta los 9.4 s el vendedor: «Hola
     Emilio, ¿me escuchas?»—. Contestan, saludan al vacío y cuelgan. Desde su
     lado somos exactamente una llamada de robot.

     Eso NO es «hablamos». Es un contacto caliente —descolgó— que se perdió por
     tres segundos de silencio nuestro, y si se cuenta como conversación queda
     enterrado entre las buenas y nadie le vuelve a marcar. Se le da resultado
     propio, se le marca de nuevo en diez minutos y se cuenta aparte, que es lo
     único que permite ver si el silencio se está cerrando.

     Las tres condiciones son deliberadamente estrechas —menos de doce segundos
     hablados, ni una palabra nuestra, y el contacto sí se oyó— porque el error
     caro es el contrario: volver a marcarle a alguien con quien SÍ se habló.
     Que se haya oído al contacto es además la prueba de que la transcripción
     estaba viva; sin ella, callar no significa nada y no se toca. */
  const oidoFin: any[] = Array.isArray(it.oido) ? it.oido : [];
  const hablamosNosotros = oidoFin.some((o: any) => o?.quien === 'vendedor' && String(o?.texto || '').trim().length > 1);
  const seOyoAlContacto = oidoFin.some((o: any) => (o?.quien || 'contacto') === 'contacto' && String(o?.texto || '').trim());
  const segHablados = previo === 'en_linea' && it.en_linea_at ? ms(it.en_linea_at) / 1000 : 0;
  const colgoEnSilencio = previo === 'en_linea' && !caida && ['persona', 'duda'].includes(String(it.veredicto))
    && segHablados < 12 && !hablamosNosotros && seOyoAlContacto;
  if (colgoEnSilencio) { estado = 'hecho'; resultado = 'colgo_rapido'; }

  const dur = previo === 'en_linea' && it.en_linea_at ? Math.round(ms(it.en_linea_at) / 1000) : 0;
  const { data: cerrado } = await supabase.from('tel_sesion_items').update({ estado, resultado, terminado_at: fin, duracion_seg: dur, updated_at: fin })
    .eq('id', itemId).eq('estado', previo).select('id');
  if (!cerrado?.length) return;

  const sid = it.call_sid || p.CallSid;
  if (sid) {
    await supabase.from('wa_llamadas').update({
      estado: ESTADO_WA[st] || 'terminada', ended_at: fin, resultado,
      duracion_seg: dur || (previo === 'en_linea' ? Number(p.CallDuration || 0) : 0),
      motivo: resultado === 'buzon' ? 'Cayó al buzón' : resultado === 'portero' ? 'Contestó un asistente automático' : resultado === 'ocupado' ? 'Comunicaba' : resultado === 'invalido' ? 'La llamada falló' : null,
      payload: { ...(it.answered_by ? { answered_by: it.answered_by } : {}), from: NUMERO, to: it.telefono, marcador: true, veredicto: it.veredicto, veredicto_fuente: it.veredicto_fuente },
    }).eq('call_id', sid);
    registrarBitacoraLlamada(sid).catch(() => {});
  }

  /* ══ SI CAYÓ EN BUZÓN, EL WHATSAPP SALE SOLO ═══════════════════════════
     «Recuerda mandar el WhatsApp donde lo intentamos contactar, con las
      condiciones que ya tenemos.»

     Reusa `avisarLlamadaPerdida`, que ya trae las condiciones: la cascada
     marketing → utility, el anti-repetición de 30 minutos y la tarea de
     devolver la llamada pase lo que pase. No se escribe otra vez aquí — dos
     sitios mandando el mismo aviso acaban mandando dos mensajes.

     Sin `await`: el cierre del item no puede quedarse esperando a Meta. Si el
     mensaje falla, la tarea que deja esa misma función es la red. */
  /* ¿SONÓ, O FUE DERECHO AL BUZÓN? Sólo se reintenta el primero. */
  if (resultado === 'buzon') {
    const sCfg = await getSesion(it.sesion_id);
    const veces = Math.max(0, Math.min(3, Number(sCfg?.config?.reintentos_buzon || 0)));
    const timbro = it.marcado_at && it.contestado_at
      && (Date.parse(it.contestado_at) - Date.parse(it.marcado_at)) >= TIMBRE_REAL_MS;
    if (veces > 0 && timbro && Number(it.intentos || 1) <= veces) {
      /* El primer reintento es pronto (25 min: pudo estar ocupado un momento);
         del segundo en adelante se cambia de franja, que es lo que de verdad
         mueve la aguja. */
      const pronto = Number(it.intentos || 1) <= 1;
      await reprogramar(it, REINTENTO_BUZON_MIN, `sonó y se fue al buzón (intento ${it.intentos} de ${veces + 1})`,
        pronto ? undefined : otraFranja(it.telefono, it.lada));
      estado = 'pendiente';
    }
  }

  /* Se le vuelve a marcar en diez minutos: descolgó, o sea que el número es
     bueno y a esa hora contesta. Dos veces y ya —a la tercera el problema no es
     el silencio—. El contador va en la nota, igual que en las promesas de
     llamada: contar items del mismo teléfono mezclaría los de otros días.
     Va DESPUÉS del cierre del item, como el reintento del buzón: `reprogramar`
     lo manda a `pendiente`, y hacerlo antes dejaría el UPDATE de arriba sin
     fila que tocar. */
  if (colgoEnSilencio) {
    const veces = Number(/silencio \((\d+)/.exec(String(it.nota || ''))?.[1] || 0) + 1;
    if (veces <= 2) {
      await reprogramar(it, 10, `contestó y colgó sin que alcanzaras a hablar · silencio (${veces})`);
      estado = 'pendiente';
    }
  }

  /* ══ 🔴 UN BUZÓN NUESTRO NO SE AVISA COMO SI ÉL NOS HUBIERA LLAMADO ══════
     Reporte del dueño (18-sep-2026), con la captura delante: «nosotros le
     llamamos y hubo un buzón interactivo que nos contestó, pero el mensaje que
     estás enviando de WhatsApp es incorrecto porque él no nos llamó».

     Tenía toda la razón, y el error salió a clientes reales. Aquí se llamaba a
     `avisarLlamadaPerdida`, que es la función de «NOS LLAMARON y no
     alcanzamos»: su plantilla dice, literal, «nos llamaste y no alcanzamos a
     responderte». Mandársela a alguien a quien MARCAMOS nosotros y cayó en su
     buzón es contarle algo que no pasó — y dejarlo esperando una devolución de
     llamada que nunca pidió.

     El aviso que sí corresponde —«te acabamos de marcar»— lo manda la regla de
     llamadas (`aplicarReglasLlamada`), que corre sola desde la bitácora unas
     líneas más arriba. Aquí sólo se anota que el buzón está avisado, para que
     la cabina lo cuente sin que nadie abra la conversación a comprobarlo. */
  if (resultado === 'buzon' && it.telefono) {
    supabase.from('tel_sesion_items').update({ nota: 'Buzón · avisando por WhatsApp…', updated_at: ahora() })
      .eq('id', itemId).then(() => {}, () => {});
  }

  if (caida) {
    await reprogramar(it, ESPERA.caida_remarcar, 'se cortó la conexión del vendedor');
    await supabase.from('tel_sesion_items').update({ estado: 'hecho', nota: [it.nota, `Se cortó la conexión del vendedor a los ${dur} s; se vuelve a marcar en ${ESPERA.caida_remarcar} min.`].filter(Boolean).join('\n'), updated_at: ahora() }).eq('id', itemId).eq('estado', 'cierre');
    estado = 'hecho';
    const s = await getSesion(it.sesion_id);
    if (s && !s.agente_en_sala) await pausarSesion(it.sesion_id, `Se cortó tu conexión. ${it.nombre || 'El contacto'} quedó para volver a llamar en ${ESPERA.caida_remarcar} min.`, 'caida');
  }
  /* La llamada PROMETIDA («márcame en diez minutos») que no contesta no se pierde:
     se vuelve a intentar dos veces, cada quince minutos. Es el «flujo de reintentos»
     que pidió el dueño para Fernanda: el contacto pidió la llamada, así que insistir
     un par de veces es cumplirle, no molestarlo. Al tercer fallo se queda como
     cualquier otro item hecho (el cierre lo manda a Mi día del vendedor). */
  if (estado === 'hecho' && /^Volver a llamar/.test(String(it.nota || '')) && ['no_contesto', 'ocupado', 'buzon'].includes(String(resultado))) {
    /* El contador va en la nota, no en una consulta: contar los items del teléfono mezclaba las caídas del
       vendedor (misma nota) y las promesas de días anteriores, así que una promesa nueva podía nacer sin
       reintentos o gastarse los de otra. */
    const n = Number(/intento (\d+) de/.exec(String(it.nota || ''))?.[1] || 0);
    if (n < ESPERA.prometida_max) await reprogramar(it, ESPERA.prometida_reintento, `no contestó la llamada que pidió (intento ${n + 1} de ${ESPERA.prometida_max})`);
  }
  /* Disyuntor: una racha de llamadas que ni timbran es un problema de la
     cuenta (caller ID, permisos, saldo), no de los contactos. Se para antes
     de quemar la lista. Una llamada que sí timbró reinicia la racha. */
  if (estado === 'hecho') await disyuntor(it.sesion_id, resultado === 'invalido');

  if (estado === 'hecho') {
    await supabase.from('tel_sesiones').update({ item_actual: null, updated_at: fin }).eq('id', it.sesion_id).eq('item_actual', itemId);
    await recontar(it.sesion_id);
    await marcarSiguiente(it.sesion_id);
  } else {
    await recontar(it.sesion_id);
  }
}

export async function procesarAmd(itemId: string, p: Record<string, string>) {
  const it = await getItem(itemId);
  if (!it) return;
  const ab = String(p.AnsweredBy || '');
  await supabase.from('tel_sesion_items').update({ answered_by: ab, updated_at: ahora() }).eq('id', itemId);
  it.answered_by = ab;
  // Fernanda al teléfono: si el detector oye máquina, que se calle (no hablarle encima al saludo del buzón); si oye persona, que siga.
  if (/^machine_start|^human/.test(ab)) {
    const sv = await getSesion(it.sesion_id);
    if (conFernanda(sv)) (await voz()).avisarCentral(it.id, ab === 'human' ? 'persona' : 'maquina', { answered_by: ab }).catch(() => {});
  }
  if (buzonEsperandoTono(it) && /^machine_end/.test(ab)) {
    const s = await getSesion(it.sesion_id);
    if (s?.buzon_dejar_mensaje) await decirEnBuzon(it, s);
    return;
  }
  if (!['escuchando'].includes(it.estado) || it.veredicto) return;
  const oido: Oido[] = Array.isArray(it.oido) ? it.oido : [];
  const reglas = juzgar(oido, ms(it.contestado_at), ab, await reglasAprendidas());
  if (reglas) return alVeredicto(it, reglas.veredicto, 'reglas', reglas.motivo);
  /* Sin reglas que digan nada: el AMD decide solo en los dos extremos claros.
     «machine_end_*» = ya terminó el saludo de la grabadora y viene el tono.
     «human» = contestó alguien y no ha dicho nada reconocible: se le pasa. */
  if (/^machine_end/.test(ab)) return alVeredicto(it, 'buzon', 'amd', `el detector oyó el final del saludo (${ab})`);
  if (ab === 'human') return alVeredicto(it, 'persona', 'amd', 'el detector dice que es una persona');
}

export async function procesarTranscripcion(itemId: string, p: Record<string, string>) {
  if (p.TranscriptionEvent !== 'transcription-content') return;
  let texto = '';
  try { texto = String(JSON.parse(p.TranscriptionData || '{}')?.transcript || ''); } catch { texto = ''; }
  if (!texto.trim()) return;
  const it = await getItem(itemId);
  if (!it) return;
  const final = String(p.Final) === 'true';
  // Se transcriben las dos pistas: la del contacto decide el veredicto; la del
  // vendedor solo sirve para el cierre con IA (qué se prometió, qué se acordó).
  const quien: Oido['quien'] = /outbound/.test(String(p.Track || '')) ? 'vendedor' : 'contacto';
  const oido: Oido[] = Array.isArray(it.oido) ? it.oido.slice() : [];
  // Un parcial reemplaza al parcial anterior de la MISMA pista; un final se queda.
  const ultimo = oido.length ? oido[oido.length - 1] : null;
  if (ultimo && !ultimo.final && (ultimo.quien || 'contacto') === quien) oido.pop();
  oido.push({ t: ms(it.contestado_at), texto: texto.trim().slice(0, 300), final, quien });
  // Tope: se tiran primero los parciales (los finales son lo que lee el cierre con IA).
  if (oido.length > 300) { const fin = oido.filter(o => o.final), par = oido.filter(o => !o.final); oido.splice(0, oido.length, ...[...fin.slice(-260), ...par.slice(-40)].sort((a, b) => a.t - b.t)); }
  await supabase.from('tel_sesion_items').update({ oido, updated_at: ahora() }).eq('id', itemId);

  if (!['escuchando', 'portero'].includes(it.estado) || quien === 'vendedor') return;
  const reglas = juzgar(oido, ms(it.contestado_at), it.answered_by, await reglasAprendidas());
  if (!reglas) return;
  if (it.estado === 'portero' && reglas.veredicto !== 'persona') return;   // ya sabemos que es portero; esperamos a la persona
  if (it.estado === 'escuchando' && it.veredicto) return;
  await alVeredicto(it, reglas.veredicto, 'reglas', reglas.motivo);
}

/**
 * Lo que pasa cuando ya se sabe quién contestó. Solo gana el primero.
 *  persona → micrófono al vendedor (el navegador lo ve en el latido) + grabación
 *  buzon   → colgar (o dejar el mensaje)
 *  portero → dictar la presentación y seguir escuchando
 *  duda    → como persona, pero avisando
 */
export async function alVeredicto(it: any, veredicto: 'persona' | 'buzon' | 'portero' | 'duda', fuente: string, motivo: string) {
  const t = ahora();

  /* ══ NO SE CUELGA UNA CONVERSACIÓN VIVA ════════════════════════════════
     El candado va AQUÍ y no en cada rama que decide, porque a «buzón» se
     llega por cinco caminos distintos —el AMD, las reglas de lo oído, el
     desempate por tiempo, el tono que nunca llegó, las reglas aprendidas— y
     blindar cuatro y olvidar el quinto es cómo se cuelga una llamada viva.
     Esta función es por donde pasan todos.

     La regla: si en la llamada ya se oyó hablar a alguien, no es un buzón.
     Un buzón no conversa. El AMD de Twilio es una PISTA —y se equivoca seguido
     con quien contesta como contesta una tienda, «Boutique Lily, buenas
     tardes», porque es un saludo largo, que es justo su criterio de
     grabadora—; que se haya oído voz es un HECHO. Entre una pista y un hecho
     no hay discusión.

     Pasa a «duda» y no a «persona»: el sistema no sabe con quién habla, sólo
     sabe que hay alguien. «Duda» abre la línea igual y deja que lo resuelva
     quien está escuchando, que es quien puede. */
  if (veredicto === 'buzon') {
    const oidoTodo: any[] = Array.isArray(it.oido) ? it.oido : [];
    /* ⚠️ SÓLO LA VOZ DEL VENDEDOR. La primera versión de este candado miraba
       CUALQUIER voz, y eso rompió la detección de buzón entera: un buzón de voz
       siempre habla —«deje su mensaje después del tono» es voz— así que todos
       los buzones pasaban a «duda» y se quedaban en línea. Lo reportó el dueño
       a los minutos: «ahora cuando es buzón no lo detecta».

       Lo que de verdad prueba que hay alguien es que hable EL VENDEDOR: nadie
       le contesta a una grabadora. Esa es la señal, y es la que se mira. */
    if (oidoTodo.some((o: any) => o?.quien === 'vendedor' && String(o?.texto || '').trim().length > 1)) {
      veredicto = 'duda';
      motivo = `${motivo} — pero tú ya estabas hablando, así que no se cuelga`;
      fuente = `${fuente}+voz`;
    }
  }
  const desde = it.estado === 'portero' ? ['portero'] : ['escuchando'];
  const cambio: any = { veredicto, veredicto_fuente: fuente, veredicto_ms: ms(it.contestado_at), updated_at: t };
  if (veredicto === 'persona' || veredicto === 'duda') { cambio.estado = 'en_linea'; cambio.en_linea_at = t; }
  if (veredicto === 'portero') cambio.estado = 'portero';
  const { data: gane } = await supabase.from('tel_sesion_items').update(cambio).eq('id', it.id).in('estado', desde).select('id');
  if (!gane?.length) return false;
  const s = await getSesion(it.sesion_id);

  if (veredicto === 'persona' || veredicto === 'duda') {
    /* ══ QUIÉN SE LLEVA AL VENDEDOR ═══════════════════════════════════════
       Con varias líneas, aquí se decide todo. `item_actual` está vacío hasta
       este momento y sólo uno puede llenarlo: ese UPDATE condicional es el
       candado. Quien gana pasa a la sala; quien pierde contestó cuando ya no
       había con quién hablar, y eso hay que tratarlo bien (abajo). */
    if (s && lineasDe(s) > 1) {
      const { data: turno } = await supabase.from('tel_sesiones')
        .update({ item_actual: it.id, updated_at: t }).eq('id', it.sesion_id).is('item_actual', null).select('id');

      if (!turno?.length) {
        /* PERDIÓ: hay otra persona ya con el vendedor. Esto es una llamada
           abandonada y es lo único de verdad feo de marcar en paralelo. No se
           le cuelga mudo: se le dice quién llamaba, se le vuelve a marcar en
           quince minutos y se cuenta, porque la tasa de abandono es lo que hay
           que vigilar para subir o bajar el número de líneas. */
        /* `escapar`: el nombre lo escribe una persona («Andy & Co») y un `&`
           suelto rompe el TwiML entero — del otro lado se oiría silencio y un
           error de Twilio. Es la misma función que usa el recado del buzón. */
        const quien = escapar(s.presentacion_nombre ? `${s.presentacion_nombre}, de Sacscloud` : 'Sacscloud');
        twilioRest(`/Calls/${it.call_sid}.json`, {
          Twiml: `<Response><Say language="es-MX" voice="${escapar(String(s.presentacion_voz || 'Polly.Mia-Neural'))}">Hola, le llamaba ${quien}. Disculpe, tuvimos un problema con la línea: le marcamos en un momento.</Say><Hangup/></Response>`,
        }).catch(() => {});
        /* Se cuenta CUÁNTAS VECES le hemos colgado sin hablarle. A la tercera ya
           no es un problema de agenda sino de trato: contestó tres veces y tres
           veces le dijimos «ahorita le marcamos». Ahí deja de ser cosa del
           marcador y se le pasa a una persona. */
        const cortes = Number(it.cortes || 0) + 1;
        await supabase.from('tel_sesion_items').update({
          estado: 'pendiente', veredicto: null, veredicto_fuente: null, cortes,
          // El intento se le devuelve las dos primeras veces; a la tercera cuenta,
          // o nunca se agotaría y el mismo contacto giraría en la lista sin fin.
          intentos: cortes <= 2 ? Math.max(0, Number(it.intentos || 1) - 1) : Number(it.intentos || 1),
          nota: `Contestó mientras el vendedor estaba en otra llamada (${cortes}${cortes === 1 ? 'ª vez' : 'ª vez'}): se le marca de nuevo.`,
          volver_at: new Date(Date.now() + 15 * 60000).toISOString(), prioridad: 1, updated_at: t,
        }).eq('id', it.id);
        if (cortes >= 3 && it.contact_id) {
          const { data: ya } = await supabase.from('ti_tareas').select('id').eq('contact_id', it.contact_id)
            .eq('estado', 'pendiente').contains('payload', { colgadas: true }).limit(1).maybeSingle();
          if (!ya) {
            await supabase.from('ti_tareas').insert({
              contact_id: it.contact_id, company_id: it.company_id, owner_id: s.owner_id, familia: 'llamar', tipo: 'llamada',
              prioridad: 1, vence_at: ahora(), origen: 'evento',
              payload: {
                de_llamada: true, colgadas: true, nombre: it.nombre, whatsapp: it.telefono,
                instruccion: `${it.nombre || 'El contacto'}: contestó ${cortes} veces y ${cortes} veces le colgamos`,
                porque: 'El marcador lo alcanzó mientras había otra llamada en curso. Llámale tú, directo.',
              },
            }).then(() => {}, () => {});
          }
        }
        await supabase.from('tel_sesiones').update({
          config: { ...(s.config || {}), abandonadas: Number(s.config?.abandonadas || 0) + 1 }, updated_at: t,
        }).eq('id', it.sesion_id);
        await supabase.from('wa_llamadas').update({ estado: 'terminada', motivo: 'abandonada: el vendedor estaba en otra llamada' }).eq('call_id', it.call_sid).then(() => {}, () => {});
        return false;
      }

      /* GANÓ: se le pasa a la sala del vendedor. La llamada está viva en su
         propio cuarto; cambiarle el TwiML la mueve sin cortarla. */
      await twilioRest(`/Calls/${it.call_sid}.json`, {
        Twiml: `<Response><Dial><Conference startConferenceOnEnter="false" endConferenceOnExit="false" beep="false" waitUrl="" `
          + `statusCallback="${BASE}/api/telefonia/marcador/sala?sesion=${it.sesion_id}" statusCallbackMethod="POST" statusCallbackEvent="start end join leave">sesion-${it.sesion_id}</Conference></Dial></Response>`,
      }).catch(() => {});

      /* Y SE CORTAN LAS OTRAS LÍNEAS, mientras todavía timbran. Vuelven a la
         lista sin gastarles el intento y con diez minutos de espera: nadie
         levantó el teléfono, así que para ellos no hubo llamada. */
      for (const otro of await itemsVivos(it.sesion_id)) {
        if (otro.id === it.id || ['en_linea', 'portero'].includes(String(otro.estado))) continue;
        if (otro.call_sid) twilioRest(`/Calls/${otro.call_sid}.json`, { Status: 'completed' }).catch(() => {});
        /* ══ QUE NO QUEDE EN PING-PONG ═══════════════════════════════════
           Devolverle el intento es lo justo —a él no le hablamos— pero
           devolvérselo SIEMPRE tiene dos costos: nunca se le agotan los
           intentos, y si le toca ser el cortado cada vez, le suena el teléfono
           una y otra vez sin que nadie le hable. Así que la espera crece
           (10 → 25 → 45 minutos), a la tercera el intento SÍ cuenta, y deja de
           colarse al principio de la fila. */
        const cortes = Number(otro.cortes || 0) + 1;
        const espera = cortes === 1 ? 10 : cortes === 2 ? 25 : 45;
        await supabase.from('tel_sesion_items').update({
          estado: 'pendiente', call_sid: null, veredicto: null, veredicto_fuente: null, oido: [], cortes,
          intentos: cortes <= 2 ? Math.max(0, Number(otro.intentos || 1) - 1) : Number(otro.intentos || 1),
          nota: cortes >= 2 ? `Se le cortó ${cortes} veces porque otro contestó primero.` : otro.nota,
          volver_at: new Date(Date.now() + espera * 60000).toISOString(),
          prioridad: cortes >= 3 ? 0 : 1, updated_at: t,
        }).eq('id', otro.id).in('estado', ['marcando', 'timbrando', 'escuchando']);
        await supabase.from('wa_llamadas').update({ estado: 'terminada', motivo: 'se cortó: otro contestó primero' }).eq('call_id', otro.call_sid).then(() => {}, () => {});
      }
    }

    // Ahora sí se graba: solo las conversaciones con personas generan minuta.
    twilioRest(`/Calls/${it.call_sid}/Recordings.json`, {
      RecordingChannels: 'dual', RecordingStatusCallback: `${BASE}/api/telefonia/grabacion`, RecordingStatusCallbackEvent: 'completed',
    }).catch(() => {});
    await supabase.from('wa_llamadas').update({ estado: 'aceptada', answered_at: t, payload: { from: NUMERO, to: it.telefono, marcador: true, veredicto, veredicto_fuente: fuente, veredicto_motivo: motivo } }).eq('call_id', it.call_sid);
    return true;
  }
  if (veredicto === 'buzon') {
    if (s?.buzon_dejar_mensaje && (s.presentacion_nombre || s.presentacion_motivo)) {
      /* El mensaje se dice DESPUÉS del tono. Las reglas saben que es buzón a
         los 3 s (E0: 2.9 s), cuando el saludo apenas empieza; hablar ahí es
         hablar encima del saludo y el mensaje no se graba. Se espera el
         «machine_end_*» del AMD (el tono) y, si no llega, `latir` lo dice a
         los ESPERA.buzon segundos de todos modos. */
      if (/^machine_end/.test(String(it.answered_by || ''))) await decirEnBuzon(it, s);
    } else {
      await colgarItem(it);
    }
    return true;
  }
  if (veredicto === 'portero') {
    // La presentación se le dice SOLO a esa pata, sin sacarla de la sala ni
    // apagar la transcripción: así se oye si después pasa la llamada.
    if (s?.sala_sid && it.call_sid && !conFernanda(s)) {
      twilioRest(`/Conferences/${s.sala_sid}/Participants/${it.call_sid}.json`, { AnnounceUrl: `${BASE}/api/telefonia/marcador/anuncio?item=${it.id}&tipo=intro`, AnnounceMethod: 'POST' }).catch(() => {});
    }
    return true;
  }
  return true;
}

/** Deja nombre y motivo en el buzón y cuelga. Solo gana el primero (resultado). */
async function decirEnBuzon(it: any, s: any) {
  const { data: gane } = await supabase.from('tel_sesion_items').update({ resultado: 'buzon', updated_at: ahora() })
    .eq('id', it.id).is('resultado', null).select('id');
  if (!gane?.length || !it.call_sid) return;
  const msg = `Hola, ${s.presentacion_nombre ? `soy ${s.presentacion_nombre}` : 'le llamamos de Sacscloud'}${s.presentacion_motivo ? `, ${s.presentacion_motivo}` : ''}. Le vuelvo a marcar más tarde. Gracias.`;
  // Si habla Fernanda, lo dice ella con su voz y cuelga; si la central no contesta, lo dice Polly.
  if (conFernanda(s) && await (await voz()).avisarCentral(it.id, 'buzon', { mensaje: msg }).catch(() => false)) return;
  const twiml = `<Response><Pause length="1"/><Say language="es-MX" voice="${s.presentacion_voz || 'Polly.Mia-Neural'}">${escapar(msg)}</Say><Hangup/></Response>`;
  try { await twilioRest(`/Calls/${it.call_sid}.json`, { Twiml: twiml }); } catch { await colgarItem(it); }
}
const buzonEsperandoTono = (it: any) => it.estado === 'escuchando' && it.veredicto === 'buzon' && !it.resultado;

export const escapar = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Lo que pasa en la sala: quién entró, quién salió, si se acabó. */
export async function procesarSala(sesionId: string, p: Record<string, string>) {
  const s = await getSesion(sesionId);
  if (!s) return;
  const ev = String(p.StatusCallbackEvent || '');
  const t = ahora();
  /* Cada reentrada del vendedor abre una sala nueva; los eventos rezagados de la
     anterior (su `conference-end` llega después) no deben pausar la sesión que
     acaba de reengancharse. El SID se aprende al empezar la sala, no en cualquier evento. */
  if (p.ConferenceSid && s.sala_sid && p.ConferenceSid !== s.sala_sid && !['conference-start', 'participant-join'].includes(ev)) return;
  if (p.ConferenceSid && s.sala_sid !== p.ConferenceSid && ['conference-start', 'participant-join'].includes(ev)) await supabase.from('tel_sesiones').update({ sala_sid: p.ConferenceSid, updated_at: t }).eq('id', sesionId);

  const esAgente = !!p.CallSid && p.CallSid === s.agente_call_sid;
  const it = s.item_actual ? await getItem(s.item_actual) : null;
  const caido = it && it.estado === 'en_linea' && !!it.agente_salio_at;

  if (ev === 'participant-join' && esAgente) {
    await supabase.from('tel_sesiones').update({ agente_en_sala: true, updated_at: t }).eq('id', sesionId);
    if (caido && it.call_sid) {
      // Volvió a tiempo: el contacto regresa a la sala y se sigue hablando.
      // Primero el redirect; la caída se limpia solo si Twilio lo aceptó (si ya colgó, el `completed` debe verla como caída y reprogramar).
      try {
        await twilioRest(`/Calls/${it.call_sid}.json`, { Url: `${BASE}/api/telefonia/marcador/twiml?item=${it.id}&reenganche=1`, Method: 'POST' });
        await supabase.from('tel_sesion_items').update({ agente_salio_at: null, updated_at: t }).eq('id', it.id);
      } catch { /* ya colgó: el completed lo cierra */ }
      return;
    }
    if (s.estado === 'activa' && !s.item_actual) await marcarSiguiente(sesionId);
  }
  if ((ev === 'participant-leave' && esAgente) || ev === 'conference-end') {
    await supabase.from('tel_sesiones').update({ agente_en_sala: false, agente_call_sid: null, updated_at: t }).eq('id', sesionId);
    if (ev === 'participant-leave' && it && it.estado === 'en_linea' && it.call_sid && !it.agente_salio_at) {
      /* El vendedor se cayó EN LÍNEA: al contacto no se le cuelga. Se le
         saca a una espera («un segundo, no cuelgue») que aguanta ~20 s; si
         el vendedor reentra, regresa a la sala; si no, la espera se disculpa
         y cuelga, y el item se reprograma. La sesión NO se pausa aquí para
         que la vuelta sea limpia. */
      await supabase.from('tel_sesion_items').update({ agente_salio_at: t, updated_at: t }).eq('id', it.id);
      try { await twilioRest(`/Calls/${it.call_sid}.json`, { Url: `${BASE}/api/telefonia/marcador/espera?item=${it.id}`, Method: 'POST' }); }
      catch { await colgarItem(it); }
      return;
    }
    if (caido) return;   // la sala se vació porque el contacto está en espera: la caída ya se está manejando
    if (sinSala(s)) return;   // Fernanda sigue sola; el vendedor solo estaba de oyente
    if (s.estado === 'activa') await pausarSesion(sesionId, 'Saliste de la sala', 'sala');
  }
}

/** El mismo contacto, otra vez en la lista, para una hora concreta. */
export async function reprogramar(it: any, minutos: number, motivo: string, cuando?: Date) {
  const volver = (cuando || new Date(Date.now() + minutos * 60000)).toISOString();
  /* UNA LLAMADA SUELTA NO VUELVE A NINGUNA LISTA. Las entrantes y las que se
     marcan a mano cuelgan de la sesión fantasma (`suelta.ts`), que nunca marca
     a nadie: meterle un item pendiente sería dejar basura que jamás se llama.
     El compromiso ya quedó donde sí se ve — la reunión, Google Calendar y la
     tarea en Mi día, que las crea `crearCompromiso` antes de llegar aquí. */
  const { data: ses } = await supabase.from('tel_sesiones').select('origen').eq('id', it.sesion_id).maybeSingle();
  if ((ses?.origen as any)?.suelta) return null;
  const { data: ya } = await supabase.from('tel_sesion_items').select('id').eq('sesion_id', it.sesion_id).eq('telefono', it.telefono).eq('estado', 'pendiente').limit(1).maybeSingle();
  if (ya) { await supabase.from('tel_sesion_items').update({ volver_at: volver, prioridad: 1, updated_at: ahora() }).eq('id', ya.id); return ya.id; }
  const { data } = await supabase.from('tel_sesion_items').insert({
    sesion_id: it.sesion_id, contact_id: it.contact_id, company_id: it.company_id, conversation_id: it.conversation_id,
    nombre: it.nombre, empresa: it.empresa, telefono: it.telefono, lada: it.lada || ladaDe(it.telefono), orden: it.orden,
    estado: 'pendiente', intentos: 0, volver_at: volver, prioridad: 1, resumen: it.resumen, apertura: it.apertura,
    nota: `Volver a llamar: ${motivo}`,
  }).select('id').single();
  return data?.id || null;
}

/** La racha de fallidas de la sesión. Devuelve true si se disparó y pausó. */
async function disyuntor(sesionId: string, fallo: boolean) {
  const s = await getSesion(sesionId);
  if (!s) return false;
  const racha = fallo ? Number(s.fallidas_seguidas || 0) + 1 : 0;
  if (racha === Number(s.fallidas_seguidas || 0)) return false;
  await supabase.from('tel_sesiones').update({ fallidas_seguidas: racha, updated_at: ahora() }).eq('id', sesionId);
  const tope = Number(s.config?.disyuntor_fallidas || CONFIG_BASE.disyuntor_fallidas);
  if (racha >= tope && s.estado === 'activa') {
    await pausarSesion(sesionId, `${racha} llamadas fallidas seguidas: revisa el caller ID, el saldo o los permisos de Twilio antes de seguir.`, 'disyuntor');
    return true;
  }
  return false;
}

/** El vendedor corrigió al detector: se apunta y se propone una regla nueva. */
export async function corregir(it: any, correccion: 'era_persona' | 'era_maquina') {
  if (!it || it.correccion === correccion) return;
  await supabase.from('tel_sesion_items').update({ correccion, updated_at: ahora() }).eq('id', it.id);
  const oido: Oido[] = Array.isArray(it.oido) ? it.oido : [];
  const dicho = textoOido(oido) || oido.filter(o => o.quien !== 'vendedor').map(o => o.texto).join(' ');
  const patron = fraseClave(dicho);
  if (!patron || patron.split(' ').length < 2) return;
  const tipo = correccion === 'era_persona' ? 'persona' : 'buzon';
  const { data: ya } = await supabase.from('tel_reglas').select('id, veces').eq('tipo', tipo).eq('patron', patron).limit(1).maybeSingle();
  if (ya) { await supabase.from('tel_reglas').update({ veces: Number(ya.veces || 0) + 1, updated_at: ahora() }).eq('id', ya.id); return; }
  await supabase.from('tel_reglas').insert({ tipo, patron, origen: 'correccion', estado: 'propuesta', ejemplo: dicho.slice(0, 300), item_id: it.id, veces: 1 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · EL LATIDO: el navegador pregunta cada segundo y aquí se cierran los
//     huecos en los que Twilio no avisa (silencios, porteros que no pasan).
// ─────────────────────────────────────────────────────────────────────────────
/* ══ UNA LLAMADA CON PERSONA NO SE CIERRA SOLA ════════════════════════════
   Pedido del dueño (17-sep-2026), después de una llamada real: «hablé con ella,
   me pidió que le marcara más tarde… ahí ya no debe seguir a la siguiente
   llamada: ahí debe aparecerme la interfaz con las decisiones a tomar en ese
   momento, y ya al tomar la decisión me pasa a la otra. Y aun así me debe decir
   qué decisión tomó la IA ANTES de ejecutarla.»

   Tenía razón y el orden estaba invertido: a los ocho segundos el motor
   aplicaba el cierre de la IA —agendaba, mandaba, cambiaba la etapa— y marcaba
   al siguiente. La propuesta se veía ocho segundos, o no se veía.

   Ahora, cuando contestó una PERSONA y hay alguien mirando (todo lo que no sea
   Fernanda sola), la lista se queda parada: enseña lo que la IA decidió y no
   ejecuta nada hasta «Confirmar y seguir». Lo que NO cambia: buzón, no
   contestó, portero y número inválido siguen saltando solos — para eso está el
   marcador.

   La válvula: si a los diez minutos nadie decidió Y el vendedor ya no está en
   la sala, se aplica y se sigue. Una sesión parada para siempre porque alguien
   cerró la pestaña no es prudencia, es una lista muerta. */
const DECISION_MAX_MS = 10 * 60000;
const esperaDecision = (it: any, s: any) =>
  !sinSala(s)
  && ['persona', 'duda'].includes(String(it?.veredicto || ''))
  && (s?.agente_en_sala || ms(it?.terminado_at) < DECISION_MAX_MS);

/** El reloj de UNA línea: lo que hay que hacer cuando lleva demasiado en un
 *  estado. Es lo mismo que vigila `latir` para la llamada del vendedor, pero
 *  aplicable a las que están timbrando en paralelo. */
async function vigilarLinea(it: any, s: any, cfg: any) {
  if (it.estado === 'escuchando' && !it.veredicto && ms(it.contestado_at) > ESPERA.juicio) {
    const oidoTodo: any[] = Array.isArray(it.oido) ? it.oido : [];
    const hablaron = oidoTodo.some((o: any) => String(o?.texto || '').trim().length > 1);
    const maquina = /^machine_/.test(String(it.answered_by || '')) && !hablaron;
    await alVeredicto(it, maquina ? 'buzon' : 'duda', 'tiempo',
      maquina ? 'nadie dijo nada claro y el detector dice máquina' : 'contestaron y no se entendió quién');
  } else if (buzonEsperandoTono(it) && ms(it.contestado_at) > ESPERA.buzon) {
    if (s.buzon_dejar_mensaje) await decirEnBuzon(it, s); else await colgarItem(it);
  } else if (it.estado === 'portero' && ms(it.contestado_at) > ESPERA.portero) {
    await colgarItem(it, 'portero');
  } else if (['marcando', 'timbrando'].includes(it.estado) && ms(it.marcado_at) > ESPERA.timbre) {
    await cerrarPorTiempo(it);
  }
}

export async function latir(sesionId: string) {
  let s = await getSesion(sesionId);
  if (!s) return null;
  let it = s.item_actual ? await getItem(s.item_actual) : null;

  /* Se pausó por horario: en cuanto sea hora en la zona de alguno de los que
     faltan, se reanuda sola (y si el vendedor sigue en la sala, marca). */
  if (s.estado === 'pausada' && s.pausa_motivo === 'horario') {
    const tope = Number(s.config?.tope_intentos || 3);
    const { data: pend } = await supabase.from('tel_sesion_items').select('lada, telefono').eq('sesion_id', sesionId).eq('estado', 'pendiente').lt('intentos', tope).or(`volver_at.is.null,volver_at.lte.${ahora()}`).limit(2000);
    const zonas = new Set((pend || []).map(c => zonaDeLada(c.lada || ladaDe(c.telefono))));
    if (Array.from(zonas).some(z => enHorario(s.config?.horario, z))) {
      await supabase.from('tel_sesiones').update({ estado: 'activa', pausa_motivo: null, updated_at: ahora(), config: { ...(s.config || {}), aviso: s.agente_en_sala || sinSala(s) ? null : 'Ya es hora de llamar: entra a la sala para seguir.' } }).eq('id', sesionId).eq('estado', 'pausada');
      s = await getSesion(sesionId);
    }
  }

  /* ══ VIGILAR CADA LÍNEA VIVA, NO SÓLO LA DEL VENDEDOR (18-sep-2026) ═════
     Con una línea, la que está viva y la que está con el vendedor son la
     misma. Con varias, no: mientras hablas con uno pueden quedar dos timbrando,
     y esas también necesitan quien les mire el reloj —el que contestó y no se
     entiende quién es, el buzón esperando el tono, el que lleva media vuelta
     de reloj timbrando—. Sin esto se quedarían colgadas en el limbo. */
  if (s.estado === 'activa' && lineasDe(s) > 1) {
    const cfgP = { ...CONFIG_BASE, ...(s.config || {}) };
    for (const v of await itemsVivos(sesionId)) {
      if (v.id === s.item_actual) continue;   // ésa se mira abajo, con su cierre y todo
      await vigilarLinea(v, s, cfgP);
    }
  }

  if (it && s.estado === 'activa') {
    const cfg = { ...CONFIG_BASE, ...(s.config || {}) };
    if (it.estado === 'en_linea' && it.agente_salio_at && !s.agente_en_sala && ms(it.agente_salio_at) > ESPERA.caida) {
      await colgarItem(it);   // la TwiML de espera debió colgar sola; esto es la red por si Twilio no la corrió
    } else if (it.estado === 'escuchando' && !it.veredicto && ms(it.contestado_at) > ESPERA.juicio) {
      /* ══ EL HUECO QUE COLGABA CONVERSACIONES VIVAS ══════════════════════
         Reporte del dueño (17-sep-2026): «el cliente habló, yo hablé, y de
         repente se cortó; siento que al momento de realmente conectar no lo
         toma en cuenta». Tenía razón, y el hueco está justo aquí.

         Esta rama es el desempate por tiempo: a los 9 s sin veredicto, si el
         AMD de Twilio dijo «máquina» se daba `buzon` —y `buzon` cuelga—. El
         problema es que MIRA SÓLO `answered_by`, sin pasar por `juzgar()`: no
         se entera de que los dos llevan nueve segundos hablando. Y el AMD se
         equivoca seguido con quien contesta como contesta una tienda
         —«Boutique Lily, buenas tardes, ¿en qué le puedo ayudar?»— porque es
         un saludo largo, que es justo su criterio de grabadora.

         Así que antes de creerle al detector se mira lo que de verdad pasó: si
         se oyó al vendedor, o al contacto, hay una conversación. El AMD es una
         pista; que los dos estén hablando es un hecho. */
      const oidoTodo: any[] = Array.isArray(it.oido) ? it.oido : [];
      const hablaronDeVerdad = oidoTodo.some((o: any) => String(o?.texto || '').trim().length > 1);
      const maquina = /^machine_/.test(String(it.answered_by || '')) && !hablaronDeVerdad;
      await alVeredicto(it, maquina ? 'buzon' : 'duda', 'tiempo',
        maquina ? 'nadie dijo nada claro y el detector dice máquina'
          : hablaronDeVerdad ? 'ya se está hablando: el detector decía máquina, pero se oyó voz'
          : 'contestaron y no se entendió quién');
      it = await getItem(it.id);
    } else if (buzonEsperandoTono(it) && ms(it.contestado_at) > ESPERA.buzon) {
      // El tono nunca llegó (AMD sin machine_end): se deja el mensaje igual.
      if (s.buzon_dejar_mensaje) await decirEnBuzon(it, s); else await colgarItem(it);
    } else if (it.estado === 'portero' && ms(it.contestado_at) > ESPERA.portero) {
      await colgarItem(it, 'portero');
    } else if (['marcando', 'timbrando'].includes(it.estado) && ms(it.marcado_at) > ESPERA.timbre) {
      await cerrarPorTiempo(it);
    } else if (it.estado === 'cierre' && !it.cierre_estado) {
      // Colgó con una persona: la IA propone el cierre (candado dentro; solo un latido lo hace; la IA tiene tope de 18 s).
      await (await cierre()).proponerCierre(it.id);
    } else if (it.estado === 'cierre' && (cfg.auto_continuar || sinSala(s)) && ms(it.terminado_at) > Number(cfg.wrapup_seg || 8) * 1000 && !esperaDecision(it, s) && (await cierre()).cierreListo(it)) {
      await siguiente(sesionId);
    }
  } else if (!it && s.estado === 'activa' && (s.agente_en_sala || sinSala(s))) {
    await marcarSiguiente(sesionId);
  }
  /* Y con varias líneas se rellena aunque ya haya alguien marcando: el hueco
     que deja una que se cayó se vuelve a llenar en el siguiente latido. Nunca
     mientras hay una persona con el vendedor: ahí la lista está parada. */
  if (s.estado === 'activa' && !s.item_actual && lineasDe(s) > 1 && (s.agente_en_sala || sinSala(s))) {
    if ((await itemsVivos(sesionId)).length < lineasDe(s)) await marcarSiguiente(sesionId);
  }
  cobrarLlamadas(sesionId).catch(() => {});
  cierre().then(c => c.rescatarCierres()).catch(() => {});   // cierres que se quedaron a medias (acotado y con freno de 30 s)
  return estadoSesion(sesionId);
}

/* Lo que costó cada llamada, según Twilio. El precio aparece un rato después
   del `completed`, así que se pregunta desde el latido, de a pocas. Es el
   precio de la LLAMADA: transcripción y AMD se cobran aparte. */
let cobrando = new Set<string>();
async function cobrarLlamadas(sesionId: string) {
  if (cobrando.has(sesionId)) return;
  cobrando.add(sesionId);
  try {
    const { data } = await supabase.from('tel_sesion_items').select('id, call_sid, terminado_at').eq('sesion_id', sesionId)
      .in('estado', ['hecho', 'saltado']).is('costo_usd', null).not('call_sid', 'is', null).lt('terminado_at', new Date(Date.now() - 45000).toISOString()).order('terminado_at').limit(3);
    for (const it of data || []) {
      let costo: number | null = null;
      try {
        const c = await twilioRest(`/Calls/${it.call_sid}.json`);
        if (c?.price != null) costo = Math.abs(Number(c.price));
        else if (['completed', 'busy', 'no-answer', 'canceled', 'failed'].includes(String(c?.status)) && ms(it.terminado_at) > 15 * 60000) costo = 0;
      } catch { /* se intenta en el siguiente latido */ }
      if (costo !== null) await supabase.from('tel_sesion_items').update({ costo_usd: costo }).eq('id', it.id);
    }
    if (data?.length) await recontar(sesionId);
  } finally { cobrando.delete(sesionId); }
}

/** Twilio nunca avisó: se le pregunta y se cierra el item con lo que diga. */
async function cerrarPorTiempo(it: any) {
  let st = 'failed';
  if (it.call_sid) { try { st = String((await twilioRest(`/Calls/${it.call_sid}.json`))?.status || 'failed'); } catch { /* sin respuesta */ } }
  if (['queued', 'ringing', 'in-progress'].includes(st)) { await colgarItem(it); return; }
  await procesarEstado(it.id, { CallStatus: st === 'busy' ? 'busy' : st === 'no-answer' ? 'no-answer' : 'failed', CallSid: it.call_sid || '' });
}

/** El vendedor cerró su llamada (o pasó el wrap-up): se suelta el turno y se marca al que sigue. */
export async function siguiente(sesionId: string) {
  const s = await getSesion(sesionId);
  if (!s) return { ok: false };
  if (s.item_actual) {
    const it = await getItem(s.item_actual);
    if (it && !['cierre', 'hecho', 'saltado'].includes(it.estado)) return { ok: false, motivo: 'todavía hay una llamada en curso' };
    if (it?.estado === 'cierre') {
      await cerrarConIA(it);
      await supabase.from('tel_sesion_items').update({ estado: 'hecho', updated_at: ahora() }).eq('id', it.id).eq('estado', 'cierre');
    }
    await supabase.from('tel_sesiones').update({ item_actual: null, updated_at: ahora() }).eq('id', sesionId).eq('item_actual', s.item_actual);
  }
  return marcarSiguiente(sesionId);
}

/* Antes de soltar un item en cierre, la IA aplica lo propuesto. Si el vendedor
   fue más rápido que la IA, se espera a la propuesta (tope ~15 s) para no
   perder los compromisos y los datos; lo que quedó sin responder se vuelve tarea. */
async function cerrarConIA(it: any) {
  const { proponerCierre, aplicarCierre } = await cierre();
  if (!it.cierre_estado) await proponerCierre(it.id);
  let est = (await getItem(it.id))?.cierre_estado;
  // Si lleva más de 25 s «proponiendo», la IA ya no va a contestar en este request: no se espera (el rescate del latido lo retoma).
  const colgado = () => ms(it.terminado_at) > 25000;
  for (let i = 0; i < 8 && est === 'proponiendo' && !colgado(); i++) { await new Promise(r => setTimeout(r, 1000)); est = (await getItem(it.id))?.cierre_estado; }
  if (est === 'propuesto') await aplicarCierre(it.id, { userId: null });
}

export async function saltar(sesionId: string) {
  const s = await getSesion(sesionId);
  if (!s?.item_actual) return marcarSiguiente(sesionId);
  const it = await getItem(s.item_actual);
  if (it && ['marcando', 'timbrando', 'escuchando', 'portero', 'en_linea'].includes(it.estado)) {
    // Saltar a los pocos segundos de «en línea» sin que el vendedor hablara es «era máquina»: se aprende.
    if (it.estado === 'en_linea' && ['reglas', 'amd', 'tiempo'].includes(String(it.veredicto_fuente)) && ms(it.en_linea_at) < 20000) await corregir(it, 'era_maquina');
    await colgarItem(it, it.estado === 'en_linea' ? undefined : 'saltado'); return { ok: true, motivo: 'colgando' };
  }
  return siguiente(sesionId);
}

/** «Hablar yo»: el vendedor toma la llamada aunque los oídos no hayan decidido. */
export async function tomar(sesionId: string) {
  const s = await getSesion(sesionId);
  if (!s?.item_actual) return false;
  const it = await getItem(s.item_actual);
  if (conFernanda(s)) {
    // Fernanda se despide («le paso con mi compañero») y Twilio mete al contacto a la sala (relay-fin).
    if (!it || !s.agente_en_sala || !['escuchando', 'portero', 'en_linea'].includes(it.estado)) return false;
    if (it.estado !== 'en_linea') await alVeredicto(it, 'persona', 'agente', 'el vendedor tomó la llamada');
    return (await voz()).avisarCentral(it.id, 'tomar', {});
  }
  if (!it || !['escuchando', 'portero'].includes(it.estado)) return false;
  const ok = await alVeredicto(it, 'persona', 'agente', 'el vendedor tomó la llamada');
  // Si ya había texto y las reglas no lo vieron como persona, es una frase que hay que aprender.
  if (ok && textoOido(Array.isArray(it.oido) ? it.oido : [])) corregir({ ...it, veredicto: 'persona' }, 'era_persona').catch(() => {});
  return ok;
}

export async function estadoSesion(sesionId: string) {
  const s = await getSesion(sesionId);
  if (!s) return null;
  const it = s.item_actual ? await getItem(s.item_actual) : null;
  const { count: pendientes } = await supabase.from('tel_sesion_items').select('id', { count: 'exact', head: true }).eq('sesion_id', sesionId).eq('estado', 'pendiente');
  const { data: prox } = await supabase.from('tel_sesion_items').select('nombre, telefono, volver_at').eq('sesion_id', sesionId).eq('estado', 'pendiente').gt('volver_at', ahora()).order('volver_at').limit(1).maybeSingle();
  /* QUIÉN SIGUE, con nombre y motivo. Se decide distinto sabiendo si el que
     viene es un lead de hoy o un rezagado de hace tres semanas; y ver el
     siguiente mientras cierras es lo que quita la sensación de estar a ciegas
     en una jornada de cincuenta llamadas. */
  const { data: sig } = await supabase.from('tel_sesion_items')
    .select('nombre, empresa, telefono, resumen, intentos, volver_at')
    .eq('sesion_id', sesionId).eq('estado', 'pendiente')
    .or(`volver_at.is.null,volver_at.lte.${ahora()}`)
    .order('prioridad', { ascending: false }).order('orden').limit(1).maybeSingle();
  const zona = it ? zonaDeLada(it.lada || ladaDe(it.telefono)) : null;
  return {
    sesion: s,
    /* `dialogo` SIEMPRE, no sólo con Fernanda. En modo manual la cabina se
       quedaba sin lo que se dijo justo cuando hay que decidir qué hacer con
       esa llamada — y decidir de memoria, en la número veinte del día, es cómo
       se agenda una cita que el cliente no pidió. */
    actual: it ? { ...it, oido_texto: textoOido(Array.isArray(it.oido) ? it.oido : []), dialogo: dialogoOido(Array.isArray(it.oido) ? it.oido : []), segundos_en_linea: it.en_linea_at ? Math.round(ms(it.en_linea_at) / 1000) : 0, hora_local: zona && zona !== 'America/Mexico_City' ? horaLocal(zona) : null } : null,
    siguiente_item: sig ? { nombre: sig.nombre, empresa: sig.empresa, telefono: sig.telefono, resumen: String(sig.resumen || '').slice(0, 220), intentos: sig.intentos } : null,
    /* LAS LÍNEAS VIVAS, para que la pantalla enseñe a quién se le está marcando
       ahora mismo. Con una línea es la de siempre (la cabina la ignora); con
       varias es lo que el dueño pidió ver: «yo vería a quiénes se les está
       marcando». Va ligero a propósito —nombre, estado y poco más—: esto viaja
       cada segundo. */
    lineas: lineasDe(s),
    vivos: lineasDe(s) > 1 ? (await itemsVivos(sesionId)).map(v => ({
      id: v.id, nombre: v.nombre, empresa: v.empresa, telefono: v.telefono, estado: v.estado,
      veredicto: v.veredicto, intentos: v.intentos, con_vendedor: v.id === s.item_actual,
      segundos: v.marcado_at ? Math.round(ms(v.marcado_at) / 1000) : 0,
    })) : [],
    abandonadas: Number(s.config?.abandonadas || 0),
    /* «Contestó y colgó sin que alcanzaras a hablar»: no es conversación (no se
       dijo nada) ni falta de contacto (descolgó), así que no cabe en ninguno de
       los contadores de la sesión y quedaría invisible. Se cuenta al vuelo —es
       una consulta de cabecera, no una columna nueva— porque es EL número que
       dice si el silencio de los primeros segundos se está cerrando. */
    colgaron_en_silencio: (await supabase.from('tel_sesion_items')
      .select('id', { count: 'exact', head: true }).eq('sesion_id', sesionId).eq('resultado', 'colgo_rapido')).count || 0,
    pendientes: pendientes || 0,
    proximo: prox ? { nombre: prox.nombre, telefono: prox.telefono, volver_at: prox.volver_at } : null,
    ahora: ahora(),
  };
}

export async function listarItems(sesionId: string) {
  const { data } = await supabase.from('tel_sesion_items')
    .select('id, contact_id, conversation_id, nombre, empresa, telefono, orden, estado, intentos, resultado, motivo_exclusion, veredicto, veredicto_fuente, veredicto_ms, resumen, nota, duracion_seg, terminado_at, call_sid, volver_at, prioridad, costo_usd, cierre_estado, cierre_ia, correccion, cortes')
    .eq('sesion_id', sesionId).order('orden').limit(2000);
  /* ══ QUÉ QUEDÓ HECHO EN CADA LLAMADA (18-sep-2026) ══════════════════════
     Pedido del dueño: «en el resumen de las terminadas debe decirme si se hizo
     corrección de datos, si se agendó reunión de demo, si se agendó discovery
     y así, para que yo pueda ver si todo se agendó en orden y bien».

     El dato ya existía y no se estaba mirando: `aplicarCierre` deja en
     `cierre_ia.hecho` la lista exacta de lo que ejecutó —«demo personalizada el
     24 a las 16:00 (en Google Calendar) y le llegó la confirmación por
     WhatsApp», «3 datos: email, ciudad, giro», «Información de Sacs: se mandó
     por WhatsApp»—. Se saca aquí y el `cierre_ia` completo no viaja: trae la
     propuesta entera y la transcripción, y esto se pide cada pocos segundos. */
  return (data || []).map((it: any) => {
    const { cierre_ia, ...resto } = it;
    return {
      ...resto,
      hecho: Array.isArray(cierre_ia?.hecho) ? cierre_ia.hecho : [],
      cierre_motivo: cierre_ia?.motivo || null,
    };
  });
}

/* ══ LOS COMPROMISOS DE ESTA JORNADA ══════════════════════════════════════
   Pedido del dueño (18-sep-2026): «una pestaña específica que diga compromisos,
   con las agendas que se generaron al hablar, para tenerlos presentes en un
   espacio más específico; que sea fácil ver fecha y hora en que se quedó, y si
   ya está en Google Calendar o no».

   Sale de dos sitios, porque un compromiso puede ser de dos clases:
    · una REUNIÓN (demo, discovery) → vive en `bookings`, con su evento de
      Google y su liga de Meet;
    · una LLAMADA de vuelta («márcame el jueves a las 4») → vive en la propia
      lista, como un item pendiente con `volver_at`.
   Las dos cuentan como «lo que prometiste al hablar», así que van juntas. */
export async function compromisosDeSesion(sesionId: string) {
  const items = await supabase.from('tel_sesion_items')
    .select('id, nombre, empresa, telefono, contact_id, volver_at, nota, estado, resultado, terminado_at')
    .eq('sesion_id', sesionId).limit(2000);
  const filas = items.data || [];
  const contactos = Array.from(new Set(filas.map(i => i.contact_id).filter(Boolean))) as string[];

  /* Las reuniones: las que nacieron DE UNA LLAMADA y son de gente de esta
     jornada. `origen = llamada` es lo que las separa de las que se agendaron
     solas desde la página pública. */
  const { data: bks } = contactos.length
    ? await supabase.from('bookings')
      .select('id, contact_id, fecha, hora_inicio, asunto, estado, google_event_id, google_meet_link, created_at, event_types(nombre, slug)')
      .in('contact_id', contactos).eq('origen', 'llamada').order('fecha').limit(500)
    : { data: [] as any[] };

  const nombreDe = (cid: string | null) => filas.find(f => f.contact_id === cid);
  const reuniones = (bks || []).map((b: any) => {
    const it = nombreDe(b.contact_id);
    return {
      tipo: 'reunion' as const, id: b.id, item_id: it?.id || null,
      nombre: it?.nombre || null, empresa: it?.empresa || null, telefono: it?.telefono || null,
      contact_id: b.contact_id, fecha: b.fecha, hora: String(b.hora_inicio || '').slice(0, 5),
      titulo: b.event_types?.nombre || b.asunto || 'Reunión', slug: b.event_types?.slug || null,
      estado: b.estado, en_google: !!b.google_event_id, meet: b.google_meet_link || null,
    };
  });

  /* Las llamadas prometidas: item pendiente con hora. Se quedan fuera las que
     el motor reprogramó solo (buzón, línea cortada): un compromiso es algo que
     una persona dijo, no un reintento. */
  const llamadas = filas
    .filter(i => i.estado === 'pendiente' && i.volver_at && !/buz[oó]n|se cort|otro contest|conexi[oó]n/i.test(String(i.nota || '')))
    .map(i => ({
      tipo: 'llamada' as const, id: i.id, item_id: i.id,
      nombre: i.nombre, empresa: i.empresa, telefono: i.telefono, contact_id: i.contact_id,
      /* ⚠️ La fecha, EN LA HORA DEL CENTRO y no en UTC. Cortar el ISO daba el
         día en Greenwich: una llamada prometida a las 7 de la tarde de hoy
         aparecía como «mañana», porque en UTC ya lo es. */
      ...fechaHoraEn('America/Mexico_City', new Date(i.volver_at as string)),
      titulo: 'Llamada de vuelta', slug: null, estado: 'agendada', en_google: false, meet: null,
      motivo: String(i.nota || '').replace(/^Volver a llamar:\s*/i, '') || null,
    }));

  return [...reuniones, ...llamadas].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));
}

/** Una sesión nueva con los que no se pudo hablar. */
export async function relanzar(sesionId: string, ownerId: string | null, cuales?: string[]) {
  const s = await getSesion(sesionId);
  if (!s) throw new Error('No existe la sesión');
  const items = await listarItems(sesionId);
  const base = cuales?.length ? new Set(cuales) : new Set(['no_contesto', 'ocupado', 'buzon', 'portero', 'volver_llamar']);
  const otra = items.filter(i => (i.estado === 'hecho' || i.estado === 'saltado') && base.has(String(i.resultado)) || (i.estado === 'pendiente'));
  if (!otra.length) throw new Error('No hay a quién volver a llamar');
  return crearSesion(ownerId, {
    nombre: `${s.nombre} · segunda vuelta`, origen: { relanzar_de: sesionId, ...(s.origen || {}) },
    items: otra.map(i => ({ contact_id: i.contact_id, conversation_id: i.conversation_id, nombre: i.nombre, empresa: i.empresa, telefono: i.telefono })),
    presentacion_nombre: s.presentacion_nombre, presentacion_motivo: s.presentacion_motivo, buzon_dejar_mensaje: s.buzon_dejar_mensaje, config: s.config,
  });
}
