const { abrir } = require('./rec.cjs'); const c = require('./rep-comun.cjs');
(async()=>{ const r=await abrir(1440,900); const {p}=r;
 const shot=async t=>{ await p.screenshot({path:__dirname+'/recon-r-'+t+'.png'}); console.log(t,p.url().split('/').slice(-3).join('/')); };
 await c.abrirHub(r); await shot('hub'); await p.mouse.move(800,500); await p.mouse.wheel(0,800); await p.waitForTimeout(2000); await shot('hub-2');
 const cards = await p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); const b=el.getBoundingClientRect(); if(own && own.length<45 && b.width>0 && b.x>330) out.push(own); }); w(document); return [...new Set(out)].slice(0,90); }); console.log(cards.join(' | '));
 await r.cerrar(); })().catch(e=>console.log('FALLO',e.message));
