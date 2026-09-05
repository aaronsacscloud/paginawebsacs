/**
 * COMPROMISOS · cuando el prospecto pide una acción con fecha (decisión del dueño, 2026-09-05).
 *
 * «Llámame el jueves», «contáctame en 30 días», «estoy de viaje, la otra semana», «lo checo». Hasta hoy el agente
 * contestaba y el reloj de silencio lo volvía a tocar cuando le tocaba a ÉL, no cuando lo pidió el lead. Ahora:
 *   1. Se DETECTA la petición (Sonnet lee el mensaje con la fecha de hoy y el día de la semana; las fechas en
 *      español son ambiguas: «la otra semana», «después de quincena», «cuando regrese»).
 *   2. Se le contesta con empatía confirmando la fecha (la nota va al agente: él redacta).
 *   3. Se PROGRAMA el seguimiento exacto: qué día, a QUÉ HORA (la suya: mejor_hora_wa o la hora a la que escribió)
 *      y qué hay que hacer (escribir, llamar, agendar). Fines de semana pasan al lunes.
 *   4. Mientras tanto: silencio total (lo pidió el dueño). El reloj de silencio y el seguimiento corto lo respetan
 *      porque se escribe agente_estado.pausa_hasta.
 *   5. Al vencer, el observador genera el mensaje con el contexto exacto («quedaste de buscarlo hoy porque el 5 dijo
 *      que estaba de viaje») y, si era llamada, deja la tarea al consultor a esa hora.
 *
 * Los «lo checo» sin fecha (el caso más común) se contestan amigable ofreciendo la otra semana o preguntar por aquí,
 * y se programan a 5 días; si tampoco entonces contesta, ese lead va camino a descalificarse (decisión del dueño).
 */
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey, calculateCost } from '../../ai/client';

export type TipoCompromiso = 'retomar' | 'llamar' | 'agendar' | 'esperar_evento' | 'vago';
export const TIPO_L: Record<TipoCompromiso, string> = { retomar: 'Volver a escribirle', llamar: 'Llamarle', agendar: 'Agendar con él', esperar_evento: 'Esperar a que pase algo', vago: 'Dijo que lo revisa' };

const TZ = -6;   // CDMX sin horario de verano
const cdmx = (d: Date) => new Date(d.getTime() + TZ * 3600e3);
const desdeCdmx = (y: number, m: number, d: number, h: number) => new Date(Date.UTC(y, m, d, h - TZ, 0, 0));

/** La hora a la que se le escribe: la suya. mejor_hora_wa si existe (se acota a 9-19), si no la hora a la que escribió, si no las 10. */
export function horaParaEl(o: { mejorHoraWa?: number | null; horaDeSuMensaje?: number | null; horaPedida?: number | null }): { hora: number; porque: string } {
  const acota = (h: number) => Math.min(19, Math.max(9, h));
  if (o.horaPedida != null) return { hora: acota(o.horaPedida), porque: 'la hora que él pidió' };
  if (o.mejorHoraWa != null) return { hora: acota(o.mejorHoraWa), porque: 'la hora a la que suele contestar' };
  if (o.horaDeSuMensaje != null) return { hora: acota(o.horaDeSuMensaje), porque: 'la hora a la que nos escribió' };
  return { hora: 10, porque: 'media mañana, sin más datos' };
}
/** Fin de semana → lunes. Si la fecha ya pasó hoy a esa hora, mañana. */
export function ajustarFecha(fechaCdmx: { y: number; m: number; d: number }, hora: number, ahora = new Date()): Date {
  let f = desdeCdmx(fechaCdmx.y, fechaCdmx.m, fechaCdmx.d, hora);
  const dow = () => cdmx(f).getUTCDay();
  if (f.getTime() <= ahora.getTime() + 10 * 60e3) f = new Date(f.getTime() + 86400e3);
  while (dow() === 0 || dow() === 6) f = new Date(f.getTime() + 86400e3);
  return f;
}

export type Deteccion = { hay: boolean; tipo: TipoCompromiso; fecha: { y: number; m: number; d: number } | null; hora_pedida: number | null; necesita_hora: boolean; pidio: string; interpretacion: string; confianza: number; costo: number };

