/**
 * EL ÁRBITRO (decisión del dueño, 2026-09-04): «que siempre sea el mejor mensaje posible».
 *
 * Un catálogo de los casos REALES por los que llega y se sigue a un lead, cada uno con criterios de aceptación
 * explícitos. Para cada caso se toma un lead de verdad, se corre el agente TAL CUAL corre en producción y un juez
 * califica el mensaje contra esos criterios: 10 solo si los cumple todos. Lo que no llega a 10 se reporta con el
 * hueco exacto, para arreglarlo con una regla o con el guion (y volver a correr).
 *
 * No inventa conversaciones: si no hay un lead real en ese estado, el caso queda «sin caso» y se dice.
 */
import { supabase } from '../../supabase';
import { anthropic, MODELS, hasApiKey, calculateCost } from '../../ai/client';
import { decidirTurno } from './agente';

export type Caso = {
  id: string; titulo: string; porQueLlega: string; momento: string;
  /** Cómo encontrar un lead real en este estado. */
  buscar: () => Promise<{ contactId: string; pista?: string } | null>;
  /** La instrucción con la que el flujo real llama al agente en este caso (null = ninguna). */
  nota?: string | null;
  tarea?: string;
  /** Lo que el mensaje DEBE tener. */
  debe: string[];
  /** Lo que NO puede tener. */
  nunca: string[];
};

const unLeadCon = async (filtro: (q: any) => any, pista = '') => {
  const q = filtro(supabase.from('contacts').select('id, nombre, lifecycle_stage, fuente, propiedades'));
  const { data } = await q.limit(5);
  for (const c of data || []) {
    const { count } = await supabase.from('wa_conversaciones').select('id', { count: 'exact', head: true }).eq('contact_id', c.id);
    if (count) return { contactId: c.id, pista: `${c.nombre || 's/n'} · ${pista}` };
  }
  return null;
};
const unLeadConEnvio = async (origen: string, pista = '') => {
  const { data } = await supabase.from('ti_envios').select('contact_id').eq('origen', origen).not('contact_id', 'is', null).order('created_at', { ascending: false }).limit(5);
  const id = (data || [])[0]?.contact_id;
  return id ? { contactId: id as string, pista } : null;
};

/* ── Reglas que valen para TODOS los mensajes (del guion) ── */
export const SIEMPRE_DEBE = [
  'Una sola pregunta, al final del mensaje',
  'Máximo cuatro líneas por burbuja; se lee de un vistazo en el celular',
  'Habla de tú, como habla la gente de tiendas en México',
];
export const SIEMPRE_NUNCA = [
  'Emojis',
  'Signos de admiración',
  'Arranques tipo «¡Excelente!», «¡Claro que sí!», «Espero que estés bien», «quería darle seguimiento»',
  'Viñetas, numeración, negritas o listas de funciones',
  'Prometer algo que no sabemos que es verdad hoy',
  'Reclamarle el silencio («no me contestaste», «te escribí y no supe de ti»)',
];

