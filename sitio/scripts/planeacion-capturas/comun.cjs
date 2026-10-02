// Utilidades para entrar al módulo Demand Planning del sistema LOCAL (sacs3 en http://localhost:8081, solo lectura) y
// moverse entre pantallas sin recargar la app (cada recarga tarda más de un minuto en el servidor de desarrollo).
// Usuario QA de andyaraujoconsultorias por variables de entorno (nada de credenciales en el repo):
// QA_USER=… QA_PASS=… node captura.cjs escritorio
const { chromium } = require('../../node_modules/playwright');
const BASE = '/lavidaesparadisfrutar/andyaraujoconsultorias/nivelacion-moda';
const USER = process.env.QA_USER, PASS = process.env.QA_PASS;
if (!USER || !PASS) throw new Error('Faltan QA_USER y QA_PASS');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function texto(p) { return p.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => ''); }
async function espera(p, fn, max = 150000) { const t0 = Date.now(); while (Date.now() - t0 < max) { try { if (await fn()) return true; } catch (e) { /* la página se está cargando */ } await sleep(2000); } return false; }
async function entrar(vp, dpr = 1) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8081/', { waitUntil: 'domcontentloaded' });
  await espera(p, async () => (await p.evaluate(() => !!document.querySelector('input[type=password]')).catch(() => false)) || (await texto(p)).includes('Cerrar sesión'));
  if (await p.evaluate(() => !!document.querySelector('input[type=password]')).catch(() => false)) {
    await p.fill('input[type=email], input[name=email], input[type=text]', USER);
    await p.fill('input[type=password]', PASS); await p.keyboard.press('Enter');
  }
  await espera(p, async () => { const bt = p.getByText('Entrar ahora, verificar después'); if (await bt.count()) { await bt.first().click(); } return (await texto(p)).includes('Cerrar sesión'); });
  await p.evaluate(() => localStorage.setItem('moda-dp-red:andyaraujoconsultorias', 'Polanco Boutique'));
  return { b, p };
}
async function ir(p, ruta, debeDecir, max = 150000) {
  await p.evaluate((url) => { history.pushState({}, '', url); window.dispatchEvent(new CustomEvent('location-changed')); }, BASE + '/' + ruta);
  const ok = await espera(p, async () => { const t = await texto(p); return !t.includes('Cargando módulo') && (!debeDecir || t.includes(debeDecir)); }, max);
  await sleep(3500);
  return ok;
}
module.exports = { entrar, ir, sleep, texto, espera, BASE };
