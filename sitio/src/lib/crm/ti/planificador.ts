/**
 * EL PLANIFICADOR NOCTURNO (flujo de Fernanda, ronda 1 cerrada con el dueño el 8-sep-2026 · sitio/FLUJO-FERNANDA.md).
 *
 * A las 22:00 CDMX revisa cada conversación de un lead en alcance cuya última palabra es NUESTRA y que no contestó desde
 * el día anterior. Lee el hilo, decide en qué paso de la escalera está y qué toca mañana, redacta con el agente y deja el
 * mensaje programado para las 09:00 (lunes a sábado; el domingo pasa al lunes). En entrenamiento nace como sugerencia
 * (lo decide el consultor en Seguimiento); en vivo sale solo a esa hora.
 *
 * La cadencia (decisión del dueño):
 *   · Silencio en paso 0 (le pedimos los datos): al día siguiente se vuelve a pedir, distinto y amable; luego paso 6; despedida; baja.
 *   · Silencio en paso 2 (le resolvimos algo): reactivación sobre su problema («¿hoy cómo resuelves X?»); luego la oferta; luego paso 5.
 *   · Silencio tras la OFERTA (paso 3): día 1 variante A/B (escasez real / novedad del giro / solo saludo); día 2 presión con
 *     horarios reales; día 3 despedida cordial; 24 h después → descalificado (embudo de nutrición).
 *   · Paso 6 («¿aún es de tu interés?») entra cuando ya hubo dos toques sin respuesta y no hubo oferta.
 *
 * A/B del paso 5: tres variantes, rotación pareja hasta 200 envíos por variante; respuesta medida a 48 h; el propio
 * planificador cuenta y declara ganadora en cfg.ab_paso5.
 */
import { supabase } from '../../supabase';
import { leerConfig } from './motor';
import { ETAPAS_SDR, nace, decidirTurno, aplicarVeredictoSilencio } from './agente';
import { horariosParaDemo } from './agenda-agente';
import { NOVEDAD_IA } from './conocimiento/puntos-giro.ts';
import { parcharConfig } from './config-parche';

const TZ = 6;   // CDMX = UTC-6 (sin horario de verano)
export type Variante = 'escasez' | 'novedad' | 'saludo';
export type Paso = 'paso0' | 'paso2' | 'oferta' | 'paso6' | 'despedida' | 'baja';

/** Mañana a las 9:00 CDMX; si cae en domingo, el lunes. */
export function proximoEnvio(desde = new Date(), horaCdmx = 9): Date {
  const d = new Date(desde.getTime() - TZ * 3600e3);
  d.setUTCDate(d.getUTCDate() + 1);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);   // domingo → lunes
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), horaCdmx + TZ, 0, 0));
}

const RX_OFERTA = /especialista en sacs|prueba gratis de 7|te interesa alguna de las dos|paso a paso, en l[ií]nea y sin costo/i;
const RX_PUNTOS = /(^|\n)\s*1\.\s.+\n\s*2\.\s/;
const RX_DESPEDIDA = /ser[aá] un gusto atenderte|cuando est[eé]s list|lo dejamos aqu[ií]/i;
const RX_PASO6 = /a[uú]n es de tu inter[eé]s|retomemos m[aá]s adelante|sigue siendo de tu inter[eé]s/i;

/** Lee el hilo y decide qué toca mañana. */
export function diagnosticar(msjs: { direccion: string; cuerpo?: string | null; created_at: string }[], datosCompletos: boolean): { paso: Paso; n: number; porque: string } {
  const ultIn = [...msjs].reverse().find(m => m.direccion === 'entrante');
  const desdeIn = ultIn ? Date.parse(ultIn.created_at) : 0;
  const nuestrosDespues = msjs.filter(m => m.direccion === 'saliente' && Date.parse(m.created_at) > desdeIn);
  const textoDespues = nuestrosDespues.map(m => String(m.cuerpo || '')).join('\n');
  const n = nuestrosDespues.length;   // toques nuestros sin respuesta
  const huboOferta = msjs.some(m => m.direccion === 'saliente' && RX_OFERTA.test(String(m.cuerpo || '')));
  const puntosDichos = msjs.some(m => m.direccion === 'saliente' && RX_PUNTOS.test(String(m.cuerpo || '')));
  if (RX_DESPEDIDA.test(textoDespues)) return { paso: 'baja', n, porque: 'ya se despidió y pasaron 24 h sin respuesta' };
  if (huboOferta && nuestrosDespues.some(m => RX_OFERTA.test(String(m.cuerpo || '')) || true)) {
    const tras = nuestrosDespues.filter(m => !RX_OFERTA.test(String(m.cuerpo || ''))).length;   // toques después de la oferta
    if (tras >= 2) return { paso: 'despedida', n, porque: 'dos toques después de la oferta sin respuesta' };
    return { paso: 'oferta', n: tras, porque: tras === 0 ? 'primer día después de la oferta' : 'segundo día después de la oferta' };
  }
  if (RX_PASO6.test(textoDespues)) return { paso: 'despedida', n, porque: 'ya se le preguntó si seguía interesado y no contestó' };
  if (n >= 2) return { paso: 'paso6', n, porque: 'dos toques sin respuesta y sin oferta' };
  if (!datosCompletos) return { paso: 'paso0', n, porque: 'faltan datos y no contestó' };
  if (puntosDichos) return { paso: 'paso2', n, porque: 'ya se le dijeron los puntos y no siguió' };
  return { paso: 'paso2', n, porque: 'plática abierta sin respuesta' };
}

