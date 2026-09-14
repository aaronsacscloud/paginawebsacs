/**
 * QA · «Si ya hice scroll y estoy abajo, que no me suba hasta arriba».
 *
 * Lo que se mide NO es el `scrollTop` —ese puede cambiar con razón, porque al
 * abrir una conversación las filas de arriba cambian de alto— sino lo único que
 * importa: dónde está en la PANTALLA la fila que estabas mirando. Si sigue a la
 * misma altura, tu sitio no se movió.
 *
 * Se prueban los tres momentos en que la lista se recarga: abrir una
 * conversación, mandarle un mensaje (interceptado: nada sale a WhatsApp) y que
 * la fila contestada se salga de la bandeja.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4329';
const TEXTO = 'QA scroll ' + process.pid;

const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

await p.route('**/api/crm/whatsapp/enviar', async r => {
  await new Promise(x => setTimeout(x, 800));
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, message_id: 'wamid.QA' + process.pid }) });
});
// El servidor reordena —la contestada pasa al frente— y, cuando toca, la saca
// de la bandeja, que es lo que pasa de verdad en «No contestadas».
let contestada = null, sacarla = false;
await p.route('**/api/crm/whatsapp/inbox**', async r => {
  const res = await r.fetch();
  const j = await res.json().catch(() => null);
  if (j && contestada && Array.isArray(j.conversaciones)) {
    const i = j.conversaciones.findIndex(c => c.id === contestada);
    if (i >= 0 && sacarla) j.conversaciones = j.conversaciones.filter((_, k) => k !== i);
    else if (i > 0) j.conversaciones = [j.conversaciones[i], ...j.conversaciones.filter((_, k) => k !== i)];
  }
  await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
});

await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/admin/crm?tab=whatsapp`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(22000);

const carril = p.locator('.wa-scroll').filter({ has: p.locator('.wa-fila-hover') }).first();
await carril.evaluate(e => { e.scrollTop = 900; e.dispatchEvent(new Event('scroll')); });
await p.waitForTimeout(700);

/** La fila «testigo»: una que se ve a media pantalla, y a qué altura está. */
const testigo = async () => p.evaluate(() => {
  const el = [...document.querySelectorAll('.wa-scroll')].find(e => e.querySelector('[data-conv]'));
  const f = [...el.querySelectorAll('[data-conv]')].find(x => x.getBoundingClientRect().top > 300);
  return f ? { id: f.dataset.conv, y: Math.round(f.getBoundingClientRect().top), nombre: (f.querySelector('b')?.textContent || '').trim() } : null;
});
const alturaDe = async id => p.evaluate(i => {
  const f = document.querySelector(`[data-conv="${i}"]`);
  return f ? Math.round(f.getBoundingClientRect().top) : null;
}, id);

const t0 = await testigo();
paso('Hay una fila testigo a media lista', !!t0, t0 ? `${t0.nombre} a ${t0.y}px` : '');

// 1 · Abrir una conversación de las que se ven ahí abajo.
const fila = p.locator('[data-conv]').nth(9);
const nombreFila = (await fila.locator('b').first().textContent() || '').trim();
await fila.click();
await p.waitForTimeout(9000);
contestada = await p.evaluate(() => new URLSearchParams(location.search).get('wa_conv') || null);
const y1 = await alturaDe(t0.id);
paso('Abrir una conversación no mueve tu sitio', y1 != null && Math.abs(y1 - t0.y) < 40, `testigo ${t0.y} → ${y1}`);

// 2 · Mandarle un mensaje: el servidor la sube al primer lugar.
const caja = p.locator('textarea').last();
await caja.fill(TEXTO).catch(() => {});
await p.keyboard.press('Enter');
await p.waitForTimeout(9000);
const y2 = await alturaDe(t0.id);
paso('Enviar no mueve tu sitio', y2 != null && Math.abs(y2 - t0.y) < 40, `testigo ${t0.y} → ${y2}`);
paso('La conversación sigue abierta', (await p.locator('body').innerText()).includes(nombreFila.slice(0, 10)), nombreFila);

// 3 · Y el caso bravo: la fila contestada se sale de la bandeja.
sacarla = true;
await p.evaluate(() => window.dispatchEvent(new Event('focus')));
await p.waitForTimeout(9000);
const y3 = await alturaDe(t0.id);
paso('Si la fila contestada sale de la bandeja, tu sitio aguanta', y3 != null && Math.abs(y3 - t0.y) < 40, `testigo ${t0.y} → ${y3}`);

await p.screenshot({ path: '/tmp/qa-lista-scroll.png' });
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
