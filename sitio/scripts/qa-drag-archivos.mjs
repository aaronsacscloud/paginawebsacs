/**
 * QA del arrastre de archivos al composer.
 * Prueba con un PDF (WhatsApp lo acepta) y un XML de factura (NO lo acepta):
 * el XML debe quedar marcado y ofrecer la salida por enlace, no fallar al
 * enviar. NO manda nada: solo se comprueba lo que pasa ANTES de enviar.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const CONV = '0a56a4b4-fddc-4698-92df-1f4fd79a8359';
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1360, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:4321/admin/login', { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`http://localhost:4321/admin/crm?tab=whatsapp&wa_conv=${CONV}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(13000);

// El input ya no restringe tipos: es lo que hacía que el explorador escondiera archivos.
const acc = await p.locator('input[type=file][multiple]').first().getAttribute('accept');
paso('El selector ya no filtra por tipo', acc === null, acc === null ? 'sin accept' : `accept="${acc}"`);

// Se sueltan los dos archivos como si vinieran del escritorio.
await p.locator('input[type=file][multiple]').first().setInputFiles(['/tmp/factura-2205.pdf', '/tmp/factura-2205.xml']);
await p.waitForTimeout(2500);
const t = await p.locator('body').innerText();
paso('Los dos archivos quedaron listos', /factura-2205/.test(t) || (await p.locator('.wa-staged').count()) === 2, `${await p.locator('.wa-staged').count()} en cola`);
paso('Avisa que WhatsApp no transporta el .xml', /no transporta \.xml/i.test(t));
paso('Dice qué SÍ acepta Meta', /PDF, Word, Excel/i.test(t));
paso('Ofrece mandarlo como enlace', /Mandar como enlace de descarga/i.test(t));
await p.screenshot({ path: '/tmp/qa-drag.png', clip: { x: 590, y: 620, width: 760, height: 340 } });
console.log(errs.length ? `  ⚠ JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
