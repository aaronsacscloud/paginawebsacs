// html-nav.js <url> [url2 …] -> JSON [{url, final, html}] con el HTML ya renderizado.
// Es el plan B de sitios-pais.py: curl se topa con 403 de Cloudflare, 429 o
// un 301 que no lleva a ningún lado, y un navegador de verdad sí entra. Solo
// se usa para esos casos: abrir Chromium por sitio es 20 veces más lento.
const { chromium } = require('/opt/sacs/paginawebsacs/sitio/node_modules/playwright');
const urls = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({args:['--no-sandbox']});
  const ctx = await b.newContext({locale:'es-419', userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', viewport:{width:1300,height:900}});
  const out = [];
  for (const u of urls) {
    const p = await ctx.newPage();
    try {
      const r = await p.goto(u, {waitUntil:'domcontentloaded', timeout:30000});
      await p.waitForTimeout(2500);
      out.push({url:u, final:p.url(), status:r ? r.status() : 0, html: await p.content()});
    } catch (e) { out.push({url:u, final:u, status:0, html:'', error:String(e).slice(0,80)}); }
    await p.close();
  }
  await b.close();
  process.stdout.write(JSON.stringify(out));
})();
