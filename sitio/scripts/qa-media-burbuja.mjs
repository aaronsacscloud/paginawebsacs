/**
 * QA de cómo se pintan las notas de voz y los archivos con transcripción.
 * Comprueba dos cosas que estaban mal: que una IMAGEN con texto leído por la
 * IA no se anuncie como nota de voz, y que un audio se pueda ESCUCHAR con la
 * transcripción a un toque — en escritorio y en teléfono.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const CONV_IMG = '0a56a4b4-fddc-4698-92df-1f4fd79a8359';   // comprobante de pago (imagen)
const CONV_AUD = 'a6785304-add4-4eae-92ff-4879716d7350';   // nota de voz con transcripción
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);
const nav = await chromium.launch({ args: ['--no-sandbox'] });

for (const [etq, vp] of [['ESCRITORIO', { width: 1360, height: 1000 }], ['TELÉFONO', { width: 390, height: 844 }]]) {
  const ctx = await nav.newContext({ viewport: vp, ...(vp.width < 500 ? { isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:4321/admin/login', { waitUntil: 'domcontentloaded' });
  await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
  await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
  console.log(`\n══ ${etq} ${vp.width}px`);

  // ── La imagen con texto leído por la IA ──
  await p.goto(`http://localhost:4321/admin/crm?tab=whatsapp&wa_conv=${CONV_IMG}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(13000);
  let t = await p.locator('body').innerText();
  paso('El comprobante ya NO dice «NOTA DE VOZ»', !/NOTA DE VOZ/.test(t));
  paso('Ya NO dice «Audio no disponible»', !/Audio no disponible/.test(t));
  paso('Se ofrece leer lo que dice la imagen', /Lo que dice la imagen/i.test(t));
  const img = await p.evaluate(() => {
    const i = [...document.querySelectorAll('img')].find(x => /supabase|media-entrante/.test(x.src) && x.naturalWidth > 0);
    return i ? { w: i.naturalWidth, h: i.naturalHeight } : null;
  });
  paso('La imagen se ve de verdad', !!img, img ? `${img.w}×${img.h}px` : 'no cargó');

  // ── La nota de voz ──
  await p.goto(`http://localhost:4321/admin/crm?tab=whatsapp&wa_conv=${CONV_AUD}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(13000);
  const aud = await p.evaluate(() => {
    const a = document.querySelector('.wa-audio audio');
    const b = document.querySelector('.wa-audio button');
    return a ? { src: !!a.getAttribute('src'), boton: b ? Math.round(b.getBoundingClientRect().height) : 0 } : null;
  });
  paso('Hay reproductor con archivo', !!aud?.src);
  paso('El botón de play es tocable', (aud?.boton || 0) >= (vp.width < 500 ? 44 : 30), `${aud?.boton}px`);
  // El botón lleva la flechita dentro («▸Transcripción»), así que no vale un
  // match exacto.
  const tr = p.locator('button').filter({ hasText: /Transcripci/i }).first();
  paso('La transcripción está plegada, a un toque', await tr.count() > 0);
  if (await tr.count()) {
    /* El largo del texto de la página NO sirve para medirlo: plegada ya se ve
       la primera línea, y si la transcripción es de una sola línea el texto no
       cambia al abrir. Se mide la FLECHA, que es el estado real del control. */
    const flecha = async () => (await tr.innerText()).trim().charAt(0);
    const a1 = await flecha();
    await tr.click(); await p.waitForTimeout(500);
    const a2 = await flecha();
    paso('Al tocarla se despliega', a1 === '▸' && a2 === '▾', `${a1} → ${a2}`);
  }
  await p.screenshot({ path: `/tmp/qa-media-${vp.width}.png` });
  console.log(errs.length ? `  ⚠ JS: ${errs.slice(0, 2).join(' | ')}` : '  ✓ sin errores de JS');
  await p.close();
}
await nav.close();
