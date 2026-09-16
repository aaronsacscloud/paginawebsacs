import { chromium } from 'playwright';
import fs from 'node:fs';
const SP = process.env.SP;
const env = Object.fromEntries(fs.readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const B='http://localhost:4403';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1500,height:950}, deviceScaleFactor:2})).newPage();
const errs=[]; p.on('console', m=>{ if(m.type()==='error') errs.push(m.text().slice(0,150)); });
await p.goto(B+'/admin/login'); await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForTimeout(8000);
await p.goto(B+'/admin/crm?tab=taller'); await p.waitForTimeout(25000);
await p.getByText('Rubens', { exact: true }).first().click({timeout:30000}); await p.waitForTimeout(3500);
const pills = await p.evaluate(() => [...document.querySelectorAll('span')]
  .filter(s => s.children.length===0 && (/^(\+ reunión|\+ módulo)$/.test(s.textContent.trim()) || /^\d{2}-\w{3} · /.test(s.textContent.trim())))
  .slice(0,10).map(s => s.textContent.trim()));
console.log('pastillas:', JSON.stringify(pills));
await p.screenshot({path:`${SP}/qa-lote-0.png`});
const cas = p.locator('[role=checkbox]');
await cas.nth(0).click(); await p.waitForTimeout(300); await cas.nth(1).click(); await p.waitForTimeout(800);
await p.screenshot({path:`${SP}/qa-lote-sel.png`});
await p.locator('button', { hasText: 'Reunión de origen' }).first().click(); await p.waitForTimeout(4000);
const rs = await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/^\d{2}-\w{3} · /.test(t)).slice(0,4));
console.log('primeras reuniones (las más nuevas):', JSON.stringify(rs));
await p.screenshot({path:`${SP}/qa-lote-junta.png`});
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.locator('button', { hasText: /^Módulo$/ }).first().click(); await p.waitForTimeout(900);
await p.screenshot({path:`${SP}/qa-lote-modulo.png`});
console.log('errores:', JSON.stringify(errs.filter(e=>!/Outdated Optimize/.test(e)).slice(0,4)));
await b.close();
