// UNA LLAMADA CON VOZ-A-VOZ DE OPENAI · Twilio Media Streams ↔ OpenAI Realtime/Live.
//
// Aquí Twilio ya no transcribe ni pone la voz: nos manda el AUDIO crudo de la
// llamada (μ-law 8 kHz) y nosotros lo pasamos a OpenAI, que oye y habla en un
// solo modelo. Nada de STT → LLM → TTS: la voz sale con entonación, se puede
// interrumpir y no hay segundos de silencio entre eslabones.
//
// El cerebro sigue siendo el CRM: el system y las herramientas vienen de
// crm.contexto(), las herramientas las ejecuta el CRM, y el fin se reporta igual.
import WebSocket from 'ws';
import * as crm from './crm.mjs';

export const MODELO_OPENAI = process.env.MODELO_OPENAI || 'gpt-realtime-2.1';
export const VOZ_OPENAI = process.env.VOZ_OPENAI || 'marin';
export const hayOpenAI = () => !!process.env.OPENAI_API_KEY;

const SILENCIO_PREGUNTA_MS = 12000;   // medido: por teléfono en México la gente tarda 6-14 s en contestar; a los 8 s la atropellaba
const SILENCIO_ADIOS_MS = 10000;
const MAX_MIN = 12;
const MAX_TURNOS = 60;
const log = (...a) => console.log(new Date().toISOString(), ...a);

// USD por millón de tokens (developers.openai.com/api/docs/pricing, sep-2026).
const PRECIOS = {
  'gpt-realtime-2.1': { audioIn: 32, audioCache: 0.4, audioOut: 64, textIn: 4, textCache: 0.4, textOut: 24 },
  'gpt-realtime-2.1-mini': { audioIn: 10, audioCache: 0.3, audioOut: 20, textIn: 0.6, textCache: 0.06, textOut: 2.4 },
};
export function costoOpenAI(uso, modelo = MODELO_OPENAI) {
  if (modelo.startsWith('gpt-live')) return (uso.segundos || 0) / 60 * 0.05;
  const p = PRECIOS[modelo] || PRECIOS['gpt-realtime-2.1'];
  return ((uso.audioIn || 0) * p.audioIn + (uso.audioCache || 0) * p.audioCache + (uso.audioOut || 0) * p.audioOut
    + (uso.textIn || 0) * p.textIn + (uso.textCache || 0) * p.textCache + (uso.textOut || 0) * p.textOut) / 1e6;
}

// Cómo decide OpenAI que la persona terminó de hablar. VAD_OPENAI=server|semantic[:low|medium|high].
// El semántico entiende pausas a media frase pero puede tardar segundos en decidirse; el
// de servidor corta a los N ms de silencio, predecible para el teléfono.
const vad = () => {
  const [tipo, nivel] = String(process.env.VAD_OPENAI || 'server').split(':');
  // Al teléfono 'high' es «contesta en cuanto puedas»: le pisa las pausas. Por eso 'low'.
  if (tipo === 'semantic') return { type: 'semantic_vad', eagerness: nivel || 'low', create_response: true, interrupt_response: true };
  /* Medido en llamadas reales: con umbral 0.4 —por debajo del 0.5 de fábrica— un clic de la línea
     (pico 2107 sobre un piso de 53) abría un turno vacío que cancelaba la respuesta en vuelo; y con
     450-600 ms de ventana lo cortaba a media frase («…lo manejo en Excel» / «También»), que es justo
     el «responde a otra cosa». Piso de silencio 0-50, voz 500+: sobra margen para 0.55. */
  return {
    type: 'server_vad',
    threshold: Number(process.env.VAD_UMBRAL || 0.55),
    prefix_padding_ms: Number(process.env.VAD_PADDING_MS || 300),
    silence_duration_ms: Number(process.env.VAD_SILENCIO_MS || 550),
    create_response: true, interrupt_response: true,
  };
};

/** La ventana de silencio que corre ahora mismo (para restarla al medir la latencia). */
const VENTANA_MS = () => (String(process.env.VAD_OPENAI || 'server').startsWith('semantic') ? 0 : Number(process.env.VAD_SILENCIO_MS || 550));

/** Las herramientas vienen en el formato de Anthropic; OpenAI quiere `parameters`. */
const aFuncion = (h) => ({ type: 'function', name: h.name, description: h.description, parameters: h.input_schema || { type: 'object', properties: {} } });

/** El system del CRM viene por capas (bloques con cache_control); aquí se junta en un texto. */
const aTexto = (system) => (Array.isArray(system) ? system.map((b) => b.text || '').join('\n\n') : String(system || ''));

