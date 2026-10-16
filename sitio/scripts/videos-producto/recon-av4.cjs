const { abrir } = require('./rec.cjs'); const c = require('./rep-comun.cjs');
(async()=>{ const r=await abrir(1440,900); const {p}=r;
 await c.abrirHub(r); await c.domClic(r,'Ventas por Vendedor',330,1440); await r.esperaTexto('Generar reporte'); await p.waitForTimeout(4000);
 const [x,y] = await r.punto('2 Oct 2026').catch(()=>[0,0]); console.log('periodo',x,y); if (x) { await p.mouse.click(x,y); await p.waitForTimeout(2000); await p.screenshot({path:__dirname+'/recon-av4-a.png'}); }
 const opts = await p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); const b=el.getBoundingClientRect(); if(own && b.width>0 && b.y>150 && b.y<700 && b.x>900 && own.length<30) out.push(own+'@'+Math.round(b.x)+','+Math.round(b.y)); }); w(document); return out; }); console.log(opts.join(' | '));
 await r.cerrar(); })().catch(e=>console.log('FALLO',e.message));
