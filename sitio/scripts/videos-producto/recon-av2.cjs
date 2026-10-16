const { abrir } = require('./rec.cjs'); const c = require('./rep-comun.cjs');
(async()=>{ const r=await abrir(1440,900); const {p}=r;
 const { sel } = await c.armarAnalisis(r);
 await p.mouse.click(350,165); await p.keyboard.type('Polanco',{delay:60}); await p.waitForTimeout(2500); await p.screenshot({path:__dirname+'/recon-av-1.png'});
 const op = await p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); const b=el.getBoundingClientRect(); if(/Polanco/.test(own) && b.width>0 && b.y>180) out.push([own,b.x+b.width/2,b.y+b.height/2]); }); w(document); return out; }); console.log(JSON.stringify(op));
 if (op[0]) { await p.mouse.click(op[0][1], op[0][2]); await p.waitForTimeout(1500); }
 await sel('nombrecategoria',0); await sel('importe_con_impuestos',1);
 await p.mouse.click(1250,165); await p.waitForTimeout(1500); await p.screenshot({path:__dirname+'/recon-av-2.png'});
 await r.cerrar(); })().catch(e=>console.log('FALLO',e.message));
