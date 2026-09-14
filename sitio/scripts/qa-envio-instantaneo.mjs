/**
 * QA · «Que se vea al instante, aunque tarde más en enviarse».
 *
 * Se finge una red LENTA a propósito: el envío tarda tres segundos en
 * contestar. Lo que se mide es lo de antes de eso — que la caja se limpie y la
 * burbuja aparezca— y que cuando el hilo traiga el mensaje de verdad no haya
 * dos burbujas ni un parpadeo.
 *
 * Nada sale a WhatsApp: el endpoint de envío está interceptado.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4328';
const CONV = 'c8970a60-9580-42f3-81d6-185599657f40';   // Dolores, con ventana abierta
const TEXTO = 'QA envio instantaneo ' + process.pid;
const WAMID = 'wamid.QA' + process.pid;

const MOVIL = process.env.MOVIL === '1';
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage(MOVIL
  ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }
  : { viewport: { width: 1440, height: 950 } });
console.log(`  · ${MOVIL ? 'teléfono 390×844' : 'escritorio 1440×950'}`);
const errs = []; p.on('pageerror', e => errs.push(e.message));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

// El envío: tres segundos de espera y luego OK, como una red mala.
let mandado = false;
await p.route('**/api/crm/whatsapp/enviar', async r => {
  await new Promise(x => setTimeout(x, 3000));
  mandado = true;
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, message_id: WAMID }) });
});
// El hilo: en cuanto el envío "salió", el servidor ya lo devuelve como mensaje real.
await p.route('**/api/crm/whatsapp/hilo**', async r => {
  const res = await r.fetch();
  const j = await res.json().catch(() => null);
  if (j && mandado && Array.isArray(j.mensajes)) {
    j.mensajes.push({ id: 'real-qa', kapso_message_id: WAMID, direccion: 'saliente', tipo: 'text', cuerpo: TEXTO,
      status: 'sent', created_at: new Date().toISOString(), enviado_at: new Date().toISOString(), autor: 'QA' });
  }
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
});

await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/admin/crm?tab=whatsapp&wa_conv=${CONV}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(22000);

const caja = p.locator('textarea').last();
await caja.click();
await caja.fill(TEXTO);

const cuantas = () => p.evaluate(t => [...document.querySelectorAll('[id^="wa-item-"]')].filter(e => (e.textContent || '').includes(t)).length, TEXTO);
const t0 = Date.now();
await p.keyboard.press('Enter');
// Se espera a lo primero que pase: la caja vacía Y la burbuja puesta.
await p.waitForFunction(t => {
  const ta = [...document.querySelectorAll('textarea')].pop();
  const hay = [...document.querySelectorAll('[id^="wa-item-"]')].some(e => (e.textContent || '').includes(t));
  return hay && ta && !ta.value.trim();
}, TEXTO, { timeout: 5000 }).catch(() => {});
const ms = Date.now() - t0;

paso('La burbuja aparece al instante', ms < 600, `${ms} ms (la red tardó 3000)`);
paso('La caja se limpia sola, sin esperar a la red', !(await caja.inputValue()).trim());
paso('Una sola burbuja', (await cuantas()) === 1, `${await cuantas()}`);

// Durante los 3 s de espera, la burbuja no debe desaparecer en ningún momento.
let minimo = 9;
for (let i = 0; i < 16; i++) { minimo = Math.min(minimo, await cuantas()); await p.waitForTimeout(400); }
paso('No parpadea mientras viaja', minimo === 1, `mínimo visto: ${minimo}`);

// Y cuando el hilo trae el mensaje real, sigue habiendo UNA.
await p.waitForTimeout(8000);
paso('Al llegar el de verdad no se duplica', (await cuantas()) === 1, `${await cuantas()} burbuja(s)`);
await p.screenshot({ path: MOVIL ? '/tmp/qa-envio-instantaneo-movil.png' : '/tmp/qa-envio-instantaneo.png' });
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
