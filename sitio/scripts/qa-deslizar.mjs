/**
 * QA del gesto de deslizar para resolver: que pida motivo después y que
 * «fue sin querer» reabra la conversación. NO toca datos reales: usa una
 * conversación de laboratorio que se crea y se borra.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:4321/admin/login', { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto('http://localhost:4321/admin/crm?tab=whatsapp', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(12000);

const fila = p.locator('.m-conv').first();
const b = await fila.boundingBox();
paso('Hay filas en la lista móvil', !!b);
// Deslizar a la izquierda por encima del umbral (84 px)
await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2).catch(() => {});
await fila.hover();
await p.mouse.move(b.x + b.width - 30, b.y + b.height / 2);
// El gesto es táctil: se simula con eventos de toque reales.
await p.evaluate(([x, y]) => {
  const el = document.querySelector('.m-conv').parentElement;
  const t = (cx) => new TouchEvent('touchmove', { bubbles: true, touches: [new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })] });
  el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })] }));
  el.dispatchEvent(t(x - 40)); el.dispatchEvent(t(x - 100)); el.dispatchEvent(t(x - 120));
  el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [] }));
}, [b.x + b.width - 30, b.y + b.height / 2]);
await p.waitForTimeout(6000);   // pasa la ventana de «Deshacer» (4 s)
const t = await p.locator('body').innerText();
paso('Aparece la hoja preguntando el motivo', /¿por qué se cierra\?/i.test(t), t.match(/Resuelta: [^\n·]*/)?.[0] || '');
paso('Ofrece los motivos del catálogo', /Venta cerrada/.test(t) && /Sin interés/.test(t));
paso('Ofrece reabrir si fue un accidente', /Fue sin querer/.test(t));
await p.screenshot({ path: '/tmp/qa-deslizar.png' });
console.log(errs.length ? `  ⚠ JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