export const CASOS: Caso[] = [
  { id: 'web_prueba', titulo: 'Llega de la web pidiendo prueba gratis', porQueLlega: 'Botón de prueba gratis en sacscloud.com', momento: 'Primer mensaje',
    buscar: () => unLeadCon(q => q.eq('fuente', 'whatsapp_web').filter('propiedades->>intencion_inicial', 'eq', 'prueba_gratis'), 'prueba gratis'),
    debe: ['Confirmar en media línea que sí se le da la prueba', 'Preguntar qué vende y cuántas tiendas, en un solo bloque', 'Ofrecer las dos opciones: probarlo por su cuenta o una demo con especialista de menos de una hora con sus flujos', 'Cerrar preguntando cuál de las dos prefiere'],
    nunca: ['Pedir el correo o el nombre de la tienda antes de que elija', 'Mandar precios', 'Explicar funciones que no preguntó'] },
  { id: 'web_demo', titulo: 'Llega de la web queriendo agendar demo', porQueLlega: 'Botón de demo en el sitio', momento: 'Primer mensaje',
    buscar: () => unLeadCon(q => q.eq('fuente', 'whatsapp_web').filter('propiedades->>intencion_inicial', 'eq', 'demo'), 'demo'),
    debe: ['Confirmar que se le agenda', 'Preguntar qué vende y cuántas tiendas para que la demo sea con lo suyo', 'Dejar claro que la demo dura menos de una hora y es con sus propios flujos'],
    nunca: ['Volver a venderle la demo como si no la hubiera pedido', 'Pedir tres datos a la vez'] },
  { id: 'form_tiktok', titulo: 'Llega por formulario de TikTok', porQueLlega: 'Anuncio de TikTok (la fuente número uno: 86 leads)', momento: 'Primer contacto, nunca ha escrito',
    buscar: () => unLeadCon(q => q.eq('fuente', 'tiktok-lead-form'), 'TikTok'),
    debe: ['Presentarse en media línea', 'Decir en una línea qué es Sacs con palabras de tienda, no «software»', 'Una pregunta muy fácil de contestar, la más fácil posible'],
    nunca: ['Referirse a «lo que platicamos» o «tu mensaje» (nunca escribió)', 'Dar por hecho que sabe qué es Sacs'] },
  { id: 'descubriendo', titulo: 'Contestó y falta saber de su negocio', porQueLlega: 'Cualquiera', momento: 'Descubriendo',
    buscar: () => unLeadCon(q => q.eq('lifecycle_stage', 'lead'), 'descubriendo'),
    debe: ['Contestar primero lo que él preguntó, si preguntó algo', 'Una sola pregunta de descubrimiento, anclada en algo que él ya dijo'],
    nunca: ['Pedir un bloque de tres datos', 'Ofrecer la demo sin saber giro, tamaño y al menos una necesidad'] },
  { id: 'proponiendo', titulo: 'Ya sabemos giro y tamaño: toca proponer', porQueLlega: 'Cualquiera', momento: 'Proponiendo',
    buscar: () => unLeadCon(q => q.eq('lifecycle_stage', 'oportunidad'), 'proponiendo'),
    debe: ['Demostrar en una línea que entendimos su situación, con algo concreto que él dijo', 'Proponer el siguiente paso con dos horarios concretos'],
    nunca: ['Proponer la demo si no dio ninguna señal de interés en su último mensaje', 'Repetir la lista de funciones'] },
  { id: 'seg_corto', titulo: 'Le escribimos y lleva 1 a 4 días sin contestar', porQueLlega: 'Cualquiera', momento: 'Seguimiento corto',
    buscar: () => unLeadConEnvio('seguimiento', '1-4 días'),
    nota: 'SEGUIMIENTO CORTO. Retoma en qué quedó la conversación y haz UNA sola pregunta.', tarea: 'seguimiento',
    debe: ['Retomar en qué quedó, con algo concreto de él', 'Una pregunta fácil de contestar'],
    nunca: ['Reclamarle el silencio', 'Repetir el mensaje anterior', 'Insistir con la demo si ya se le ofreció y no la tomó'] },
  { id: 'reenganche', titulo: 'Lleva semanas en silencio', porQueLlega: 'Cualquiera', momento: 'Reloj de silencio',
    buscar: () => unLeadConEnvio('reenganche', 'semanas'),
    nota: 'TOQUE DE SILENCIO: retómalo con otro ángulo, en una línea.', tarea: 'silencio',
    debe: ['Un ángulo NUEVO, distinto al del mensaje anterior', 'Una sola línea; cabe dentro de una plantilla'],
    nunca: ['Reclamarle el silencio', 'Repetir el ángulo anterior', 'Sonar a mensaje masivo'] },
  { id: 'reactivacion', titulo: 'Preguntó hace meses y se enfrió', porQueLlega: 'Cualquiera', momento: 'Reactivación 60-365 días',
    buscar: () => unLeadConEnvio('reactivacion', 'meses'),
    nota: 'REACTIVACIÓN: pasaron meses. Reconoce el tiempo con un hecho concreto, retoma SU pregunta y da una novedad que le sirva.', tarea: 'reactivacion',
    debe: ['Reconocer el tiempo con un hecho concreto («en tu mensaje de mayo»), no con vaguedades', 'Retomar su pregunta original con sus palabras', 'Una novedad real que le sirva a esa pregunta'],
    nunca: ['Disculparse de más', 'Sonar a campaña', 'Ofrecer la demo de entrada'] },
  { id: 'agendada', titulo: 'Ya tiene demo agendada y escribe', porQueLlega: 'Cualquiera', momento: 'Agendada',
    buscar: () => unLeadCon(q => q.eq('lifecycle_stage', 'oportunidad'), 'con cita'),
    nota: 'El lead YA tiene su demo agendada y acaba de escribir. Contesta solo lo que preguntó.', tarea: 'respuesta',
    debe: ['Contestar únicamente lo que preguntó y cortar ahí', 'Un solo mensaje corto'],
    nunca: ['Repetir los datos de la cita si no los pidió', 'Agregar beneficios o cierres de cortesía'] },
  { id: 'dijo_no', titulo: 'Dijo que no le interesa', porQueLlega: 'Cualquiera', momento: 'Descalificación',
    buscar: () => unLeadCon(q => q.eq('lifecycle_stage', 'rezagado'), 'dijo que no'),
    nota: 'El lead dijo claramente que NO le interesa o que no es para él.', tarea: 'respuesta',
    debe: ['Aceptarlo sin insistir', 'Dejar la puerta abierta en una línea, sin condiciones', 'Cerrar sin pedir nada'],
    nunca: ['Intentar rebatir la objeción', 'Ofrecer demo, prueba o descuento', 'Preguntar por qué no'] },
];

