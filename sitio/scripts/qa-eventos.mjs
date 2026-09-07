// QA con navegador del módulo Ferias y eventos: entra al CRM, recorre la lista, el calendario,
// la ficha, la edición (todas las pestañas) y el modo stand. Deja las capturas en el scratchpad.
// Uso: node scripts/qa-eventos.mjs [--movil]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const S = '/tmp/claude-1000/-opt-sacs/aeb6a79e-2293-4ae9-bda3-16dd840d4ce3/scratchpad';
const env = Object.fromEntries(readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const nav = await chromium.launch({ args: ['--no-sandbox'] });
const movil = process.argv.includes('--movil');
const pg = await nav.newPage({ viewport: movil ? { width: 390, height: 844 } : { width: 1360, height: 900 }, ...(movil ? { isMobile: true, hasTouch: true } : {}) });
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); }); pg.on('response', async r => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.request().method() + ' ' + r.url() + ' body=' + (r.request().postData() || '') + ' → ' + (await r.text().catch(() => '')).slice(0, 300)); });
const shot = async (n) => { await pg.waitForTimeout(700); await pg.screenshot({ path: `${S}/ev-${n}.png` }); console.log('shot', n); };
await pg.goto('http://localhost:4321/admin/login', { waitUntil: 'networkidle' });
await pg.fill('input[type="email"]', env.CRM_EMAIL); await pg.fill('input[type="password"]', env.CRM_PASSWORD); await pg.click('button[type="submit"]');
await pg.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(()=>{});
await pg.goto('http://localhost:4321/admin/crm?tab=eventos', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1500);
const suf = movil ? '-m' : '';
await shot('1-home' + suf);
await pg.getByText('Calendario', { exact: true }).first().click(); await shot('2-cal' + suf);
await pg.getByText('A dónde ir', { exact: true }).first().click();
await pg.getByText('Intermoda', { exact: false }).first().click(); await pg.waitForTimeout(1200); await shot('3-ficha' + suf);
// abrir la primera edición futura
const prep = pg.getByRole('button', { name: /Preparar|Ver resultados/ }).first();
if (await prep.count()) { await prep.click(); await pg.waitForTimeout(1500); await shot('4-edicion' + suf);
  const sh = pg.locator('.crm-sheet').last();
  const vamos = sh.getByRole('button', { name: 'Vamos', exact: true }).first();
  if (await vamos.count()) { await vamos.click(); await pg.waitForTimeout(1800); await shot('4b-vamos' + suf); }
  for (const t of ['Preparación','Registros','A quién buscar','Gastos','Cierre']) { const b = sh.getByRole('button', { name: new RegExp('^' + t) }).first(); if (await b.count()) { await b.click(); await pg.waitForTimeout(1200); await shot('5-'+t.toLowerCase().normalize('NFD').replace(/[^a-z]/g,'') + suf); } }
  const stand = sh.getByRole('button', { name: 'Modo stand' }).first(); if (await stand.count()) { await stand.click(); await pg.waitForTimeout(1200); await shot('6-stand' + suf);
    await pg.fill('input[placeholder*="ombre"]', 'Prueba QA Referee'); await pg.fill('input[placeholder*="55"]', '5512345678').catch(()=>{}); await shot('6b-stand-lleno' + suf); }
}
console.log('errores JS:', errs.length ? errs : 'ninguno');
await nav.close();
