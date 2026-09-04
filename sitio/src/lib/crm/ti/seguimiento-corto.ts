/**
 * SEGUIMIENTO DE 1 A 4 DÍAS (decisión del dueño, 2026-09-04).
 *
 * Distinto del reloj de silencio (que trabaja en ciclos de semanas): esta es la ventana corta, cuando el
 * seguimiento todavía se siente natural. Le escribimos, no contestó, y llevan entre 20 h y 4 días.
 *
 * El criterio NO es el tiempo: es en qué quedó la conversación. Por eso primero se CLASIFICA la situación
 * leyendo el hilo completo y luego se redacta con ese ángulo:
 *   nunca_respondio  · escribió el formulario o entró por anuncio y nunca contestó un mensaje
 *   quedo_en_demo    · dijo que sí le interesa ver el sistema, pero falta algo para agendarla
 *   falta_dato       · para avanzar falta un dato concreto que él tiene (giro, tiendas, correo)
 *   pregunto_precio  · preguntó plan o precio y ya no siguió
 *   pensandolo       · dijo que lo va a ver después, que lo checa, que ahorita no
 *   dijo_no          · dijo que no le interesa o que no es para él → se propone DESCALIFICAR, no se le escribe
 *
 * Lo que sale queda como «sugerencia»: el dueño lo evalúa en Seguimiento o en la compuerta del inbox antes
 * de que salga. Si el reloj de silencio ya había dejado un mensaje genérico para ese lead y la situación pide
 * otro ángulo, se reemplaza (el viejo queda como «reemplazado», con su motivo).
 */
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey, calculateCost } from '../../ai/client';
import { leerConfig } from './motor';
import { decidirTurno, nace, avisoSistema, modeloPara } from './agente';
import { puedeAutomatico } from './semaforo';

export type Situacion = 'nunca_respondio' | 'quedo_en_demo' | 'falta_dato' | 'pregunto_precio' | 'pensandolo' | 'dijo_no' | 'otro';

export const SITUACIONES: Record<Situacion, { label: string; corto: string; comoEscribir: string }> = {
  nunca_respondio: { label: 'Nunca contestó', corto: 'Nunca contestó',
    comoEscribir: 'NUNCA te ha contestado un solo mensaje: no puedes dar por hecho que leyó lo anterior ni referirte a «lo que platicamos». Una sola pregunta, la más fácil de contestar del mundo (qué vende), enganchada a lo poco que sabemos de él (su registro, su marca, su anuncio). Sin resumir lo que ya le mandaste.' },
  quedo_en_demo: { label: 'Quiere la demo, falta info', corto: 'Quiere demo',
    comoEscribir: 'Él YA dijo que quiere ver el sistema; lo único que falta es lo necesario para agendarla. No vuelvas a venderle la demo ni a preguntarle si le interesa: retoma que quedaron en verla y pide SOLO el dato que falta, o propón directamente dos horarios si ya no falta nada.' },
  falta_dato: { label: 'Falta un dato para avanzar', corto: 'Falta dato',
    comoEscribir: 'La conversación se frenó porque falta un dato que solo él tiene. Pídelo en una línea, explicando en media línea para qué lo necesitas (que la respuesta le sirva a él), sin repetir todo el contexto.' },
  pregunto_precio: { label: 'Preguntó precio y no siguió', corto: 'Precio',
    comoEscribir: 'Preguntó por precio o plan y ya no contestó. No repitas la lista de precios: retoma con lo que hace que el precio tenga sentido para SU caso (su tamaño, su dolor) y ofrece resolver la duda concreta que suele frenar ahí. Si ya tienes giro y tamaño, puedes cerrar con la demo.' },
  pensandolo: { label: 'Dijo que lo iba a ver', corto: 'Lo va a ver',
    comoEscribir: 'Dijo que lo iba a revisar o que ahorita no. No lo presiones ni le preguntes «¿ya lo viste?». Da un motivo nuevo y concreto para retomar (algo útil de su giro) y deja la puerta abierta con una pregunta suave; si él marcó un tiempo, respétalo.' },
  dijo_no: { label: 'Dijo que no le interesa', corto: 'Dijo que no',
    comoEscribir: 'NO se le escribe.' },
  otro: { label: 'Otro', corto: 'Otro',
    comoEscribir: 'Retoma lo último que él dijo, contesta lo que haya quedado sin responder y haz una sola pregunta que mueva la conversación al siguiente paso.' },
};

/** Los leads de la ventana: le escribimos, no contestó, y llevan entre 20 h y 4 días. */
export async function cohorte(limite = 60) {
  const { data } = await supabase.from('v_ti_seguimiento_corto').select('*').limit(limite);
  return data || [];
}

