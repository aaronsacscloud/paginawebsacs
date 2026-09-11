// LLAMADA DE PRUEBA · marca al celular del dueño con Fernanda, sin pasar por el CRM.
//
//   node llamar-prueba.mjs eco        solo repite lo que oye (mide Twilio: oído + voz)
//   node llamar-prueba.mjs fernanda   conversación completa contra el CRM (CRM_BASE) o con el guion local
//   opciones: --a=+52…  --voz=<id>  --modelo=flash_v2_5  --stt=nova-3-general  --saludo="…"
//   --motor=openai            voz-a-voz de OpenAI (Media Streams → /voz/media); --voz=marin|cedar|…
//   --amd=0                   sin detección de contestadora
//
// Twilio necesita alcanzar wss://code.sacscloud.com/voz/ws → nginx → 127.0.0.1:8470.
import { tokenDe } from './crm.mjs';

const momento = () => { const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', hour: 'numeric', hour12: false }).format(new Date())); return h < 12 ? 'buenos días' : h < 19 ? 'buenas tardes' : 'buenas noches'; };
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a, true]; }));
const modo = process.argv[2] || 'eco';
const A = args.a || process.env.PRUEBA_CELULAR || '';
const SID = process.env.TWILIO_ACCOUNT_SID, TOKEN = process.env.TWILIO_AUTH_TOKEN, DE = process.env.TWILIO_NUMERO;
const motor = args.motor || 'relay';
const WS = process.env.VOZ_WS_URL || (motor === 'openai' ? 'wss://code.sacscloud.com/voz/media' : 'wss://code.sacscloud.com/voz/ws');
if (!A || !SID || !TOKEN || !DE) { console.error('Faltan PRUEBA_CELULAR / TWILIO_* en .env'); process.exit(1); }

// Voz: ElevenLabs vía Twilio. Formato «voiceId-modelo-velocidad_estabilidad_similitud».
const voz = `${args.voz || process.env.VOZ_ELEVENLABS || 'CaJslL1xziwefCeTNzHv'}-${args.modelo || 'flash_v2_5'}-1.0_0.5_0.8`;
const stt = args.stt || 'nova-3-general';
const item = `prueba-${Date.now().toString(36)}`;
const saludo = args.saludo || (modo === 'eco'
  ? 'Hola, soy la prueba de eco. Diga algo y se lo repito. Diga adiós para terminar.'
  : `Hola, ${momento()}. ¿Hablo con Aarón?`);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const params = `<Parameter name="item" value="${esc(item)}"/><Parameter name="token" value="${tokenDe(item)}"/><Parameter name="prueba" value="1"/><Parameter name="modo" value="${esc(modo)}"/><Parameter name="saludo" value="${esc(saludo)}"/>`;
const twiml = motor === 'openai'
  // Media Streams: Twilio nos manda el audio crudo y OpenAI oye y habla en un solo modelo.
  ? `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${esc(WS)}">${params}<Parameter name="voz" value="${esc(args.voz || process.env.VOZ_OPENAI || 'marin')}"/></Stream></Connect></Response>`
  : `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><ConversationRelay url="${esc(WS)}" welcomeGreeting="${esc(saludo)}" welcomeGreetingInterruptible="true" language="es-MX" ttsProvider="ElevenLabs" voice="${esc(voz)}" transcriptionProvider="Deepgram" speechModel="${esc(stt)}" interruptible="any" interruptSensitivity="medium" hints="Sacs, Sacscloud, apartado, consignación, tallas, punto de venta, Fernanda" elevenlabsTextNormalization="on">${params}</ConversationRelay></Connect></Response>`;

// La TwiML la sirve la propia central (/voz/twiml-prueba): así el AMD puede
// colgar si contesta un buzón en vez de dejarle un mensaje a la grabadora.
const url = new URL(`${process.env.VOZ_HTTP_URL || 'https://code.sacscloud.com/voz'}/twiml-prueba`);
url.searchParams.set('item', item); url.searchParams.set('token', tokenDe(item));
url.searchParams.set('twiml', Buffer.from(twiml).toString('base64url'));
// --amd=0 salta la detección de contestadora (a veces toma un «¿bueno?» rápido por buzón).
const body = new URLSearchParams({ To: A, From: DE, Url: url.toString(), Method: 'POST', Timeout: '30', ...(args.amd === '0' ? {} : { MachineDetection: 'Enable', MachineDetectionTimeout: '15' }) });
const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`, {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
});
const j = await r.json();
if (!r.ok) { console.error('Twilio dijo que no:', j); process.exit(1); }
console.log(motor === 'openai'
  ? `Marcando a ${A} · modo ${modo} · motor openai · voz ${args.voz || process.env.VOZ_OPENAI || 'marin'}\nitem ${item} · call ${j.sid} · estado ${j.status}`
  : `Marcando a ${A} · modo ${modo} · voz ${voz} · stt ${stt}\nitem ${item} · call ${j.sid} · estado ${j.status}`);
