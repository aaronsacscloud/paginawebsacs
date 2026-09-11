// EL PROSPECTO DE MENTIRAS · una llamada completa contra la central, sin teléfono y sin molestar a nadie.
//
// Hace de Twilio: abre el WebSocket de /voz/media, manda el `start` con los mismos parámetros que el TwiML,
// reproduce el audio de Fernanda a ritmo real (20 ms por paquete), le devuelve las marcas —si no, el reloj
// del silencio de la central nunca se arma— y le manda de vuelta la voz del cliente.
//
// Y el cliente es OTRA sesión voz-a-voz: el proyecto de OpenAI solo tiene habilitado el modelo realtime
// (ni TTS ni mini), así que en vez de un guion grabado hay un dueño de tienda de verdad al otro lado, que
// duda, interrumpe y se sale del libreto. Es lo que hace que la prueba valga: mide el TURNO, no el texto.
//
//   node sim-llamada.mjs                  (dueño de boutique: acaba agendando la demo)
//   node sim-llamada.mjs --guion=prueba   (pide la cuenta gratis y dicta su correo)
//   node sim-llamada.mjs --guion=ocupado  («márcame en diez minutos»)
//   node sim-llamada.mjs --guion=dificil  (interrumpe, pregunta el precio, ya tiene sistema)
import WebSocket from 'ws';
import { tokenDe } from './crm.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? '1'] : [a, '1']; }));
const URL_WS = args.url || 'ws://127.0.0.1:8470/media';
const ITEM = `prueba-sim${Math.random().toString(36).slice(2, 8)}`;
const SALUDO = 'Hola, ¿qué tal? ¿Hablo con Aarón?';
const VOZ_CLIENTE = args.vozCliente || 'ash';
const MINUTOS = Number(args.minutos || 4);
const t0 = Date.now();
const log = (...a) => console.log(`${String((Date.now() - t0) / 1000).padStart(7)}s`, ...a);

const PERSONAJES = {
  demo: `Eres Aarón, dueño de una boutique de ropa de dama con DOS sucursales en la Ciudad de México. Te llama una asesora de un sistema para tiendas. Hablas como mexicano normal, de tú, frases cortas.
Tu situación: llevas el inventario en Excel, tienes un sistema genérico que no entiende tallas ni colores, se te va venta porque no sabes qué hay en la otra tienda, y se te pierden los apartados.
Cómo te comportas: contestas lo que te preguntan en una o dos frases, sin adelantarte. Eres un dueño ocupado pero educado. Si te convence, ACEPTAS la demo con el consultor y tomas uno de los horarios que te ofrezca. Cuando ya quedó agendada, te despides y cuelgas.
Cuando pregunte por ti al inicio, contestas «sí, él habla, ¿quién es?». Nunca digas que eres una IA, nunca rompas el personaje, nunca hables más de dos frases seguidas.`,
  prueba: `Eres Aarón, dueño de una zapatería con dos sucursales en Guadalajara. Te llama una asesora de un sistema para tiendas. Hablas de tú, frases cortas, mexicano normal.
Tu situación: llevas el inventario en un cuaderno y un punto de venta viejo; se te rompen las corridas de números y no sabes qué hay en la otra tienda.
Cómo te comportas: contestas corto. Cuando te ofrezca la demo o una cuenta gratis, PIDES LA CUENTA GRATIS para probarlo tú mismo, y le dictas tu correo: «aaron arroba gmail punto com». Cuando te confirme que ya quedó, te despides y cuelgas.
Nunca digas que eres una IA, nunca rompas el personaje, nunca hables más de dos frases seguidas.`,
  ocupado: `Eres Aarón, dueño de una tienda de ropa, y estás ocupado atendiendo. Te llama una asesora.
Contestas «sí, soy yo» y en cuanto se presente le dices que ahorita estás ocupado y que te marque en diez minutos. Si insiste, repites que ahorita no puedes. Cuando quede en marcarte, te despides y cuelgas.
Hablas de tú, frases cortas, mexicano normal. Nunca digas que eres una IA.`,
  dificil: `Eres Aarón, dueño de una joyería con tres sucursales, y estás escéptico. Te llama una asesora de un sistema para tiendas.
La INTERRUMPES a media frase un par de veces, preguntas «¿esto cuánto cuesta?» antes de que termine de explicar, y le dices que ya tienes un sistema. Si te contesta bien y sientes que entiende tu negocio (gramaje, piezas, apartados), aceptas la demo y tomas un horario.
Hablas de tú, frases cortas, mexicano normal. Nunca digas que eres una IA, nunca rompas el personaje.`,
};
const personaje = PERSONAJES[args.guion || 'demo'] || PERSONAJES.demo;