async function hiloDe(contactId: string, limite = 24) {
  const { data: convs } = await supabase.from('wa_conversaciones').select('id, telefono').eq('contact_id', contactId).order('ultimo_mensaje_at', { ascending: false }).limit(2);
  let msjs: any[] = [];
  for (const cv of convs || []) {
    const { data } = await supabase.from('wa_mensajes').select('direccion, cuerpo, tipo, transcript, created_at, metadata, autor').eq('conversation_id', cv.id).is('borrado_at', null).order('created_at', { ascending: false }).limit(limite);
    msjs = msjs.concat(data || []);
  }
  msjs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const texto = msjs.map(m => `${m.direccion === 'entrante' ? 'LEAD' : ((m.metadata as any)?.origen === 'agente' ? 'AGENTE' : 'NOSOTROS')} (${String(m.created_at).slice(5, 16).replace('T', ' ')}): ${m.tipo === 'audio' ? (m.transcript ? '[audio] ' + m.transcript : '[audio sin transcripción]') : String(m.cuerpo || `[${m.tipo}]`).slice(0, 400)}`).join('\n');
  return { texto, n: msjs.length, conversationId: convs?.[0]?.id || null, telefono: convs?.[0]?.telefono || null };
}

/** Lee el hilo y dice en qué quedó: situación, qué falta, con qué ángulo retomar y si hay que descalificar. */
export async function clasificar(c: any): Promise<{ situacion: Situacion; por_que: string; falta: string | null; angulo: string; resumen: string; descalificar: boolean; confianza: number; costo: number } | null> {
  if (!hasApiKey()) return null;
  const h = await hiloDe(c.contact_id);
  if (h.n < 1) return null;
  const cfgC: any = await leerConfig().catch(() => ({}));
  const prompt = `Eres quien decide el seguimiento de un agente de ventas por WhatsApp (Sacs: sistema para tiendas de moda y retail en México). A este prospecto le escribimos nosotros al final y lleva ${c.horas_sin_respuesta} horas sin contestar.

LEAD: ${c.nombre || 'sin nombre'}${c.giro ? ` · giro: ${c.giro}` : ''} · etapa CRM: ${c.lifecycle_stage} · ${c.respondio_alguna_vez ? `nos ha contestado ${c.n_entrantes} veces` : 'NUNCA nos ha contestado un mensaje'}.

CONVERSACIÓN COMPLETA:
${h.texto.slice(0, 9000)}

Clasifica EN QUÉ QUEDÓ, no cuánto tiempo pasó. Una sola situación, la que mejor describe el último estado real:
- "nunca_respondio": nunca contestó un mensaje nuestro (aunque haya llegado por formulario, anuncio o registro).
- "quedo_en_demo": dijo que sí quiere ver el sistema o aceptó la demo, pero no se agendó porque falta algo (un dato, confirmar horario, él no volvió).
- "falta_dato": la conversación se frenó porque falta un dato concreto que solo él tiene (qué vende, cuántas tiendas, correo, cuándo decide).
- "pregunto_precio": preguntó precio, planes o costo y ya no contestó.
- "pensandolo": dijo que lo va a revisar, que lo checa, que ahorita no, que después.
- "dijo_no": dijo que no le interesa, que no es para él, que ya tiene sistema y no piensa cambiar, o pidió que no le escribamos.
- "otro": ninguna de las anteriores.

Ojo: si nunca contestó, la situación es "nunca_respondio" aunque el formulario dijera que quería una demo.

Responde SOLO JSON:
{"situacion":"...","por_que":"1 línea con la evidencia: cita textual de él si la hay","falta":"el dato exacto que falta para avanzar, o null","angulo":"con qué retomar, en 1 línea concreta y específica de ESTE lead (nada genérico)","resumen":"2 líneas de en qué quedó, para que una persona lo lea de un vistazo","descalificar":true|false,"confianza":0.0-1.0}`;
  // Hilos muy largos (o con mucho ruido) hacían que el modelo devolviera texto en vez de JSON: se reintenta una vez con menos historia.
  let j: any = null; let costo = 0;
  for (const intento of [0, 1]) {
    const p = intento === 0 ? prompt : prompt.replace(h.texto.slice(0, 9000), h.texto.slice(-3500));
    const r = await anthropic.messages.create({ model: modeloPara('clasificar', cfgC), max_tokens: 700, messages: [{ role: 'user', content: p }] });
    costo += calculateCost(MODELS.opus, (r.usage || {}) as any).cost_usd;
    const txt = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    const m = txt.match(/\{[\s\S]*\}/);
    if (m) { try { j = JSON.parse(m[0]); break; } catch { /* reintenta */ } }
  }
  if (!j?.situacion) return null;
  const situacion: Situacion = (SITUACIONES as any)[j.situacion] ? j.situacion : 'otro';
  return { situacion, por_que: String(j.por_que || '').slice(0, 400), falta: j.falta ? String(j.falta).slice(0, 200) : null, angulo: String(j.angulo || '').slice(0, 300), resumen: String(j.resumen || '').slice(0, 500), descalificar: situacion === 'dijo_no' || !!j.descalificar, confianza: Number(j.confianza) || 0, costo };
}

