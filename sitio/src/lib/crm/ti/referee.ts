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
import { notaPara } from './planificador';
import { ETAPAS_SDR } from './agente';

export type Caso = {
  id: string; titulo: string; porQueLlega: string; momento: string;
  /** Cómo encontrar un lead real en este estado. */
  buscar: () => Promise<{ contactId: string; pista?: string } | null>;
  /** La instrucción con la que el flujo real llama al agente en este caso (null = ninguna). */
  nota?: string | null;
  tarea?: string;
  /** Un mensaje entrante simulado (no se guarda): para casos que dependen de lo que el lead acaba de decir. */
  simular?: string;
  /** Nota calculada como en producción (p. ej. la de contratación), a partir del lead y el mensaje simulado. */
  nota_de?: (contactId: string, simular: string) => Promise<string | null>;
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
  'Una sola pregunta, al final del mensaje (excepto el paso 0, donde los datos que faltan se piden juntos en una frase)',
  'Máximo cuatro líneas por burbuja; se lee de un vistazo en el celular',
  'Habla de tú, en registro formal y cálido, con voz femenina (es Fernanda, asesora comercial): profesional, nunca informal',
  'Si ya se sabe el giro, usa lenguaje y problemas específicos de ese giro, no genéricos (no aplica a los mensajes de cadencia: saludo del paso 5, paso 6 y despedida, que son cortos por diseño)',
];
export const SIEMPRE_NUNCA = [
  'Más de un emoji, o emoji en primer contacto o en temas de dinero',
  'Más de un signo de admiración',
  'Modismos informales: «te late», «nomás», «órale», «chido», «gacho», «va», «sale», «ahorita», «batallar», «checar», diminutivos',
  'Hablar de sí misma en masculino, o presentarse como asistente o bot',
  'Arranques tipo «¡Excelente!», «¡Claro que sí!», «Espero que estés bien», «quería darle seguimiento»',
  'Viñetas, negritas o listas de funciones (EXCEPCIÓN: la lista numerada 1. 2. 3. del paso 1, cuando ya se saben modelo, giro y sucursales)',
  'Prometer algo que no sabemos que es verdad hoy',
  'Reclamarle el silencio («no me contestaste», «te escribí y no supe de ti»)',
];

