/* La cabina de llamadas EN EL TELÉFONO, de verdad: la barra del pulgar, la
   hoja de la lista y que nada quede fuera de alcance. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const login = Object.fromEntries(readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const B = 'http://127.0.0.1:4321';
const nav = await chromium.launch({ args:['--no-sandbox'] });
const ctx = await nav.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
const p = await ctx.newPage();
const errores = []; p.on('pageerror', e => errores.push(e.message));
let fallas = 0;
const paso = (n, ok, d='') => { if (!ok) fallas++; console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };
try {
  await p.goto(`${B}/admin/login`, { waitUntil:'networkidle' });
  await p.fill('input[type="email"]', login.CRM_EMAIL);
  await p.fill('input[type="password"]', login.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout:45000 }).catch(()=>{});
  await p.goto(`${B}/admin/crm?tab=llamadas`, { waitUntil:'networkidle' });
  await p.waitForTimeout(10000);
  const txt = () => p.locator('body').innerText();
  paso('Abre Llamadas inteligentes en móvil', /[Ll]lamadas inteligentes/.test(await txt()), '');

  // abrir la jornada pausada (tiene sesión viva para ver la barra)
  const seguir = p.getByRole('button', { name: /^Seguir$|^Abrir$/ }).first();
  if (await seguir.count()) { await seguir.click(); await p.waitForTimeout(8000); }

  const medidas = await p.evaluate(() => {
    const fijos = [...document.querySelectorAll('div')].filter(d => {
      const s = getComputedStyle(d);
      return s.position === 'fixed' && parseInt(s.bottom || '99') <= 1 && d.getBoundingClientRect().height > 40;
    }).map(d => ({ alto: Math.round(d.getBoundingClientRect().height), texto: d.innerText.replace(/\n/g,' · ').slice(0,60) }));
    const botones = [...document.querySelectorAll('button')].filter(b => b.offsetParent);
    const chicos = botones.filter(b => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 32).length;
    return { fijos, chicos, doc: document.documentElement.scrollWidth, win: window.innerWidth };
  });
  console.log(`  · barras fijas abajo: ${JSON.stringify(medidas.fijos)}`);
  paso('Sin desborde horizontal', medidas.doc <= medidas.win + 1, `${medidas.doc} vs ${medidas.win}`);
  paso('Ningún botón por debajo de 32 px', medidas.chicos === 0, `${medidas.chicos} chicos`);
  await p.screenshot({ path:'/tmp/qa-cabina-movil.png' });
  paso('Sin errores de JS propios', errores.filter(e=>!/async_hooks/.test(e)).length === 0, errores.slice(0,2).join(' | '));
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
