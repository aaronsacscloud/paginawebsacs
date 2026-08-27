// perf-switch.js — mide el cambio de tab (tap → contenido) con chunks precargados.
// USO: node perf-switch.js <base-url>
const { chromium } = require('playwright-core');
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const BASE = process.argv[2] || 'http://localhost:4321';
const DESTINOS = [['Leads', '.m-row'], ['Clientes', '.m-row'], ['Inbox', '.m-row, .m-sec'], ['Inicio', '.m-hero .m-hv']];
(async () => {
  const login = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'aaron@sacscloud.com', password: '12345678' }) });
  const tok = ((login.headers.get('set-cookie') || '').match(/sacs_session=([^;]+)/) || [])[1];
  const ctx = await chromium.launchPersistentContext(process.env.SP + '/profile-sw-' + Date.now(), {
    executablePath: EXEC, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  await ctx.addCookies([{ name: 'sacs_session', value: tok, url: BASE }]);
  const page = ctx.pages()[0] || await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 70, downloadThroughput: 12 * 1024 * 1024 / 8, uploadThroughput: 3 * 1024 * 1024 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU || 4) });
  await page.goto(BASE + '/admin/crm', { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(9000); // hidratar + prefetch idle + primer uso (SWR caliente)
  for (const [label, sel] of DESTINOS) {
    const t0 = Date.now();
    await page.locator(`nav[aria-label="Navegación principal"] button:has-text("${label}")`).click();
    await page.waitForSelector(sel, { state: 'visible', timeout: 20000 }).catch(() => {});
    console.log(`switch → ${label.padEnd(9)} ${Date.now() - t0} ms`);
    await page.waitForTimeout(1200);
  }
  await ctx.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