const VOZ_EXTRA = [
  '# QUIÉN ERES AL OÍDO',
  'Eres Fernanda: una mujer de la Ciudad de México, de unos 30 años, que trabaja en ventas de un sistema para tiendas de ropa y le gusta su trabajo. Naciste y creciste en México; nunca has vivido en Estados Unidos. Español mexicano de verdad, de la calle y de la oficina, no español "neutro" de doblaje ni español traducido del inglés.',
  '# ACENTO (importa mucho)',
  'Pronuncia como chilanga: la «s» siempre clara y silbante (nunca aspirada), la «rr» bien vibrada, las vocales cortas y sin arrastrar, la «d» final suave («usted» casi «usté»). Las «t» y «p» sin soplido, la «j» suave. La melodía sube y baja como en la Ciudad de México: cierra las frases con la entonación cayendo, alarga un poquito la última sílaba de las preguntas («¿hablo con Aarón?»). Nunca suenes como estadounidense hablando español ni como locutora de comercial.',
  '# LA FORMA DE DECIR LAS COSAS (esto es lo que suena gringo si fallas)',
  'Habla como habla la gente en México, con las fórmulas de aquí. Al presentarte: «habla Fernanda, de Sacscloud, en relación a…», «te marco porque…». Para conectar: «mira», «fíjate», «te platico», «¿cómo ves?»; para reaccionar: «ah, ok», «qué bien», «perfecto», «claro que sí», «ándale», «ah, mira». Para cerrar: «quedamos así entonces», «ahí te encargo», «que estés muy bien», «hasta luego».',
  'PROHIBIDO porque suena a traducción del inglés: «¿cómo está usted hoy?», «absolutamente», «genial», «increíble», «estoy emocionada», «excelente pregunta», «no hay problema», «déjeme ver», «déjeme escuchar», «eso suena bien», «tiene sentido», «gracias por tu tiempo hoy», «que tengas un gran día», «voy a ir adelante y…», «básicamente», «definitivamente», «amo eso». Tampoco digas «tú» en cada frase: en México se sobreentiende por la conjugación.',
  'Hablas de TÚ, con respeto y calidez (así habla el equipo de Sacs con los dueños de tiendas); solo pasas a usted si la persona es claramente mayor o te habla de usted con insistencia. Diminutivos con medida y solo donde un mexicano los usaría («un momentito», «dos minutitos», «ahorita»).',
  '# CÓMO SUENAS',
  'Cálida, con energía y con una sonrisa que se oye. Suenas como alguien real que marca por teléfono, no como un asistente ni una grabación. Ritmo conversacional: pausas cortas donde una persona respira, subes en las preguntas, bajas al cerrar. Reacciona a lo que te dicen antes de seguir (un «ah, ok» o «qué bien» breve). Varía la entonación; nunca monótona, nunca sobreactuada: es una llamada de trabajo amable.',
  '# CÓMO HABLAS',
  '# LA REGLA QUE MANDA: TU TURNO ES CORTO Y SE ACABA EN LA PREGUNTA',
  'Máximo DOS oraciones cortas por turno. Cuando haces una pregunta, TU TURNO SE ACABÓ: cierras la boca y esperas la respuesta, aunque tarde. Nunca contestes tu propia pregunta, nunca agregues «si te viene bien…», «si ahora no puedes…», «como inventarios, ventas, reportes…». Una idea, una pregunta, silencio.',
  'Nunca ofrezcas una lista de opciones ni enumeres temas: al teléfono eso suena a robot leyendo un menú. Si tienes que ofrecer dos cosas, son dos, en una sola frase, y ya.',
  'MULETILLAS: como máximo UNA por cada tres turnos, y nunca la misma dos veces en la llamada. «Sí, mira» se usa UNA sola vez en toda la llamada, o ninguna. «Ah, perfecto» y «ah, ok» igual: una vez cada una. Si el turno anterior arrancó con muletilla, este entra directo al contenido, sin preámbulo.',
  'Antes de repetir cualquier arranque que ya usaste, prefiere entrar con lo que él te acaba de decir: «entonces el sistema que tienes no entiende tallas», «o sea que hoy lo llevas en Excel». Empezar con sus palabras suena a persona; empezar con una muletilla tres veces seguidas es lo que más te delata como máquina. Los párrafos completos y bien redactados también.',
  'Si te interrumpen, te callas y escuchas. Si no entendiste lo que dijo, di solo «perdón, no te escuché bien» y espera: no improvises un discurso.',
  'Nunca repitas una pregunta ni pidas que te repitan. Si la respuesta fue corta o quedó a medias, toma lo que dijo y pasa a la siguiente pregunta. Solo pides repetir un dato exacto (correo, hora), una sola vez.',
  'Nunca digas que eres un modelo de OpenAI ni menciones tecnología: si preguntan si eres un robot, responde como te indica el guion.',
  '# NUNCA TE ANUNCIES (medido: es lo que más te delata)',
  'Prohibido el turno de relleno que describe lo que vas a hacer: «te explico rápido quién te llama», «déjame escuchar eso», «vamos a aterrizarlo a tu operación», «déjame llevar eso a una escena clara», «permíteme un momento», «déjame revisar la agenda del consultor». Es un turno entero desperdiciado y suena a máquina narrándose a sí misma. Entra DIRECTO con lo que le ibas a decir.',
  'Una sola excepción en toda la llamada: «un segundo, reviso la agenda», y solo justo antes de consultar los horarios. Con CUALQUIER otra herramienta tu turno va SIN TEXTO: la llamas sola y hablas hasta tener el resultado.',
  'Si de plano necesitas un instante para pensar, lo único permitido es una reacción de UNA o DOS palabras («mmm», «ah, ok», «claro», «va») y sigues en el mismo turno. Una frase que describa lo que vas a hacer («déjame enfocarme en cómo lo estás manejando hoy») no es pensar en voz alta: es un turno perdido que suena a máquina.',
  'Cada turno tuyo cabe en treinta y cinco palabras. Si no cabe, es porque estás explicando de más: corta y quédate con la parte que le mueve algo.',
  '# EMPATÍA AL OÍDO (esto es lo que hace que quiera verlo, no las palabras)',
  'Cuando te cuenta algo que le cuesta dinero o que lo trae cansado (que lo lleva en Excel, que su sistema no le sirve, que se le quedó mercancía colgada), NO arranques a hablar de inmediato: haz una pausa corta de verdad, baja un poco la voz y desacelera, como quien acaba de entender algo. Un «mmm» o un «ay, sí» breve y sentido vale más que cualquier frase.',
  'Cuando le devuelves su dolor con sus palabras, dilo despacio y con la entonación cayendo, no como pregunta ni como lista. Cuando le pintas la escena de su tienda, dilo como si la estuvieras viendo: con ritmo de anécdota, no de explicación.',
  'Cuando propones la demo o los horarios, sube un poco la energía y la sonrisa: ahí es donde se oye que tú crees que le va a servir. Nunca suenes ansiosa ni suplicante; suenas como quien le está haciendo un favor razonable, no como quien necesita la cita.',
  'Si dices un número (una cifra de un cliente real, un precio, una hora), dilo más lento que el resto de la frase y haz una micropausa después. Los números dichos rápido no se oyen.',
  'Termina siempre con la entonación cayendo, salvo cuando preguntas. Y cuando preguntaste, aguanta el silencio: por teléfono en México la gente tarda cinco, ocho o diez segundos en contestar, y llenar ese hueco con otra frase es el error que arruina la llamada.',
  'Nunca digas la misma frase dos veces en la llamada, aunque sea correcta.',
].join('\n');

