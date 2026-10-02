// Inventario omnicanal · pestaña «Traspasos con estado»: transferencias → «Por enviar» (sin abrir detalle: las completas traen datos de otra cuenta y el detalle sale en $0)
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await r.go('sacs-transferencias/list/index', 'Nueva Transferencia');
  await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await p.waitForTimeout(6000);
  await r.iniciar('inventario-traspasos');
  await r.quieto(0.9);
  const [px,py] = await r.punto('Por enviar', { ymax: 520 }); await r.toque(px, py, { clic:false });
  await r.transicion(async()=>{ await p.mouse.click(px, py); await p.waitForTimeout(5000); }, 'Querétaro Antea', { extra: 1500 });
  await r.quieto(1.1);
  // recorre los traspasos por enviar: destino y estado
  const [qx,qy] = await r.punto('Querétaro Antea', { ymin: 300 }); await r.toque(qx, qy, { clic:false }); await r.quieto(0.7);
  const est = await p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); if(own==='Por enviar'){ const b=el.getBoundingClientRect(); if(b.width>0&&b.y>380) out.push([b.x+b.width/2,b.y+b.height/2]); } }); w(document); return out; });
  for (const [ex,ey] of est.slice(0,3)) { await r.mover(ex, ey, 0.45); await r.quieto(0.35); }
  await r.ocultar(); await r.quieto(0.5);
  await r.terminar('inventario-traspasos', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
