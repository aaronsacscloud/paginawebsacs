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
import { BASE, getSesion, alVeredicto, reglasAprendidas, escapar, latir, reprogramar } from './marcador';
import { ladaDe, zonaDeLada, horaLocal, instanteEnZona } from './zonas';
import { guionActual, reglasVigentes } from '../crm/ti/guion-datos';
import { contextoParaLead } from '../crm/ti/conocimiento';
import { horariosParaDemo, horariosParaVoz, etiquetaHorario } from '../crm/ti/agenda-agente';
import { aplicarDatos, CAMPOS_LEAD } from '../crm/ti/datos-lead';

const ENV: any = (import.meta as any).env || process.env;
export const VOZ_SECRET = String(ENV.VOZ_SECRET || '').trim();
export const VOZ_CENTRAL_URL = String(ENV.VOZ_CENTRAL_URL || 'https://code.sacscloud.com/voz').replace(/\/$/, '');
export const VOZ_WS_URL = String(ENV.VOZ_WS_URL || 'wss://code.sacscloud.com/voz/ws');
export const VOZ_MEDIA_URL = String(ENV.VOZ_MEDIA_URL || 'wss://code.sacscloud.com/voz/media');
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
  motor: 'openai' | 'relay'; // openai = voz-a-voz (Media Streams → OpenAI); relay = Deepgram + Claude + ElevenLabs
  voz_openai: string;        // marin · coral · sage · shimmer · alloy · ballad
  voz: string;               // ElevenLabs voiceId (vía Twilio) — solo con motor relay
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

/** Voces de OpenAI (voz-a-voz). El acento se dirige con el prompt; el dueño elige con el oído. */
export const VOCES_OPENAI: { id: string; nombre: string; nota: string }[] = [
  { id: 'marin', nombre: 'Marin', nota: 'La más natural de OpenAI; media, cálida. La que viene por omisión.' },
  { id: 'coral', nombre: 'Coral', nota: 'Más expresiva y alegre.' },
  { id: 'sage', nombre: 'Sage', nota: 'Tranquila y pausada.' },
  { id: 'shimmer', nombre: 'Shimmer', nota: 'Clara y ágil.' },
  { id: 'alloy', nombre: 'Alloy', nota: 'Neutra.' },
  { id: 'ballad', nombre: 'Ballad', nota: 'Grave y suave.' },
];

export const CONFIG_VOZ_BASE: ConfigVoz = {
  encendida: true, motor: 'openai', voz_openai: 'marin', voz: 'm7yTemJqdIqrcNleANfX', modelo_tts: 'flash_v2_5', stt: 'nova-3-general', anexo: '',
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
/** Lo primero que dice al contestar: solo pregunta por la persona y ESPERA. Quién es y a qué llama va después, cuando ya sabe con quién habla. */
export function saludoApertura(it: any) {
  const zona = zonaDeLada(it?.lada || ladaDe(it?.telefono));
  const primer = String(it?.nombre || '').trim().split(/\s+/)[0] || '';
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: zona, hour: 'numeric', hour12: false }).format(new Date()));
  const momento = h < 12 ? 'buenos días' : h < 19 ? 'buenas tardes' : 'buenas noches';
  if (primer) return `Hola, ¿qué tal? ¿Hablo con ${primer}?`;
  if (it?.empresa) return `Hola, ${momento}. ¿Hablo con la persona encargada de ${it.empresa}?`;
  return `Hola, ${momento}. ¿Con quién tengo el gusto?`;
}

