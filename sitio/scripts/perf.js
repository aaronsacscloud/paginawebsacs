// perf.js — mide velocidad de carga por pantalla del CRM.
// USO: node perf.js <base-url> [tabs...]   (default: todos los tabs del goal)
// Red: 4G realista (12 Mbps down / 70 ms RTT), CPU 4x (teléfono medio).
// Métricas por tab: COLD (caché vacío) y WARM (assets cacheados, datos fríos)
// = tiempo desde goto hasta CONTENIDO con datos visible (.m-row o héroe).
const { chromium } = require('playwright-core');
const EXEC = process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const BASE = process.argv[2] || 'http://localhost:4321';
const TABS = process.argv.slice(3).length ? process.argv.slice(3)
  : ['dashboard', 'pipeline', 'clientes', 'whatsapp', 'cotizaciones', 'pagos', 'soporte'];
const SEL = {
  default: '.m-row, .m-hero .m-hv, .m-sec',
};
const THROTTLE = !process.env.NO_THROTTLE;

(async () => {
  const login = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'aaron@sacscloud.com', password: '12345678' }) });
  const tok = ((login.headers.get('set-cookie') || '').match(/sacs_session=([^;]+)/) || [])[1];
  if (!tok) { console.error('sin sesión'); process.exit(1); }

  const results = [];
  for (const tab of TABS) {
    const row = { tab };
    for (const modo of ['cold', 'warm']) {
      const ctx = await chromium.launchPersistentContext(process.env.SP + '/profile-perf-' + tab + modo + Date.now(), {
        executablePath: EXEC, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
        viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      });
      await ctx.addCookies([{ name: 'sacs_session', value: tok, url: BASE }]);
      const page = ctx.pages()[0] || await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      if (THROTTLE) {
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 70, downloadThroughput: 12 * 1024 * 1024 / 8, uploadThroughput: 3 * 1024 * 1024 / 8 });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      }
      const url = BASE + '/admin/crm?tab=' + tab;
      if (modo === 'warm') { // primer viaje para calentar caché de assets, luego medir
        await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
        await page.waitForTimeout(2500);
      }
      const muestras = [];
      let fcp = null;
      const n = modo === 'warm' ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const t0 = Date.now();
        await page.goto(url, { waitUntil: 'commit', timeout: 90000 });
        let ok = true;
        await page.waitForSelector(SEL[tab] || SEL.default, { state: 'visible', timeout: 30000 }).catch(() => { ok = false; });
        muestras.push(ok ? Date.now() - t0 : -1);
        fcp = await page.evaluate(() => {
          const e = performance.getEntriesByName('first-contentful-paint')[0];
          return e ? Math.round(e.startTime) : null;
        }).catch(() => null);
        await page.waitForTimeout(400);
      }
      const buenas = muestras.filter(x => x > 0).sort((a, b) => a - b);
      row[modo] = buenas.length ? buenas[Math.floor((buenas.length - 1) / 2)] : -1; // mediana
      row[modo + '_max'] = muestras.length > 1 ? Math.max(...muestras) : undefined;
      row[modo + '_fcp'] = fcp;
      await ctx.close();
    }
    console.log(JSON.stringify(row));
    results.push(row);
  }
  console.log('\nRESUMEN (contenido visible, ms):');
  console.log('tab            cold    warm(mediana de 3)  warm_max   warm_fcp');
  for (const r of results) console.log(`${r.tab.padEnd(14)} ${String(r.cold).padStart(5)}   ${String(r.warm).padStart(8)}   ${String(r.warm_max).padStart(8)}   ${String(r.warm_fcp).padStart(7)}`);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
