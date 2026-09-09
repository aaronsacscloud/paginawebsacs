const { chromium } = require('/opt/sacs/paginawebsacs/sitio/node_modules/playwright');
const q = process.argv[2];
const scrolls = parseInt(process.argv[3]||'6');
(async () => {
  const b = await chromium.launch({args:['--no-sandbox']});
  const ctx = await b.newContext({locale:'es-MX', userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', viewport:{width:1400,height:1000}});
  const p = await ctx.newPage();
  try {
    await p.goto('https://www.google.com/maps/search/'+encodeURIComponent(q)+'?hl=es&gl=MX', {waitUntil:'domcontentloaded', timeout:60000});
    await p.waitForTimeout(4500);
    try { const btn = await p.$('button[aria-label*="Aceptar"]'); if(btn) { await btn.click(); await p.waitForTimeout(3000);} } catch(e){}
    await p.waitForSelector('div[role="feed"]', {timeout:25000}).catch(()=>{});
    for (let i=0;i<scrolls;i++){
      await p.evaluate(()=>{const f=document.querySelector('div[role="feed"]'); if(f) f.scrollTop=f.scrollHeight;});
      await p.waitForTimeout(2000);
    }
    const out = await p.evaluate(()=>{
      const res=[];
      document.querySelectorAll('div[role="feed"] > div').forEach(d=>{
        const a=d.querySelector('a[href*="/maps/place/"]');
        if(!a) return;
        const name=a.getAttribute('aria-label')||'';
        const txt=(d.innerText||'').replace(/\n/g,' | ');
        let rating=null, reviews=null;
        const st=[...d.querySelectorAll("span[aria-label]")].find(x=>/estrella|rese/i.test(x.getAttribute("aria-label")));
        if(st){
          const al=st.getAttribute('aria-label')||'';
          const m=al.match(/([\d.,]+)\s*estrellas?/i); if(m) rating=m[1].replace(',','.');
          const m2=al.match(/([\d.,]+)\s*rese/i); if(m2) reviews=m2[1].replace(/[.,]/g,'');
        }
        if(!rating){ const m=txt.match(/\|\s*(\d[.,]\d)\s*\|/); if(m) rating=m[1].replace(',','.'); }
        const web=d.querySelector('a[href^="http"]:not([href*="google.com"])');
        const ph=txt.match(/(\d{2,3}\s\d{3,4}\s\d{4})/);
        res.push({name, rating, reviews, url:a.href.split('?')[0], web: web?web.href:null, phone: ph?ph[1]:null, txt: txt.slice(0,260)});
      });
      return res;
    });
    console.log(JSON.stringify(out));
  } catch(e){ console.log(JSON.stringify([])); console.error('ERR '+e.message); }
  await b.close();
})();
