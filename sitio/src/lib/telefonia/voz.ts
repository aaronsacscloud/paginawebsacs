// FERNANDA AL TELÉFONO · el cerebro del CRM para la central de voz.
//
// La central (voz/server.mjs, en sacs-dev-01) es tonta y rápida: recibe lo
// que dice el contacto ya transcrito, le pide a Claude la respuesta y se la
// manda a Twilio para que la diga. TODO lo que sabe lo saca de aquí:
//   contexto      → el system prompt por capas + las herramientas + el saludo
//   turno         → cada frase dicha (del contacto o de Fernanda) entra a
//                   `oido` y pasa por los mismos oídos del marcador (máquina,
//                   portero, persona)
//   herramienta   → horarios, agendar, guardar dato, pasar a humano, no llamar
//   fin           → métricas de la llamada (latencias, tokens, costo)
// El item del marcador se cierra como cualquier otro: `procesarEstado` con el
// `completed` de Twilio y el cierre con IA (`cierre.ts`) leen `oido`.
import crypto from 'node:crypto';
import { supabase } from '../supabase';
import { juzgar, type Oido } from './oidos';
import { BASE, getSesion, alVeredicto, reglasAprendidas, escapar, latir } from './marcador';
import { ladaDe, zonaDeLada, horaLocal } from './zonas';
import { guionActual, reglasVigentes } from '../crm/ti/guion-datos';
import { contextoParaLead } from '../crm/ti/conocimiento';
import { horariosParaDemo, etiquetaHorario } from '../crm/ti/agenda-agente';
import { aplicarDatos, CAMPOS_LEAD } from '../crm/ti/datos-lead';

const ENV: any = (import.meta as any).env || process.env;
export const VOZ_SECRET = String(ENV.VOZ_SECRET || '').trim();
export const VOZ_CENTRAL_URL = String(ENV.VOZ_CENTRAL_URL || 'https://code.sacscloud.com/voz').replace(/\/$/, '');
export const VOZ_WS_URL = String(ENV.VOZ_WS_URL || 'wss://code.sacscloud.com/voz/ws');
export const vozConfigurada = () => !!VOZ_SECRET;
const ahora = () => new Date().toISOString();
const ms = (iso?: string | null) => (iso ? Date.now() - new Date(iso).getTime() : 0);
export const MODOS = ['manual', 'ia', 'asistido'] as const;
export type Modo = typeof MODOS[number];

/** El token que va en el TwiML: la central lo verifica en el `setup` (mismo cálculo en voz/crm.mjs). */
export const tokenVoz = (item: string) => crypto.createHmac('sha256', VOZ_SECRET).update(`voz:${item}`).digest('hex').slice(0, 32);
export const secretoValido = (auth: string | null) => {
  if (!VOZ_SECRET || !auth) return false;
  const t = auth.replace(/^Bearer\s+/i, '');
  try { return t.length === VOZ_SECRET.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(VOZ_SECRET)); } catch { return false; }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1 · CONFIGURACIÓN (Configuración → Telefonía → Fernanda)
// ─────────────────────────────────────────────────────────────────────────────
export type ConfigVoz = {
  encendida: boolean;
  voz: string;               // ElevenLabs voiceId (vía Twilio)
  modelo_tts: string;        // flash_v2_5 · turbo_v2_5 …
  stt: string;               // nova-3-general · nova-2-general
  anexo: string;             // instrucciones extra del dueño para la voz
  revelar_ia: boolean;       // si preguntan «¿eres un robot?»: decir que es asistente virtual
  discovery_min: number;     // duración de la llamada discovery que agenda
  tope_dia_usd: number;      // freno de gasto por día (IA + Twilio)
  max_min_llamada: number;
};
/** Voces de ElevenLabs que suenan a mujer mexicana (se piden a Twilio por id). El dueño elige con el oído. */
export const VOCES: { id: string; nombre: string; nota: string }[] = [
  { id: 'm7yTemJqdIqrcNleANfX', nombre: 'Ana María', nota: 'Cálida y clara, ritmo natural de llamada. La que viene por omisión.' },
  { id: '9Godp7dNohUvXk6qp0gS', nombre: 'Regina', nota: 'Más joven y ágil; suena a atención a clientes.' },
  { id: 'ewn5JTa3lNPY8QVuZJi6', nombre: 'Ana Sofía', nota: 'Grave y pausada; suena a consultora.' },
];