/** Lee el mensaje del lead y dice si pidió algo con fecha. Sonnet con la fecha de hoy, porque «la otra semana» depende de qué día es. */
export async function detectarCompromiso(texto: string, ahora = new Date()): Promise<Deteccion | null> {
  if (!hasApiKey()) return null;
  const t = String(texto || '').trim();
  if (t.length < 4) return null;
  // Filtro barato antes de gastar: si no hay ni una palabra de tiempo o de acción, no hay compromiso.
  if (!/(d[ií]a|semana|mes|ma[ñn]ana|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|hora|tarde|noche|luego|despu[eé]s|ahorita|viaje|vacacion|regres|checo|chequ|reviso|lo veo|d[eé]jame|ll[aá]ma|m[aá]rca|marc|contacta|busca|escr[ií]be|quincena|fin de mes|pr[oó]xim|siguiente|otra semana|\d)/i.test(t)) return null;
  const hoy = cdmx(ahora); const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const prompt = `Hoy es ${dias[hoy.getUTCDay()]} ${hoy.getUTCDate()}/${hoy.getUTCMonth() + 1}/${hoy.getUTCFullYear()}, ${hoy.getUTCHours()}:${String(hoy.getUTCMinutes()).padStart(2, '0')} hora de la Ciudad de México.
Un prospecto le escribió esto a una asesora de ventas por WhatsApp:
«${t.slice(0, 600)}»

¿Está pidiendo que se le busque en OTRO momento, o una acción concreta con tiempo? Clasifica:
- "retomar": que le escribamos después («la otra semana», «en 30 días», «después de quincena», «cuando regrese de viaje el 20»).
- "llamar": que le llamemos («márcame», «llámame el jueves», «después de las 4»).
- "agendar": que se agende algo (demo, reunión) en un momento que él propone.
- "esperar_evento": esperar a que pase algo suyo sin fecha clara («cuando abra la tienda», «cuando me autoricen el presupuesto»).
- "vago": lo va a revisar sin fecha («lo checo», «déjame ver», «lo veo y te digo»).
Si NO pide nada de eso (solo pregunta, agradece, dice que sí o que no), "hay": false.

Calcula la FECHA concreta en que quiere que actuemos (si dijo «la otra semana» → el martes de la próxima semana; «en 3 días» → hoy+3; «después de quincena» → el 16 o el 1 siguiente; «el jueves» → el jueves más próximo que no sea hoy si ya es tarde). Si dijo una hora («después de las 4», «en la mañana»→10, «en la tarde»→16), ponla.
Responde SOLO JSON: {"hay":bool,"tipo":"retomar|llamar|agendar|esperar_evento|vago","fecha":"YYYY-MM-DD o null","hora_pedida":n o null,"necesita_hora":bool,"pidio":"cita textual corta de lo que pidió","interpretacion":"1 línea en español: qué quiere y cuándo","confianza":0.0-1.0}`;
  try {
    const r: any = await anthropic.messages.create({ model: MODELS.sonnet, max_tokens: 300, messages: [{ role: 'user', content: prompt }] });
    const txt = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const m = txt.match(/\{[\s\S]*\}/); if (!m) return null;
    const j = JSON.parse(m[0]);
    const costo = calculateCost(MODELS.sonnet, r.usage as any).cost_usd;
    if (!j.hay) return { hay: false, tipo: 'vago', fecha: null, hora_pedida: null, necesita_hora: false, pidio: '', interpretacion: '', confianza: Number(j.confianza) || 0, costo };
    let fecha: Deteccion['fecha'] = null;
    if (j.fecha && /^\d{4}-\d{2}-\d{2}$/.test(j.fecha)) { const [y, mo, d] = j.fecha.split('-').map(Number); fecha = { y, m: mo - 1, d }; }
    return { hay: true, tipo: (['retomar', 'llamar', 'agendar', 'esperar_evento', 'vago'].includes(j.tipo) ? j.tipo : 'vago'), fecha, hora_pedida: Number.isFinite(Number(j.hora_pedida)) && j.hora_pedida !== null ? Number(j.hora_pedida) : null, necesita_hora: !!j.necesita_hora, pidio: String(j.pidio || t).slice(0, 240), interpretacion: String(j.interpretacion || '').slice(0, 240), confianza: Math.max(0, Math.min(1, Number(j.confianza) || 0)), costo };
  } catch { return null; }
}

