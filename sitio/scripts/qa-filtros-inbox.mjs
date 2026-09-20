/* Los filtros del inbox: que la lista cuadre con el contador SIN refrescar.
   Reproduce la carrera: cambia de etapa varias veces seguidas, rápido. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const login = Object.fromEntries(readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const B = 'http://127.0.0.1:4321';
const nav = await chromium.launch({ args:['--no-sandbox'] });
const p = await (await nav.newContext({ viewport:{width:1440,height:950} })).newPage();
const errores = []; p.on('pageerror', e => errores.push(e.message));
let fallas = 0;
const paso = (n, ok, d='') => { if (!ok) fallas++; console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };
try {
  await p.goto(`${B}/admin/login`, { waitUntil:'networkidle' });
  await p.fill('input[type="email"]', login.CRM_EMAIL);
  await p.fill('input[type="password"]', login.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout:45000 }).catch(()=>{});
  await p.goto(`${B}/admin/crm?tab=whatsapp`, { waitUntil:'networkidle' });
  await p.waitForTimeout(11000);

  /* ══ SE FUERZA LA CARRERA, TAL COMO PASA ══════════════════════════════
     El síntoma del dueño era «Nuevo lead 68» con la lista VACÍA. Eso ocurre
     cuando la respuesta que aterriza al final es la de OTRA selección que sí
     está vacía. Así que se encadena: primero una etapa sin conversaciones
     —«Prueba gratis», 0— cuya respuesta se retrasa 4 s a propósito, y encima
     se pica «Nuevo lead», que tiene 68. Sin candado de secuencia, la vacía
     llega tarde y pinta encima: contador lleno, lista en blanco.
     En local no pasa solo porque todo responde en milisegundos; en producción
     /inbox se va a 8 s cada tantas peticiones (ya medido). */
  const orden = [];
  await p.route('**/api/crm/whatsapp/inbox**', async route => {
    const u = route.request().url();
    const etapa = (decodeURIComponent(u).match(/"valor":"([^"]+)"/) || [])[1] || (decodeURIComponent(u).match(/etapa=([^&]+)/) || [])[1] || 'todas';
    orden.push('→ ' + etapa);
    if (/prueba_gratis/.test(decodeURIComponent(u))) await new Promise(r => setTimeout(r, 4000));
    orden.push('← ' + etapa);
    await route.continue();
  });

  const filas = () => p.locator('button[data-conv]').count();
  // Se pincha etapa tras etapa SIN esperar: así se solapan las peticiones,
  // que es justo lo que provocaba el desajuste.
  await p.getByRole('button', { name: /Prueba gratis/ }).first().click({ timeout: 20000 }).catch(()=>{});
  await p.waitForTimeout(250);
  await p.getByRole('button', { name: /Nuevo lead/ }).first().click({ timeout: 20000 }).catch(()=>{});
  await p.waitForTimeout(7000);   // que aterrice también la lenta

  const r = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /Nuevo lead/.test(b.innerText));
    const n = btn ? Number((btn.innerText.match(/(\d+)\s*$/) || [])[1] || 0) : -1;
    return { contador: n, filas: document.querySelectorAll('button[data-conv]').length };
  });
  console.log(`  · peticiones: ${orden.join('  ')}`);
  console.log(`  · «Nuevo lead» dice ${r.contador} · la lista trae ${r.filas}`);
  paso('El contador no queda en cero', r.contador > 0, `${r.contador}`);
  paso('La lista NO queda vacía con contador lleno', !(r.contador > 0 && r.filas === 0), `${r.filas} filas`);
  await p.screenshot({ path:'/tmp/qa-filtros.png' });
  paso('Sin errores de JS propios', errores.filter(e=>!/async_hooks/.test(e)).length === 0, errores.slice(0,2).join(' | '));
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
