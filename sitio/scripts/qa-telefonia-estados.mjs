/**
 * QA VISUAL del panel de llamada, recorriendo el ciclo completo SIN marcar.
 *
 * El problema: los estados interesantes —timbrando, en línea, teclado, aviso
 * de red, llamada en espera, resumen con minuta— solo existen durante una
 * llamada de verdad. Probarlos «de verdad» significa marcarle a alguien.
 *
 * La solución: se intercepta el módulo del SDK de Twilio que sirve Vite y se
 * devuelve uno FALSO con la misma superficie (Device/Call con on/emit). El
 * componente es el real, sus eventos son los reales, sus transiciones son las
 * reales; lo único falso es el otro lado del cable.
 *
 *   node scripts/qa-telefonia-estados.mjs [--puerto 4321]
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const RUTA_LOGIN = resolve(aqui, '../../.crm-login');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const base = `http://localhost:${arg('puerto', '4321')}`;
const SID = 'CA' + 'ab12cd34'.repeat(4);

if (!existsSync(RUTA_LOGIN)) { console.error(`Falta ${RUTA_LOGIN}`); process.exit(1); }
const env = Object.fromEntries(readFileSync(RUTA_LOGIN, 'utf8').split('\n').filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

const SDK_FALSO = `
class Emisor {
  constructor(){ this._h = {}; }
  on(e, f){ (this._h[e] = this._h[e] || []).push(f); return this; }
  removeListener(){ return this; }
  emit(e, ...a){ (this._h[e] || []).slice().forEach(f => f(...a)); }
}
class Llamada extends Emisor {
  constructor(from){ super(); this.parameters = { CallSid: '${SID}', From: from || '' }; }
  mute(v){ this._mudo = v; }
  isMuted(){ return !!this._mudo; }
  sendDigits(d){ window.__tonos = (window.__tonos || '') + d; }
  disconnect(){ this.emit('disconnect'); }
  accept(){ this.emit('accept', this); }
  reject(){ this.emit('reject'); }
}
export class Device extends Emisor {
  constructor(){ super(); window.__dispositivo = this; }
  async register(){ }
  destroy(){ }
  updateToken(){ }
  async connect({ params }){ const c = new Llamada(); c.destino = params.To; window.__llamada = c; return c; }
}
export const Call = Llamada;
window.__nivel = v => window.__llamada && window.__llamada.emit('volume', v);
export default { Device, Call: Llamada };
window.__LlamadaFalsa = Llamada;
`;

const nav = await chromium.launch({ args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const MOVIL = process.argv.includes('--movil');
const ctx = await nav.newContext({ viewport: MOVIL ? { width: 390, height: 844 } : { width: 1360, height: 950 }, permissions: ['microphone'], ...(MOVIL ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}) });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', e => errores.push(e.message));
p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

// El SDK falso, en lugar del real.
await p.route('**/*voice-sdk*', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: SDK_FALSO }));
// Token válido de mentiras: el componente solo necesita que traiga `numero`.
await p.route('**/api/crm/telefonia/token*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'jwt.falso.qa', identity: 'crm-qa', numero: '+525593027234' }) }));

let desenlace = { existe: true, estado: 'terminada', duracion_seg: 96, motivo: null, conversation_id: null, minuta_esperada: true, minuta_lista: false };
await p.route('**/api/crm/telefonia/llamada*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(desenlace) }));

const paso = (n, ok, det = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${det ? ` — ${det}` : ''}`);
const panel = () => p.evaluate(() => {
  const d = document.querySelector('[data-tel-panel]');
  return d ? d.innerText.trim().replace(/\n+/g, ' · ') : '';
});
const foto = async n => { await p.waitForTimeout(350); await p.screenshot({ path: `/tmp/qa-tel-${MOVIL ? 'm' : 'e'}${n}.png` }); };

try {
  await p.goto(`${base}/admin/login`, { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', env.CRM_EMAIL);
  await p.fill('input[type="password"]', env.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
  await p.goto(`${base}/admin/crm?tab=whatsapp`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(7000);

  // ── Marcar ──────────────────────────────────────────────────────────────
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: '+525512345678', nombre: 'Joyería Ruben' } })));
  await p.waitForFunction(() => !!window.__llamada, null, { timeout: 10000 });
  let t = await panel();
  paso('Conectando', /Conectando con la central/.test(t), t.slice(0, 60));
  await foto('1-conectando');

  // ── Timbrando ───────────────────────────────────────────────────────────
  await p.evaluate(() => window.__llamada.emit('ringing'));
  t = await panel();
  paso('Timbrando', /Timbrando/.test(t), t.slice(0, 60));
  await foto('2-timbrando');

  // ── Contestan: cronómetro desde AQUÍ, no desde que marcamos ─────────────
  await p.evaluate(() => window.__llamada.emit('accept', window.__llamada));
  await p.waitForTimeout(2600);
  t = await panel();
  // En el teléfono la pantalla enseña el cronómetro en lugar de la etiqueta:
  // el número ES el estado, y ocupa el lugar bueno.
  paso('En línea con cronómetro', (MOVIL || /En línea/.test(t)) && /0:0[23]/.test(t), t.slice(0, 60));
  await foto('3-en-linea');

  // ── Teclado DTMF ────────────────────────────────────────────────────────
  await p.getByRole('button', { name: MOVIL ? 'Teclado' : 'Teclas' }).click();
  for (const d of ['2', '0', '#']) await p.getByRole('button', { name: d, exact: true }).first().click();
  const tonos = await p.evaluate(() => window.__tonos);
  paso('Teclado manda tonos al menú', tonos === '20#', `mandó «${tonos}»`);
  await foto('4-teclado');

  // ── Silenciar ───────────────────────────────────────────────────────────
  await p.getByRole('button', { name: MOVIL ? 'Silenciar' : 'Silenciar' }).click();
  const mudo = await p.evaluate(() => window.__llamada._mudo);
  paso('Silenciar apaga el micrófono', mudo === true, `mute=${mudo}`);

  // ── Aviso: el micrófono no está mandando nada ───────────────────────────
  await p.evaluate(() => window.__llamada.emit('warning', 'constant-audio-input-level'));
  t = await panel();
  paso('Avisa si el micrófono está mudo', /No se oye nada de tu micrófono/.test(t), '');

  // ── Llamada en espera mientras hablo ────────────────────────────────────
  await p.evaluate(() => window.__dispositivo.emit('incoming', new window.__LlamadaFalsa('+525599887766')));
  t = await panel();
  paso('Segunda llamada entrante se anuncia', /Otra llamada entrando/.test(t), '');
  await foto('5-espera');

  // ── MEJORA 2 · el medidor de voz responde ───────────────────────────────
  await p.evaluate(() => window.__nivel(0.85));
  await p.waitForTimeout(250);
  const barras = await p.evaluate(() => [...document.querySelectorAll('[title="Nivel de tu micrófono"] span')].filter(x => !/rgba\(255, 255, 255, 0.22\)|229, 231, 235/.test(getComputedStyle(x).backgroundColor)).length);
  paso('El medidor se mueve con la voz', barras >= 4, `${barras}/5 barras encendidas`);

  // ── MEJORA 3 · el apunte se escribe y se guarda al colgar ───────────────
  let guardada = null;
  await p.route('**/api/crm/telefonia/nota', async r => { guardada = JSON.parse(r.request().postData() || '{}'); await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  await p.getByRole('button', { name: /Apuntar algo/ }).click();
  await p.locator('textarea').first().fill('Tiene 3 sucursales y quiere traspasos entre tiendas.');
  await foto('8-apunte');

  // ── Colgar → resumen, minuta en curso ───────────────────────────────────
  await p.getByRole('button', { name: 'Colgar' }).click();
  await p.waitForTimeout(3200);
  t = await panel();
  paso('Resumen con la minuta en curso', /Transcribiendo y redactando/.test(t), t.slice(0, 70));
  paso('El apunte se guardó solo al colgar', /3 sucursales/.test(guardada?.texto || ''), guardada ? 'se mandó al hilo' : 'NO se mandó');
  await foto('6-resumen-minuta');

  // ── La minuta queda lista ───────────────────────────────────────────────
  desenlace = { ...desenlace, minuta_lista: true, conversation_id: '11111111-2222-3333-4444-555555555555' };
  await p.waitForTimeout(5600);
  t = await panel();
  paso('Minuta lista con acceso a la conversación', /Minuta lista/.test(t) && /Ver en la conversación/.test(t), t.slice(0, 70));
  await foto('7-minuta-lista');

  console.log(errores.length ? `\n  ⚠ ${errores.length} error(es) de JS:\n     ${errores.slice(0, 4).join('\n     ')}` : '\n  ✓ sin errores de JS');
} finally {
  await nav.close();
}
