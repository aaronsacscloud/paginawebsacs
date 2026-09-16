import { chromium } from 'playwright';
import fs from 'node:fs';
const SC = process.env.SC;
const env = Object.fromEntries(fs.readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const B='http://localhost:4340';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1700,height:1150}, deviceScaleFactor:1.8})).newPage();
p.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0,200)));
await p.goto(B+'/admin/login');
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForTimeout(5000);
await p.goto(B+'/admin/crm?tab=clientes'); await p.waitForTimeout(9000);
await p.locator('input[placeholder*="usc" i], input[type=search]').first().fill('rubens');
await p.waitForTimeout(3000);
await p.locator('tr').filter({ hasText: 'Rubens' }).first().click(); await p.waitForTimeout(9000);
await p.getByRole('button', { name: /^Info general/ }).first().click(); await p.waitForTimeout(6000);
const alt = await p.evaluate(() => {
  const g = [...document.querySelectorAll('div')].find(d => getComputedStyle(d).display==='grid' && d.children.length===3 && d.getBoundingClientRect().width>800);
  return g ? [...g.children].map(c => Math.round(c.getBoundingClientRect().height)) : null;
});
console.log('alturas de las tres:', JSON.stringify(alt));
const t = await p.locator('body').innerText();
console.log('¿estado crudo duplicado?', t.includes('ESTADO DE LA CUENTA'));
const caja = await p.evaluate(() => {
  const d = document.querySelector('.ficha-tab');
  if (!d) return null; const r = d.getBoundingClientRect();
  return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: Math.min(r.height + 16, 1100) };
});
if (caja) await p.screenshot({path:`${SC}/infoB.png`, clip: caja});
// modo edición: la primera debe ocupar todo el ancho
await p.getByRole('button', { name: /^Editar$/ }).first().click(); await p.waitForTimeout(2500);
const ancho = await p.evaluate(() => {
  const g = [...document.querySelectorAll('div')].find(d => getComputedStyle(d).display==='grid' && d.getBoundingClientRect().width>800 && d.children.length>=1);
  return g ? Math.round(g.children[0].getBoundingClientRect().width) + ' de ' + Math.round(g.getBoundingClientRect().width) : null;
});
console.log('editando · ancho de la primera:', ancho);
await b.close();
