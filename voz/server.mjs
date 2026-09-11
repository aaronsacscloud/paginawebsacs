// LA CENTRAL DE VOZ · un proceso Node detrás de nginx (code.sacscloud.com/voz/).
//
//   wss://…/voz/ws        Twilio ConversationRelay abre uno por llamada (motor: Claude + ElevenLabs)
//   wss://…/voz/media     Twilio Media Streams: el audio crudo va a OpenAI voz-a-voz (motor: openai)
//   POST /voz/evento      el CRM avisa: maquina | buzon | persona | decir | tomar | colgar
//   GET  /voz/salud       para el monitoreo y para el cron del CRM
//   GET  /voz/sesiones    qué llamadas están vivas (con el secreto)
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { Sesion } from './sesion.mjs';
import { hayCerebro, MODELO_VOZ } from './cerebro.mjs';
import { SesionOpenAI, hayOpenAI, MODELO_OPENAI, VOZ_OPENAI } from './openai.mjs';
import { hayCrm, tokenValido } from './crm.mjs';

const PORT = Number(process.env.PORT || 8470);
const SECRET = (process.env.VOZ_SECRET || '').trim();
const arranque = Date.now();
const sesiones = new Map();          // item → Sesion
let atendidas = 0;
const log = (...a) => console.log(new Date().toISOString(), ...a);

if (!hayCrm()) log('AVISO: falta VOZ_SECRET; ninguna llamada va a pasar el setup');
if (!hayCerebro()) log('AVISO: falta ANTHROPIC_API_KEY; solo funciona el modo eco');
if (!hayOpenAI()) log('AVISO: falta OPENAI_API_KEY; el motor voz-a-voz (/voz/media) no va a funcionar');

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const autorizado = (req) => SECRET && (req.headers.authorization || '') === `Bearer ${SECRET}`;
const leerCuerpo = (req) => new Promise((ok, mal) => {
  let s = ''; req.on('data', (c) => { s += c; if (s.length > 65536) { mal(new Error('grande')); req.destroy(); } });
  req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { mal(e); } });
  req.on('error', mal);
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ruta = url.pathname.replace(/^\/voz/, '') || '/';
  if (req.method === 'GET' && ruta === '/salud') {
    return json(res, 200, { ok: true, vivas: sesiones.size, atendidas, modelo: MODELO_VOZ, cerebro: hayCerebro(), crm: hayCrm(), openai: hayOpenAI() ? `${MODELO_OPENAI}/${VOZ_OPENAI}` : null, segundos: Math.round((Date.now() - arranque) / 1000) });
  }
  if (ruta === '/twiml-prueba') {
    // TwiML de las llamadas de prueba (llamar-prueba.mjs). Twilio manda AnsweredBy si pidió AMD.
    const item = url.searchParams.get('item') || '';
    if (!tokenValido(item, url.searchParams.get('token'))) return json(res, 403, { error: 'token' });
    let p = {}; try { p = Object.fromEntries(new URLSearchParams(await new Promise((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s)); }))); } catch { /* sin cuerpo */ }
    const maquina = /^machine|^fax/.test(String(p.AnsweredBy || ''));
    log(`[${item}] twiml-prueba AnsweredBy=${p.AnsweredBy || '?'}${maquina ? ' → buzón, se cuelga' : ''}`);
    const twiml = maquina ? '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>' : Buffer.from(url.searchParams.get('twiml') || '', 'base64url').toString('utf8');
    res.writeHead(200, { 'Content-Type': 'text/xml' }); return res.end(twiml);
  }
  if (!autorizado(req)) return json(res, 401, { error: 'sin autorización' });
  if (req.method === 'GET' && ruta === '/sesiones') {
    return json(res, 200, { sesiones: [...sesiones.values()].map((s) => ({ item: s.item, callSid: s.callSid, turnos: s.turnos, segundos: Math.round((Date.now() - s.t0) / 1000), silenciada: s.silenciada, terminando: s.terminando })) });
  }
  if (req.method === 'POST' && ruta === '/evento') {
    let b; try { b = await leerCuerpo(req); } catch { return json(res, 400, { error: 'cuerpo inválido' }); }
    const s = b.item && sesiones.get(String(b.item));
    if (!s) return json(res, 404, { error: 'no hay llamada viva con ese item', item: b.item });
    try { await s.evento(String(b.evento || ''), b); return json(res, 200, { ok: true }); }
    catch (e) { return json(res, 500, { error: e.message }); }
  }
  json(res, 404, { error: 'no existe' });
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const ruta = new URL(req.url, 'http://x').pathname;
  const motor = ruta === '/voz/ws' || ruta === '/ws' ? 'relay' : ruta === '/voz/media' || ruta === '/media' ? 'openai' : null;
  if (!motor) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, motor));
});

wss.on('connection', (ws, req, motor) => {
  atendidas++;
  const alCerrar = (ses) => { if (ses.item && sesiones.get(ses.item) === ses) sesiones.delete(ses.item); };
  const s = motor === 'openai' ? new SesionOpenAI(ws, { alCerrar }) : new Sesion(ws, { alCerrar });
  ws.on('message', async (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    try {
      await s.recibir(msg);
      if ((msg.type === 'setup' || msg.event === 'start') && s.item) sesiones.set(s.item, s);
    } catch (e) { log(`[${s.item}] error atendiendo ${msg.type || msg.event}:`, e.message); }
  });
  ws.on('close', () => s.cerrar());
  ws.on('error', (e) => { log(`[${s.item}] ws error`, e.message); });
});

// Al apagar: se avisa a las llamadas vivas para que no se queden mudas.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  log(`${sig}: cerrando ${sesiones.size} llamadas`);
  for (const s of sesiones.values()) s.despedirse('Disculpe, tuve un problema técnico. Le marco en un momento.', 'apagado');
  setTimeout(() => process.exit(0), 5000);
});

server.listen(PORT, '127.0.0.1', () => log(`central de voz en 127.0.0.1:${PORT} (modelo ${MODELO_VOZ})`));
