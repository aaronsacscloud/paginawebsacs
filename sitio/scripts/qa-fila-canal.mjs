/**
 * QA de la fila de canal del composer: que NUNCA se desborde por la derecha
 * (se metía encima del panel del cliente) y que las píldoras de línea sigan
 * siendo tocables en vez de quedar aplastadas.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const CONV = '326663ff-7426-43c4-99cc-bfd18b22aa31';
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);

for (const [etiqueta, vp] of [['escritorio 1360', { width: 1360, height: 950 }], ['laptop chica 1180', { width: 1180, height: 820 }], ['teléfono 390', { width: 390, height: 844 }]]) {
  const p = await nav.newPage({ viewport: vp });
  await p.goto('http://localhost:4321/admin/login', { waitUntil: 'domcontentloaded' });
  await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
  await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
  await p.goto(`http://localhost:4321/admin/crm?tab=whatsapp&wa_conv=${CONV}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(12000);
  const r = await p.evaluate(() => {
    const g = document.querySelector('[aria-label="Línea por la que sale este chat"]');
    if (!g) return { hay: false };
    const fila = g.parentElement, f = fila.getBoundingClientRect();
    const hijos = [...fila.children].filter(c => c.getBoundingClientRect().width > 0);
    return {
      hay: true,
      desborda: Math.round(Math.max(...hijos.map(c => c.getBoundingClientRect().right)) - f.right),
      pildoras: Math.round(g.getBoundingClientRect().width),
      resumir: !!document.evaluate('//button[contains(.,"Resumir")]', document, null, 9, null).singleNodeValue?.getBoundingClientRect().width,
    };
  });
  console.log(`\n── ${etiqueta}`);
  if (!r.hay) { console.log('   (una sola línea: no hay píldoras)'); await p.close(); continue; }
  paso('No se desborda por la derecha', r.desborda <= 1, `${r.desborda}px fuera`);
  paso('Las píldoras siguen usables', r.pildoras >= 150, `${r.pildoras}px de ancho`);
  paso('«Resumir» sigue en pantalla', r.resumir);
  await p.screenshot({ path: `/tmp/qa-fila-${vp.width}.png` });
  await p.close();
}
await nav.close();
