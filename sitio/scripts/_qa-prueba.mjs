import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const B='http://localhost:4321';
const nav = await chromium.launch({ args:['--no-sandbox'] });
const errores=[];
async function sesion(viewport){
  const pag = await nav.newPage({ viewport });
  pag.on('pageerror', e=>errores.push(`[${viewport.width}] ${e.message}`));
  pag.on('console', m=>{ if(m.type()==='error' && !/favicon|404/.test(m.text())) errores.push(`[${viewport.width}] ${m.text().slice(0,140)}`); });
  await pag.goto(`${B}/admin/login`,{waitUntil:'networkidle'});
  await pag.fill('input[type="email"]', env.CRM_EMAIL);
  await pag.fill('input[type="password"]', env.CRM_PASSWORD);
  await pag.click('button[type="submit"]');
  await pag.waitForURL('**/admin/crm**',{timeout:30000}).catch(()=>{});
  return pag;
}

// ── 1. La ficha del lead, pestaña Seguimiento ──
const web = await sesion({width:1440,height:1000});
await web.goto(`${B}/admin/crm?tab=pipeline`,{waitUntil:'networkidle'});
await web.waitForTimeout(5000);
// La lista pinta tarjetas, no una <table>: se abre por el nombre del lead.
const fila = web.locator('table tbody tr, [class*="fila"], [role="row"]').first();
if (await fila.count()) { await fila.click({timeout:5000}).catch(()=>{}); await web.waitForTimeout(3500); }
if (!/Seguimiento/.test(await web.locator('body').innerText())) {
  await web.locator('text=/^(Claudia|Arturo|Erika)/').first().click({timeout:5000}).catch(()=>{});
  await web.waitForTimeout(9000);
}
const seg = web.locator('text=Seguimiento').first();
if (await seg.count()) { await seg.click().catch(()=>{}); await web.waitForTimeout(4000); }
await web.screenshot({path:'/tmp/qa-prueba-ficha.png'});
const txt = await web.locator('body').innerText();
console.log('  ficha · ¿aparece el panel?  ', /Prueba gratis/.test(txt) ? 'sí' : 'NO');
console.log('  ficha · ¿botón de crear?    ', /Crear cuenta de prueba/.test(txt) ? 'sí' : 'no (ya tiene prueba o no cargó)');

// ── 2. El inbox, escritorio ──
await web.goto(`${B}/admin/crm?tab=whatsapp`,{waitUntil:'networkidle'});
await web.waitForTimeout(7000);
const conv = web.locator('[class*="wa-"], li, div').filter({hasText:/hace|min|ayer/}).first();
await conv.click({timeout:5000}).catch(()=>{});
await web.waitForTimeout(4000);
await web.screenshot({path:'/tmp/qa-prueba-inbox.png'});
console.log('  inbox web · cargó         ', /Escribe|plantilla|Enviar/i.test(await web.locator('body').innerText()) ? 'sí' : 'no');

// ── 3. El inbox, teléfono ──
const mov = await sesion({width:390,height:844});
await mov.goto(`${B}/admin/crm?tab=whatsapp`,{waitUntil:'networkidle'});
await mov.waitForTimeout(7000);
await mov.screenshot({path:'/tmp/qa-prueba-movil.png'});
console.log('  inbox móvil · cargó       ', (await mov.locator('body').innerText()).length > 50 ? 'sí' : 'no');

console.log(errores.length ? `\n  ⚠ ${errores.length} error(es) de JS:\n     ${[...new Set(errores)].slice(0,5).join('\n     ')}` : '\n  ✓ sin errores de JS en ninguna vista');
await nav.close();
