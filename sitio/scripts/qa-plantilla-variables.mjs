/**
 * QA del EDITOR DE PLANTILLAS con variables, en la compu y en el teléfono.
 * Crea una plantilla de mentiras en la pantalla (sin mandarla a Meta: no se
 * aprieta «Crear») y comprueba que lo que el dueño pidió se pueda hacer con
 * clics: meter la variable del nombre, una de un campo del CRM y una de campo
 * abierto con su etiqueta.
 *
 *   node scripts/qa-plantilla-variables.mjs [--puerto 4321] [--movil]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const raiz = '/opt/sacs/paginawebsacs';
const login = Object.fromEntries(readFileSync(`${raiz}/.crm-login`, 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const base = `http://localhost:${process.argv.includes('--puerto') ? process.argv[process.argv.indexOf('--puerto') + 1] : '4321'}`;
const MOVIL = process.argv.includes('--movil');

let fallas = 0;
const paso = (n, ok, d = '') => { if (!ok) fallas++; console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };

const nav = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: MOVIL ? { width: 390, height: 844 } : { width: 1400, height: 1000 }, ...(MOVIL ? { isMobile: true, hasTouch: true } : {}) });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', e => errores.push(e.message));
// El campo abierto se pide con un prompt del navegador: se contesta solo.
p.on('dialog', d => d.accept('Promoción del mes'));

try {
  await p.goto(`${base}/admin/login`, { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', login.CRM_EMAIL);
  await p.fill('input[type="password"]', login.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
  await p.goto(`${base}/admin/crm?tab=wa-plantillas`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(7000);
  await p.getByRole('button', { name: /Nueva plantilla/ }).first().click({ timeout: 25000 });
  await p.waitForTimeout(1200);

  // El texto donde se van a meter las variables.
  const cuerpo = p.locator('#plantilla-cuerpo');
  await cuerpo.fill('Hola , este mes tenemos algo para tu tienda .');
  paso('Se abre el editor con su cuerpo', await cuerpo.isVisible(), '');

  // 1 · la del nombre, con un clic
  await cuerpo.click();
  await p.keyboard.press('Control+End');
  await p.getByRole('button', { name: 'Su nombre' }).click();
  await p.waitForTimeout(400);
  let txt = await cuerpo.inputValue();
  paso('«Su nombre» mete la variable', /\{\{1\}\}/.test(txt), txt.slice(0, 60));

  // 2 · un campo del CRM
  await p.getByRole('combobox').filter({ hasText: 'Un campo del CRM' }).first().selectOption('empresa').catch(async () => {
    await p.locator('select').filter({ hasText: 'Un campo del CRM' }).first().selectOption('empresa');
  });
  await p.waitForTimeout(400);
  txt = await cuerpo.inputValue();
  paso('Un campo del CRM se inserta igual', /\{\{2\}\}/.test(txt), txt.slice(0, 70));

  // 3 · el campo abierto, con su nombre
  await p.getByRole('button', { name: /Campo abierto/ }).click();
  await p.waitForTimeout(600);
  const pantalla = (await p.locator('body').innerText()).replace(/\n+/g, ' · ');
  paso('El campo abierto queda con SU nombre', /Promoción del mes/.test(pantalla), '');
  paso('Y se dice que lo escribes al enviar', /lo escribes al enviar/i.test(pantalla), '');
  paso('Los ejemplos que Meta exige se ponen solos', /María/.test(pantalla) && /Boutique Lily/.test(pantalla), '');

  // 4 · las reglas de Meta, antes de mandarla
  await cuerpo.fill('{{1}} hola');
  await p.waitForTimeout(400);
  const err = (await p.locator('body').innerText()).replace(/\n+/g, ' · ');
  paso('Avisa que Meta no acepta empezar con variable', /EMPIECE con una variable/i.test(err), '');

  await p.screenshot({ path: `/tmp/qa-plantilla-vars${MOVIL ? '-movil' : ''}.png`, fullPage: true });
  paso('Sin errores de JS', errores.length === 0, errores.slice(0, 2).join(' | '));
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
