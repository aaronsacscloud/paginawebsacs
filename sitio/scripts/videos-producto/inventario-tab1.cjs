// Inventario omnicanal · pestaña «Talla y color»: ficha del Blazer → variantes por color y talla con lo disponible
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await r.go('articulos/list/index', 'Catálogo de productos');
  await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await p.waitForTimeout(2500);
  await r.esperaTexto('Blazer sastre', 120000);
  await p.evaluate(()=>{ let hit=null; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(hit) return; if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').replace(/\s+/g,' ').trim().toLowerCase(); if(own==='blazer sastre cruzado' && el.getBoundingClientRect().width>0) hit=el; }); w(document); hit.scrollIntoView({block:'center'}); });
  await p.waitForTimeout(1500);
  const [bx,by] = await r.punto('Blazer Sastre Cruzado');
  await r.iniciar('inventario-variantes');
  await r.quieto(0.8);
  await r.toque(bx, by, { clic:false });
  await r.transicion(async()=>{ await p.mouse.click(bx, by); }, 'Producto con variantes', { extra: 3000 });
  await prep.ocultarFlotantes(r); await r.quieto(0.4);
  const yv = (await r.punto('Producto con variantes'))[1];
  await p.mouse.move(500, 400); await r.scroll(yv - 90, 1.4); await r.quieto(0.9);
  await r.scroll(320, 1.2); await r.quieto(1.4);
  await r.terminar('inventario-variantes', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