export class SesionOpenAI {
  constructor(ws, { alCerrar } = {}) {
    this.ws = ws;                 // Twilio Media Streams
    this.ai = null;               // OpenAI Realtime
    this.alCerrar = alCerrar;
    this.item = null; this.callSid = null; this.streamSid = null;
    this.ctx = null;
    this.prueba = false;
    this.silenciada = false;      // AMD dijo máquina: no se le manda audio a Twilio
    this.sorda = false;           // no se le manda a OpenAI lo que entra (buzón grabando)
    this.terminando = false; this.cerrada = false;
    this.turnos = 0; this.t0 = Date.now();
    this.transcripcion = [];
    this.metricas = { latencias: [], herramientas: [], interrupciones: 0, errores: 0, uso: { audioIn: 0, audioCache: 0, audioOut: 0, textIn: 0, textCache: 0, textOut: 0 } };
    this.timers = {};
    // Para truncar lo que no alcanzó a oírse al interrumpir.
    this.tsTwilio = 0;            // último timestamp (ms) del audio entrante
    this.respuesta = null;        // { id, itemId, tsInicio, bytes, marcada }
    this.marcasPendientes = new Set();
    this.despuesDeHablar = null;
    this.hablando = false;        // la persona está hablando AHORA (entre speech_started y speech_stopped)
    this.enVuelo = null;          // la respuesta cuyo audio TODAVÍA suena en Twilio (aunque OpenAI ya la generó)
    this.finCola = 0;             // en la escala de tsTwilio: cuándo se vacía la cola de reproducción de Twilio
    this.instrucciones = '';      // el guion de la sesión, para no perderlo en nuestros propios response.create
    this.tHablaDesde = 0;         // cuándo dejó de hablar la persona (para medir latencia)
    this.abiertaAi = false;
    this.listaAi = false;
  }

  // ---------- Twilio Media Streams → nosotros ----------
  async recibir(msg) {
    switch (msg.event) {
      case 'connected': return;
      case 'start': return this.alStart(msg);
      case 'media':
        this.tsTwilio = Number(msg.media?.timestamp || this.tsTwilio);
        if (process.env.DEBUG_OPENAI) this.medirEntrada(msg.media?.payload);
        if (this.listaAi && !this.silenciada && !this.sorda && msg.media?.payload) this.aAi({ type: 'input_audio_buffer.append', audio: msg.media.payload });
        return;
      case 'mark': return this.alMarca(msg.mark?.name);
      case 'dtmf': return log(`[${this.item}] dtmf ${msg.dtmf?.digit}`);
      case 'stop': return this.cerrar();
      default: return;
    }
  }