/**
 * Clasifica y deja listo el mensaje de cada lead de la ventana. No manda nada: todo queda como sugerencia
 * para que el dueño lo evalúe. Los «dijo que no» no reciben mensaje: se propone descalificar en la Torre.
 */
export async function generarSeguimientos(opts: { max?: number; soloContactId?: string } = {}): Promise<any> {
  const cfg: any = await leerConfig();
  if (cfg.agente_activo !== true) return { error: 'El agente está apagado' };
  if (!hasApiKey()) return { error: 'Sin API key de Anthropic' };
  const max = Math.min(Number(opts.max) || 12, 25);
  let lista = await cohorte(60);
  if (opts.soloContactId) lista = lista.filter((x: any) => x.contact_id === opts.soloContactId);
  const res: any = { revisados: 0, mensajes: 0, reemplazados: 0, descalificar: 0, sin_cambio: 0, saltados: 0, costo: 0, por_situacion: {} as Record<string, number>, errores: [] as string[] };
  const ahora = new Date();

  for (const c of lista) {
    if (res.revisados >= max) break;
    // Ya clasificado y con su mensaje esperando decisión: no se vuelve a redactar (cada pasada cuesta y lo reemplazaría por otro igual).
    if (c.envio_origen === 'seguimiento' && !opts.soloContactId) { res.sin_cambio++; continue; }
    try {
      const cl = await clasificar(c);
      if (!cl) { res.saltados++; continue; }
      res.revisados++; res.costo += cl.costo;
      res.por_situacion[cl.situacion] = (res.por_situacion[cl.situacion] || 0) + 1;

      // Dijo que no: no se le escribe. Se veta lo que hubiera en la fila y se propone descalificar en la Torre.
      if (cl.descalificar) {
        if (c.envio_id) await supabase.from('ti_envios').update({ estado: 'vetado', motivo_veto: `seguimiento: el lead ya había dicho que no (${cl.por_que.slice(0, 120)})`, updated_at: ahora.toISOString() }).eq('id', c.envio_id);
        const { data: abierta } = await supabase.from('ti_tareas').select('id').eq('contact_id', c.contact_id).eq('estado', 'pendiente').eq('tipo', 'veredicto').limit(1);
        if (!(abierta || []).length) {
          const n = String(c.nombre || 'el lead').split(/\s+/)[0];
          await supabase.from('ti_tareas').insert({ contact_id: c.contact_id, company_id: c.company_id, owner_id: c.owner_id, familia: 'decidir', tipo: 'veredicto', prioridad: 4, vence_at: ahora.toISOString(), origen: 'seguimiento', payload: {
            instruccion: `${n}: dijo que no le interesa · se sugiere descalificar`, porque: cl.por_que, nombre: c.nombre, whatsapp: c.whatsapp, sujeto: 'seguimiento', propuesta: 'descalificar',
            hechos: [['En qué quedó', cl.resumen, '', 'ambar'], ['Sin contestar', `${c.horas_sin_respuesta} h`, '']],
            resultados: { descalificar: 'Descalificar: dijo que no', seguir: 'Que siga (el agente insiste con otro ángulo)', pausar: 'Pausar hasta una fecha' },
          } });
        }
        res.descalificar++;
        await supabase.from('ia_log').insert({ accion: 'seguimiento_clasifica', contact_id: c.contact_id, razon: `${cl.situacion} · descalificar`, detalle: { ...cl, costo: undefined } }).then(() => {}, () => {});
        continue;
      }

      // Semáforo: horario, tope por lead, opt-out. La aprobación humana viene después, al evaluarlo.
      const sem = await puedeAutomatico(c.contact_id, { telefono: c.whatsapp, origen: 'seguimiento' });
      if (!sem.ok && sem.motivo !== 'pendiente_mismo_telefono') { res.saltados++; res.errores.push(`${c.nombre}: ${sem.motivo}`); continue; }

      const S = SITUACIONES[cl.situacion];
      const nota = `SEGUIMIENTO CORTO (${c.horas_sin_respuesta} h sin respuesta). Situación: ${S.label}. ${S.comoEscribir}
Lo que quedó: ${cl.resumen}
${cl.falta ? `Lo que falta: ${cl.falta}` : ''}
Ángulo para retomar: ${cl.angulo}
Es un SEGUIMIENTO, no el primer mensaje: no te presentes de nuevo, no repitas lo que ya le dijiste y no le reclames el silencio ("no me contestaste", "te escribí"). Una sola pregunta, al final.`;
      const d = await decidirTurno(c.contact_id, nota, { tarea: 'seguimiento' });
      res.costo += d.costo || 0;
      if (!d.salida?.mensaje || !d.telefono) { res.saltados++; res.errores.push(`${c.nombre}: el agente no propuso mensaje`); continue; }

      const salida = { ...d.salida, seguimiento: { situacion: cl.situacion, label: S.label, por_que: cl.por_que, falta: cl.falta, angulo: cl.angulo, resumen: cl.resumen, horas: c.horas_sin_respuesta, respondio_antes: c.respondio_alguna_vez } };
      const estado = nace(cfg, d.telefono);

      if (c.envio_id) {
        // Ya había un mensaje en la fila (casi siempre el genérico del reloj de silencio): se reemplaza por este,
        // que sí considera en qué quedó la conversación.
        await supabase.from('ti_envios').update({ estado: 'reemplazado', motivo_veto: `reemplazado por el seguimiento clasificado (${S.label})`, updated_at: ahora.toISOString() }).eq('id', c.envio_id);
        res.reemplazados++;
      }
      const { error } = await supabase.from('ti_envios').insert({
        contact_id: c.contact_id, conversation_id: d.conversationId, telefono: d.telefono, origen: 'seguimiento', estado,
        mensaje: d.salida.mensaje.trim(), imagen_id: d.salida.imagen?.id || null, imagen_url: d.salida.imagen?.url || null,
        adjuntos: d.salida.adjuntos || [], salida, sale_at: ahora.toISOString(), modelo: MODELS.opus, costo_usd: d.costo,
      });
      if (error) { res.saltados++; res.errores.push(`${c.nombre}: ${error.message}`); continue; }
      res.mensajes++;
      await supabase.from('ia_log').insert({ accion: 'seguimiento_clasifica', contact_id: c.contact_id, contenido: d.salida.mensaje, razon: `${cl.situacion} · ${c.horas_sin_respuesta} h`, costo_usd: cl.costo + (d.costo || 0), detalle: { ...cl, costo: undefined } }).then(() => {}, () => {});
    } catch (e: any) { res.errores.push(`${c.nombre || c.contact_id}: ${String(e?.message || e).slice(0, 160)}`); }
  }
  res.costo = Math.round(res.costo * 1000) / 1000;
  res.quedan = Math.max(0, lista.filter((x: any) => x.envio_origen !== 'seguimiento').length - res.revisados);
  if (res.mensajes || res.descalificar) await avisoSistema({ tipo: 'ti_seguimiento', nivel: 'info', clave: `seguimiento_corto:${ahora.toISOString().slice(0, 13)}`, titulo: `${res.mensajes} seguimientos listos para revisar${res.descalificar ? ` y ${res.descalificar} por descalificar` : ''}`, detalle: Object.entries(res.por_situacion).map(([k, n]) => `${(SITUACIONES as any)[k]?.label || k}: ${n}`).join(' · '), que_hacer: 'Trabajo inteligente → Seguimiento: cada uno trae en qué quedó la conversación.' }).catch(() => {});
  return res;
}

/** Resumen para la pantalla: cuántos hay en la ventana y cómo se reparten. */
export async function panelSeguimientoCorto() {
  const lista = await cohorte(60);
  const { data: sug } = await supabase.from('ti_envios').select('salida').eq('origen', 'seguimiento').in('estado', ['sugerencia', 'pendiente']).limit(60);
  const porSituacion: Record<string, number> = {};
  for (const s of sug || []) { const k = (s.salida as any)?.seguimiento?.situacion; if (k) porSituacion[k] = (porSituacion[k] || 0) + 1; }
  return {
    ventana: lista.length,
    sin_mensaje: lista.filter((x: any) => !x.envio_id).length,
    por_preparar: lista.filter((x: any) => x.envio_origen !== 'seguimiento').length,
    respondieron_antes: lista.filter((x: any) => x.respondio_alguna_vez).length,
    nunca_respondieron: lista.filter((x: any) => !x.respondio_alguna_vez).length,
    listos: (sug || []).length,
    por_situacion: porSituacion,
    etiquetas: Object.fromEntries(Object.entries(SITUACIONES).map(([k, v]) => [k, v.label])),
  };
}
