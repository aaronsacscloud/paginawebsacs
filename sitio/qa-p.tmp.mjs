import { chromium } from 'playwright';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('../.crm-login','utf8').split('\n').filter(Boolean).map(l=>l.split('=').map(s=>s.trim().replace(/^["']|["']$/g,''))));
const B='http://localhost:4321', S='/tmp/claude-1000/-opt-sacs/7e8a832f-e7d9-49d7-9fd0-a2a7e5ec15a5/scratchpad';
const b = await chromium.launch({ executablePath: process.env.CHROME });
const p = await b.newPage({ viewport:{width:1500,height:950} });
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(B+'/admin/login');
await p.fill('input[type=email]',env.CRM_EMAIL); await p.fill('input[type=password]',env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForTimeout(4000);
// 1 · Churn: la pestaña Sin respuesta
await p.goto(B+'/admin/crm?tab=churn'); await p.waitForTimeout(14000);
console.log('pestañas:', await p.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(t=>/Detectados|conciliación|Sin respuesta|Irrecuperables/.test(t)).join(' | ')));
const ok = await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Sin respuesta/.test(x.innerText||'')); if(b){b.click();return true} return false});
console.log('clic Sin respuesta:', ok); await p.waitForTimeout(4000);
await p.screenshot({path:`${S}/churn.png`, clip:{x:300,y:0,width:1200,height:620}});
// 2 · el selector: ¿sale Perdido · definitivo?
await p.goto(B+'/admin/crm?tab=whatsapp&wa_conv=a6a23b7e-5267-4555-85b5-b45a99344a77'); await p.waitForTimeout(14000);
console.log('etapas:', await p.evaluate(()=>{const s=[...document.querySelectorAll('select')].find(x=>x.getAttribute('aria-label')==='Etapa del ciclo de vida'); return s?[...s.options].map(o=>o.text).join(' · '):'sin selector';}));
console.log('ERRS:',errs.slice(0,3));
await b.close();