/** Programa el compromiso: escribe la fila, pausa al agente hasta esa fecha y devuelve la nota para que el agente conteste bien. */
export async function programarCompromiso(o: { contactId: string; conversationId?: string | null; det: Deteccion; mensajeOrigenId?: string | null; horaDeSuMensaje?: number | null; creadoPor?: string }): Promise<{ id: string | null; programado: Date | null; nota: string; hora: number; porqueHora: string }> {
  const { det } = o;
  const { data: pf } = await supabase.from('ti_perfil').select('mejor_hora_wa, agente_estado').eq('contact_id', o.contactId).maybeSingle();
  const st: any = (pf as any)?.agente_estado || {};
  const ahora = new Date(); const hoy = cdmx(ahora);
  const { hora, porque } = horaParaEl({ mejorHoraWa: (pf as any)?.mejor_hora_wa, horaDeSuMensaje: o.horaDeSuMensaje, horaPedida: det.hora_pedida });

  // Sin fecha: «vago» a 5 días; «esperar_evento» a 14 días para preguntar cómo va; llamar sin hora → primero se le pregunta.
  let base = det.fecha;
  if (!base) {
    const mas = det.tipo === 'esperar_evento' ? 14 : det.tipo === 'llamar' ? 0 : 5;
    const f = new Date(hoy.getTime() + mas * 86400e3); base = { y: f.getUTCFullYear(), m: f.getUTCMonth(), d: f.getUTCDate() };
  }
  const necesitaHora = det.tipo === 'llamar' && det.hora_pedida == null;
  const programado = necesitaHora ? null : ajustarFecha(base, hora, ahora);
  const accion = det.tipo === 'llamar' ? 'llamar' : det.tipo === 'agendar' ? 'agendar' : 'escribir';

  const { data: fila } = await supabase.from('ti_compromisos').insert({
    contact_id: o.contactId, conversation_id: o.conversationId || null, tipo: det.tipo, pidio: det.pidio, interpretacion: det.interpretacion,
    programado_para: (programado || new Date(ahora.getTime() + 2 * 86400e3)).toISOString(), hora_local: hora, por_que_hora: porque,
    estado: necesitaHora ? 'preguntando_hora' : 'programado', accion_al_vencer: accion, mensaje_origen_id: o.mensajeOrigenId || null,
    confianza: det.confianza, creado_por: o.creadoPor || 'agente',
  }).select('id').maybeSingle();

  // El agente se pausa hasta entonces: ni reloj de silencio ni seguimiento corto lo tocan mientras tanto (silencio total, decisión del dueño).
  if (programado) await supabase.from('ti_perfil').upsert({ contact_id: o.contactId, agente_estado: { ...st, pausa_hasta: programado.toISOString(), compromiso_id: fila?.id || null, retomar: { fecha: programado.toISOString(), motivo: det.interpretacion, desde: ahora.toISOString() } }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });

  const fechaTxt = programado ? cdmx(programado).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : null;
  let nota: string;
  if (det.tipo === 'vago') nota = `EL LEAD DIJO QUE LO REVISA (${det.pidio}), sin fecha. Contéstale AMIGABLE y sin presión: que lo vea con calma, que si le late lo vemos la otra semana en 15 minutos, y que si prefiere por aquí puede preguntar lo que sea mientras tanto. Sin pedirle fecha. Ya está programado buscarlo el ${fechaTxt}; si tampoco contesta entonces, es señal de poco interés.`;
  else if (necesitaHora) nota = `EL LEAD PIDIÓ QUE LE LLAMEMOS (${det.pidio}) pero no dijo hora. Contesta con gusto y pregúntale SOLO la hora que le acomoda («¿te marco hoy en la tarde o mañana temprano?»). En cuanto la diga, se agenda la llamada de descubrimiento con el consultor.`;
  else if (det.tipo === 'llamar') nota = `EL LEAD PIDIÓ QUE LE LLAMEMOS ${det.pidio}. Confírmale con calidez que le marcamos el ${fechaTxt} a las ${hora}:00, y nada más. Ya quedó agendada la llamada con el consultor.`;
  else if (det.tipo === 'esperar_evento') nota = `EL LEAD DIJO QUE ESPERA A QUE PASE ALGO SUYO (${det.pidio}). Contesta con empatía, dile que entonces lo buscas cuando eso pase y que si quiere le escribes en dos semanas para ver cómo va. NO vendas. Ya quedó programado para el ${fechaTxt}.`;
  else nota = `EL LEAD PIDIÓ QUE LO BUSQUEMOS DESPUÉS (${det.pidio}). Contesta con empatía y CONFÍRMALE la fecha en una línea («va, te busco el ${fechaTxt}»), sin vender ni pedir nada más. Hasta entonces no se le escribe: ya está programado.`;
  return { id: fila?.id || null, programado, nota, hora, porqueHora: porque };
}

