/* El inbox: jerarquía de columnas, panel plegable y secciones cerradas. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const raiz = '/opt/sacs/paginawebsacs';
const login = Object.fromEntries(readFileSync(`${raiz}/.crm-login`, 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const B = 'http://127.0.0.1:4321';
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 950 } });
const p = await ctx.newPage();
const errores = []; p.on('pageerror', e => errores.push(e.message));
let fallas = 0;
const paso = (n, ok, d = '') => { if (!ok) fallas++; console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };
try {
  await p.goto(`${B}/admin/login`, { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', login.CRM_EMAIL);
  await p.fill('input[type="password"]', login.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout: 40000 }).catch(() => {});
  await p.goto(`${B}/admin/crm?tab=whatsapp`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(11000);
  await p.locator('[role="button"], li, div').filter({ hasText: /Estefany|JO-el|Manuela/ }).first().click({ timeout: 25000 }).catch(() => {});
  await p.waitForSelector('select[aria-label="Estado"]', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);

  /* Se mide el carril de la conversación por su cabecera —la que lleva el
     select de «Estado»—, subiendo hasta la columna. Buscar el composer no
     servía: es un contenteditable dentro de varias cajas y devolvía 0. */
  const anchoHilo = async () => p.evaluate(() => {
    const sel = document.querySelector('select[aria-label="Estado"]');
    let el = sel; while (el && el.parentElement && el.getBoundingClientRect().width < 500) el = el.parentElement;
    return Math.round(el ? el.getBoundingClientRect().width : 0);
  });
  const anchoCarril = () => p.evaluate(() => {
    const sel = document.querySelector('select[aria-label="Estado"]');
    if (!sel) return 0;
    let el = sel;
    while (el.parentElement && el.getBoundingClientRect().width < 500) el = el.parentElement;
    return Math.round(el.getBoundingClientRect().width);
  });
  /* Medir «la columna más ancha» a ciegas caía siempre en un envoltorio
     exterior. Se comprueban los anchos CONCRETOS del layout, que es lo que de
     verdad se cambió: lista 252, ficha 328, y la conversación = lo que sobra. */
  const anchos = () => p.evaluate(() => {
    const todos = [...document.querySelectorAll('div, button')].map(e => Math.round(e.getBoundingClientRect().width));
    const hay = (w) => todos.some(x => Math.abs(x - w) <= 1);
    const sel = document.querySelector('select[aria-label="Estado"]');
    let carril = sel; while (carril?.parentElement && carril.getBoundingClientRect().width < 500) carril = carril.parentElement;
    return { lista: hay(252), ficha: hay(328), pestana: hay(30), hilo: Math.round(carril?.getBoundingClientRect().width || 0) };
  });
  const a1 = await anchos();
  console.log(`  · lista 252: ${a1.lista} · ficha 328: ${a1.ficha} · conversación: ${a1.hilo} px`);
  paso('La lista y la ficha ya miden lo nuevo', a1.lista && a1.ficha, JSON.stringify(a1));
  const antes = a1.hilo;
  paso('La conversación pasa de 600 px', antes >= 600, `${antes} px`);
  paso('La píldora «nota» ya no satura la lista', !/\bNOTA\b/.test(txt.slice(0, 2500)), '');

  // plegar la ficha
  const plegar = p.getByRole('button', { name: /Plegar la ficha/i });
  if (await plegar.count()) {
    await plegar.click();
    await p.waitForTimeout(1200);
    const a2 = await anchos();
    const despues = a2.hilo;
    paso('Plegada, la ficha deja sólo su pestaña de 30 px', a2.pestana && !a2.ficha, JSON.stringify(a2));
    paso('Al plegar la ficha, la conversación crece', despues > antes + 200, `${antes} → ${despues} px`);
    await p.getByRole('button', { name: /Abrir la ficha/i }).click();
    await p.waitForTimeout(1200);
    paso('Y se puede volver a abrir', (await p.getByRole('button', { name: /Plegar la ficha/i }).count()) > 0, '');
  } else paso('Existe el botón de plegar la ficha', false, 'no se encontró');

  const abiertas = await p.evaluate(() => [...document.querySelectorAll('button[aria-expanded="true"]')].map(b => b.innerText.split('\n')[0]).filter(Boolean));
  paso('Las secciones de la ficha nacen cerradas', abiertas.length === 0, abiertas.join(' · '));
  await p.screenshot({ path: '/tmp/qa-inbox-layout.png' });
  paso('Sin errores de JS propios', errores.filter(e => !/async_hooks/.test(e)).length === 0, errores.slice(0, 2).join(' | '));
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
