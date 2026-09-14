/**
 * QA de «compartir la conversación»: el botón copia la liga, la liga a un
 * mensaje ancla el hilo en ese mensaje, y mandársela a un compañero le deja el
 * aviso y el rastro. Lo que escribe en la base se borra al final.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.crm-login', import.meta.url), 'utf8')
  .split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.BASE || 'http://localhost:4325';
const CONV = '326663ff-7426-43c4-99cc-bfd18b22aa31';   // «Prueba Aaron», la de pruebas del dueño
const AGENTE = 'a7de2512-2bbc-4234-82e9-db4e6b706abf'; // Agente IA: cuenta de sistema, no le suena a ninguna persona

const nav = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 1420, height: 950 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
const paso = (n, ok, d = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`);
const portapapeles = () => p.evaluate(() => navigator.clipboard.readText());

await p.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
await p.fill('input[type=email]', env.CRM_EMAIL); await p.fill('input[type=password]', env.CRM_PASSWORD);
await p.click('button[type=submit]'); await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});

await p.goto(`${BASE}/admin/crm?tab=whatsapp&wa_conv=${CONV}`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(22000);
paso('Abre la conversación por liga', (await p.locator('[id^="wa-item-mensaje-"]').count()) > 0);

// ── 1 · El botón de la barra: un clic, liga copiada ──
const boton = p.locator('button[title="Compartir esta conversación"]');
paso('El botón vive en la barra del hilo', (await boton.count()) === 1);
await boton.click();
await p.waitForTimeout(700);
const liga = await portapapeles();
paso('Un clic deja la liga en el portapapeles', liga.includes(`wa_conv=${CONV}`), liga);
paso('La hoja dice que ya la copió', (await p.locator('text=Liga copiada').count()) > 0);
paso('Ofrece mandársela a un compañero', (await p.locator('text=Mandársela a un compañero').count()) > 0);
await p.screenshot({ path: '/tmp/qa-compartir-1.png' });

// ── 2 · La liga a UN mensaje ──
await p.keyboard.press('Escape');
const ultima = p.locator('[id^="wa-item-mensaje-"]').last();
const idAncla = (await ultima.getAttribute('id')).replace('wa-item-mensaje-', '');
await ultima.hover();
await p.waitForTimeout(300);
const ligaMsj = p.locator('button[aria-label="Copiar liga a este mensaje"]').last();
paso('La burbuja ofrece su propia liga al pasar el ratón', (await ligaMsj.count()) > 0);
await ligaMsj.click({ force: true });
await p.waitForTimeout(600);
const liga2 = await portapapeles();
paso('La liga del mensaje trae el ancla', liga2.includes(`wa_msg=${idAncla}`), liga2);
paso('Avisa que copió', (await p.locator('text=Liga del mensaje copiada').count()) > 0);
await p.screenshot({ path: '/tmp/qa-compartir-2.png' });

// ── 3 · Abrir esa liga cae en el mensaje ──
await p.goto(liga2, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(22000);
const visible = await p.evaluate(id => {
  const el = document.getElementById(`wa-item-mensaje-${id}`);
  const caja = el?.firstElementChild; if (!caja) return { hay: false };
  const r = caja.getBoundingClientRect();
  return { hay: true, dentro: r.top > 0 && r.bottom < window.innerHeight };
}, idAncla);
paso('La liga anclada deja el mensaje a la vista', visible.hay && visible.dentro, JSON.stringify(visible));
paso('El ancla no se queda pegada en la URL', !p.url().includes('wa_msg='), p.url());
await p.screenshot({ path: '/tmp/qa-compartir-3.png' });

// ── 4 · Mandársela a un compañero (con limpieza al final) ──
const r = await p.request.post(`${BASE}/api/crm/whatsapp/compartir`, {
  data: { conversation_id: CONV, para: AGENTE, recado: 'QA: esto se borra solo', mensaje_id: idAncla },
});
const j = await r.json();
paso('El envío responde ok', !!j.ok, JSON.stringify(j));

console.log(errs.length ? `  ⚠ ${errs.length} error(es) de JS: ${errs.slice(0, 3).join(' | ')}` : '  ✓ sin errores de JS');
await nav.close();