/** Los compromisos que ya vencieron: generan su seguimiento con el contexto exacto. Corre con el observador. */
export async function dispararCompromisos(): Promise<any> {
  const ahora = new Date();
  const { data: due } = await supabase.from('ti_compromisos').select('*').eq('estado', 'programado').lte('programado_para', ahora.toISOString()).order('programado_para').limit(15);
  const res = { vencidos: (due || []).length, escritos: 0, llamadas: 0, errores: [] as string[] };
  if (!due?.length) return res;
  const { decidirTurno, nace } = await import('./agente');
  const { leerConfig } = await import('./motor');
  const cfg: any = await leerConfig();
  for (const c of due) {
    try {
      // Levanta la pausa del agente para este lead.
      const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', c.contact_id).maybeSingle();
      const st: any = (pf as any)?.agente_estado || {};
      await supabase.from('ti_perfil').upsert({ contact_id: c.contact_id, agente_estado: { ...st, pausa_hasta: undefined, compromiso_id: undefined }, updated_at: ahora.toISOString() }, { onConflict: 'contact_id' });
      const cuando = cdmx(new Date(c.created_at)).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      if (c.accion_al_vencer === 'llamar') {
        const { data: k } = await supabase.from('contacts').select('nombre, whatsapp, owner_id, company_id').eq('id', c.contact_id).maybeSingle();
        await supabase.from('ti_tareas').insert({ contact_id: c.contact_id, company_id: k?.company_id || null, owner_id: k?.owner_id || null, familia: 'llamar', tipo: 'llamada', prioridad: 1, vence_at: ahora.toISOString(), origen: 'compromiso', payload: { instruccion: `${String(k?.nombre || 'el lead').split(' ')[0]}: le prometimos llamarle ahora`, porque: `El ${cuando} dijo: «${c.pidio}». Llamada de descubrimiento.`, nombre: k?.nombre, whatsapp: k?.whatsapp, reloj: 'compromiso', resultados: { contesto: 'Contestó', buzon: 'Buzón', no_contesto: 'No contestó', reagendar: 'Pidió otra hora' } } });
        res.llamadas++;
      }
      const nota = c.accion_al_vencer === 'llamar'
        ? `HOY LE TOCA LA LLAMADA QUE PIDIÓ (el ${cuando} dijo: «${c.pidio}»). Mándale una línea avisando que en un momento le marca el consultor, y nada más.`
        : `QUEDASTE DE BUSCARLO HOY: el ${cuando} dijo «${c.pidio}» (${c.interpretacion}). Retómalo EXACTAMENTE ahí, con naturalidad: recuérdale en media línea lo que quedó y sigue con lo que él quería. No le expliques que «quedamos de», solo retoma. Una sola pregunta.`;
      const d = await decidirTurno(c.contact_id, nota, { tarea: 'respuesta' });
      if (!d.salida?.mensaje || !d.telefono) { res.errores.push(`${c.id.slice(0, 8)}: sin mensaje`); continue; }
      const { data: env } = await supabase.from('ti_envios').insert({ contact_id: c.contact_id, conversation_id: d.conversationId, telefono: d.telefono, origen: 'compromiso', estado: nace(cfg, d.telefono), mensaje: d.salida.mensaje.trim(), adjuntos: d.salida.adjuntos || [], salida: { ...d.salida, compromiso: { id: c.id, pidio: c.pidio, tipo: c.tipo } }, sale_at: ahora.toISOString(), modelo: MODELS.opus, costo_usd: d.costo }).select('id').maybeSingle();
      await supabase.from('ti_compromisos').update({ estado: 'cumplido', cumplido_at: ahora.toISOString(), envio_id: env?.id || null, updated_at: ahora.toISOString() }).eq('id', c.id);
      res.escritos++;
    } catch (e: any) { res.errores.push(`${c.id.slice(0, 8)}: ${String(e?.message || e).slice(0, 80)}`); }
  }
  return res;
}

