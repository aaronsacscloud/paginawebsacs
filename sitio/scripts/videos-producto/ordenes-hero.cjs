// Órdenes de compra · hero: la orden de Atelier MX — total, ordenado contra recibido y el flujo de la orden
const { abrir } = require('./rec.cjs'); const c = require('./oc-comun.cjs');
(async()=>{
  const r = await abrir(1344, 720); const { p } = r;
  await c.abrirRec(r); const f = await c.folioPorTotal(r, '$140,276.00', 'OC-'); console.log('folio', f); await c.abrirFolio(r, f, 'TOTAL DE LA ORDEN');
  await r.iniciar('ordenes-hero'); await r.quieto(1.2);
  try { const [x,y] = await r.punto('TOTAL DE LA ORDEN'); await r.mover(x, y+30, 0.6); await r.quieto(0.6); } catch(e){}
  try { const [x,y] = await r.punto('ORDENADO'); await r.mover(x, y+20, 0.6); await r.quieto(0.5); } catch(e){}
  try { const [x,y] = await r.punto('DIFERENCIA'); await r.mover(x, y+20, 0.5); await r.quieto(0.6); } catch(e){}
  // captura lo que llegó (sin confirmar: no se guarda nada)
  const ins = await p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('input').forEach(i=>{ const b=i.getBoundingClientRect(); if(b.width>20&&b.width<120&&b.y>380&&b.y<700&&b.x>500&&b.x<900) out.push([b.x+b.width/2,b.y+b.height/2]); }); const ww=r=>{w(r); r.querySelectorAll('*').forEach(e=>{ if(e.shadowRoot) ww(e.shadowRoot); });}; ww(document); return out; });
  for (const [[x,y],q] of ins.slice(0,3).map((v,k)=>[v,['58','22','18'][k]])) { await r.toque(x, y); await p.keyboard.press('Control+A'); await r.teclear(q, { porLetra: 3 }); await p.keyboard.press('Tab'); await p.waitForTimeout(400); await r.quieto(0.3); }
  await r.quieto(0.6);
  try { const [x,y] = await r.punto('Recepción', { xmin: 1000 }); await r.mover(x, y, 0.6); await r.quieto(0.5); } catch(e){}
  try { const [x,y] = await r.punto('Factura y pago'); await r.mover(x, y, 0.5); await r.quieto(0.7); } catch(e){}
  await r.ocultar(); await p.mouse.move(600,450); await r.scroll(260, 1.2); await r.quieto(1.2);
  await r.terminar('ordenes-hero', { recorteIzq: 64, salida: [1600, 900] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
