/**
 * QA · el encabezado del hilo enseña el NOMBRE, no una inicial.
 *
 * El caso (15-sep-2026): con la conversación de Carmina abierta, el encabezado
 * decía «C…» y al lado, con todo el espacio del mundo, el teléfono. El número
 * no se usa en ese renglón —el botón de llamar ya lo lleva dentro y la ficha de
 * la derecha lo enseña completo—, así que se va, y el nombre pasa a ser lo
 * último que cede cuando falta ancho.
 *
 * Se mide a tres anchos, porque el problema solo aparece cuando aprieta.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4334';
const CONV = 'ea6738a1-2605-4b07-a2fb-4dc0e3b647fa';   // Carmina
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

const nav = await chromium.launch({ args: ['--no-sandbox'] });
const p = await nav.newPage({ viewport: { width: 1440, height: 950 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
await p.goto(`${BASE}/admin/crm?tab=whatsapp&wa_conv=${CONV}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(24000);

/* El nombre del encabezado: el primer <b> del panel derecho. Se lee el ancho
   pintado contra el ancho real del texto — así se sabe si está recortado, que
   es lo que el ojo ve como «C…». */
const leer = () => p.evaluate(() => {
  // El nombre del encabezado: el <b> de la mitad derecha que está más arriba.
  const bs = [...document.querySelectorAll('b')]
    .map(b => ({ b, r: b.getBoundingClientRect() }))
    .filter(x => x.r.width > 0 && x.r.top < 160 && x.r.left > window.innerWidth * 0.4)
    .sort((a, z) => a.r.top - z.r.top);
  const b = bs[0]?.b;
  if (!b) return null;
  return { texto: b.textContent, pintado: Math.round(b.getBoundingClientRect().width), real: b.scrollWidth };
});

for (const ancho of [1440, 1180, 980]) {
  await p.setViewportSize({ width: ancho, height: 950 });
  await p.waitForTimeout(1200);
  const n = await leer();
  paso(`A ${ancho} px se lee el nombre entero`, !!n && n.texto === 'Carmina' && n.pintado >= n.real,
    n ? `«${n.texto}» · ${n.pintado}px pintados de ${n.real}px` : 'no encontré el nombre');
}

await p.setViewportSize({ width: 1440, height: 950 });
await p.waitForTimeout(1000);
const enc = await p.evaluate(() => {
  // El encabezado DEL HILO, no la fila de la lista: mitad derecha y hasta arriba.
  const b = [...document.querySelectorAll('b')]
    .map(x => ({ x, r: x.getBoundingClientRect() }))
    .filter(o => o.r.width > 0 && o.r.top < 160 && o.r.left > window.innerWidth * 0.4)
    .sort((a, z) => a.r.top - z.r.top)[0]?.x;
  return b?.parentElement?.parentElement?.textContent || '';
});
paso('Y el teléfono ya no ocupa lugar en el encabezado', !/\d{2}\s?\d{4}\s?\d{4}/.test(enc || ''),
  (enc || '').replace(/\s+/g, ' ').slice(0, 90));
await p.screenshot({ path: '/tmp/qa-encabezado-nombre.png' });
console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs[0]}` : '  ✓ sin errores de JS');
await nav.close();
