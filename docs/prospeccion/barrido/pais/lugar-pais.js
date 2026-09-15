// lugar-pais.js <url-de-maps> <GL> -> la ficha: {name, web, phone, address, cat, rating, reviews, ig}
// Maps pone el teléfono, la web y el número de reviews en la ficha, no en el
// feed (en el feed de fuera de México ni el teléfono sale). Una ficha por lugar.
const { chromium } = require('/opt/sacs/paginawebsacs/sitio/node_modules/playwright');
const u = process.argv[2]; const gl = process.argv[3] || 'CO';
(async () => {
  const b = await chromium.launch({args:['--no-sandbox']});
  const ctx = await b.newContext({locale:'en-US', userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', viewport:{width:1300,height:900}});
  const p = await ctx.newPage();
  try {
    await p.goto(u + '?hl=en&gl=' + gl, {waitUntil:'domcontentloaded', timeout:60000});
    await p.waitForTimeout(3500);
    try { const btn = await p.$('button[aria-label*="Aceptar"]'); if(btn) { await btn.click(); await p.waitForTimeout(2500);} } catch(e){}
    await p.waitForSelector('h1', {timeout:20000}).catch(()=>{});
    const out = await p.evaluate(()=>{
      const web = (()=>{const e=document.querySelector('a[data-item-id="authority"]'); return e? e.getAttribute('href') : null;})();
      const phone = (()=>{const e=document.querySelector('button[data-item-id^="phone:tel:"]'); return e? e.getAttribute('data-item-id').replace('phone:tel:','') : null;})();
      const address = (()=>{const e=document.querySelector('button[data-item-id="address"]'); return e? (e.getAttribute('aria-label')||'').replace(/^Address:\s*/,'') : null;})();
      const name = (document.querySelector('h1')||{}).innerText||null;
      const cat = (()=>{const e=document.querySelector('button[jsaction*="category"]'); return e? e.innerText : null;})();
      let rating=null, reviews=null;
      const main = document.querySelector('div[role="main"]');
      const r = main && main.querySelector('span[aria-label*="star"]');
      if (r) { const al=r.getAttribute('aria-label'); const m=al.match(/([\d.,]+)\s*star/); if(m) rating=m[1].replace(',','.'); }
      const rv = [...(main? main.querySelectorAll('span[aria-label*="review"], button[aria-label*="review"], a[aria-label*="review"]') : [])].map(x=>x.getAttribute('aria-label')).find(x=>/\d/.test(x||''));
      if (rv) { const m=rv.replace(/[.,]/g,'').match(/(\d+)/); if(m) reviews=m[1]; }
      if (!reviews && main) { const t=main.innerText||''; const m=t.match(/\n\s*\d[.,]\d\s*\n\s*\(?([\d.,]+)\)?\s*\n/); if(m) reviews=m[1].replace(/[.,]/g,''); }
      const ig = [...document.querySelectorAll('a[href*="instagram.com/"]')].map(a=>a.href)[0]||null;
      return {name, web, phone, address, cat, rating, reviews, ig};
    });
    console.log(JSON.stringify(out));
  } catch(e){ console.log(JSON.stringify({error:e.message})); }
  await b.close();
})();