export const CONFIG_VOZ_BASE: ConfigVoz = {
  encendida: true, voz: 'm7yTemJqdIqrcNleANfX', modelo_tts: 'flash_v2_5', stt: 'nova-3-general', anexo: '',
  revelar_ia: true, discovery_min: 15, tope_dia_usd: 60, max_min_llamada: 12,
};
let cacheCfg: { at: number; v: ConfigVoz } | null = null;
export async function configVoz(fresco = false): Promise<ConfigVoz> {
  if (!fresco && cacheCfg && Date.now() - cacheCfg.at < 60e3) return cacheCfg.v;
  const { data } = await supabase.from('tel_voz_config').select('*').eq('id', 1).maybeSingle();
  const v = { ...CONFIG_VOZ_BASE, ...((data?.config as any) || {}) };
  cacheCfg = { at: Date.now(), v };
  return v;
}
export async function guardarConfigVoz(cambios: Partial<ConfigVoz>) {
  const v = { ...(await configVoz(true)), ...cambios };
  await supabase.from('tel_voz_config').upsert({ id: 1, config: v, updated_at: ahora() });
  cacheCfg = null;
  return v;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · EL TWIML: la pata del contacto se conecta a la central en vez de a la sala
// ─────────────────────────────────────────────────────────────────────────────
export async function twimlRelay(it: any, s: any) {
  const cfg = await configVoz();
  const saludo = String(it.apertura || `Hola, ${s.presentacion_nombre ? `soy ${s.presentacion_nombre}` : 'le llamo de Sacscloud'}.`);
  const voz = `${cfg.voz}-${cfg.modelo_tts}-1.0_0.5_0.8`;
  const action = `${BASE}/api/telefonia/marcador/relay-fin?item=${it.id}`;
  const params = { item: it.id, token: tokenVoz(it.id), sesion: s.id, modo: s.modo || 'ia', saludo };
  return `<Connect action="${escapar(action)}" method="POST"><ConversationRelay url="${escapar(VOZ_WS_URL)}" welcomeGreeting="${escapar(saludo)}" welcomeGreetingInterruptible="true" ` +
    `language="es-MX" ttsProvider="ElevenLabs" voice="${escapar(voz)}" transcriptionProvider="Deepgram" speechModel="${escapar(cfg.stt)}" ` +
    `interruptible="any" interruptSensitivity="medium" hints="Sacs, Sacscloud, apartado, consignación, tallas, punto de venta, Fernanda" elevenlabsTextNormalization="on">` +
    Object.entries(params).map(([k, v]) => `<Parameter name="${k}" value="${escapar(String(v))}"/>`).join('') +
    `</ConversationRelay></Connect>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · EL GUION DE VOZ (lo que cambia respecto al WhatsApp: es una llamada)
// ─────────────────────────────────────────────────────────────────────────────
export const GUION_VOZ = `
QUIÉN ERES
Eres FERNANDA, asesora comercial de Sacscloud (software para tiendas de moda, calzado y joyería en México). Estás EN UNA LLAMADA TELEFÓNICA que tú hiciste. Lo que escribas se convierte en voz al instante, así que hablas, no escribes.

CÓMO HABLAS (es una llamada, no un chat)
- Frases cortas. Una idea por turno. Máximo dos o tres oraciones y luego te callas para que la otra persona hable. Nunca listas, nunca numerar, nunca markdown, nunca emojis.
- Empiezas de USTED («¿cómo está?», «¿le parece?»). Si la persona te habla de tú, cambias a tú y te quedas ahí.
- Tono: cálido, tranquilo, segura de lo que sabes, con acento y palabras de México. Como una asesora que de verdad conoce tiendas, no una vendedora con prisa. Sin urgencia, sin «aprovecha», sin insistir.
- PROHIBIDO: «te late», «nomás», «órale», «chido», «va», «sale», «ahorita», «checar», «lana», «qué onda», «neta», diminutivos («ratito», «tantito»). Di «¿le parece bien?», «solo», «de acuerdo», «perfecto», «en este momento», «revisar».
- Los números se dicen con palabras («quince minutos», «cuatro de la tarde», «dos mil pesos»). Las horas siempre con «de la mañana» o «de la tarde».
- Si te interrumpen, te callas y escuchas. Si no entendiste, pides que lo repita con naturalidad («perdón, no le escuché bien, ¿me lo repite?»). Si te preguntan algo que no sabes, lo dices y ofreces que el consultor lo vea con él.
- Te presentaste UNA vez en el saludo (ya lo dijiste); no lo repitas. No digas «como te comentaba».
- Reconoce lo que te dijo en una frase antes de contestar. Agradece cuando te da un dato.

QUÉ VAS A LOGRAR EN ESTA LLAMADA (en orden, sin correr)
1. Confirmar que hablas con la persona correcta (o con quien decide sobre el sistema de la tienda). Si contesta otra persona: pregunta si está o cuándo se le puede llamar; si no está, agradece y cuelga.
2. Decir en una frase por qué llamas (el motivo viene en el expediente). Preguntar si tiene un momento. Si no, pregunta cuándo le marcas y cuelga.
3. Entender su negocio con preguntas de una en una: qué vende, si maneja varias marcas o marca propia, cuántas sucursales, cómo lleva hoy su inventario y sus ventas. Con lo que te cuente, di cómo Sacs le resuelve ESO, con un ejemplo con su producto.
4. Cuando muestre interés (o cuando ya le ayudaste con algo): ofrecer la reunión con un consultor para verlo con sus productos. Primero pregunta si le interesa; si dice que sí, consulta los horarios con la herramienta y ofrece DOS opciones. Si acepta una, agéndala con la herramienta y confirma en voz alta el día y la hora. Pide el correo solo si no lo tenemos, letra por letra si hace falta.
5. Cierra: repite lo acordado en una frase, agradece y despídete. Luego llama a la herramienta colgar.

HERRAMIENTAS (úsalas sin anunciarlas; mientras corren, no digas «déjame revisar» más de una vez)
- ORDEN: en cada turno PRIMERO escribe lo que vas a decir y DESPUÉS llama a las herramientas; nunca un turno con herramientas y sin texto (la persona oye silencio). La excepción es consultar_horarios: di una frase corta («permítame, reviso la agenda») y llama a la herramienta.
- consultar_horarios: SIEMPRE antes de proponer una hora; nunca inventes horarios.
- agendar: solo con una fecha y hora que salieron de consultar_horarios y que la persona aceptó.
- Los datos del negocio (giro, sucursales, correo, ciudad…) NO se guardan con herramienta: el sistema los saca de la transcripción al colgar. Tú solo escúchalos y repítelos cuando confirmes.
- pasar_a_humano: si pide hablar con una persona, si pregunta algo de precio o contrato que no sabes, o si se enoja. Si no hay nadie disponible, la herramienta te lo dice: ofrece agendar en su lugar.
- no_llamar: si pide que no se le llame más. Se respeta a la primera, sin argumentar. Te disculpas y cuelgas.
- colgar: al terminar, después de despedirte. También si contesta una grabadora o un fax.

SITUACIONES
- Preguntan si eres un robot o una grabación: ${'{REVELAR}'}
- Contestó un buzón o una máquina (menciona «deje su mensaje», «después del tono», «buzón», «el número que usted marcó»): no digas nada más y llama a colgar con motivo «buzon».
- Contestó una recepcionista o asistente: preséntate, di con quién quieres hablar y por qué en una frase. Si te pasa, sigue; si no está, pregunta a qué hora y cuelga.
- Ya es cliente de Sacs y llama por soporte: dile que le pasas el dato al equipo de soporte y que le escriben por WhatsApp; guarda el dato y cuelga.
- No es de moda ni calzado ni joyería: sé honesta, Sacs es para tiendas de moda; agradece y cuelga.
- Dice que no le interesa: «de acuerdo, le agradezco su tiempo» y cuelga. Nada de insistir.
- Se despide («gracias, hasta luego», «luego hablamos», «tengo que colgar»): te despides en UNA frase y llamas a colgar. Nunca la retengas ni le repitas una pregunta.
- Te pide información por escrito: di que se la mandas por WhatsApp después de la llamada (el sistema lo hace solo a partir de lo que prometas: promete solo lo que existe en LO QUE SABES).
- Silencio largo: pregunta una vez si sigue ahí; si no, despídete y cuelga.
- La llamada lleva más de diez minutos: cierra con lo acordado.
`;

/** Lo de voz manda sobre el guion escrito (que es de WhatsApp: tú, burbujas, emojis, ligas). Va al final para ganar. */
const MANDA_EN_LA_LLAMADA = `

LO QUE MANDA EN ESTA LLAMADA (por encima de todo lo anterior, que está escrito para WhatsApp):
- Es VOZ: nada de emojis, ligas, «burbujas», «mensajes» ni «te mando el enlace»; lo que se envíe va por WhatsApp DESPUÉS de la llamada.
- Empiezas de USTED y solo cambias a tú si la persona te tutea. Esto sustituye al «hablas de tú» de las reglas de WhatsApp.
- Frases cortas, una idea por turno, y te callas. Máximo tres oraciones.
- Si preguntan si eres un robot, una grabación o una inteligencia artificial: {REVELAR}
- Las herramientas van DESPUÉS de tu texto en el mismo turno (ver ORDEN).
- Al terminar de despedirte llama a colgar SIEMPRE; si no, la línea se queda abierta.
- La reunión se agenda con la herramienta y se confirma en voz alta; no la «confirmas después», la confirmas ahí.`;

const REVELAR_SI = 'di con naturalidad que eres Fernanda, la asistente virtual del equipo comercial de Sacscloud, y que si prefiere hablar con una persona, con gusto le agendas o le pasas la llamada. No insistas en el tema.';
const REVELAR_NO = 'contesta con naturalidad que eres Fernanda, del equipo comercial, y sigue con la conversación.';

/** Fecha y hora de hoy en CDMX y en la zona del contacto, en palabras que la voz puede decir. */
function hoyTexto(zona: string) {
  const d = new Date();
  const f = (z: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-MX', { timeZone: z, ...o }).format(d);
  const cdmx = `${f('America/Mexico_City', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${f('America/Mexico_City', { hour: 'numeric', minute: '2-digit', hour12: true })} (Ciudad de México)`;
  const alla = zona !== 'America/Mexico_City' ? ` · en la zona del contacto son las ${horaLocal(zona)}` : '';
  return cdmx + alla;
}

/** Las herramientas, en el formato de la API de Anthropic. */
export function herramientasVoz(): any[] {
  return [
    { name: 'consultar_horarios', description: 'Horarios disponibles del consultor para una reunión. Úsala SIEMPRE antes de proponer una hora.', input_schema: { type: 'object', properties: { tipo: { type: 'string', enum: ['discovery', 'demo'], description: 'discovery = llamada corta de quince minutos (la opción por defecto); demo = demostración de una hora' } }, required: ['tipo'] } },
    { name: 'agendar', description: 'Agenda la reunión en una fecha y hora que salió de consultar_horarios y que la persona aceptó.', input_schema: { type: 'object', properties: { tipo: { type: 'string', enum: ['discovery', 'demo'] }, fecha: { type: 'string', description: 'YYYY-MM-DD' }, hora: { type: 'string', description: 'HH:MM en la hora del contacto' }, email: { type: 'string', description: 'correo si lo dio' }, nombre: { type: 'string' }, motivo: { type: 'string', description: 'en una frase, qué quiere ver' } }, required: ['tipo', 'fecha', 'hora'] } },
    { name: 'pasar_a_humano', description: 'Pasa la llamada a un vendedor humano si hay uno disponible. Si no hay, devuelve que no y tú ofreces agendar.', input_schema: { type: 'object', properties: { motivo: { type: 'string' } }, required: ['motivo'] } },
    { name: 'no_llamar', description: 'La persona pidió que no se le llame más. Se respeta para siempre.', input_schema: { type: 'object', properties: { evidencia: { type: 'string', description: 'sus palabras' } }, required: [] } },
    { name: 'colgar', description: 'Termina la llamada. Llámala DESPUÉS de despedirte (o de inmediato si es buzón/máquina).', input_schema: { type: 'object', properties: { motivo: { type: 'string', enum: ['despedida', 'buzon', 'no_interesa', 'no_es_moda', 'equivocado', 'volver_llamar', 'soporte'] } }, required: ['motivo'] } },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · EL CONTEXTO de una llamada (system por capas, cacheable la primera)
// ─────────────────────────────────────────────────────────────────────────────
const getItem = async (id: string) => (await supabase.from('tel_sesion_items').select('*').eq('id', id).maybeSingle()).data as any;
const esPrueba = (id: string) => /^prueba-/.test(String(id));

/** Las reglas y límites nacen de WhatsApp. Las que hablan del canal (tutear, «persona real», emojis, ligas,
 *  burbujas) no aplican al teléfono y, si se dejan, el modelo las obedece aunque abajo se le diga lo contrario. */
const RE_SOLO_CHAT = /\bde t[uú]\b|tutea|persona real|emoji|whatsapp|mensaje de texto/i;
const sinReglasDeChat = (t: string) => String(t || '').split('\n').filter((l) => !(/^\s*[-•*]/.test(l) && RE_SOLO_CHAT.test(l))).join('\n');

export async function contextoVoz(itemId: string, o: { prueba?: boolean; callSid?: string; saludo?: string } = {}) {
  const cfg = await configVoz();
  const g = await guionActual();
  const r = await reglasVigentes();
  const prueba = o.prueba || esPrueba(itemId);
  const it = prueba ? null : await getItem(itemId);
  if (!prueba && !it) throw new Error('no existe el item');
  const s = it ? await getSesion(it.sesion_id) : null;
  if (it && o.callSid && it.call_sid && it.call_sid !== o.callSid) throw new Error('la llamada no es la del item');

  // Capa 1 (estable, se cachea): guion de voz + wiki + límites + reglas vigentes + anexo del dueño.
  const revelar = cfg.revelar_ia ? REVELAR_SI : REVELAR_NO;
  const capa1 = GUION_VOZ.replace('{REVELAR}', revelar) +
    `\n\nLO QUE SABES (general):\n${g.textos.wiki}\n\nLÍMITES:\n${sinReglasDeChat(g.textos.limites)}${sinReglasDeChat(r.texto)}` +
    MANDA_EN_LA_LLAMADA.replace('{REVELAR}', revelar) +
    (cfg.anexo ? `\n\nINSTRUCCIONES DEL DUEÑO PARA LAS LLAMADAS (mandan sobre todo):\n${cfg.anexo}` : '');

  // Capa 2: el expediente de ESTE contacto.
  let ct: any = null;
  if (it?.contact_id) {
    ct = (await supabase.from('contacts').select('nombre, apellido, email, puesto, giro, sucursales_interes, lifecycle_stage, proximo_paso, resumen_ia, companies(nombre_comercial, plan, giro, ciudad, sucursales)').eq('id', it.contact_id).maybeSingle()).data;
  }
  const emp: any = ct?.companies;
  const nombre = String(it?.nombre || [ct?.nombre, ct?.apellido].filter(Boolean).join(' ') || (prueba ? 'Aarón' : '')).trim();
  const primer = nombre.split(/\s+/)[0] || '';
  const giro = ct?.giro || emp?.giro || null;
  const zona = zonaDeLada(it?.lada || ladaDe(it?.telefono));
  const conocimiento = contextoParaLead({ giroCrm: giro, conversacion: String(it?.resumen || ''), ultimoMensaje: '' });
  const motivo = s?.presentacion_motivo || (prueba ? 'para conocer su tienda y ver si Sacs le puede ayudar con el inventario y las ventas' : 'para conocer su negocio y ver si Sacs le sirve');
  const expediente = [
    `HOY: ${hoyTexto(zona)}.`,
    `CON QUIÉN HABLAS: ${nombre || 'no sabemos el nombre'}${emp?.nombre_comercial || it?.empresa ? ` · ${emp?.nombre_comercial || it?.empresa}` : ''}${giro ? ` · giro: ${giro}` : ''}${emp?.ciudad ? ` · ${emp.ciudad}` : ''}${ct?.email ? ` · correo: ${ct.email}` : ' · sin correo en el CRM'}${ct?.lifecycle_stage ? ` · etapa: ${ct.lifecycle_stage}` : ''}.`,
    `POR QUÉ LLAMAS: ${motivo}.`,
    'TRATO: de USTED mientras la persona no te tutee: «¿tiene un momento?», «su tienda», «le ayuda», «¿cómo lleva…?». Está mal decir «tienes», «tu tienda», «te ayuda», «¿cómo llevas…?». Si la persona te tutea («oye, tú…»), a partir de ahí hablas de tú.',
    `LO QUE YA DIJISTE AL CONTESTAR: «${it?.apertura || o.saludo || ''}» (no lo repitas).`,
    it?.resumen ? `HISTORIAL EN EL CRM:\n${it.resumen}` : (prueba ? 'HISTORIAL: es una LLAMADA DE PRUEBA con el dueño de Sacscloud; actúa como si fuera un prospecto real dueño de una boutique.' : 'HISTORIAL: sin historial en el CRM.'),
    ct?.proximo_paso ? `PENDIENTE: ${ct.proximo_paso}` : '',
    `LA REUNIÓN QUE OFRECES: por defecto una llamada discovery de ${cfg.discovery_min} minutos con un consultor (en línea). La demo es de una hora y se ofrece si la pide.`,
    s?.modo === 'asistido' ? 'HAY UN VENDEDOR ESCUCHANDO: si la persona quiere hablar con alguien, usa pasar_a_humano.' : 'NO HAY VENDEDOR EN LÍNEA: si piden hablar con una persona, ofrece agendar.',
  ].filter(Boolean).join('\n');

  const system = [
    { type: 'text', text: capa1, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: conocimiento.texto, cache_control: { type: 'ephemeral' } },   // estable por giro: también se cachea
    { type: 'text', text: `EXPEDIENTE DE ESTA LLAMADA\n${expediente}` },
  ];
  const mensajeBuzon = s?.buzon_dejar_mensaje ? `Hola${primer ? ` ${primer}` : ''}, ${s.presentacion_nombre ? `soy ${s.presentacion_nombre}` : 'le llamo de Sacscloud'}${s.presentacion_motivo ? `, ${s.presentacion_motivo}` : ''}. Le vuelvo a marcar más tarde. Gracias.` : null;
  return { system, herramientas: herramientasVoz(), saludo: it?.apertura || o.saludo || null, nombre: primer || null, zona, mensajeBuzon, modo: s?.modo || 'ia', prueba };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · CADA TURNO: entra a `oido` y pasa por los oídos del marcador
// ─────────────────────────────────────────────────────────────────────────────
export async function registrarTurno(itemId: string, d: { quien: 'contacto' | 'fernanda'; texto: string; t?: number; callSid?: string }) {
  if (esPrueba(itemId)) return { ok: true };
  const it = await getItem(itemId);
  if (!it) return { ok: false };
  const texto = String(d.texto || '').trim().slice(0, 400);
  if (!texto) return { ok: true };
  // Fernanda entra como «vendedor»: es lo que lee el cierre con IA (qué se prometió, qué se acordó).
  const quien: Oido['quien'] = d.quien === 'fernanda' ? 'vendedor' : 'contacto';
  const oido: Oido[] = Array.isArray(it.oido) ? it.oido.slice() : [];
  oido.push({ t: Number.isFinite(d.t) ? Number(d.t) : ms(it.contestado_at), texto, final: true, quien });
  if (oido.length > 300) oido.splice(0, oido.length - 300);
  await supabase.from('tel_sesion_items').update({ oido, updated_at: ahora() }).eq('id', itemId);
  if (quien !== 'contacto' || !['escuchando', 'portero'].includes(it.estado)) return { ok: true };
  const reglas = juzgar(oido, ms(it.contestado_at), it.answered_by, await reglasAprendidas());
  if (!reglas) {
    // Con Fernanda al teléfono, que alguien conteste con una frase que no es de máquina ya es «persona»:
    // no hay vendedor esperando el micrófono, así que no vale la pena dudar más de una frase.
    const dicho = oido.filter(o => o.quien !== 'vendedor').length;
    if (dicho >= 2 && it.estado === 'escuchando' && !it.veredicto) { await alVeredicto(it, 'persona', 'fernanda', 'contestó y conversa'); return { ok: true, veredicto: 'persona' }; }
    return { ok: true };
  }
  if (it.estado === 'portero' && reglas.veredicto !== 'persona') return { ok: true, veredicto: reglas.veredicto };
  if (it.estado === 'escuchando' && it.veredicto) return { ok: true, veredicto: it.veredicto };
  await alVeredicto(it, reglas.veredicto, 'reglas', reglas.motivo);
  return { ok: true, veredicto: reglas.veredicto };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 · LAS HERRAMIENTAS
// ─────────────────────────────────────────────────────────────────────────────
const slugDe = (tipo: string) => (tipo === 'demo' ? 'demo' : 'llamada-discovery');
export async function ejecutarHerramienta(itemId: string, nombre: string, args: any = {}) {
  const prueba = esPrueba(itemId);
  const it = prueba ? null : await getItem(itemId);
  if (!prueba && !it) return { ok: false, error: 'no existe el item' };
  const cfg = await configVoz();
  const anotar = async (h: any) => { if (!it) return; const voz = { ...(it.voz || {}) }; voz.herramientas = [...(voz.herramientas || []), { ...h, at: ahora() }].slice(-40); await supabase.from('tel_sesion_items').update({ voz }).eq('id', it.id); it.voz = voz; };

  switch (nombre) {
    case 'consultar_horarios': {
      const tipo = args.tipo === 'demo' ? 'demo' : 'discovery';
      const hs = await horariosParaDemo({ slug: slugDe(tipo), dias: 4, max: 3 });
      await anotar({ nombre, tipo, n: hs.length });
      if (!hs.length) return { ok: true, horarios: [], nota: 'No hay horarios libres en los próximos días. Ofrece que el consultor le escriba por WhatsApp para acordar hora.' };
      return { ok: true, tipo, duracion_min: tipo === 'demo' ? 60 : cfg.discovery_min, horarios: hs.map(h => ({ fecha: h.fecha, hora: h.hora, dicho: h.etiqueta })), nota: 'Ofrece dos, dichos con palabras (día, y hora «de la mañana/tarde»).' };
    }
    case 'agendar': {
      const tipo = args.tipo === 'demo' ? 'demo' : 'discovery';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(args.fecha || '')) || !/^\d{1,2}:\d{2}$/.test(String(args.hora || ''))) return { ok: false, error: 'fecha u hora mal formadas; usa las de consultar_horarios' };
      if (prueba) return { ok: true, simulado: true, dicho: etiquetaHorario(args.fecha, args.hora), nota: 'Es una prueba: no se agendó de verdad. Confirma en voz alta como si sí.' };
      if (args.email && it.contact_id && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(args.email))) await aplicarDatos(it.contact_id, [{ campo: 'email', valor: String(args.email).trim().toLowerCase(), confianza: 0.9, evidencia: 'lo dictó en la llamada' }], { fuente: 'llamada', conversation_id: it.conversation_id }).catch(() => {});
      const { crearCompromiso } = await import('./cierre');
      const r = await crearCompromiso(it, { tipo: 'reunion', fecha: args.fecha, hora: String(args.hora).padStart(5, '0'), duracion_min: tipo === 'demo' ? 60 : cfg.discovery_min, motivo: String(args.motivo || '').slice(0, 200) || undefined, reunion_tipo: slugDe(tipo), confianza: 1 }, null);
      await anotar({ nombre, tipo, fecha: args.fecha, hora: args.hora, ok: !!r });
      if (!r) return { ok: false, error: 'no se pudo agendar (quizá ya existe una cita a esa hora). Ofrece otro horario.' };
      return { ok: true, dicho: etiquetaHorario(args.fecha, String(args.hora).padStart(5, '0')), detalle: r, nota: 'Confirma día y hora en voz alta y di que le llega la invitación por WhatsApp y correo.' };
    }
    case 'guardar_dato': {
      const campo = String(args.campo || ''), valor = String(args.valor || '').trim().slice(0, 200);
      if (!(CAMPOS_LEAD as readonly string[]).includes(campo) || !valor) return { ok: false, error: 'campo o valor inválido' };
      if (prueba || !it?.contact_id) return { ok: true, simulado: true };
      const r = await aplicarDatos(it.contact_id, [{ campo, valor, confianza: 0.85, evidencia: 'lo dijo en la llamada' }], { fuente: 'llamada', conversation_id: it.conversation_id });
      await anotar({ nombre, campo, cambios: r.cambios.length });
      return { ok: true, cambios: r.cambios.length };
    }
    case 'pasar_a_humano': {
      if (prueba) return { ok: false, motivo: 'no hay vendedor disponible en la prueba; ofrece agendar' };
      const s = await getSesion(it.sesion_id);
      await anotar({ nombre, motivo: args.motivo, disponible: !!s?.agente_en_sala });
      if (!s?.agente_en_sala || s.estado !== 'activa') return { ok: false, motivo: 'no hay ningún vendedor disponible en este momento; ofrece agendar una llamada' };
      await supabase.from('tel_sesion_items').update({ voz: { ...(it.voz || {}), handoff: { motivo: args.motivo, at: ahora() } } }).eq('id', it.id);
      return { ok: true, handoff: { sesion: s.id, item: it.id, motivo: String(args.motivo || '').slice(0, 200) }, nota: 'Di «le paso con mi compañero, un momento» y no digas nada más.' };
    }
    case 'no_llamar': {
      if (prueba) return { ok: true, simulado: true };
      if (it.contact_id) {
        await supabase.from('contacts').update({ no_llamar: true, updated_at: ahora() }).eq('id', it.contact_id);
        await supabase.from('activities').insert({ contact_id: it.contact_id, tipo: 'opt_out', titulo: 'Pidió que no se le llame (se lo dijo a Fernanda)', descripcion: String(args.evidencia || '').slice(0, 300) || null, automatico: true, metadata: { regla: 'voz_no_llamar', actor: 'ia' } }).then(() => {}, () => {});
      }
      await supabase.from('tel_sesion_items').update({ resultado: 'no_interesa', updated_at: ahora() }).eq('id', it.id).is('resultado', null);
      await anotar({ nombre });
      return { ok: true, nota: 'Discúlpate en una frase y cuelga.' };
    }
    case 'colgar': {
      // Lo resuelve la central (manda `end`); aquí solo se anota el motivo para el cierre.
      if (it) {
        const motivo = String(args.motivo || 'despedida');
        const resultado = motivo === 'buzon' ? 'buzon' : motivo === 'no_interesa' || motivo === 'no_es_moda' ? 'no_interesa' : motivo === 'volver_llamar' ? 'volver_llamar' : null;
        if (resultado) await supabase.from('tel_sesion_items').update({ resultado, updated_at: ahora() }).eq('id', it.id).is('resultado', null);
        await anotar({ nombre, motivo });
      }
      return { ok: true, colgar: true };
    }
    default: return { ok: false, error: `herramienta desconocida: ${nombre}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7 · FIN DE LA LLAMADA (lo que midió la central) y AVISOS hacia la central
// ─────────────────────────────────────────────────────────────────────────────
export async function finLlamadaVoz(itemId: string, d: any) {
  const uso = d?.uso || {};
  await supabase.from('ia_uso').insert({
    modelo: String(d?.modelo || 'claude-haiku-4-5'), proposito: 'telefonia/voz (Fernanda al teléfono)',
    input_tokens: uso.input || 0, output_tokens: uso.output || 0, cache_read: uso.cacheR || 0, cache_write: uso.cacheW || 0,
    costo_usd: Number(d?.costoUsd || 0), ok: true, ms: Number(d?.duracionS || 0) * 1000,
  }).then(() => {}, () => {});
  if (esPrueba(itemId)) {
    await supabase.from('tel_voz_pruebas').insert({ item: itemId, call_sid: d?.callSid || null, resumen: d }).then(() => {}, () => {});
    return { ok: true };
  }
  const it = await getItem(itemId);
  if (!it) return { ok: false };
  const voz = { ...(it.voz || {}), fin: { motivo: d?.motivo, duracionS: d?.duracionS, turnos: d?.turnos, latencia: d?.latencia, interrupciones: d?.interrupciones, errores: d?.errores, uso, costoUsd: d?.costoUsd, at: ahora() } };
  await supabase.from('tel_sesion_items').update({ voz, updated_at: ahora() }).eq('id', itemId);
  // El `completed` de Twilio cierra el item; el latido empuja el cierre con IA y la siguiente llamada.
  latir(it.sesion_id).catch(() => {});
  return { ok: true };
}

/** La central empuja la sesión unos segundos después de cada llamada (no hay navegador latiendo en modo «ia»). */
export async function latirDesdeCentral(itemId: string) {
  if (esPrueba(itemId)) return { ok: true };
  const it = await getItem(itemId);
  if (!it) return { ok: false };
  const s = await getSesion(it.sesion_id);
  if (!s || s.modo !== 'ia') return { ok: true, motivo: 'la cabina late' };
  const e = await latir(it.sesion_id);
  return { ok: true, estado: e?.sesion?.estado ?? null, item: e?.actual?.estado ?? null };
}

/** Le dice algo a la central sobre una llamada viva (máquina, buzón, tomar, colgar, decir). */
export async function avisarCentral(itemId: string, evento: string, datos: Record<string, any> = {}): Promise<boolean> {
  if (!vozConfigurada()) return false;
  try {
    const r = await fetch(`${VOZ_CENTRAL_URL}/evento`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOZ_SECRET}` },
      body: JSON.stringify({ item: itemId, evento, ...datos }), signal: AbortSignal.timeout(4000),
    });
    return r.ok;
  } catch { return false; }
}

/** Lo que Fernanda lleva gastado hoy (CDMX): IA de la central + minutos de Twilio de sus llamadas. */
export async function gastoHoyVoz(): Promise<number> {
  const hoy = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  const desde = `${hoy}T06:00:00.000Z`;
  const [ia, tel] = await Promise.all([
    supabase.from('ia_uso').select('costo_usd').eq('proposito', 'telefonia/voz (Fernanda al teléfono)').gte('created_at', desde).limit(2000),
    supabase.from('tel_sesion_items').select('costo_usd, tel_sesiones!inner(modo)').gte('terminado_at', desde).neq('tel_sesiones.modo', 'manual').not('costo_usd', 'is', null).limit(2000),
  ]);
  const suma = (xs: any[] | null) => (xs || []).reduce((a, x) => a + Number(x.costo_usd || 0), 0);
  return Math.round((suma(ia.data) + suma(tel.data as any)) * 100) / 100;
}

/** ¿La central está viva? (para la pantalla de configuración y el latido). */
export async function saludCentral(): Promise<any> {
  try { const r = await fetch(`${VOZ_CENTRAL_URL}/salud`, { signal: AbortSignal.timeout(3000) }); return r.ok ? await r.json() : { ok: false, status: r.status }; }
  catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
}
