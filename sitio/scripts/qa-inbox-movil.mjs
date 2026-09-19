/* El inbox en el teléfono: que la lista no se rompa contra la barra de abajo. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const login = Object.fromEntries(readFileSync('/opt/sacs/paginawebsacs/.crm-login','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const B = process.argv.includes('--prod') ? 'https://www.sacscloud.com' : 'http://127.0.0.1:4321';
const nav = await chromium.launch({ args:['--no-sandbox'] });
const ctx = await nav.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
const p = await ctx.newPage();
let fallas = 0;
const paso = (n, ok, d='') => { if (!ok) fallas++; console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ` — ${d}` : ''}`); };
try {
  await p.goto(`${B}/admin/login`, { waitUntil:'networkidle' });
  await p.fill('input[type="email"]', login.CRM_EMAIL);
  await p.fill('input[type="password"]', login.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout:45000 }).catch(()=>{});
  await p.goto(`${B}/admin/crm?tab=whatsapp`, { waitUntil:'networkidle' });
  await p.waitForTimeout(12000);

  const medir = () => p.evaluate(() => {
    const nav = [...document.querySelectorAll('div,nav')].find(e => {
      const s = getComputedStyle(e);
      return s.position === 'fixed' && s.bottom === '0px' && e.getBoundingClientRect().height > 40 && e.getBoundingClientRect().height < 120;
    });
    const navTop = nav ? Math.round(nav.getBoundingClientRect().top) : null;
    // filas de la lista que quedan TAPADAS por la barra
    const filas = [...document.querySelectorAll('.m-conv, .m-row')];
    const tapadas = navTop == null ? 0 : filas.filter(f => {
      const b = f.getBoundingClientRect();
      return b.top < window.innerHeight && b.bottom > navTop + 4;
    }).length;
    return { navTop, alto: window.innerHeight, filas: filas.length, tapadas,
      docAlto: document.documentElement.scrollHeight, finLista: Math.round(filas.length ? filas[filas.length-1].getBoundingClientRect().bottom + window.scrollY : 0) };
  });

  const arriba = await medir();
  console.log(`  · barra fija arriba de y=${arriba.navTop} · ventana ${arriba.alto} · ${arriba.filas} filas`);
  paso('La barra está pegada abajo', arriba.navTop != null && Math.abs(arriba.alto - arriba.navTop) < 100, `top=${arriba.navTop}`);
  paso('Ninguna fila queda tapada por la barra', arriba.tapadas === 0, `${arriba.tapadas} tapadas`);

  // hasta el final de la lista
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(2500);
  const abajo = await medir();
  paso('Al llegar al final, la última fila se ve entera', abajo.tapadas === 0, `${abajo.tapadas} tapadas`);
  const sobra = abajo.docAlto - abajo.finLista;
  console.log(`  · aire tras la última fila: ${sobra} px (la barra mide ~${abajo.alto - (abajo.navTop || 0)})`);
  paso('El aire de abajo es el justo, no media pantalla', sobra > 40 && sobra < 320, `${sobra} px`);
  await p.screenshot({ path:'/tmp/qa-inbox-movil.png', fullPage:false });
} finally { await nav.close(); }
process.exit(fallas ? 1 : 0);
