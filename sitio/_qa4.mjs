import { chromium } from 'playwright';
import fs from 'node:fs';
const SP = process.env.SP;
const env = Object.fromEntries(fs.readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const B='http://localhost:4401';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1500,height:900}, deviceScaleFactor:2})).newPage();
const errs=[]; p.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,160)); });
await p.goto(B+'/admin/login'); await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForTimeout(7000);
await p.goto(B+'/admin/crm?tab=taller'); await p.waitForTimeout(18000);
await p.getByText('Rubens', { exact: true }).first().click({timeout:20000}); await p.waitForTimeout(2500);
const tabs = await p.evaluate(() => [...document.querySelectorAll('button')]
  .filter(b => /^(Todas|Por arrancar|En análisis|En desarrollo|En pruebas|Esperan tu OK|Detenidas|Sin fecha)\s*\d+$/.test(b.textContent.trim()))
  .map(b => { const c = getComputedStyle(b); const pill = b.querySelector('span');
    return { t: b.textContent.trim(), bg: c.backgroundColor, linea: c.borderBottomColor, tinta: c.color,
             pastilla: pill ? (getComputedStyle(pill).backgroundImage !== 'none' ? 'degradado' : getComputedStyle(pill).backgroundColor) : null }; }));
console.log(JSON.stringify(tabs, null, 1));
await p.screenshot({path:`${SP}/qa-tabs-cuenta.png`, clip:{x:300,y:250,width:1200,height:300}});
await p.locator('button', { hasText: /^Sin fecha \d+$/ }).first().click(); await p.waitForTimeout(1000);
await p.screenshot({path:`${SP}/qa-tabs-sinfecha.png`, clip:{x:300,y:250,width:1200,height:300}});
console.log('errores:', JSON.stringify(errs.filter(e=>!/Outdated Optimize Dep/.test(e)).slice(0,4)));
await b.close();
