const { abrir } = require('./rec.cjs'); const c = require('./rep-comun.cjs');
(async()=>{ const r=await abrir(1440,900); const {p}=r;
 await c.abrirHub(r); await c.domClic(r,'Análisis de ventas',330,1440); await p.waitForTimeout(10000);
 const sels = await p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); if(el.tagName==='SELECT'){ const b=el.getBoundingClientRect(); out.push(Math.round(b.x)+','+Math.round(b.y)+' :: '+[...el.options].map(o=>o.value+'='+o.textContent.trim()).join(' | ')); } }); w(document); return out; }); console.log(sels.join('\n'));
 await r.cerrar(); })().catch(e=>console.log('FALLO',e.message));