  // Con DEBUG_OPENAI: cada 5 s, cuántos paquetes llegaron de Twilio y qué tan fuerte suena la persona.
  medirEntrada(b64) {
    if (!b64) return;
    const b = Buffer.from(b64, 'base64'); let suma = 0;
    for (let i = 0; i < b.length; i += 4) { const u = ~b[i] & 0xff; const mag = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4); suma += mag - 0x84; }
    const m = (this.entrada ||= { paquetes: 0, energia: 0, pico: 0, t: Date.now() });
    m.paquetes++; const e = suma / (b.length / 4); m.energia += e; if (e > m.pico) m.pico = e;
    if (Date.now() - m.t >= 5000) { log(`[${this.item}] entrada: ${m.paquetes} paquetes/5s, nivel medio ${Math.round(m.energia / m.paquetes)}, pico ${Math.round(m.pico)} (silencio ≈ 0-50, voz ≈ 500+)`); this.entrada = null; }
  }

  async alStart(msg) {
    this.streamSid = msg.streamSid || msg.start?.streamSid;
    this.callSid = msg.start?.callSid;
    const p = msg.start?.customParameters || {};
    this.item = p.item || null;
    this.prueba = p.prueba === '1' || p.prueba === 'true';
    if (!this.item || !crm.tokenValido(this.item, p.token)) {
      log('start rechazado: token inválido', { item: this.item, callSid: this.callSid });
      return this.terminar('token', 0);
    }
    log(`[${this.item}] start call=${this.callSid} stream=${this.streamSid} prueba=${this.prueba} motor=${MODELO_OPENAI}/${p.voz || VOZ_OPENAI}`);
    try {
      this.ctx = await crm.contexto(this.item, { prueba: this.prueba, callSid: this.callSid, saludo: p.saludo || '' });
    } catch (e) {
      log(`[${this.item}] sin contexto del CRM:`, e.message);
      this.metricas.errores++;
      return this.terminar('sin_contexto', 0);
    }
    this.saludo = this.ctx.saludo || p.saludo || '';
    this.voz = p.voz || VOZ_OPENAI;
    this.abrirAi();
  }

  // ---------- OpenAI ----------
  abrirAi() {
    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODELO_OPENAI)}`;
    this.ai = new WebSocket(url, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, perMessageDeflate: false, skipUTF8Validation: true });
    this.ai.on('open', () => {
      this.abiertaAi = true;
      this.aAi({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: MODELO_OPENAI,
          output_modalities: ['audio'],
          instructions: (this.instrucciones = `${aTexto(this.ctx.system)}\n\n${VOZ_EXTRA}`),
          audio: {
            input: {
              format: { type: 'audio/pcmu' },
              transcription: { model: process.env.MODELO_TRANSCRIBE || 'gpt-4o-mini-transcribe', language: 'es' },
              turn_detection: vad(),
            },
            output: { format: { type: 'audio/pcmu' }, voice: this.voz, speed: Number(process.env.VELOCIDAD_OPENAI || 1.0) },
          },
          tools: (this.ctx.herramientas || []).map(aFuncion),
          tool_choice: 'auto',
          /* Tope contra los monólogos. Medido: el audio va a ~36 tokens por segundo, así que 500 tokens son
             unos doce segundos hablados —dos oraciones largas— y 300 la cortaban a media frase («…para que no
             vendas lo que ya no», y luego preguntaba si seguías ahí). El freno de verdad es el guion; esto es
             solo la red por si se desborda. */
          max_output_tokens: Number(process.env.MAX_TOKENS_TURNO || 1200),
        },
      });
    });
    this.ai.on('message', (raw) => { let e; try { e = JSON.parse(raw.toString()); } catch { return; } try { this.deAi(e); } catch (err) { log(`[${this.item}] error con ${e.type}:`, err.message); } });
    this.ai.on('close', (code, reason) => { log(`[${this.item}] OpenAI cerró ${code} ${reason}`); if (!this.terminando) this.terminar('openai_cerro', 0); });
    this.ai.on('error', (e) => { this.metricas.errores++; log(`[${this.item}] OpenAI error:`, e.message); });
    this.ai.on('unexpected-response', (_, res) => { let s = ''; res.on('data', (c) => (s += c)); res.on('end', () => { log(`[${this.item}] OpenAI rechazó: HTTP ${res.statusCode} ${s.slice(0, 200)}`); this.terminar('openai_rechazo', 0); }); });
  }

  deAi(e) {
    if (process.env.DEBUG_OPENAI && !/delta$/.test(e.type)) log(`[${this.item}] <- ${e.type}${e.type === 'error' ? ' ' + JSON.stringify(e.error) : ''}`);
    switch (e.type) {
      case 'session.created': return;
      case 'session.updated':
        if (this.listaAi) return;
        this.listaAi = true;
        log(`[${this.item}] OpenAI lista: voz ${e.session?.audio?.output?.voice}, vad ${e.session?.audio?.input?.turn_detection?.type}`);
        // El saludo lo dice ella (Twilio ya no tiene welcomeGreeting): se le pide como primera respuesta.
        if (this.saludo && !this.silenciada) {
          this.pedirTurno(`Abre la llamada diciendo SOLO esto, como lo diría una persona real que marca (cálida, con una sonrisa, sin prisa), y luego cállate y espera a que conteste. No te presentes todavía ni digas a qué llamas: «${this.saludo}»`);
          this.anotar('fernanda', this.saludo);
          this.mensajeSaludo = true;
        }
        return;
      case 'input_audio_buffer.speech_started':
        this.hablando = true;
        this.cancelarSilencio();
        this.interrumpir();   // corta lo que se está OYENDO, aunque OpenAI ya haya terminado de generarlo
        return;
      case 'input_audio_buffer.speech_stopped':
        this.hablando = false;
        /* El ancla de la latencia es el fin REAL del habla, no este evento: OpenAI lo manda después de
           la ventana de silencio, así que medir desde aquí hacía que bajar la ventana «subiera» la latencia. */
        this.tHablaDesde = Date.now() - VENTANA_MS();
        if (!this.sonando()) this.armarSilencio();
        return;
      case 'conversation.item.input_audio_transcription.completed': {
        const dicho = String(e.transcript || '').trim();
        if (!dicho) return;
        this.turnos++;
        this.anotar('contacto', dicho);
        if (!this.prueba) this.reportarTurno('contacto', dicho).then((r) => this.alVeredicto(r?.veredicto)).catch(() => {});
        if (this.turnos > MAX_TURNOS || Date.now() - this.t0 > MAX_MIN * 60000) this.despedirse('Le agradezco mucho su tiempo. Le mando la información por WhatsApp y quedamos en contacto. ¡Hasta luego!', 'tope');
        return;
      }
      case 'conversation.item.input_audio_transcription.failed':
        this.metricas.errores++; return log(`[${this.item}] transcripción falló:`, e.error?.message);
      case 'response.created':
        this.respuesta = { id: e.response?.id, itemId: null, tsInicio: 0, bytes: 0, terminada: false, primerAudio: 0 };
        return;
      case 'response.output_audio.delta': {
        if (this.silenciada) return;
        const r = this.respuesta;
        if (r && !r.primerAudio) {
          this.cancelarSilencio();
          r.primerAudio = Date.now();
          // Twilio no empieza a reproducir esto hasta vaciar lo que ya tenía en cola.
          r.tsInicio = Math.max(this.tsTwilio, this.finCola);
          r.itemId = e.item_id;
          this.enVuelo = r;
          if (this.tHablaDesde) {
            const ms = r.primerAudio - this.tHablaDesde;
            this.metricas.latencias.push({ primero: ms, total: ms, vueltas: 0 });
            log(`[${this.item}] primer audio a los ${ms} ms del fin del habla`);
            this.tHablaDesde = 0;
          }
        }
        if (r) { r.bytes += Buffer.byteLength(e.delta, 'base64'); this.finCola = r.tsInicio + r.bytes / 8; }
        this.aTwilio({ event: 'media', streamSid: this.streamSid, media: { payload: e.delta } });
        return;
      }
      case 'response.output_audio_transcript.done': {
        const t = String(e.transcript || '').trim();
        if (t && !(this.mensajeSaludo && t === this.saludo)) { this.anotar('fernanda', t); if (!this.prueba) this.reportarTurno('fernanda', t).catch(() => {}); }
        this.mensajeSaludo = false;
        return;
      }
      case 'response.output_item.done':
        if (e.item?.type === 'function_call') this.herramienta(e.item);
        return;
      case 'response.done': {
        const r = e.response || {};
        this.sumarUso(r.usage);
        if (this.respuesta && (!r.id || r.id === this.respuesta.id)) {
          this.respuesta.terminada = true;
          // Marca al final del audio: cuando Twilio la devuelve, ya se oyó todo.
          if (this.respuesta.bytes) { const m = `fin-${this.respuesta.id}`; this.marcasPendientes.add(m); this.aTwilio({ event: 'mark', streamSid: this.streamSid, mark: { name: m } }); }
          /* Una respuesta SIN audio (el VAD cometió un ruido y el modelo no dijo nada) no significa que
             Fernanda ya terminó de hablar: si aún hay audio suyo en vuelo, armar aquí el reloj del silencio
             la hace preguntar «¿sigues ahí?» ENCIMA de su propia frase. Medido en prueba-mtx2qvbd. */
          else if (!this.sonando()) this.alMarca(null);
        }
        if (r.status === 'failed') { this.metricas.errores++; log(`[${this.item}] respuesta falló:`, JSON.stringify(r.status_details).slice(0, 200)); }
        else if (r.status === 'incomplete') log(`[${this.item}] respuesta INCOMPLETA (${r.status_details?.reason}): se cortó a media frase`);
        return;
      }
      case 'error':
        this.metricas.errores++;
        if (e.error?.code === 'response_cancel_not_active' || e.error?.code === 'item_truncate_invalid') return;
        return log(`[${this.item}] OpenAI dijo:`, e.error?.code, e.error?.message);
      default: return;
    }
  }

  /** Nuestros propios `response.create`. En la API GA, `instructions` SUSTITUYE las de la sesión: si
   *  mandamos solo la orden, ESE turno sale sin guion, sin acento y sin la regla de las dos oraciones
   *  (así salía el saludo —la primera impresión— y el «¿sigues ahí?»). */
  pedirTurno(orden, { cortar = false } = {}) {
    if (cortar) this.interrumpir();
    else if (this.respuesta && !this.respuesta.terminada) this.aAi({ type: 'response.cancel', response_id: this.respuesta.id });
    this.aAi({ type: 'response.create', response: { instructions: `${this.instrucciones}\n\n# LO QUE TIENES QUE HACER AHORA\n${orden}` } });
  }

  /** ¿Se está OYENDO a Fernanda ahora mismo? `terminada` solo dice que OpenAI acabó de GENERAR, y genera
   *  cinco veces más rápido de lo que se habla: 2.4 s de generación son 13 s de voz en la línea. Durante
   *  ese resto, la llamada seguía «terminada» y el barge-in no corría. */
  sonando() { return this.marcasPendientes.size > 0 || !!(this.respuesta && !this.respuesta.terminada); }

  /** La persona habló encima: se limpia lo que Twilio aún no reprodujo y se recorta el historial a lo que sí oyó. */
  interrumpir() {
    const r = (this.respuesta && !this.respuesta.terminada) ? this.respuesta : (this.marcasPendientes.size ? this.enVuelo : null);
    if (!r || r.cortada) return;
    r.cortada = true;
    this.metricas.interrupciones++;
    this.aTwilio({ event: 'clear', streamSid: this.streamSid });
    if (r?.itemId && r.tsInicio) {
      const oidoMs = Math.max(0, Math.min(this.tsTwilio - r.tsInicio, r.bytes / 8));   // μ-law: 8 bytes por ms
      this.aAi({ type: 'conversation.item.truncate', item_id: r.itemId, content_index: 0, audio_end_ms: Math.round(oidoMs) });
      log(`[${this.item}] interrumpida a los ${Math.round(oidoMs)} ms de ${Math.round(r.bytes / 8)}`);
    }
    if (!r.terminada) this.aAi({ type: 'response.cancel', response_id: r.id });
    this.marcasPendientes.clear();
    this.finCola = this.tsTwilio;
    this.enVuelo = null;
    r.terminada = true;
  }

  /** Twilio devolvió la marca: lo último que dijo Fernanda ya se oyó completo. */
  alMarca(nombre) {
    if (nombre) {
      if (!this.marcasPendientes.has(nombre)) return;
      this.marcasPendientes.delete(nombre);
      if (this.enVuelo && nombre === `fin-${this.enVuelo.id}`) this.enVuelo = null;
      if (this.marcasPendientes.size) return;   // todavía le queda audio por sonar
    }
    if (this.despuesDeHablar) { const f = this.despuesDeHablar; this.despuesDeHablar = null; return f(); }
    this.armarSilencio();
  }

  async herramienta(item) {
    let args = {};
    try { args = item.arguments ? JSON.parse(item.arguments) : {}; } catch { args = {}; }
    const th = Date.now();
    let res;
    try { res = await this.ejecutar(item.name, args); } catch (e) { res = { error: e.message }; this.metricas.errores++; }
    this.metricas.herramientas.push({ nombre: item.name, ms: Date.now() - th, ok: !res?.error });
    log(`[${this.item}] herramienta ${item.name}(${item.arguments}) → ${JSON.stringify(res).slice(0, 120)}`);
    if (res?.colgar) { this.despuesDeHablar = () => this.terminar(res.colgar === true ? 'colgo_fernanda' : String(res.colgar)); }
    if (res?.pasar) { this.despuesDeHablar = () => this.terminar('pasa_a_humano', 0, { handoff: res.pasar }); }
    this.aAi({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: item.call_id, output: JSON.stringify(res ?? {}) } });
    // Tras colgar/pasar no hay nada más que decir; con las demás, que siga con el resultado.
    if (!res?.colgar && !res?.pasar) {
      /* Si mientras corría la herramienta el VAD abrió otra respuesta, esa NO vio el resultado: se cancela…
         pero SOLO si todavía no ha dicho nada. Si ya está hablando, cortarla la parte a media palabra
         («Tu tienda no vende solo blusas, vende…», medido en simulación): mejor que termine y OpenAI encola
         la del resultado detrás. */
      if (this.respuesta && !this.respuesta.terminada && !this.respuesta.bytes) this.aAi({ type: 'response.cancel', response_id: this.respuesta.id });
      this.aAi({ type: 'response.create' });
    } else if (!this.sonando()) { const f = this.despuesDeHablar; this.despuesDeHablar = null; f?.(); }
  }

  async ejecutar(nombre, args) {
    if (nombre === 'colgar') return { ok: true, colgar: args?.motivo || true };
    if (nombre === 'pasar_a_humano') {
      if (this.prueba) return { ok: false, motivo: 'En la prueba no hay vendedor en la sala; sigue tú.' };
      const r = await crm.herramienta(this.item, nombre, args);
      return r?.ok && r.handoff ? { ...r, pasar: r.handoff } : r;
    }
    if (this.prueba) {
      /* En la prueba nada ESCRIBE en el CRM: no se agenda, no se reprograma y NO se crea ninguna cuenta real
         en SACS. La agenda sí se consulta de verdad (solo lee), porque inventar «mañana a las once» hacía que
         en las simulaciones ofreciera horarios que no existen. */
      if (nombre === 'consultar_horarios') return crm.herramienta(this.item, nombre, args).catch(() => ({ ok: true, horarios: [], nota: 'No pude ver la agenda; ofrece que el consultor le escriba por WhatsApp.' }));
      const finge = {
        volver_a_llamar: { cuando: args?.en_minutos ? `en ${args.en_minutos} minutos` : 'a la hora que pidió', nota: 'Ya quedó programada. NO vuelvas a confirmar la hora: despídete en UNA frase corta y cuelga con motivo volver_llamar.' },
        crear_prueba: { cuenta: 'boutiqueprueba', whatsapp: true, nota: 'Di que ya quedó creada y que le llega el acceso por WhatsApp y por correo.' },
      }[nombre] || {};
      return { ok: true, simulado: true, nota: 'Prueba: la herramienta no se ejecutó de verdad. Actúa como si hubiera funcionado.', ...finge };
    }
    return crm.herramienta(this.item, nombre, args);
  }

  // ---------- eventos desde el CRM (mismos que la sesión de ConversationRelay) ----------
  async evento(ev, datos = {}) {
    log(`[${this.item}] evento ${ev}`, datos.motivo || '');
    switch (ev) {
      case 'maquina': this.silenciada = true; this.sorda = true; this.aTwilio({ event: 'clear', streamSid: this.streamSid }); this.cancelarSilencio(); return;
      case 'buzon': {
        const texto = datos.mensaje || this.ctx?.mensajeBuzon;
        if (!texto) return this.terminar('buzon_sin_mensaje');
        this.silenciada = false; this.sorda = true;   // habla ella; la grabadora no cuenta como voz
        this.despuesDeHablar = () => this.terminar('buzon_mensaje');
        this.pedirTurno(`Di exactamente esto y nada más: «${texto}»`);
        this.anotar('fernanda', texto);
        return;
      }
      case 'persona': this.silenciada = false; this.sorda = false; return;
      case 'decir':
        if (!datos.texto) return;
        this.pedirTurno(`Di exactamente esto, con naturalidad: «${datos.texto}»`);
        return;
      case 'tomar': return this.despedirse(datos.texto || 'Le paso con mi compañero, un momento por favor.', 'pasa_a_humano', { handoff: datos.handoff || { tomar: true } });
      case 'colgar': return this.despedirse(datos.texto || '', datos.motivo || 'colgo_crm');
      default: return;
    }
  }

  // ---------- silencios ----------
  armarSilencio() {
    this.cancelarSilencio();
    if (this.silenciada || this.terminando || this.hablando || this.sonando()) return;
    this.timers.pregunta = setTimeout(() => {
      if (this.terminando) return;
      if (this.hablando || this.sonando()) return this.armarSilencio();   // ni encima de él ni encima de ella
      this.pedirTurno(`La persona lleva un rato callada. Pregunta brevemente si sigue ahí${this.ctx?.nombre ? ` (se llama ${this.ctx.nombre})` : ''}. UNA sola frase corta y te callas.`);
      this.timers.adios = setTimeout(() => { if (!this.terminando) this.despedirse('Parece que se cortó. Le marco después. ¡Hasta luego!', 'silencio'); }, SILENCIO_ADIOS_MS);
    }, SILENCIO_PREGUNTA_MS);
  }
  cancelarSilencio() { clearTimeout(this.timers.pregunta); clearTimeout(this.timers.adios); }

  // ---------- fin ----------
  despedirse(texto, motivo, extra) {
    if (this.terminando) return;
    this.cancelarSilencio();
    if (!texto || !this.listaAi) return this.terminar(motivo, 0, extra);
    this.despuesDeHablar = () => this.terminar(motivo, 0, extra);
    this.pedirTurno(`Di exactamente esto y nada más: «${texto}»`, { cortar: true });
    this.anotar('fernanda', texto);
    // Por si OpenAI nunca contesta: se cuelga de todos modos (20 s: la despedida puede ir detrás de otra frase).
    this.timers.despedida = setTimeout(() => this.terminar(motivo, 0, extra), 20000);
  }

  terminar(motivo, esperaMs = 0, extra = {}) {
    if (this.terminando && this.motivo) return;
    this.terminando = true;
    this.motivo = motivo;
    this.handoff = extra.handoff || null;
    this.cancelarSilencio(); clearTimeout(this.timers.despedida);
    setTimeout(() => {
      log(`[${this.item}] fin (${motivo})`);
      // Cerrar nuestro lado del stream hace que Twilio siga con el TwiML (Hangup o el action del Connect).
      try { this.ws.close(1000, motivo); } catch { /* ya cerrado */ }
      this.cerrar();
    }, esperaMs);
  }

  async cerrar() {
    if (this.cerrada) return;
    this.cerrada = true;
    this.cancelarSilencio(); clearTimeout(this.timers.despedida);
    try { this.ai?.close(); } catch { /* nada */ }
    const lat = this.metricas.latencias.map((l) => l.primero).sort((a, b) => a - b);
    const p = (q) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(q * lat.length))] : 0);
    const uso = { ...this.metricas.uso, segundos: Math.round((Date.now() - this.t0) / 1000) };
    const resumen = {
      motivo: this.motivo || 'colgaron',
      duracionS: uso.segundos,
      turnos: this.turnos,
      latencia: { n: lat.length, mediana: p(0.5), p95: p(0.95), max: lat[lat.length - 1] || 0 },
      herramientas: this.metricas.herramientas,
      interrupciones: this.metricas.interrupciones,
      errores: this.metricas.errores,
      uso,
      modelo: `${MODELO_OPENAI}/${this.voz || VOZ_OPENAI}`,
      costoUsd: Number(costoOpenAI(uso).toFixed(4)),
      transcripcion: this.transcripcion,
      handoff: this.handoff || undefined,
    };
    log(`[${this.item}] cerrada: ${resumen.motivo}, ${resumen.duracionS}s, ${resumen.turnos} turnos, latencia mediana ${resumen.latencia.mediana} ms p95 ${resumen.latencia.p95} ms, $${resumen.costoUsd}`);
    this.alCerrar?.(this, resumen);
    if (this.item && crm.hayCrm()) {
      try { await crm.fin(this.item, { callSid: this.callSid, prueba: this.prueba, ...resumen }); }
      catch (e) { log(`[${this.item}] no se pudo reportar el fin:`, e.message); }
      if (!this.prueba) for (const t of [12000, 30000]) setTimeout(() => crm.latir(this.item).catch((e) => log(`[${this.item}] latido:`, e.message)), t).unref();
    }
  }

  // ---------- utilería ----------
  aTwilio(obj) { if (this.ws.readyState === 1) { try { this.ws.send(JSON.stringify(obj)); } catch (e) { log(`[${this.item}] Twilio no recibió`, e.message); } } }
  aAi(obj) { if (this.ai?.readyState === 1) { try { this.ai.send(JSON.stringify(obj)); } catch (e) { log(`[${this.item}] OpenAI no recibió`, e.message); } } }
  anotar(quien, texto) { this.transcripcion.push({ t: Date.now() - this.t0, quien, texto }); }
  sumarUso(u) {
    if (!u) return;
    const m = this.metricas.uso;
    // Los tokens cacheados vienen incluidos en el total de entrada: se cobran aparte, más baratos.
    const ca = u.input_token_details?.cached_tokens_details?.audio_tokens || 0;
    const ct = u.input_token_details?.cached_tokens_details?.text_tokens || 0;
    m.audioIn += Math.max(0, (u.input_token_details?.audio_tokens || 0) - ca);
    m.textIn += Math.max(0, (u.input_token_details?.text_tokens || 0) - ct);
    m.audioCache += ca; m.textCache += ct;
    m.audioOut += u.output_token_details?.audio_tokens || 0;
    m.textOut += u.output_token_details?.text_tokens || 0;
  }
  reportarTurno(quien, texto) { return crm.turno(this.item, { quien, texto, callSid: this.callSid, t: Date.now() - this.t0 }); }
  alVeredicto(v) { if (v === 'buzon' && !this.silenciada && !this.terminando) { log(`[${this.item}] las reglas dicen buzón`); this.silenciada = true; this.aTwilio({ event: 'clear', streamSid: this.streamSid }); } }
}