/** El cliente: una sesión realtime que oye el mismo μ-law que oiría un celular. */
class Prospecto {
  constructor(instrucciones, alHablar) {
    this.instrucciones = instrucciones; this.alHablar = alHablar; this.lista = false; this.dijo = [];
    this.ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, perMessageDeflate: false, skipUTF8Validation: true,
    });
    this.ws.on('open', () => this.mandar({
      type: 'session.update',
      session: {
        type: 'realtime', model: 'gpt-realtime-2.1', output_modalities: ['audio'], instructions: this.instrucciones,
        audio: {
          input: { format: { type: 'audio/pcmu' }, transcription: { model: 'gpt-transcribe', language: 'es' }, turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 700, create_response: true, interrupt_response: true } },
          output: { format: { type: 'audio/pcmu' }, voice: VOZ_CLIENTE, speed: 1 },
        },
        max_output_tokens: 300,
      },
    }));
    this.ws.on('message', (raw) => {
      let e; try { e = JSON.parse(raw.toString()); } catch { return; }
      if (e.type === 'session.updated') { this.lista = true; return; }
      if (e.type === 'response.output_audio.delta') return this.alHablar(Buffer.from(e.delta, 'base64'));
      if (e.type === 'response.output_audio_transcript.done') { const t = String(e.transcript || '').trim(); if (t) { this.dijo.push(t); log(`CLIENTE : ${t}`); } return; }
      if (e.type === 'error') log('(cliente) error', e.error?.code, e.error?.message);
    });
    this.ws.on('error', (e) => log('(cliente) ws', e.message));
  }
  mandar(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  oir(b64) { if (this.lista) this.mandar({ type: 'input_audio_buffer.append', audio: b64 }); }
  cerrar() { try { this.ws.close(); } catch { /* ya estaba cerrada */ } }
}

let ts = 0;                       // el reloj del stream, como el de Twilio
let cola = Buffer.alloc(0);       // audio de Fernanda pendiente de "reproducir"
let marcas = [];                  // sus marcas, con el byte en el que caen
let bytesOidos = 0, terminado = false;
let miAudio = Buffer.alloc(0);    // lo que el cliente está diciendo

const ws = new WebSocket(URL_WS);
const mandar = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const prospecto = new Prospecto(personaje, (pcmu) => { miAudio = Buffer.concat([miAudio, pcmu]); });

function tick() {
  if (terminado) return;
  ts += 20;
  let deElla = null;
  if (cola.length) {
    const n = Math.min(160, cola.length);
    deElla = cola.subarray(0, n);
    cola = cola.subarray(n); bytesOidos += n;
    for (const m of marcas.filter((x) => x.byte <= bytesOidos)) mandar({ event: 'mark', streamSid: 'MZsim', mark: { name: m.name } });
    marcas = marcas.filter((x) => x.byte > bytesOidos);
  }
  prospecto.oir((deElla || Buffer.alloc(160, 0xff)).toString('base64'));
  let trozo;
  if (miAudio.length) { trozo = miAudio.subarray(0, 160); miAudio = miAudio.subarray(160); }
  else trozo = Buffer.alloc(160, 0xff);     // μ-law: 0xff es silencio
  mandar({ event: 'media', streamSid: 'MZsim', media: { track: 'inbound', chunk: String(ts / 20), timestamp: String(ts), payload: trozo.toString('base64') } });
}

ws.on('open', () => {
  log(`conectado · item ${ITEM} · personaje ${args.guion || 'demo'}`);
  mandar({ event: 'connected', protocol: 'Call', version: '1.0.0' });
  mandar({ event: 'start', sequenceNumber: '1', streamSid: 'MZsim', start: { streamSid: 'MZsim', callSid: 'CAsim' + ITEM.slice(-6), customParameters: { item: ITEM, token: tokenDe(ITEM), prueba: '1', modo: 'ia', saludo: SALUDO, voz: 'marin' } } });
  setInterval(tick, 20);
});
ws.on('message', (raw) => {
  let m; try { m = JSON.parse(raw.toString()); } catch { return; }
  if (m.event === 'media') { cola = Buffer.concat([cola, Buffer.from(m.media.payload, 'base64')]); return; }
  if (m.event === 'mark') { marcas.push({ name: m.mark.name, byte: bytesOidos + cola.length }); return; }
  if (m.event === 'clear') { cola = Buffer.alloc(0); marcas = []; log('(la central limpió la cola: interrupción)'); return; }
});
ws.on('close', () => { log('la central cerró la llamada'); fin(); });
ws.on('error', (e) => { log('ws error', e.message); fin(); });

setTimeout(() => { log(`tope de ${MINUTOS} minutos`); try { mandar({ event: 'stop' }); ws.close(); } catch { /* ya */ } fin(); }, MINUTOS * 60000);

function fin() {
  if (terminado) return; terminado = true;
  prospecto.cerrar();
  log(`--- fin · item ${ITEM} (la transcripción y las latencias quedan en tel_voz_pruebas) ---`);
  setTimeout(() => process.exit(0), 800);
}