export const CASOS: Caso[] = [
  ...([] as Caso[]),
  { id: 'web_prueba', titulo: 'Llega de la web pidiendo prueba gratis', porQueLlega: 'Botón de prueba gratis en sacscloud.com', momento: 'Primer mensaje',
    buscar: () => unLeadCon(q => q.eq('fuente', 'whatsapp_web').filter('propiedades->>intencion_inicial', 'eq', 'prueba_gratis'), 'prueba gratis'),
    // Se prueba como en producción: su PRIMER mensaje simulado + la nota de intención de la web (antes se medía un seguimiento días después).
    simular: 'Hola, quiero la prueba gratis', nota_de: async (cid) => { const { notaDeIntencion } = await import('../../whatsapp/lead-entrante'); return notaDeIntencion(cid, { forzar: true }); },
    debe: ['Confirmar en media línea que sí se le da la prueba', 'Preguntar qué vende y cuántas tiendas, en un solo bloque', 'Ofrecer las dos opciones: probarlo por su cuenta o una demo con especialista de menos de una hora con sus flujos', 'Cerrar preguntando cuál de las dos prefiere'],
    nunca: ['Pedir el correo o el nombre de la tienda antes de que elija', 'Mandar precios', 'Explicar funciones que no preguntó'] },
  // ── Decisiones del dueño del 5-sep (catálogo de casos): se prueban con un mensaje simulado sobre un lead real ──
  { id: 'contratar', titulo: 'Dice que quiere contratar', porQueLlega: 'Cualquiera', momento: 'Ya decidió comprar',
    buscar: () => unLeadCon(q => q.eq('lifecycle_stage', 'lead').not('sucursales_interes', 'is', null), 'con tiendas conocidas'), simular: 'Ya lo pensé y quiero contratar, ¿cómo le hago?',
    nota_de: async (cid, sim) => { const { contratacionAntesDelTurno } = await import('./contratacion'); return contratacionAntesDelTurno(cid, sim, null, { simular: true }); },
    debe: ['Decir el total claro: mensual, y anual con el 35 % de ahorro', 'Dar las vías de pago en una línea cada una (tarjeta en /planes, transferencia, liga)', 'Pedir o confirmar el correo para el acceso', 'Preguntar cuál prefiere'],
    nunca: ['Mandarlo a demo o a llamada', 'Poner el pago como barrera o hacerlo esperar', 'Listas de funciones', 'Más de dos preguntas'] },
  { id: 'si_cualquiera', titulo: 'Dice «sí, el que sea» a los horarios', porQueLlega: 'Cualquiera', momento: 'Proponiendo: ya se le ofrecieron horarios',
    buscar: () => unLeadConEnvio('respuesta', 'con envío reciente'), simular: 'Sí, el que sea está bien',
    debe: ['Elegir UN horario real y agendarlo (accion agendar o agendar_llamada con fecha y hora)', 'Decir que ya quedó apartado ese día a esa hora y que la invitación le llega por aquí', 'Pedirle que confirme con un «va»'],
    nunca: ['Volver a preguntar qué horario prefiere', 'Ofrecer dos horarios otra vez', 'Pedir el correo antes de apartar'] },
  { id: 'socio', titulo: 'Lo tiene que ver con su socio', porQueLlega: 'Cualquiera', momento: 'Descubriendo o proponiendo',
    buscar: () => unLeadCon(q => q.eq('lifecycle_stage', 'lead'), 'con socio'), simular: 'Lo tengo que ver con mi socio, él decide eso',
    debe: ['Dar las DOS salidas en una sola pregunta: agendar cuando puedan los dos, o hacer la demo con él y mandarle la grabación al socio', 'Dejar que él elija'],
    nunca: ['Insistir en una sola de las dos', 'Dejarlo en «avísame cuando lo veas»', 'Pedir el correo del socio antes de que elija'] },
  { id: 'sin_dinero', titulo: 'Dice que se le bajó la venta', porQueLlega: 'Cualquiera', momento: 'Descubriendo',
    buscar: () => unLeadCon(q => q.eq('lifecycle_stage', 'lead'), 'sin dinero'), simular: 'Se me bajó mucho la venta, espero pronto poder',
    nota: 'EL LEAD DIJO QUE AHORA NO TIENE DINERO O QUE LA VENTA ESTÁ BAJA (Se me bajó mucho la venta, espero pronto poder). Contesta con empatía en dos líneas y SIN vender: que lo entiendes, que las temporadas flojas pasan, y que cuando repunte aquí estás para verlo con calma. Nada de demo, horarios, precios, «aprovecha» ni preguntas: este mensaje NO lleva signo de interrogación; cierra con UNA sola invitación en condicional («cuando lo veas mejor, me avisas y lo vemos»). Sin pronósticos sobre su negocio («ya repuntará», «pasará la temporada») ni consuelos genéricos («no eres el único»): reconoce lo que él dijo. Si sabes qué vende, puedes dejarle una sola idea útil y gratis para mover venta esta semana (una, concreta, sin mencionar Sacs). No se le vuelve a escribir por ahora.',
    debe: ['Empatía real en dos líneas, sin vender', 'Dejar la puerta abierta para cuando repunte', 'EXCEPCIÓN a la regla general de «una pregunta al final»: este mensaje cierra con una invitación sin signo de interrogación («me avisas y lo vemos»)'],
    nunca: ['Ofrecer demo, horarios o precios', 'Hacer preguntas', '«Aprovecha», «justo por eso», «es una inversión»'] },
  { id: 'foto', titulo: 'Mandó una foto de su tienda o producto', porQueLlega: 'Cualquiera', momento: 'Su último mensaje es una foto',
    buscar: async () => {
      const { data } = await supabase.from('wa_mensajes').select('conversation_id, created_at').eq('tipo', 'image').eq('direccion', 'entrante').is('borrado_at', null).order('created_at', { ascending: false }).limit(12);
      for (const m of data || []) {
        const { count } = await supabase.from('wa_mensajes').select('id', { count: 'exact', head: true }).eq('conversation_id', m.conversation_id).eq('direccion', 'saliente').gt('created_at', m.created_at);
        if (count) continue;   // ya le contestamos después de la foto
        const { data: cv } = await supabase.from('wa_conversaciones').select('contact_id').eq('id', m.conversation_id).maybeSingle();
        if (cv?.contact_id) return { contactId: cv.contact_id as string, pista: 'su último mensaje es una foto' };
      }
      return null;
    },
    debe: ['Mencionar UNA cosa concreta que se ve en la foto (que note que la miró)', 'Dar contexto de lo que eso dice de su negocio', 'Una pregunta sobre su tienda u operación a partir de eso'],
    nunca: ['Describir la foto entera', 'Halagos vacíos («qué bonita tienda»)', 'Ofrecer la demo en este mensaje'] },
  { id: 'web_demo', titulo: 'Llega de la web queriendo agendar demo', porQueLlega: 'Botón de demo en el sitio', momento: 'Primer mensaje',
    buscar: () => unLeadCon(q => q.eq('fuente', 'whatsapp_web').filter('propiedades->>intencion_inicial', 'eq', 'demo'), 'demo'),
    simular: 'Hola, me gustaría agendar una demo', nota_de: async (cid) => { const { notaDeIntencion } = await import('../../whatsapp/lead-entrante'); return notaDeIntencion(cid, { forzar: true }); },
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
    debe: ['Demostrar en una línea que entendió su situación', 'Preguntar de forma amable si le gustaría que un consultor se lo enseñe con sus productos (sí o no, SIN horarios); si él ya había dicho que sí, entonces dos horarios concretos'],
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

/** Un lead en alcance cuya última pieza del hilo es NUESTRA (callado): el estado en que trabaja el planificador. */
const unLeadCallado = async (filtro: (c: any) => boolean, pista = '') => {
  const { data } = await supabase.from('wa_conversaciones').select('contact_id, alerta, ultimo_mensaje_at, contacts!inner(id, nombre, lifecycle_stage, giro, modelo_negocio, sucursales_interes, fuente, archived_at)')
    .not('contact_id', 'is', null).eq('ultima_direccion', 'saliente').is('alerta', null).order('ultimo_mensaje_at', { ascending: false }).limit(120);
  for (const v of data || []) {
    const c: any = (v as any).contacts; if (!c || c.archived_at || !ETAPAS_SDR.includes(String(c.lifecycle_stage || ''))) continue;
    if (filtro(c)) return { contactId: c.id as string, pista: `${c.nombre || 's/n'} · ${pista}` };
  }
  return null;
};
const conDatos = (c: any) => !!(c.modelo_negocio && c.giro && Number(c.sucursales_interes));
const ESC = { hayEstaSemana: true, nombre: null as string | null };

/* ── LA ESCALERA (11-sep): un caso por paso del flujo v2, con la MISMA nota que usa el planificador ── */
const CASOS_ESCALERA: Caso[] = [
  { id: 'esc_p0', titulo: 'Paso 0: le pedimos sus datos y no contestó', porQueLlega: 'Cualquiera', momento: 'Planificador, faltan modelo de negocio/giro/sucursales',
    buscar: () => unLeadCallado(c => !conDatos(c), 'sin datos'), nota: notaPara('paso0', { n: 1, ...ESC }), tarea: 'silencio',
    debe: ['Pide SOLO lo que falta (modelo de negocio, giro o sucursales), distinto a como se pidió antes', 'Ofrece el audio', 'Interés genuino, sin prisa'],
    nunca: ['Hablar de Sacs, funciones o demo', 'Dar por hecho que el lead escribió o volvió', 'Reclamar el silencio'] },
  { id: 'esc_nunca_escribio', titulo: 'Nunca ha escrito por WhatsApp (llegó por formulario)', porQueLlega: 'Formulario web/TikTok', momento: 'Planificador, primer toque sin respuesta',
    buscar: async () => { const { data } = await supabase.from('wa_conversaciones').select('contact_id, contacts!inner(id, nombre, lifecycle_stage, archived_at)').is('ultimo_entrante_at', null).is('alerta', null).eq('ultima_direccion', 'saliente').order('ultimo_mensaje_at', { ascending: false }).limit(60);
      for (const v of data || []) { const c: any = (v as any).contacts; if (c && !c.archived_at && ETAPAS_SDR.includes(String(c.lifecycle_stage || ''))) return { contactId: c.id, pista: `${c.nombre || 's/n'} · nunca escribió` }; } return null; },
    nota: notaPara('paso0', { n: 1, ...ESC }), tarea: 'silencio',
    debe: ['Toma la iniciativa como quien escribe por primera vez de nuevo', 'Pide los datos que faltan y ofrece el audio'],
    nunca: ['«Qué gusto que me escribas», «gracias por tu mensaje» o cualquier frase que dé por hecho que él escribió', 'Contestar preguntas que no hizo'] },
  { id: 'esc_p1', titulo: 'Paso 1: ya dio los tres datos, tocan la novedad y los puntos', porQueLlega: 'Cualquiera', momento: 'Acaba de contestar modelo, giro y tiendas',
    buscar: () => unLeadCallado(c => /ropa|calzado|zapat|uniform|boutique|moda/i.test(String(c.giro || '')), 'con giro'),
    simular: 'Sí, es tienda de ropa, manejamos varias marcas y tenemos dos sucursales', tarea: 'respuesta',
    debe: ['PRIMERO la novedad del catálogo automático con IA', 'Lista numerada 1. 2. 3. (máximo 5) con puntos de SU combinación (multimarca, dos tiendas)', 'Cierra con UNA pregunta abierta: qué quiere resolver hoy'],
    nunca: ['Ofrecer demo, reunión u horarios (salvo que el lead ya hubiera pedido la demo antes; entonces sí van los horarios)', 'Puntos genéricos que valdrían para cualquier negocio', 'Más de una pregunta'] },
  { id: 'esc_p2', titulo: 'Paso 2: dijo qué le cuesta trabajo', porQueLlega: 'Cualquiera', momento: 'Acaba de contar su problema',
    buscar: () => unLeadCallado(c => conDatos(c) || !!c.giro, 'con datos'),
    simular: 'Somos tienda multimarca de ropa con dos sucursales. Lo que más me cuesta es saber qué me falta en cada tienda, siempre me quedo sin las tallas que sí se venden y me sobran las que no', tarea: 'respuesta',
    debe: ['Explica cómo Sacs resuelve EXACTAMENTE eso, con un ejemplo de su producto (tallas, tiendas)', 'Pregunta si hay otro tema que quiera resolver («entre más detalle, más específica la reunión»)'],
    nunca: ['Ofrecer horarios', 'Cambiar de tema a otra función que no pidió', 'Más de dos burbujas'] },
  { id: 'esc_oferta_escasez', titulo: 'Paso 5, día 1: variante escasez', porQueLlega: 'Cualquiera', momento: 'Ayer se le hizo la oferta (demo o prueba) y calló',
    buscar: () => unLeadCallado(c => conDatos(c) || !!c.giro, 'tras la oferta'), nota: notaPara('oferta', { n: 0, variante: 'escasez', escasez: 2, ...ESC }), tarea: 'silencio',
    debe: ['Pregunta si aún le interesa', 'Dice que espera su confirmación para agendar y que el consultor tiene 2 horarios esta semana', 'Corto'],
    nunca: ['Listar horarios concretos', 'Repetir la oferta completa', 'Presionar con tono de urgencia falsa'] },
  { id: 'esc_oferta_novedad', titulo: 'Paso 5, día 1: variante novedad del giro', porQueLlega: 'Cualquiera', momento: 'Ayer se le hizo la oferta y calló',
    buscar: () => unLeadCallado(c => /ropa|calzado|zapat|uniform/i.test(String(c.giro || '')), 'tras la oferta'), nota: notaPara('oferta', { n: 0, variante: 'novedad', escasez: 2, giroTxt: 'ropa', ...ESC }), tarea: 'silencio',
    debe: ['Algo NUEVO del sistema para su giro (p. ej. el catálogo automático con IA)', 'Cierra preguntando si aún le interesa verlo o prefiere en otra ocasión'],
    nunca: ['Horarios', 'Repetir puntos ya dichos', 'Más de cuatro líneas'] },
  { id: 'esc_oferta_saludo', titulo: 'Paso 5, día 1: variante solo saludo', porQueLlega: 'Cualquiera', momento: 'Ayer se le hizo la oferta y calló',
    buscar: () => unLeadCallado(c => true, 'tras la oferta'), nota: notaPara('oferta', { n: 0, variante: 'saludo', escasez: 2, ...ESC }), tarea: 'silencio',
    debe: ['SOLO un saludo cálido y corto con su nombre'],
    nunca: ['Cualquier pregunta de negocio', 'Mencionar reunión, demo, prueba o Sacs', 'Más de una línea'] },
  { id: 'esc_oferta_dia2', titulo: 'Paso 5, día 2: presión suave con horarios reales', porQueLlega: 'Cualquiera', momento: 'Dos días callado tras la oferta',
    buscar: () => unLeadCallado(c => conDatos(c) || !!c.giro, 'día 2'), nota: notaPara('oferta', { n: 1, escasez: 2, ...ESC }), tarea: 'silencio',
    debe: ['Dice que el consultor aún tiene 2 horarios disponibles esta semana', 'Pregunta si quiere que le aparte uno', 'Cordial, sin reproche'],
    nunca: ['Inventar horarios concretos que no vienen en la agenda', 'Tono de reclamo', 'Repetir la oferta completa'] },
  { id: 'esc_p6', titulo: 'Paso 6: dos toques sin respuesta', porQueLlega: 'Cualquiera', momento: 'Planificador, sigue sin responder',
    buscar: () => unLeadCallado(c => true, 'dos toques'), nota: notaPara('paso6', { n: 2, ...ESC }), tarea: 'silencio',
    debe: ['«espero que vaya todo bien» y preguntar si aún es de su interés o prefiere retomarlo más adelante', 'Nada más: máximo dos líneas'],
    nunca: ['Hablar de funciones o novedades', 'Horarios', 'Dar por hecho que escribió'] },
  { id: 'esc_despedida', titulo: 'Paso 7: despedida cordial', porQueLlega: 'Cualquiera', momento: 'Último mensaje antes de descalificar',
    buscar: () => unLeadCallado(c => true, 'despedida'), nota: notaPara('despedida', { n: 3, ...ESC }), tarea: 'silencio',
    debe: ['Será un gusto atenderle cuando esté lista y por aquí queda a la orden', 'Sin pregunta', 'Máximo dos líneas'],
    nunca: ['Reproche o presión', 'Oferta, horarios o descuentos', 'Pregunta final'] },
];

CASOS.push(...CASOS_ESCALERA);

async function juez(caso: Caso, mensaje: string, contexto: string) {
  const debe = [...caso.debe, ...SIEMPRE_DEBE].map((x, i) => `${i + 1}. ${x}`).join('\n');
  const nunca = [...caso.nunca, ...SIEMPRE_NUNCA].map((x, i) => `${i + 1}. ${x}`).join('\n');
  const r: any = await anthropic.messages.create({ proposito: 'lib/crm/ti/referee.ts:217', model: MODELS.opus, max_tokens: 1600, messages: [{ role: 'user', content: `Eres el árbitro de calidad del agente de ventas de Sacs (sistema para tiendas de moda en México, se vende por WhatsApp). Tu trabajo es ser exigente: un 10 significa que NO se le puede mejorar nada.

CASO: ${caso.titulo}. Por dónde llega: ${caso.porQueLlega}. Momento: ${caso.momento}.
CONTEXTO DEL LEAD (lo que dice el CRM es VERDAD: nombres de persona y de tienda, correo, tiendas, y las promociones con fecha que el agente menciona vienen del CRM; no lo marques como inventado): ${contexto.slice(0, 1400)}

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
  if (!j.nota) throw new Error(`el juez no devolvió nota legible: stop=${r.stop_reason} tipos=${(r.content || []).map((b: any) => b.type).join(',')} texto=${t.slice(0, 160)}`);
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
      const notaCaso = caso.nota_de && caso.simular ? await caso.nota_de(encontrado.contactId, caso.simular).catch(() => null) : null;
      const d = await decidirTurno(encontrado.contactId, notaCaso || caso.nota || undefined, { tarea: caso.tarea || 'respuesta', simularEntrante: caso.simular });
      costo += d.costo || 0;
      if (!d.salida?.mensaje) { res.push({ id: caso.id, titulo: caso.titulo, nota: null, motivo: `el agente no propuso mensaje (${d.motivo || 'sin motivo'})` }); continue; }
      const { data: k } = await supabase.from('contacts').select('nombre, email, giro, sucursales_interes, companies(nombre, nombre_comercial)').eq('id', encontrado.contactId).maybeSingle();
      const co: any = (k as any)?.companies || {};
      const crm = k ? `CRM: persona «${k.nombre || '?'}», tienda/empresa «${co.nombre_comercial || co.nombre || 'desconocida'}», correo ${k.email ? 'SÍ lo tenemos' : 'no lo tenemos'}, giro ${k.giro || 'desconocido'}, tiendas ${k.sucursales_interes ?? 'desconocido'}` : '';
      const j = await juez(caso, d.salida.mensaje, `${crm} · ${encontrado.pista || ''} · etapa ${d.salida.estado} · último del lead: ${String(d.salida.ultimo_mensaje || '').slice(0, 300)}`);
      costo += j.costo;
      res.push({ id: caso.id, titulo: caso.titulo, momento: caso.momento, lead: encontrado.pista, nota: j.nota, mensaje: d.salida.mensaje, faltantes: j.faltantes, violaciones: j.violaciones, para10: j.para10, regla: j.regla });
    } catch (e: any) { res.push({ id: caso.id, titulo: caso.titulo, nota: null, motivo: String(e?.message || e).slice(0, 140) }); }
  }
  const con = res.filter(r => r.nota !== null);
  return { casos: res, resumen: { evaluados: con.length, sin_caso: res.length - con.length, promedio: con.length ? +(con.reduce((s, r) => s + r.nota, 0) / con.length).toFixed(2) : null, dieces: con.filter(r => r.nota === 10).length, bajo_8: con.filter(r => r.nota < 8).length }, costo: +costo.toFixed(3) };
}