/** Variante del paso 5: la ganadora si ya se declaró; si no, la que menos se ha usado (rotación pareja). */
export function elegirVariante(ab: any, caso = 'post_oferta'): Variante {
  const c = ab?.[caso] || {};
  if (c.ganadora) return c.ganadora as Variante;
  const usos: [Variante, number][] = (['escasez', 'novedad', 'saludo'] as Variante[]).map(v => [v, Number(c[v]?.n || 0)]);
  usos.sort((a, b) => a[1] - b[1]);
  return usos[0][0];
}

async function escasezReal(): Promise<number> {
  const hs = await horariosParaDemo({ dias: 2, max: 10 }).catch(() => []);
  return Math.max(1, Math.min(3, hs.length));
}

function notaPara(paso: Paso, o: { n: number; variante?: Variante; escasez?: number; giroTxt?: string | null; hayEstaSemana: boolean; nombre: string | null }): string {
  const nombre = o.nombre || '';
  switch (paso) {
    case 'paso0': return `PLANIFICADOR (toque ${o.n + 1}): ayer le pedimos sus datos (modelo de negocio, giro, sucursales) y no contestó. Vuelve a pedir SOLO lo que falta, distinto a como lo pediste, con interés genuino y sin prisa; ofrece el audio. Sin hablar de Sacs.`;
    case 'paso2': return `PLANIFICADOR (toque ${o.n + 1}): ya le resolvimos algo y se quedó callado. Reactiva sobre SU problema, no sobre nosotros: pregúntale cómo lo resuelve hoy («¿hoy cómo resuelves X?») o si quedó alguna duda de lo que te contó. Una sola pregunta, cálida, sin ofrecer reunión.`;
    case 'oferta':
      if (o.n === 0) {
        if (o.variante === 'escasez') return `PLANIFICADOR (día 1 tras la oferta · variante ESCASEZ): pregunta si aún le interesa y di que estás esperando su confirmación para agendar con el consultor, que todavía tiene ${o.escasez} horario${o.escasez === 1 ? '' : 's'} disponible${o.escasez === 1 ? '' : 's'} esta semana (es un dato REAL, no lo cambies). Corto, amable, una pregunta.`;
        if (o.variante === 'novedad') return `PLANIFICADOR (día 1 tras la oferta · variante NOVEDAD): comparte algo nuevo del sistema para su giro${o.giroTxt ? ` (${o.giroTxt})` : ''} —por ejemplo «${NOVEDAD_IA.titulo}» si es ropa, calzado o uniformes, o la función del glosario de su giro que no se haya mencionado— en una línea, como quien avisa de una novedad, y cierra: «¿aún te interesa verlo, o prefieres en otra ocasión?».`;
        return `PLANIFICADOR (día 1 tras la oferta · variante SALUDO): SOLO un saludo cálido y corto, nada más: «Hola ${nombre || ''}, ¿cómo estás?». Sin pregunta de negocio, sin reunión.`;
      }
      return `PLANIFICADOR (día 2 tras la oferta · presión suave con horarios reales): dile que el consultor aún tiene ${o.escasez} horario${o.escasez === 1 ? '' : 's'} disponible${o.escasez === 1 ? '' : 's'} ${o.hayEstaSemana ? 'esta semana' : 'próximamente'} (dato REAL) y pregúntale si quiere que le aparte uno o si prefiere verlo en otra ocasión. Una pregunta, sin insistir.`;
    case 'paso6': return `PLANIFICADOR (paso 6): dos toques sin respuesta. Con cordialidad: «${nombre ? nombre + ', ' : ''}espero que vaya todo bien. Me gustaría saber si aún es de tu interés o si prefieres que lo retomemos más adelante.» Nada más.`;
    case 'despedida': return `PLANIFICADOR (despedida cordial): es el último mensaje. Sin reproche ni presión: que será un gusto atenderle cuando esté lista, que por aquí quedas a la orden. Sin pregunta. Máximo dos líneas.`;
    default: return '';
  }
}