/** Para la sección: lo programado agrupado por cuándo, y el historial. */
export async function panelCompromisos() {
  const [{ data: prox }, { data: hist }] = await Promise.all([
    supabase.from('ti_compromisos').select('*').in('estado', ['programado', 'preguntando_hora']).order('programado_para').limit(120),
    supabase.from('ti_compromisos').select('*').in('estado', ['cumplido', 'cancelado']).order('updated_at', { ascending: false }).limit(40),
  ]);
  const ids = [...new Set([...(prox || []), ...(hist || [])].map(x => x.contact_id))];
  const { data: cs } = ids.length ? await supabase.from('contacts').select('id, nombre, whatsapp, lifecycle_stage, giro, companies(nombre_comercial, nombre)').in('id', ids) : { data: [] as any[] };
  const k = (id: string) => { const c: any = (cs || []).find((x: any) => x.id === id) || {}; return { nombre: c.nombre || 'Sin nombre', telefono: c.whatsapp || null, etapa: c.lifecycle_stage || null, giro: c.giro || null, empresa: c.companies?.nombre_comercial || c.companies?.nombre || null }; };
  const hoy = cdmx(new Date()); const hoyYmd = hoy.toISOString().slice(0, 10);
  const grupo = (iso: string) => { const d = cdmx(new Date(iso)); const ymd = d.toISOString().slice(0, 10); const dif = Math.round((Date.parse(ymd) - Date.parse(hoyYmd)) / 86400e3); return dif <= 0 ? 'hoy' : dif === 1 ? 'manana' : dif <= 7 ? 'semana' : 'despues'; };
  return {
    proximos: (prox || []).map(x => ({ ...x, lead: k(x.contact_id), grupo: x.estado === 'preguntando_hora' ? 'sin_hora' : grupo(x.programado_para), tipo_label: (TIPO_L as any)[x.tipo] || x.tipo })),
    historial: (hist || []).map(x => ({ ...x, lead: k(x.contact_id), tipo_label: (TIPO_L as any)[x.tipo] || x.tipo })),
    resumen: { hoy: (prox || []).filter(x => x.estado === 'programado' && grupo(x.programado_para) === 'hoy').length, semana: (prox || []).filter(x => x.estado === 'programado' && ['hoy', 'manana', 'semana'].includes(grupo(x.programado_para))).length, sin_hora: (prox || []).filter(x => x.estado === 'preguntando_hora').length, total: (prox || []).length, tipos: TIPO_L },
  };
}

/** Mover, cancelar o disparar ya. Todo queda con quién y por qué. */
export async function decidirCompromiso(id: string, o: { accion: 'mover' | 'cancelar' | 'ahora' | 'fijar_hora'; fecha?: string; hora?: number; nota?: string; userId?: string | null }) {
  const { data: c } = await supabase.from('ti_compromisos').select('*').eq('id', id).maybeSingle();
  if (!c) return { error: 'No existe' };
  const ahora = new Date().toISOString();
  if (o.accion === 'cancelar') {
    await supabase.from('ti_compromisos').update({ estado: 'cancelado', notas: o.nota || null, updated_at: ahora }).eq('id', id);
    const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', c.contact_id).maybeSingle();
    const st: any = (pf as any)?.agente_estado || {}; if (st.compromiso_id === id) await supabase.from('ti_perfil').upsert({ contact_id: c.contact_id, agente_estado: { ...st, pausa_hasta: undefined, compromiso_id: undefined }, updated_at: ahora }, { onConflict: 'contact_id' });
    return { ok: true };
  }
  if (o.accion === 'ahora') { await supabase.from('ti_compromisos').update({ programado_para: ahora, estado: 'programado', updated_at: ahora }).eq('id', id); const r = await dispararCompromisos(); return { ok: true, disparado: r }; }
  if (o.accion === 'mover' || o.accion === 'fijar_hora') {
    const base = o.fecha ? new Date(o.fecha) : new Date(c.programado_para);
    const bc = cdmx(base); const hora = o.hora ?? c.hora_local ?? 10;
    const f = ajustarFecha({ y: bc.getUTCFullYear(), m: bc.getUTCMonth(), d: bc.getUTCDate() }, hora);
    await supabase.from('ti_compromisos').update({ programado_para: f.toISOString(), hora_local: hora, por_que_hora: o.accion === 'fijar_hora' ? 'la hora que él dijo' : 'movido por el consultor', estado: 'programado', notas: o.nota || c.notas, updated_at: ahora }).eq('id', id);
    const { data: pf } = await supabase.from('ti_perfil').select('agente_estado').eq('contact_id', c.contact_id).maybeSingle();
    const st: any = (pf as any)?.agente_estado || {};
    await supabase.from('ti_perfil').upsert({ contact_id: c.contact_id, agente_estado: { ...st, pausa_hasta: f.toISOString(), compromiso_id: id }, updated_at: ahora }, { onConflict: 'contact_id' });
    return { ok: true, programado_para: f.toISOString() };
  }
  return { error: 'Acción desconocida' };
}
