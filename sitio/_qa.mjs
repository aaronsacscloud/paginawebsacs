import { chromium } from 'playwright';
import fs from 'node:fs';
const SP = process.env.SP;
const env = Object.fromEntries(fs.readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const B='http://localhost:4399';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1500,height:1000}, deviceScaleFactor:2})).newPage();
const errs=[]; p.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });
await p.goto(B+'/admin/login'); await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForTimeout(7000);
await p.goto(B+'/admin/crm/taller'); await p.waitForTimeout(14000);
const kpis = await p.$$eval('div', ds => ds.filter(d=>/ÓRDENES VIVAS|órdenes vivas/.test('')).length);
const cards = await p.evaluate(() => [...document.querySelectorAll('div')]
  .filter(d => /^(Total|Por arrancar|En desarrollo|En espera de tu OK)$/.test((d.textContent||'').trim()) && d.children.length===0)
  .map(d => { const c = d.parentElement; return { l: d.textContent.trim(), v: (c.children[1]||{}).textContent }; }));
console.log('KPIs:', JSON.stringify(cards));
await p.screenshot({path:`${SP}/qa-taller-lista.png`, fullPage:false});
// abrir Rubens
const r = p.locator('div').filter({ hasText: /^Rubens\s*\d+/ }).first();
await p.getByText('Rubens', { exact: true }).first().click(); await p.waitForTimeout(2500);
const chips = await p.evaluate(() => [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/^(Todas|Por arrancar|En análisis|En desarrollo|En pruebas|Esperan tu OK|Detenidas|Sin fecha)\s*\d+$/.test(t)));
console.log('filtro dentro:', JSON.stringify(chips));
const quitar = await p.locator('button', { hasText: /^Quitar$/ }).count();
console.log('botones Quitar:', quitar);
await p.screenshot({path:`${SP}/qa-taller-cuenta.png`, fullPage:false});
console.log('errores JS:', JSON.stringify(errs.slice(0,5)));
await b.close();
