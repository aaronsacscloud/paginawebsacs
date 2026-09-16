import { chromium } from 'playwright';
import fs from 'node:fs';
const SC = process.env.SC;
const env = Object.fromEntries(fs.readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const B='http://localhost:4341';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1500,height:1250}, deviceScaleFactor:1.8})).newPage();
p.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0,200)));
await p.goto(B+'/admin/login');
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForTimeout(5000);
await p.goto(B+'/admin/crm?tab=clientes'); await p.waitForTimeout(9000);
await p.locator('input[placeholder*="usc" i], input[type=search]').first().fill('rubens');
await p.waitForTimeout(3000);
await p.locator('tr').filter({ hasText: 'Rubens' }).first().click(); await p.waitForTimeout(9000);
await p.getByRole('button', { name: /^Consultoría/ }).first().click(); await p.waitForTimeout(7000);
console.log('botón:', await p.getByRole('button', { name: 'Trabajo en curso' }).count());
await p.getByRole('button', { name: 'Trabajo en curso' }).click(); await p.waitForTimeout(2500);
await p.getByRole('button', { name: 'Generar' }).click(); await p.waitForTimeout(9000);
const t = await p.locator('body').innerText();
const i = t.indexOf('EN SU COLA');
console.log('generado:', t.slice(i, i+160).replace(/\n{2,}/g,' | '));
const liga = await p.evaluate(() => {
  const a = [...document.querySelectorAll('input')].map(x=>x.value).find(v => v.includes('/reporte/'));
  return a || null;
});
console.log('liga:', liga);
await p.screenshot({path:`${SC}/rc-modal.png`});
if (liga) {
  const p2 = await p.context().newPage();
  await p2.goto(liga.replace(/^https?:\/\/[^/]+/, B), { waitUntil:'networkidle' });
  await p2.waitForTimeout(2500);
  const t2 = await p2.locator('body').innerText();
  console.log('DOC:', t2.slice(0, 260).replace(/\n{2,}/g,' | '));
  await p2.screenshot({path:`${SC}/rc-doc.png`, fullPage:true});
}
await b.close();