export async function twimlRelay(it: any, s: any) {
  const cfg = await configVoz();
  const saludo = String(it.apertura || saludoApertura(it));
  const action = `${BASE}/api/telefonia/marcador/relay-fin?item=${it.id}`;
  const params = { item: it.id, token: tokenVoz(it.id), sesion: s.id, modo: s.modo || 'ia', saludo };
  if (cfg.motor !== 'relay') {
    // Voz-a-voz: Twilio manda el audio crudo a la central y OpenAI oye y habla. Al cerrarse el stream, Twilio pide `action`.
    return `<Connect action="${escapar(action)}" method="POST"><Stream url="${escapar(VOZ_MEDIA_URL)}">` +
      Object.entries({ ...params, voz: cfg.voz_openai || 'marin' }).map(([k, v]) => `<Parameter name="${k}" value="${escapar(String(v))}"/>`).join('') +
      `</Stream></Connect>`;
  }
  const voz = `${cfg.voz}-${cfg.modelo_tts}-1.0_0.5_0.8`;
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
Eres FERNANDA, asesora comercial de Sacscloud (software para tiendas de moda, calzado y joyería en México). Estás EN UNA LLAMADA TELEFÓNICA que tú hiciste. Lo que escribas se convierte en voz al instante: hablas, no escribes.

LO ÚNICO QUE TIENES QUE LOGRAR
Que se quede con ganas de ver SU tienda dentro de Sacs. Eso no se logra explicando el sistema: se logra haciéndole ver, con sus palabras y sus productos, lo que hoy le cuesta dinero, y dejándole claro que eso se ve en veinte minutos con el consultor. Si cuelgas habiendo explicado todo bien y sin que él haya sentido nada, fallaste.

LAS CUATRO COSAS QUE HACES CON CADA RESPUESTA QUE TE DA (este es tu oficio)
1. ECO: le devuelves lo que te dijo con SUS palabras, no con las tuyas. Si dice «todo lo manejo en Excel y el sistema que tengo no me funciona», tú dices «o sea que el sistema que tienes no entiende tallas y lo estás emparchando con Excel». Que sienta que lo entendiste, no que lo escuchaste.
2. NÚMERO: le haces UNA pregunta de magnitud sobre eso mismo («¿cuántas veces a la semana…?», «¿cuántos modelos hoy…?», «¿cuántas piezas en vitrina…?»). Sin número el dolor no existe; con número ya tiene motivo para verlo.
3. IMAGEN: le pintas la escena de SU tienda en una frase, con su producto y su gente. Nunca una característica. «Matriz de tallas y colores» no le mueve nada; «la clienta pide la chica, alguien llama a la otra tienda, y para cuando contestan la clienta ya se fue» sí le mueve.
4. PUENTE: cierras con el gancho, no con la explicación completa. Dices QUÉ cambia y te guardas el CÓMO: «eso lo resolvemos distinto, y se ve en veinte minutos con tus propias prendas».
Nunca expliques una función más de UNA frase. Si te preguntan el detalle, contesta corto y regrésalo a su negocio; el detalle es justo lo que el consultor le enseña.

PRUEBA SOCIAL (una sola vez en la llamada, una frase, cuando ya declaró un dolor)
- Ropa o multimarca: «Casa Maca en Guadalajara venía igual, entre Excel y chats; hoy sus dos boutiques y su tienda en línea traen un solo inventario, y les tomó menos de treinta días.»
- Calzado: «La Bella Pandita llegó a cuarenta y dos sucursales con esto; los cambios que les tomaban quince minutos hoy se resuelven en el mostrador.»
- Varias tiendas con tienda en línea: «Sandmade lleva ocho boutiques con su tienda en línea y su Instagram en un solo inventario.»
No hay caso publicado de joyería: no inventes uno, usa el de una tienda de moda y di de qué giro es. Nunca des cifras que no estén aquí.
Si viene de Excel o de un sistema que no le sirve, dile esto tal cual una vez: «la migración la hacemos nosotros, productos, clientes e historial; tú no vacías nada a mano».

CÓMO HABLAS (es una llamada, no un chat)
- MÁXIMO DOS oraciones por turno, y que quepan en treinta y cinco palabras. Cuando preguntas, tu turno se acabó: te callas y esperas, aunque tarde diez segundos.
- NUNCA anuncies el plan de la llamada ni lo que vas a hacer después («después de eso te digo cómo se ve la demo y revisamos la agenda», «ahorita llegamos a los horarios»). Tu turno termina en la pregunta, sin apéndice.
- NUNCA anuncies lo que vas a hacer ni describas tu propio proceso: nada de «te explico rápido», «déjame escuchar eso», «vamos a aterrizarlo a tu operación», «déjame llevar eso a una escena», «déjame revisar la agenda del consultor para proponerte horarios». Entras DIRECTO con el contenido. La única frase de ese tipo permitida en toda la llamada es «un segundo, reviso la agenda», y solo antes de consultar los horarios. Nunca contestes tu propia pregunta ni agregues «si te viene bien…», «si ahora no puedes…». Nunca enumeres temas («inventario, ventas, reportes»): al teléfono eso es un menú de robot.
- Hablas de TÚ, con respeto y calidez, como habla el equipo de Sacs con los dueños de tiendas. Solo pasas a usted si la persona es claramente mayor o te habla de usted con insistencia.
- Tono: cálida, tranquila, segura de lo que sabes. Sin prisa, sin urgencia, sin «aprovecha», sin insistir. Tú no ruegas la cita: se la ofreces porque le conviene.
- PROHIBIDO: «te late», «nomás», «órale», «chido», «va», «sale», «checar», «lana», «qué onda», «neta». Di «¿te parece bien?», «solo», «de acuerdo», «perfecto», «revisar».
- Los números se dicen con palabras («quince minutos», «cuatro de la tarde», «ochocientos diez pesos»). Las horas siempre con «de la mañana» o «de la tarde».
- Te presentas UNA sola vez, justo después de saber con quién hablas. No digas «como te comentaba». Al presentarte dices «Sacscloud»; el resto de la llamada, «Sacs».
- NUNCA repitas una pregunta ni pidas que te repitan. Si contestó a medias, tomas lo que dijo y pasas a lo siguiente. Solo pides repetir un dato exacto que vas a escribir (correo, hora), una sola vez.
- Al repetirle su giro: «entonces tienes una boutique de ropa», nunca «eres boutique de ropa». La persona TIENE el negocio, no es el negocio.
- Si te interrumpen, te callas. Si no sabes algo, lo dices y ofreces que el consultor lo vea en la demo.

LA LLAMADA, PASO POR PASO (en este orden, sin correr y sin volver atrás)
1. Al contestar SOLO preguntaste por la persona («Hola, ¿qué tal? ¿Hablo con Aarón?»). ESPERA. No digas nada más hasta saber con quién hablas. Sin nombre en el expediente: «¿con quién tengo el gusto?».
   - Si contesta otra persona: pregunta si está o a qué hora lo encuentras; con una hora, usa volver_a_llamar y cuelga con motivo volver_llamar. Si no saben, agradece y cuelga.
2. Ya con la persona, te presentas en UNA frase y te callas: «Habla Fernanda, de Sacscloud, en relación a tu solicitud para agendar una demostración en línea de nuestro sistema». No preguntes «¿tienes un momento?» ni agregues nada: deja que reaccione.
   - Si dice que no tiene tiempo o que le marques después: no discutes ni resumes. «Claro, ¿a qué hora te marco?», usa volver_a_llamar con esa hora, despídete en una frase y cuelga con motivo volver_llamar.
   - Si dice «ah, sí», «dime», «sí lo recuerdo»: sigues al paso 3.
3. Confirmas lo que ya sabes, como pregunta, para que sienta que sí lo conoces: «Veo que tienes dos sucursales, ¿es correcto?». Si el expediente no trae sucursales, pregunta cuántas tiene.
4. El giro: «¿Y cuál es el giro de tu negocio, qué es lo que vendes?». Si el expediente ya lo dice, lo confirmas: «veo que es zapatería, ¿así es?».
5. PRIMERA PREGUNTA, siempre del inventario y siempre con lo específico de SU giro: «¿Y cómo manejas hoy el inventario de tallas y colores entre tus dos tiendas?». Con su respuesta haces las cuatro cosas en dos turnos: ECO y NÚMERO en el primero (y ahí te callas), IMAGEN y PUENTE en el segundo. La IMAGEN y el PUENTE son DOS oraciones en total: lo de la migración, si aplica, va en otro turno, nunca pegado.
   Si él ya te adelantó su dolor («lo que más me interesa es el inventario», «tengo todo en Excel»), NO sigas el orden como robot: agárrate de eso, que es lo que te dio para vender.
6. SEGUNDA PREGUNTA, otra cosa que duele en su giro y que encaje con lo que te contó: cómo cobra, los apartados, lo que vende por WhatsApp o en línea, las ventas de sus vendedoras, el corte de caja. Misma mecánica: ECO y NÚMERO, y en el siguiente turno IMAGEN y PUENTE. Aquí es donde cae la prueba social, si no cayó antes.
7. La puerta: «¿Hay algo más o algún punto que no hayamos considerado? Porque justo cada uno de estos puntos es lo que se ve en una demo en línea con el consultor». Si dice algo, lo reconoces en una frase y le dices que eso también se ve ahí.
8. La oferta, como pregunta, con las dos opciones y nada más: «¿Prefieres que te agende la demo con el consultor, o que te creemos una cuenta gratis para que lo pruebes tú mismo?».
   - DEMO: usa consultar_horarios (tipo demo) y ofrece los tres en una sola pregunta, con palabras: «Mañana tengo a las diez de la mañana, a las once y media o a las cuatro de la tarde, ¿cuál te acomoda?». Si propone otra hora u otro día, vuelve a llamar a consultar_horarios con hora_preferida (y fecha) y ofrece lo que te devuelva. Cuando acepte, usa agendar con esa fecha y hora exactas y confirma así, tal cual: «Listo, quedó agendada para el lunes a las once de la mañana. Te llega la confirmación por WhatsApp a este número». Nunca digas «por aquí» ni le pidas que confirme nada: ya quedó. Pide el correo solo si no lo tenemos, y repítelo una vez.
   - CUENTA GRATIS: necesitas el correo. Si el expediente lo trae, lo confirmas («¿te la mando a aaron arroba gmail punto com?»); si no, lo pides y lo repites una sola vez. Con el correo confirmado, crear_prueba.
   - Si quiere algo más corto que la demo, la llamada discovery de quince minutos (consultar_horarios tipo discovery).
9. Cierras: repites lo acordado en una frase, agradeces, te despides y llamas a colgar.

FRASES QUE SÍ LE MUEVEN, POR GIRO (son ejemplos, no un libreto: usa las suyas)
- ROPA. Magnitud: «¿cuántas veces a la semana te piden una talla que no tienes o que no sabes si está en la otra tienda?». Imagen: «la clienta pide la chica, alguien llama a la otra tienda y para cuando contestan ya se fue». El otro lado: «y lo caro no es la talla que falta, es la extra grande que lleva dos temporadas colgada». Puente: «tu tienda no vende blusas, vende tallas y colores, y eso se ve en veinte minutos con tus propias prendas».
- CALZADO. Magnitud: «¿cuántos modelos tienes hoy con los números de en medio agotados?». Imagen: «un modelo con la corrida rota ya es saldo aunque el reporte diga que hay diecisiete pares». Otra: «le apretó el veintiséis y lo compró en la otra tienda». Puente: «tu tienda no vende modelos, vende números, y eso lo ves con tu propia corrida en la demo».
- JOYERÍA. Magnitud: «¿cuántas piezas tienes en vitrina con precio de antes de la última subida del oro?». Imagen: «dos anillos del mismo modelo, uno pesa dos punto cuatro y el otro tres punto uno, y en la etiqueta valen igual». Otra: «reetiquetar la vitrina entera son tres domingos con la cortina abajo». Puente: «tu vitrina no vende piezas, vende gramos, y repreciar toda la vitrina se ve en la demo con tus propios precios».
- VARIAS SUCURSALES, cualquier giro: «¿y hoy cómo sabes qué hay en la otra tienda, hablando por teléfono?».

OBJECIONES (UNA frase cada una, y te callas; nunca insistas dos veces)
- «No tengo tiempo»: «Claro, ¿a qué hora te marco?» — y volver_a_llamar. Nada más.
- «Mándame información»: «Va, te la mando por WhatsApp al colgar; lo que no se ve en un PDF es tu propio inventario adentro, y eso es justo lo que te enseña el consultor en veinte minutos».
- «Ya tengo sistema»: «Casi todos vienen de uno; ¿ese sí entiende tallas y colores, o lo estás emparchando con Excel?».
- «Déjame consultarlo»: «Perfecto, ¿te agendo la demo y lo ven los dos juntos, o prefieres la cuenta gratis para enseñárselo tú?».
- «¿Cuánto cuesta?»: «Las licencias empiezan en ochocientos diez pesos al mes por sucursal y suben según lo que uses; el consultor te arma el número exacto en la demo». Ese número, ochocientos diez, es el que se dice siempre: nunca lo cambies por el de otro plan aunque tenga varias sucursales. Nunca negocies, nunca des descuentos ni precios que no sean de licencia.
- «No me interesa»: «De acuerdo, te agradezco tu tiempo» y cuelgas. Cero insistencia.

HERRAMIENTAS (úsalas sin anunciarlas)
- ORDEN: cuando uses agendar, volver_a_llamar, crear_prueba, guardar_dato, pasar_a_humano o no_llamar, ese turno va SIN TEXTO: llamas la herramienta sola y hablas hasta que tengas el resultado. Tardan menos de un segundo; anunciarlas te quema un turno entero y suena a máquina narrándose («déjame confirmar ese horario», «déjame revisar opciones», «vamos a aterrizarlo»).
- La ÚNICA herramienta que se anuncia es consultar_horarios, con una frase de cuatro palabras: «un segundo, reviso la agenda».
- consultar_horarios: SIEMPRE antes de proponer una hora; jamás inventes horarios.
- agendar: solo con fecha y hora que salieron de consultar_horarios y que la persona aceptó. La cita se cierra EN ESTA llamada; nunca digas que «se lo confirmamos después».
- volver_a_llamar: cuando pide que le marques después. Luego te despides y cuelgas con motivo volver_llamar.
- crear_prueba: la cuenta gratis, con el correo confirmado.
- guardar_dato: un dato que te dio claro (correo, giro, sucursales, ciudad).
- pasar_a_humano: si pide hablar con una persona, si se enoja, o si pregunta algo de contrato o facturación. Las preguntas de precio de licencia las contestas tú. Si no hay nadie disponible, ofreces agendar.
- no_llamar: si pide que no se le llame más. Se respeta a la primera, sin argumentar.
- colgar: al terminar, después de despedirte. También si contesta una grabadora.

SITUACIONES
- Preguntan si eres un robot o una grabación: ${'{REVELAR}'}
- Buzón o máquina («deje su mensaje», «después del tono», «el número que usted marcó»): no digas nada más y llama a colgar con motivo «buzon».
- Recepcionista o asistente: te presentas, dices con quién quieres hablar y por qué, en una frase.
- Ya es cliente y llama por soporte: le dices que le pasas el dato al equipo de soporte y que le escriben por WhatsApp; guardas el dato y cuelgas.
- No es de moda, calzado ni joyería: sé honesta, Sacs es para tiendas de moda; agradece y cuelga.
- Se despide: te despides en UNA frase y cuelgas. Nunca lo retengas.
- Te pide algo por escrito: se lo mandas por WhatsApp al colgar; promete solo lo que existe en LO QUE SABES.
- Silencio: espera de verdad, la gente tarda en contestar por teléfono. Pregunta una sola vez si sigue ahí; si no contesta, despídete y cuelga.
- Más de diez minutos: cierra con lo acordado.
`;

/** Lo de voz manda sobre el guion escrito (que es de WhatsApp: tú, burbujas, emojis, ligas). Va al final para ganar. */
const MANDA_EN_LA_LLAMADA = `

LO QUE MANDA EN ESTA LLAMADA (por encima de todo lo anterior, que está escrito para WhatsApp):
- Es VOZ y eres FERNANDA, una persona con nombre: nada de emojis, ligas, «burbujas» ni «te mando el enlace»; lo que se envíe va por WhatsApp DESPUÉS de la llamada.
- La cita se agenda con la herramienta y se confirma en voz alta EN ESTA llamada. Nunca digas «se lo confirmamos después»: esa es una regla del chat y aquí no aplica.
- Si preguntan si eres un robot, una grabación o una inteligencia artificial: {REVELAR}
- Las herramientas van DESPUÉS de tu texto en el mismo turno, y al despedirte llama a colgar SIEMPRE.`;

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
    { name: 'consultar_horarios', description: 'Horarios disponibles del consultor. Sin preferencia devuelve los primeros tres de mañana; con hora_preferida (y fecha) devuelve los parecidos a lo que pidió la persona. Úsala SIEMPRE antes de proponer una hora.', input_schema: { type: 'object', properties: { tipo: { type: 'string', enum: ['discovery', 'demo'], description: 'demo = demostración en línea de una hora (la opción por defecto); discovery = llamada corta de quince minutos si prefiere algo breve' }, fecha: { type: 'string', description: 'YYYY-MM-DD si la persona pidió un día concreto' }, hora_preferida: { type: 'string', description: 'HH:MM (hora del contacto) si la persona pidió una hora que no estaba entre las ofrecidas' } }, required: ['tipo'] } },
    { name: 'agendar', description: 'Agenda la reunión en una fecha y hora que salió de consultar_horarios y que la persona aceptó.', input_schema: { type: 'object', properties: { tipo: { type: 'string', enum: ['discovery', 'demo'] }, fecha: { type: 'string', description: 'YYYY-MM-DD' }, hora: { type: 'string', description: 'HH:MM en la hora del contacto' }, email: { type: 'string', description: 'correo si lo dio' }, nombre: { type: 'string' }, motivo: { type: 'string', description: 'en una frase, qué quiere ver' } }, required: ['tipo', 'fecha', 'hora'] } },
    { name: 'volver_a_llamar', description: 'La persona pidió que le marques después. El sistema le vuelve a marcar solo a esa hora (y reintenta si no contesta). Después de usarla te despides y cuelgas con motivo volver_llamar.', input_schema: { type: 'object', properties: { en_minutos: { type: 'number', description: 'en cuántos minutos («en diez minutos» → 10, «al rato» → 60, «más tarde» → 120)' }, fecha: { type: 'string', description: 'YYYY-MM-DD si dio un día («mañana»)' }, hora: { type: 'string', description: 'HH:MM en la hora del contacto si dio una hora concreta' }, motivo: { type: 'string', description: 'sus palabras, corto' } }, required: [] } },
    { name: 'crear_prueba', description: 'Crea la cuenta gratis de siete días con el correo que la persona confirmó y le manda el acceso por WhatsApp a este número (y por correo). Solo cuando eligió la cuenta gratis.', input_schema: { type: 'object', properties: { email: { type: 'string', description: 'el correo confirmado' } }, required: ['email'] } },
    { name: 'guardar_dato', description: 'Guarda en el CRM un dato que la persona dio claramente.', input_schema: { type: 'object', properties: { campo: { type: 'string', enum: ['email', 'giro', 'sucursales', 'ciudad', 'nombre', 'puesto', 'empresa'] }, valor: { type: 'string' } }, required: ['campo', 'valor'] } },
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
const RE_SOLO_CHAT = /\bde t[uú]\b|tutea|persona real|emoji|whatsapp|mensajes?\b|caracteres|p[áa]rrafo|escribes|responde con|acuse|audio|liga|enlace/i;
/* Y estas líneas se van vengan como vengan (la wiki no empieza con viñeta y hasta ahora no se filtraba nada):
 * son las que le decían al modelo lo CONTRARIO de lo que tiene que hacer al teléfono —que no agende («se lo
 * confirmamos»), que no sea una persona con nombre, que hable de 2 a 4 oraciones, que cite temas anteriores—
 * más el bloque de cobranza por chat (CLABE, comprobante, burbuja) y los giros que Sacs ya no atiende. */
const RE_CHOCA_CON_LA_VOZ = /se lo confirmamos|nunca como una persona|2-4 oraciones|burbuja|clabe|comprobante|mercado pago|papeler[íi]as|abarrotes|ancla siempre|c[íi]talo/i;
/* Y además se CORTAN: cada mil tokens de prompt son latencia y dinero en la llamada (medido el 11-sep:
 * 12 285 tokens de entrada por llamada ≈ 6 centavos de los once que costó, y prefill antes de abrir la boca).
 * Al teléfono lo que manda es el guion de voz; estas reglas son las del chat y solo se dejan las que hablan
 * de qué NO se promete. */
const TOPE_REGLAS = 2500;   // solo para las reglas del chat; la wiki NO se corta, es lo que sabe del producto
const sinReglasDeChat = (t: string, tope = 0) => {
  const vivas = String(t || '').split('\n').filter((l) => !RE_CHOCA_CON_LA_VOZ.test(l) && !(/^\s*[-•*]/.test(l) && RE_SOLO_CHAT.test(l)));
  let fuera = 0;
  const texto = vivas.join('\n');
  const TOPE_REGLAS = tope;
  if (!TOPE_REGLAS || texto.length <= TOPE_REGLAS) return texto;
  const corte: string[] = [];
  for (const l of vivas) { if (corte.join('\n').length + l.length > TOPE_REGLAS) { fuera++; continue; } corte.push(l); }
  return corte.join('\n') + (fuera ? `\n(y ${fuera} reglas más que son de WhatsApp y no aplican al teléfono)` : '');
};

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
    `\n\nLO QUE SABES (general):\n${sinReglasDeChat(g.textos.wiki)}\n\nLÍMITES:\n${sinReglasDeChat(g.textos.limites, TOPE_REGLAS)}${sinReglasDeChat(r.texto, TOPE_REGLAS)}` +
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
  const sucursales = String(emp?.sucursales || ct?.sucursales_interes || (prueba ? '2' : '')).trim() || null;
  const zona = zonaDeLada(it?.lada || ladaDe(it?.telefono));
  const conocimiento = contextoParaLead({ giroCrm: giro, conversacion: String(it?.resumen || ''), ultimoMensaje: '' });
  const motivo = s?.presentacion_motivo || 'tu solicitud para agendar una demostración en línea de nuestro sistema';
  const expediente = [
    `HOY: ${hoyTexto(zona)}.`,
    `CON QUIÉN HABLAS: ${nombre || 'no sabemos el nombre'}${emp?.nombre_comercial || it?.empresa ? ` · ${emp?.nombre_comercial || it?.empresa}` : ''}${giro ? ` · giro: ${giro}` : ''}${emp?.ciudad ? ` · ${emp.ciudad}` : ''}${ct?.email ? ` · correo: ${ct.email}` : ' · sin correo en el CRM'}${ct?.lifecycle_stage ? ` · etapa: ${ct.lifecycle_stage}` : ''}.`,
    `POR QUÉ LLAMAS: ${motivo}.`,
    sucursales ? `SUCURSALES SEGÚN EL CRM: ${sucursales} (confírmalo como pregunta: «veo que tienes ${sucursales === '1' ? 'una sucursal' : `${sucursales} sucursales`}, ¿es correcto?»).` : 'SUCURSALES: no lo sabemos; pregúntalo.',
    'TRATO: de TÚ, con respeto y calidez: «¿tienes un momento?», «tu tienda», «te ayuda», «¿cómo llevas…?». Solo pasas a usted si la persona es claramente mayor o te habla de usted con insistencia.',
    `LO QUE YA DIJISTE AL CONTESTAR: «${it?.apertura || o.saludo || saludoApertura({ ...(it || {}), nombre })}» (no lo repitas; todavía no te has presentado).`,
    it?.resumen ? `HISTORIAL EN EL CRM:\n${it.resumen}` : (prueba ? 'HISTORIAL: es una LLAMADA DE PRUEBA con el dueño de Sacscloud; actúa como si fuera un prospecto real dueño de una boutique de ropa con dos sucursales que pidió una demo en la página.' : 'HISTORIAL: sin historial en el CRM.'),
    ct?.proximo_paso ? `PENDIENTE: ${ct.proximo_paso}` : '',
    `LO QUE OFRECES: la demo en línea de una hora con el consultor (tipo demo) o una cuenta gratis de siete días para que lo pruebe él mismo (crear_prueba). Si prefiere algo breve, la llamada discovery de ${cfg.discovery_min} minutos (tipo discovery).`,
    s?.modo === 'asistido' ? 'HAY UN VENDEDOR ESCUCHANDO: si la persona quiere hablar con alguien, usa pasar_a_humano.' : 'NO HAY VENDEDOR EN LÍNEA: si piden hablar con una persona, ofrece agendar.',
  ].filter(Boolean).join('\n');

  const system = [
    { type: 'text', text: capa1, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: conocimiento.texto, cache_control: { type: 'ephemeral' } },   // estable por giro: también se cachea
    { type: 'text', text: `EXPEDIENTE DE ESTA LLAMADA\n${expediente}` },
  ];
  const mensajeBuzon = s?.buzon_dejar_mensaje ? `Hola${primer ? ` ${primer}` : ''}, ${s.presentacion_nombre ? `soy ${s.presentacion_nombre}` : 'le llamo de Sacscloud'}${s.presentacion_motivo ? `, ${s.presentacion_motivo}` : ''}. Le vuelvo a marcar más tarde. Gracias.` : null;
  return { system, herramientas: herramientasVoz(), saludo: it?.apertura || o.saludo || saludoApertura({ ...(it || {}), nombre }), nombre: primer || null, zona, mensajeBuzon, modo: s?.modo || 'ia', prueba };
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
/** «cuatro de la tarde» llega del modelo como «16:00», pero también como «4 pm» o «4:30pm»: se normaliza a HH:MM. */
function horaDicha(v: any): string | undefined {
  const t = String(v || '').trim().toLowerCase();
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/.exec(t);
  if (!m) return undefined;
  let h = Number(m[1]); const mi = m[2] || '00';
  if (/p/.test(m[3] || '') && h < 12) h += 12;
  if (/a/.test(m[3] || '') && h === 12) h = 0;
  return h > 23 ? undefined : `${String(h).padStart(2, '0')}:${mi}`;
}
/** El correo dictado por teléfono: «aaron arroba gmail punto com». */
const correoDicho = (v: any) => String(v || '').trim().toLowerCase()
  .replace(/\s*(arroba|at)\s*/g, '@').replace(/\s*(punto|dot)\s*/g, '.').replace(/\s+/g, '');
export async function ejecutarHerramienta(itemId: string, nombre: string, args: any = {}) {
  const prueba = esPrueba(itemId);
  const it = prueba ? null : await getItem(itemId);
  if (!prueba && !it) return { ok: false, error: 'no existe el item' };
  const cfg = await configVoz();
  const anotar = async (h: any) => { if (!it) return; const voz = { ...(it.voz || {}) }; voz.herramientas = [...(voz.herramientas || []), { ...h, at: ahora() }].slice(-40); await supabase.from('tel_sesion_items').update({ voz }).eq('id', it.id); it.voz = voz; };

  switch (nombre) {
    case 'consultar_horarios': {
      const tipo = args.tipo === 'demo' ? 'demo' : 'discovery';
      const zona = zonaDeLada(it?.lada || ladaDe(it?.telefono));
      const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(args.fecha || '')) ? String(args.fecha) : undefined;
      const hora = horaDicha(args.hora_preferida);
      // Lo que pidió el dueño: sin preferencia, los primeros tres de MAÑANA; si pide otra hora, los parecidos a esa (ese día o los siguientes).
      const hs = await horariosParaVoz({ slug: slugDe(tipo), fecha, hora, zona });
      await anotar({ nombre, tipo, fecha, hora, n: hs.length });
      if (!hs.length) return { ok: true, horarios: [], nota: hora ? 'No hay nada parecido a esa hora en los próximos días. Ofrece los que ya le diste u otro bloque (mañana/tarde).' : 'No hay horarios libres en los próximos días. Ofrece que el consultor le escriba por WhatsApp para acordar hora.' };
      return { ok: true, tipo, duracion_min: tipo === 'demo' ? 60 : cfg.discovery_min, horarios: hs.map(h => ({ fecha: h.fecha, hora: h.hora, dicho: h.etiqueta })), nota: hora ? 'Ofrece los parecidos, con palabras, en una sola pregunta.' : 'Ofrece los tres, con palabras (día y hora «de la mañana/tarde»), en una sola pregunta.' };
    }
    case 'volver_a_llamar': {
      const zona = zonaDeLada(it?.lada || ladaDe(it?.telefono));
      let cuando: Date | undefined;
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(args.fecha || '')) && /^\d{1,2}:\d{2}$/.test(String(args.hora || ''))) {
        const d = instanteEnZona(String(args.fecha), String(args.hora).padStart(5, '0'), zona);
        if (d.getTime() > Date.now() + 60e3 && d.getTime() < Date.now() + 30 * 86400e3) cuando = d;
      }
      const min = Math.max(5, Math.min(7 * 24 * 60, Math.round(Number(args.en_minutos) || 0) || (cuando ? 0 : 60)));
      const dicho = cuando ? etiquetaHorario(String(args.fecha), String(args.hora).padStart(5, '0')) : `en ${min} minutos`;
      if (prueba) return { ok: true, simulado: true, cuando: dicho, nota: 'Es una prueba: no se reprogramó de verdad. NO vuelvas a confirmar la hora: despídete en UNA frase y cuelga con motivo volver_llamar.' };
      const id = await reprogramar(it, min, String(args.motivo || 'lo pidió en la llamada').slice(0, 120), cuando);
      await supabase.from('tel_sesion_items').update({ resultado: 'volver_llamar', updated_at: ahora() }).eq('id', it.id).is('resultado', null);
      /* Y además como tarea: si la hora prometida no cabe en el horario de hoy, `marcarSiguiente` agota la
         sesión y el item reprogramado se queda huérfano. La promesa no puede depender de eso. */
      const ses = await getSesion(it.sesion_id);
      await supabase.from('ti_tareas').insert({
        contact_id: it.contact_id, company_id: it.company_id || null, owner_id: (ses as any)?.owner_id || null,
        familia: 'llamar', tipo: 'llamada', prioridad: 1, vence_at: (cuando || new Date(Date.now() + min * 60000)).toISOString(), origen: 'evento',
        payload: { instruccion: `${String(it.nombre || 'El lead').split(/\s+/)[0]}: le prometiste llamarle ${dicho}`, porque: `Lo pidió en la llamada con Fernanda${args.motivo ? `: «${String(args.motivo).slice(0, 120)}»` : ''}.`, nombre: it.nombre, whatsapp: it.telefono, item_id: id, resultados: { contesto: 'Contestó', buzon: 'Buzón', no_contesto: 'No contestó', reagendar: 'Pidió otra hora' } },
      }).then(() => {}, () => {});
      await anotar({ nombre, en_minutos: min, cuando: cuando?.toISOString() || null, item: id });
      return { ok: true, cuando: dicho, nota: 'Ya quedó programada. NO vuelvas a confirmar la hora: solo despídete en UNA frase corta y cuelga con motivo volver_llamar.' };
    }
    case 'crear_prueba': {
      const email = correoDicho(args.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'el correo no se entendió bien; pídelo de nuevo, letra por letra, una sola vez' };
      if (prueba) return { ok: true, simulado: true, email, nota: 'Es una prueba: no se creó la cuenta. Di que ya quedó creada y que le llega el acceso por WhatsApp y por correo.' };
      if (!it.contact_id) return { ok: false, error: 'no hay contacto en el CRM; di que el equipo le manda el acceso por WhatsApp hoy mismo' };
      await aplicarDatos(it.contact_id, [{ campo: 'email', valor: email, confianza: 0.95, evidencia: 'lo confirmó en la llamada para su cuenta gratis' }], { fuente: 'llamada', conversation_id: it.conversation_id }).catch(() => {});
      const r = await altaPruebaDesdeLlamada(it, email).catch((e) => ({ ok: false as const, error: String(e?.message || e) }));
      await anotar({ nombre, email, ok: r.ok, cuenta: (r as any).cuenta || null, whatsapp: (r as any).whatsapp ?? null });
      if (!r.ok) return { ok: false, error: `no se pudo crear la cuenta en este momento (${r.error}). Di que el equipo se la crea hoy y le manda el acceso por WhatsApp.` };
      if ((r as any).ya_tenia) return { ok: true, cuenta: (r as any).cuenta, nota: 'Ya tenía una cuenta de prueba: NO prometas una nueva. Dile que ya tiene una cuenta con nosotros y que su consultor le escribe hoy por WhatsApp para reactivarla.' };
      return { ok: true, cuenta: (r as any).cuenta, whatsapp: (r as any).whatsapp, nota: (r as any).whatsapp ? 'Di que ya quedó creada y que le llega el acceso por WhatsApp y por correo en un momento.' : 'La cuenta quedó creada pero el WhatsApp no salió (fuera de ventana): di que le llega el acceso por correo y que el equipo le escribe por WhatsApp.' };
    }
    case 'agendar': {
      const tipo = args.tipo === 'demo' ? 'demo' : 'discovery';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(args.fecha || '')) || !/^\d{1,2}:\d{2}$/.test(String(args.hora || ''))) return { ok: false, error: 'fecha u hora mal formadas; usa las de consultar_horarios' };
      if (prueba) return { ok: true, simulado: true, dicho: etiquetaHorario(args.fecha, args.hora), nota: 'Es una prueba: no se agendó de verdad. Confirma en voz alta como si sí.' };
      /* Que el hueco siga libre: entre consultar_horarios y agendar pueden pasar dos minutos, y el modelo
         también podría inventarse una hora que nunca se ofreció. Sin esto se le empalma una cita al consultor. */
      const libres = await horariosParaVoz({ slug: slugDe(tipo), fecha: args.fecha, hora: String(args.hora).padStart(5, '0'), zona: zonaDeLada(it.lada || ladaDe(it.telefono)), max: 8 });
      if (libres.length && !libres.some(h => h.fecha === args.fecha && h.hora === String(args.hora).padStart(5, '0'))) {
        await anotar({ nombre, tipo, fecha: args.fecha, hora: args.hora, ok: false, motivo: 'el hueco ya no está libre' });
        return { ok: false, error: `ese horario ya no está disponible. Ofrécele estos: ${libres.slice(0, 3).map(h => h.etiqueta).join(' · ')}` };
      }
      if (args.email && it.contact_id && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(args.email))) await aplicarDatos(it.contact_id, [{ campo: 'email', valor: String(args.email).trim().toLowerCase(), confianza: 0.9, evidencia: 'lo dictó en la llamada' }], { fuente: 'llamada', conversation_id: it.conversation_id }).catch(() => {});
      const { crearCompromiso } = await import('./cierre');
      const r = await crearCompromiso(it, { tipo: 'reunion', fecha: args.fecha, hora: String(args.hora).padStart(5, '0'), duracion_min: tipo === 'demo' ? 60 : cfg.discovery_min, motivo: String(args.motivo || '').slice(0, 200) || undefined, reunion_tipo: slugDe(tipo), confianza: 1 }, null);
      /* Ojo: `crearCompromiso` devuelve un STRING cuando NO pudo insertar el booking, y un string es truthy.
         Con `if (!r)` Fernanda confirmaba en voz alta una cita que no existía: el peor final de una llamada buena. */
      const fallo = !r || /^no se pudo/.test(String(r));
      await anotar({ nombre, tipo, fecha: args.fecha, hora: args.hora, ok: !fallo, detalle: typeof r === 'string' ? r : null });
      if (fallo) return { ok: false, error: `no se pudo agendar${typeof r === 'string' ? ` (${r})` : ' (quizá ya hay una cita a esa hora)'}. Ofrece otro horario.` };
      return { ok: true, dicho: etiquetaHorario(args.fecha, String(args.hora).padStart(5, '0')), detalle: r, nota: 'Confirma día y hora en voz alta y di que le llega la invitación por WhatsApp y correo.' };
    }
    case 'guardar_dato': {
      const campo = String(args.campo || '').trim().toLowerCase(), valor = String(args.valor || '').trim().slice(0, 200);   // `sucursales` es el nombre bueno; aplicarDatos lo escribe en sucursales_interes
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

/** La cuenta gratis que Fernanda promete en la llamada: se crea en SACS (mismo camino que el botón del CRM), se liga al
 *  contacto y el acceso sale por WhatsApp a ese mismo número. Fuera de la ventana de 24 h Kapso rechaza el texto libre:
 *  la cuenta queda creada (SACS manda su correo de bienvenida) y se deja una tarea para que el consultor le escriba. */
async function altaPruebaDesdeLlamada(it: any, email: string) {
  const { altaCuentaPrueba, DIAS_PRUEBA } = await import('../crm/prueba');
  const { generateUniqueAccountId } = await import('../register');
  const { data: c } = await supabase.from('contacts').select('id, nombre, apellido, email, whatsapp, company_id, prueba_cuenta, companies(nombre, nombre_comercial)').eq('id', it.contact_id).maybeSingle();
  if (!c) return { ok: false as const, error: 'el contacto no existe' };
  if (c.prueba_cuenta) return { ok: true as const, cuenta: c.prueba_cuenta, whatsapp: false, ya_tenia: true };
  const empresa = (c as any).companies?.nombre_comercial || (c as any).companies?.nombre || it.empresa || c.nombre || 'tienda';
  const { data: yaCliente } = await supabase.from('company_sacs_accounts').select('cuenta').eq('company_id', c.company_id || '').limit(1);
  if (yaCliente?.length) return { ok: false as const, error: `esta empresa ya tiene la cuenta ${yaCliente[0].cuenta} en Sacs; dile que le pasas el dato a su consultor y no prometas una cuenta nueva` };
  const cuenta = await generateUniqueAccountId(empresa);
  /* Candado: solo el primero crea. El modelo puede llamar la herramienta dos veces y la central corta a los
     20 s, así que un reintento es esperable; sin esto salen dos cuentas reales en SACS con dos contraseñas. */
  const { data: claim } = await supabase.from('contacts').update({ prueba_cuenta: cuenta, updated_at: ahora() }).eq('id', c.id).is('prueba_cuenta', null).select('id');
  if (!claim?.length) {
    const { data: y } = await supabase.from('contacts').select('prueba_cuenta').eq('id', c.id).maybeSingle();
    return { ok: true as const, cuenta: y?.prueba_cuenta || cuenta, whatsapp: false, ya_tenia: true };
  }
  const r = await altaCuentaPrueba({ ...c, email }, { cuenta, dias: DIAS_PRUEBA, quien: 'Fernanda (llamada)' });
  if (!r.ok) { await supabase.from('contacts').update({ prueba_cuenta: null }).eq('id', c.id).eq('prueba_cuenta', cuenta); return { ok: false as const, error: r.error }; }
  const tel = String(it.telefono || c.whatsapp || '').replace(/\D/g, '');
  /* La contraseña NO va por WhatsApp: Kapso espeja los salientes a `wa_mensajes` y quedaría guardada en el
     inbox, justo lo que el alta promete que no pasa. SACS ya se la manda en su correo de bienvenida. */
  const texto = `Hola${c.nombre ? ` ${String(c.nombre).split(/\s+/)[0]}` : ''}, soy Fernanda, de Sacscloud. Ya quedó creada tu cuenta gratis de ${DIAS_PRUEBA} días.\n\nEntra en ${r.url}\nCuenta: ${cuenta}\nCorreo: ${email}\n\nTu contraseña temporal te llega al correo, en el mensaje de bienvenida de Sacs. Cualquier duda, aquí me escribes.`;
  let whatsapp = false;
  try {
    const { enviarTexto } = await import('../whatsapp/kapso-api');
    if (tel) { await enviarTexto(tel, texto); whatsapp = true; }
  } catch (e: any) {
    // Sin ventana de 24 h no sale texto libre. La contraseña no se guarda (regla del alta): el consultor la restablece desde SACS.
    /* `wa_libre` está filtrado en la torre y en Mi día desde el 3-sep: una tarea de ese tipo no la ve nadie. */
    const { data: ses } = await supabase.from('tel_sesiones').select('owner_id').eq('id', it.sesion_id).maybeSingle();
    await supabase.from('ti_tareas').insert({
      contact_id: c.id, company_id: c.company_id || null, owner_id: (ses as any)?.owner_id || null,
      familia: 'avanzar', tipo: 'responder', prioridad: 1, vence_at: ahora(), origen: 'evento',
      payload: { instruccion: `${String(c.nombre || '').split(/\s+/)[0] || 'El lead'}: mándale por WhatsApp el acceso a su cuenta gratis (${cuenta})`, porque: `Fernanda le creó la cuenta en la llamada y el WhatsApp no salió (${String(e?.message || e).slice(0, 120)}). SACS ya le mandó el correo de bienvenida a ${email}; si no lo ve, restablécele la contraseña desde SACS y mándasela.`, nombre: c.nombre, whatsapp: it.telefono },
    }).then(() => {}, () => {});
  }
  return { ok: true as const, cuenta, whatsapp, fin: r.fin };
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
