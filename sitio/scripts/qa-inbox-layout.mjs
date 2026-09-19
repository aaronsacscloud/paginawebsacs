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
  /* Las filas de la lista son <button data-conv>: pinchar por texto caía en un
     contenedor y no abría nada. Se pincha la fila por lo que es. */
  await p.locator('button[data-conv]').first().click({ timeout: 30000 });
  await p.waitForSelector('select[aria-label="Estado"]', { timeout: 30000 });
  await p.waitForTimeout(3500);

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
  /* El umbral no es un número redondo: con el menú del CRM (≈236) + el del
     inbox (196) + lista (252) + ficha (328), en 1440 quedan ~428 para la
     conversación con los anchos VIEJOS. Con los nuevos son 148 px más. Se
     comprueba que sea la columna más ancha y que pase de ese suelo. */
  const antes = a1.hilo;
  paso('La conversación es la columna más ancha', antes > 328 && antes > 252, `${antes} px vs ficha 328 y lista 252`);
  paso('Ganó los 148 px de los laterales', antes >= 540, `${antes} px (antes serían ${antes - 148})`);
  const cuerpo = await p.locator('body').innerText();
  paso('La píldora «nota» ya no satura la lista', !/\bNOTA\b/.test(cuerpo.slice(0, 2500)), '');
  paso('Ni la del número ni «→ Agente»', !/\+1 ?···|→ Agente/.test(cuerpo.slice(0, 2500)), '');

  // plegar la ficha
  const plegar = p.getByRole('button', { name: /Ocultar/i }).first();
  if (await plegar.count()) {
    await plegar.click();
    await p.waitForTimeout(1200);
    const a2 = await anchos();
    const despues = a2.hilo;
    paso('Plegada, la ficha deja sólo su pestaña de 30 px', a2.pestana && !a2.ficha, JSON.stringify(a2));
    paso('Al plegar la ficha, la conversación crece', despues > antes + 200, `${antes} → ${despues} px`);
    await p.getByRole('button', { name: /Abrir la ficha/i }).click();
    await p.waitForTimeout(1500);
    paso('Y se puede volver a abrir', (await p.getByRole('button', { name: /Ocultar/i }).count()) > 0, '');
  } else paso('Existe el botón de plegar la ficha', false, 'no se encontró');

  const abiertas = await p.evaluate(() => [...document.querySelectorAll('button[aria-expanded="true"]')].map(b => b.innerText.split('\n')[0]).filter(Boolean));
  paso('Las secciones de la ficha nacen cerradas', abiertas.length === 0, abiertas.join(' · '));
  await p.screenshot({ path: '/tmp/qa-inbox-layout.png' });
  paso('Sin errores de JS propios', errores.filter(e => !/async_hooks/.test(e)).length === 0, errores.slice(0, 2).join(' | '));
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