async function juez(caso: Caso, mensaje: string, contexto: string) {
  const debe = [...caso.debe, ...SIEMPRE_DEBE].map((x, i) => `${i + 1}. ${x}`).join('\n');
  const nunca = [...caso.nunca, ...SIEMPRE_NUNCA].map((x, i) => `${i + 1}. ${x}`).join('\n');
  const r: any = await anthropic.messages.create({ model: MODELS.opus, max_tokens: 1600, messages: [{ role: 'user', content: `Eres el árbitro de calidad del agente de ventas de Sacs (sistema para tiendas de moda en México, se vende por WhatsApp). Tu trabajo es ser exigente: un 10 significa que NO se le puede mejorar nada.

CASO: ${caso.titulo}. Por dónde llega: ${caso.porQueLlega}. Momento: ${caso.momento}.
CONTEXTO DEL LEAD: ${contexto.slice(0, 1200)}

EL MENSAJE QUE ESCRIBIÓ EL AGENTE:
«${mensaje}»

DEBE CUMPLIR TODO ESTO:
${debe}

Y NO PUEDE TENER NADA DE ESTO:
${nunca}

Califica del 1 al 10. Baja un punto por cada «debe» que falte y dos por cada «nunca» que aparezca. Un 10 solo si cumple todo y además el mensaje da ganas de contestar.

Responde SOLO JSON: {"nota": n, "faltantes": ["los «debe» que no cumple, textual"], "violaciones": ["los «nunca» que sí aparecen, textual"], "que_le_falta_para_10": "1 línea concreta y accionable", "regla_sugerida": "si el fallo se repetiría en otros leads, la regla que lo evitaría; si no, vacío"}` }] });
  const t = (r.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  const m = t.match(/\{[\s\S]*\}/); let j: any = {}; try { j = m ? JSON.parse(m[0]) : {}; } catch { /* nada */ }
  if (!j.nota) { const m2 = t.match(/"nota"\s*:\s*(\d+(?:\.\d+)?)/); if (m2) j.nota = Number(m2[1]); }
  if (!j.nota) throw new Error(`el juez no devolvió nota legible: ${t.slice(0, 120)}`);
  return { nota: Number(j.nota) || 0, faltantes: j.faltantes || [], violaciones: j.violaciones || [], para10: j.que_le_falta_para_10 || '', regla: j.regla_sugerida || '', costo: calculateCost(MODELS.opus, r.usage as any).cost_usd };
}

export async function correrReferee(soloIds?: string[]) {
  if (!hasApiKey()) return { error: 'Sin API key' };
  const casos = soloIds?.length ? CASOS.filter(c => soloIds.includes(c.id)) : CASOS;
  const res: any[] = []; let costo = 0;
  for (const caso of casos) {
    const encontrado = await caso.buscar().catch(() => null);
    if (!encontrado) { res.push({ id: caso.id, titulo: caso.titulo, nota: null, motivo: 'sin lead real en ese estado' }); continue; }
    try {
      const d = await decidirTurno(encontrado.contactId, caso.nota || undefined, { tarea: caso.tarea || 'respuesta' });
      costo += d.costo || 0;
      if (!d.salida?.mensaje) { res.push({ id: caso.id, titulo: caso.titulo, nota: null, motivo: `el agente no propuso mensaje (${d.motivo || 'sin motivo'})` }); continue; }
      const j = await juez(caso, d.salida.mensaje, `${encontrado.pista || ''} · etapa ${d.salida.estado} · último del lead: ${String(d.salida.ultimo_mensaje || '').slice(0, 300)}`);
      costo += j.costo;
      res.push({ id: caso.id, titulo: caso.titulo, momento: caso.momento, lead: encontrado.pista, nota: j.nota, mensaje: d.salida.mensaje, faltantes: j.faltantes, violaciones: j.violaciones, para10: j.para10, regla: j.regla });
    } catch (e: any) { res.push({ id: caso.id, titulo: caso.titulo, nota: null, motivo: String(e?.message || e).slice(0, 140) }); }
  }
  const con = res.filter(r => r.nota !== null);
  return { casos: res, resumen: { evaluados: con.length, sin_caso: res.length - con.length, promedio: con.length ? +(con.reduce((s, r) => s + r.nota, 0) / con.length).toFixed(2) : null, dieces: con.filter(r => r.nota === 10).length, bajo_8: con.filter(r => r.nota < 8).length }, costo: +costo.toFixed(3) };
}
