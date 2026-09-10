/**
 * QA de la telefonía del inbox, SIN marcarle a nadie.
 *
 * El riesgo obvio de probar un marcador es marcar de verdad: cada clic sería
 * una llamada a un cliente real. Por eso todas las pruebas empujan la llamada
 * hacia una VALIDACIÓN que corta antes de tocar Twilio: número inválido, el
 * propio número del negocio, o una llamada de WhatsApp ya en curso. Se recorre
 * la ruta completa —ícono → evento → componente → pantalla— y nunca sale una
 * llamada.
 *
 *   node scripts/qa-telefonia.mjs [--puerto 4321]
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const RUTA_LOGIN = resolve(aqui, '../../.crm-login');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const base = `http://localhost:${arg('puerto', '4321')}`;
const NUESTRO = '+525593027234';

if (!existsSync(RUTA_LOGIN)) { console.error(`Falta ${RUTA_LOGIN}`); process.exit(1); }
const env = Object.fromEntries(readFileSync(RUTA_LOGIN, 'utf8').split('\n').filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

const nav = await chromium.launch({ args: ['--no-sandbox', '--use-fake-ui-for-media-stream'] });
const p = await nav.newPage({ viewport: { width: 1360, height: 950 } });
const errores = [];
p.on('pageerror', e => errores.push(e.message));
p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

const paso = (n, ok, det = '') => console.log(`  ${ok ? '✓' : '✗'} ${n}${det ? ` — ${det}` : ''}`);
const textoPanel = () => p.evaluate(() => {
  const n = [...document.querySelectorAll('div')].filter(d => d.getAttribute('role') === 'alert' || /Ya estás en una llamada|no es un teléfono|llamarte a ti mismo|WhatsApp en curso|Timbrando|En línea|Conectando|micrófono/.test(d.textContent || ''));
  return n.length ? n[n.length - 1].innerText.trim().slice(0, 200) : '';
});
const limpiar = () => p.evaluate(() => {
  delete document.documentElement.dataset.waLlamada;
  document.querySelectorAll('button[aria-label="Cerrar"]').forEach(b => b.click());
  [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === '✕').forEach(b => b.click());
});

try {
  await p.goto(`${base}/admin/login`, { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', env.CRM_EMAIL);
  await p.fill('input[type="password"]', env.CRM_PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL('**/admin/crm**', { timeout: 30000 }).catch(() => {});
  await p.goto(`${base}/admin/crm?tab=whatsapp`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(7000);

  // ── 1 · El ícono de llamar existe en las filas de la lista ───────────────
  const iconos = p.locator('[aria-label^="Llamar a"]');
  const n = await iconos.count();
  paso('Ícono de llamar en las conversaciones', n > 0, `${n} filas con teléfono válido`);

  const fila = p.locator('.wa-fila-hover').first();
  await fila.hover();
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/qa-tel-1-icono.png' });

  // Que de verdad se vea al pasar el mouse (no basta con que exista en el DOM).
  const visible = await iconos.first().evaluate(el => Number(getComputedStyle(el).opacity));
  paso('Se revela al pasar el mouse', visible > 0.9, `opacidad ${visible}`);

  // ── 2 · Clic en el ícono con una llamada de WhatsApp en curso ────────────
  await p.evaluate(() => { document.documentElement.dataset.waLlamada = '1'; });
  await iconos.first().click();
  await p.waitForTimeout(700);
  let t = await textoPanel();
  paso('Clic en la fila → llega al marcador y valida', /WhatsApp en curso/i.test(t), t.slice(0, 70));
  await p.screenshot({ path: '/tmp/qa-tel-2-ocupado.png' });
  await limpiar();

  // ── 3 · Número basura ───────────────────────────────────────────────────
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: '123', nombre: 'Prueba' } })));
  await p.waitForTimeout(700);
  t = await textoPanel();
  paso('Teléfono inválido se rechaza antes de marcar', /no es un teléfono válido/i.test(t), t.slice(0, 70));
  await p.screenshot({ path: '/tmp/qa-tel-3-invalido.png' });
  await limpiar();

  // ── 4 · Nuestro propio número (bucle) ───────────────────────────────────
  await p.evaluate(num => document.dispatchEvent(new CustomEvent('tel-llamar', { detail: { telefono: num, nombre: null } })), NUESTRO);
  await p.waitForTimeout(700);
  t = await textoPanel();
  paso('Marcar al propio número se bloquea', /llamarte a ti mismo/i.test(t), t.slice(0, 70));
  await p.screenshot({ path: '/tmp/qa-tel-4-bucle.png' });
  await limpiar();

  // ── 5 · La barra de WhatsApp ya no se prende con llamadas telefónicas ────
  const r = await p.evaluate(async b => {
    const j = await fetch(b + '/api/crm/whatsapp/llamadas?activas=1').then(x => x.json()).catch(() => null);
    return (j?.llamadas || []).filter(l => l.canal === 'telefono').length;
  }, base);
  paso('El banner de WhatsApp ya no recoge llamadas telefónicas', r === 0, `${r} filas 'telefono' devueltas`);

  console.log(errores.length ? `\n  ⚠ ${errores.length} error(es) de JS:\n     ${errores.slice(0, 4).join('\n     ')}` : '\n  ✓ sin errores de JS');
} finally {
  await nav.close();
}
