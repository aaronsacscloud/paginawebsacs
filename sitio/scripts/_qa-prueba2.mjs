import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const B='http://localhost:4321';
const nav = await chromium.launch({ args:['--no-sandbox'] });
const errores=[];
async function sesion(viewport){
  const p = await nav.newPage({ viewport });
  p.on('pageerror', e=>errores.push(`[${viewport.width}] ${e.message}`));
  p.on('console', m=>{ if(m.type()==='error' && !/favicon|503|telefonia/.test(m.text())) errores.push(`[${viewport.width}] ${m.text().slice(0,140)}`); });
  await p.goto(`${B}/admin/login`,{waitUntil:'networkidle'});
  await p.fill('input[type="email"]', env.CRM_EMAIL);
  await p.fill('input[type="password"]', env.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**',{timeout:30000}).catch(()=>{});
  return p;
}

// ── El formulario de alta en la ficha ──
const web = await sesion({width:1440,height:1000});
await web.goto(`${B}/admin/crm?tab=pipeline`,{waitUntil:'networkidle'});
await web.waitForTimeout(6000);
await web.locator('[role="row"], [class*="fila"]').first().click({timeout:8000}).catch(()=>{});
await web.waitForTimeout(9000);
await web.locator('text=Seguimiento').first().click().catch(()=>{});
await web.waitForTimeout(3000);
await web.locator('text=Crear cuenta de prueba').first().click({timeout:8000}).catch(()=>{});
await web.waitForTimeout(1500);
const panel = web.locator('text=IDENTIFICADOR DE LA CUENTA').first();
const caja = await panel.count() ? await panel.locator('xpath=ancestor::div[3]').first() : null;
await (caja || web).screenshot({path:'/tmp/qa-prueba-form.png'}).catch(()=>web.screenshot({path:'/tmp/qa-prueba-form.png'}));
const t = await web.locator('body').innerText();
console.log('  formulario · identificador ', /IDENTIFICADOR/.test(t)?'sí':'NO');
console.log('  formulario · aviso del host', /app\.sacscloud\.com/.test(t)?'sí':'NO');
console.log('  formulario · botón          ', /Crear cuenta y arrancar/.test(t)?'sí':'NO');

// ── El popup del inbox, escritorio ──
await web.goto(`${B}/admin/crm?tab=whatsapp`,{waitUntil:'networkidle'});
await web.waitForTimeout(9000);
await web.locator('[class*="conv"], li').filter({hasText:/./}).nth(2).click({timeout:8000}).catch(()=>{});
await web.waitForTimeout(5000);
// el 📎 del composer
const clip = web.locator('button[title="Adjuntar"], button[aria-label="Adjuntar"]').first();
if (await clip.count()) { await clip.click(); await web.waitForTimeout(1200); }
await web.screenshot({path:'/tmp/qa-prueba-inbox-menu.png'});
const t2 = await web.locator('body').innerText();
console.log('  inbox · menú con «Prueba gratis»', /Prueba gratis/.test(t2)?'sí':'NO');
if (/Prueba gratis/.test(t2)) {
  await web.locator('text=Prueba gratis').first().click().catch(()=>{});
  await web.waitForTimeout(1500);
  await web.screenshot({path:'/tmp/qa-prueba-inbox-pop.png'});
  console.log('  inbox · popup abierto           ', /IDENTIFICADOR|ya tiene una prueba/i.test(await web.locator('body').innerText())?'sí':'NO');
}

// ── El teléfono ──
const mov = await sesion({width:390,height:844});
await mov.goto(`${B}/admin/crm?tab=whatsapp`,{waitUntil:'networkidle'});
await mov.waitForTimeout(9000);
await mov.locator('[class*="conv"], li').filter({hasText:/./}).nth(2).click({timeout:8000}).catch(()=>{});
await mov.waitForTimeout(5000);
const clipM = mov.locator('button[title="Adjuntar"], button[aria-label="Adjuntar"]').first();
if (await clipM.count()) { await clipM.click(); await mov.waitForTimeout(1200); }
await mov.screenshot({path:'/tmp/qa-prueba-movil-menu.png'});
console.log('  móvil · menú con «Prueba gratis»', /Prueba gratis/.test(await mov.locator('body').innerText())?'sí':'NO');

console.log(errores.length ? `\n  ⚠ ${errores.length} error(es):\n     ${[...new Set(errores)].slice(0,4).join('\n     ')}` : '\n  ✓ sin errores de JS');
await nav.close();