export async function planificarNocturno(opts: { max?: number; soloContactId?: string; ahora?: Date } = {}): Promise<any> {
  const cfg: any = await leerConfig();
  if (cfg.agente_activo !== true) return { planificador: 'apagado' };
  const ahora = opts.ahora || new Date();
  const saleAt = proximoEnvio(ahora, Number(cfg.flujo_hora_envio) || 9);
  const res: any = { revisados: 0, programados: 0, bajas: 0, saltados: 0, por_paso: {} as Record<string, number>, costo: 0 };
  const { data: lk } = await supabase.rpc('ti_lock', { p_clave: 'planificador', p_segundos: 900 });
  if (lk === false && !opts.soloContactId) return { planificador: 'otro corredor activo' };

  // Universo: leads en alcance cuya última pieza del hilo es NUESTRA y con más de 20 h de silencio.
  const { data: convs } = await supabase.from('wa_conversaciones').select('id, contact_id, telefono, ultimo_mensaje_at, ultima_direccion, contacts!inner(id, nombre, lifecycle_stage, giro, modelo_negocio, sucursales_interes, archived_at, propiedades)')
    .not('contact_id', 'is', null).eq('ultima_direccion', 'saliente').lt('ultimo_mensaje_at', new Date(ahora.getTime() - 20 * 3600e3).toISOString()).gt('ultimo_mensaje_at', new Date(ahora.getTime() - 45 * 86400e3).toISOString()).limit(400);
  const ab: any = cfg.ab_paso5 || {};
  let escasez: number | null = null;
  const finSemana = (() => { const d = new Date(ahora.getTime() - TZ * 3600e3); const dow = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + (7 - dow)); return d.toISOString().slice(0, 10); })();
  const hsSemana = await horariosParaDemo({ dias: 6, max: 10 }).catch(() => []);
  const hayEstaSemana = hsSemana.some(h => h.fecha <= finSemana);

  for (const cv of convs || []) {
    if (opts.soloContactId && cv.contact_id !== opts.soloContactId) continue;
    if (res.programados + res.bajas >= (opts.max ?? 60)) break;
    const c: any = (cv as any).contacts;
    if (!c || c.archived_at || c.propiedades?.demo_ti || !ETAPAS_SDR.includes(String(c.lifecycle_stage || ''))) { res.saltados++; continue; }
    const { data: pf } = await supabase.from('ti_perfil').select('agente_estado, silenciar_ia').eq('contact_id', c.id).maybeSingle();
    const st: any = (pf?.agente_estado as any) || {};
    if (pf?.silenciar_ia || st.cerrado || (st.pausa_hasta && Date.parse(st.pausa_hasta) > ahora.getTime())) { res.saltados++; continue; }
    // Ya hay algo en la fila para él (sugerencia o pendiente): no se duplica.
    const { data: vivo } = await supabase.from('ti_envios').select('id').eq('contact_id', c.id).in('estado', ['sugerencia', 'pendiente']).limit(1);
    if ((vivo || []).length) { res.saltados++; continue; }
    res.revisados++;
    const { data: msjs } = await supabase.from('wa_mensajes').select('direccion, cuerpo, created_at').eq('conversation_id', cv.id).is('borrado_at', null).order('created_at', { ascending: false }).limit(30);
    const hilo = (msjs || []).reverse();
    const datosCompletos = !!(c.modelo_negocio && c.giro && Number(c.sucursales_interes));
    const dx = diagnosticar(hilo as any, datosCompletos);
    res.por_paso[dx.paso] = (res.por_paso[dx.paso] || 0) + 1;

    if (dx.paso === 'baja') {
      await aplicarVeredictoSilencio({ contact_id: c.id, id: null, payload: { propuesta: 'descalificar', origen: 'planificador' } }, 'descalificar', { automatica: true, flujo: 'v2', porque: dx.porque }, null).catch(() => {});
      await supabase.from('ia_log').insert({ accion: 'flujo_baja', contact_id: c.id, razon: dx.porque }).then(() => {}, () => {});
      res.bajas++; continue;
    }
    let variante: Variante | undefined;
    if (dx.paso === 'oferta') {
      if (escasez === null) escasez = await escasezReal();
      if (dx.n === 0) variante = elegirVariante(ab);
    }
    const nota = notaPara(dx.paso, { n: dx.n, variante, escasez: escasez ?? undefined, giroTxt: c.giro, hayEstaSemana, nombre: String(c.nombre || '').split(/\s+/)[0] || null });
    try {
      (globalThis as any).__ia_proposito = 'planificador';
      const d = await decidirTurno(c.id, nota, { tarea: 'silencio' });
      (globalThis as any).__ia_proposito = null;
      res.costo += d.costo || 0;
      if (!d.salida?.mensaje || d.salida.responder === false || !d.telefono) { res.saltados++; continue; }
      await supabase.from('ti_envios').insert({ contact_id: c.id, conversation_id: cv.id, telefono: d.telefono, origen: 'silencio', estado: nace(cfg, d.telefono), mensaje: d.salida.mensaje.trim(), adjuntos: d.salida.adjuntos || [], salida: { ...d.salida, flujo: { paso: dx.paso, n: dx.n, porque: dx.porque, variante: variante || null, escasez: escasez ?? null } }, sale_at: saleAt.toISOString(), modelo: 'planificador', costo_usd: d.costo });
      if (variante) { ab.post_oferta = ab.post_oferta || {}; ab.post_oferta[variante] = { n: Number(ab.post_oferta[variante]?.n || 0) + 1, resp: Number(ab.post_oferta[variante]?.resp || 0) }; }
      await supabase.from('ti_perfil').upsert({ contact_id: c.id, agente_estado: { ...st, flujo: { paso: dx.paso, n: dx.n + 1, variante: variante || null, planificado_para: saleAt.toISOString() } }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });
      res.programados++;
    } catch (e: any) { res.saltados++; await supabase.from('ia_log').insert({ accion: 'agente_error', contact_id: c.id, razon: `planificador: ${e?.message || e}` }).then(() => {}, () => {}); }
  }

  // A/B: contar respuestas a 48 h de las variantes ya enviadas y declarar ganadora (≥200 por variante).
  try {
    const desde = new Date(ahora.getTime() - 10 * 86400e3).toISOString(), corte = new Date(ahora.getTime() - 48 * 3600e3).toISOString();
    const { data: enviados } = await supabase.from('ti_envios').select('id, contact_id, enviado_at, salida').eq('estado', 'enviado').gte('enviado_at', desde).lte('enviado_at', corte).not('salida->flujo->variante', 'is', null).limit(500);
    for (const e of enviados || []) {
      const s: any = e.salida || {}; if (s.ab_contado) continue;
      const v: Variante = s.flujo?.variante; if (!v) continue;
      const { data: resp } = await supabase.from('ti_eventos').select('id').eq('contact_id', e.contact_id).eq('tipo', 'wa_entrante').gt('ocurrio_at', e.enviado_at).lte('ocurrio_at', new Date(Date.parse(e.enviado_at) + 48 * 3600e3).toISOString()).limit(1);
      ab.post_oferta = ab.post_oferta || {}; ab.post_oferta[v] = ab.post_oferta[v] || { n: 0, resp: 0 };
      if ((resp || []).length) ab.post_oferta[v].resp = Number(ab.post_oferta[v].resp || 0) + 1;
      await supabase.from('ti_envios').update({ salida: { ...s, ab_contado: true, ab_respondio: !!(resp || []).length } }).eq('id', e.id);
    }
    const c = ab.post_oferta || {};
    if (!c.ganadora && (['escasez', 'novedad', 'saludo'] as Variante[]).every(v => Number(c[v]?.n || 0) >= 200)) {
      const tasas = (['escasez', 'novedad', 'saludo'] as Variante[]).map(v => [v, Number(c[v].resp || 0) / Number(c[v].n || 1)] as [Variante, number]).sort((a, b) => b[1] - a[1]);
      c.ganadora = tasas[0][0]; c.ganadora_at = ahora.toISOString(); c.tasas = Object.fromEntries(tasas);
      await supabase.from('ia_log').insert({ accion: 'ab_ganadora', razon: `paso 5: gana «${c.ganadora}»`, detalle: c }).then(() => {}, () => {});
    }
    ab.post_oferta = c;
  } catch (e: any) { res.ab_error = String(e?.message || e); }
  const { data: cfgRow } = await supabase.from('ti_config').select('valor').eq('id', 1).maybeSingle();
  await parcharConfig({ ab_paso5: ab, planificador_ultimo: { at: ahora.toISOString(), ...res } });
  await supabase.from('ti_locks').delete().eq('clave', 'planificador').then(() => {}, () => {});
  await supabase.from('ia_log').insert({ accion: 'planificador_nocturno', razon: `${res.programados} programados para ${saleAt.toISOString().slice(0, 16)} · ${res.bajas} bajas · ${res.saltados} saltados`, costo_usd: res.costo, detalle: res }).then(() => {}, () => {});
  return { ...res, sale_at: saleAt.toISOString() };
}
