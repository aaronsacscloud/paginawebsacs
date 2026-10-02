const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await r.go('notas-credito/list/index', 'Nueva Nota');
  await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await p.waitForTimeout(800);
  await r.iniciar('tab-notas-credito');
  await r.quieto(0.8);
  const [nx,ny] = await r.punto('Nueva Nota'); await r.toque(nx,ny,{clic:false});
  await r.transicion(async()=>{ await p.mouse.click(nx,ny); }, 'Factura a Relacionar', { extra: 2500 });
  await prep.ocultarFlotantes(r); await r.quieto(0.7);
  // cliente: toque visible; la búsqueda se teclea fuera de cámara y entra con fundido
  const inp = await p.locator('input[placeholder="Busca tus clientes"]').locator('visible=true').first().boundingBox();
  await r.toque(inp.x + 60, inp.y + inp.height/2, { clic:false });
  await r.transicion(async()=>{
    await p.mouse.click(inp.x + 60, inp.y + inp.height/2); await p.keyboard.type(process.env.CLIENTE_NC || '', { delay: 50 }); // cliente con datos fiscales completos (fuera de git) await p.waitForTimeout(3500);
    const [ox,oy] = await r.punto('BOUTIQUE ALMA S.A. DE C.V.', { ymin: inp.y + 10 }); await p.mouse.click(ox, oy); await p.waitForTimeout(5000);
  }, 'Factura a Relacionar', { extra: 1200 });
  await r.quieto(1.0);
  await p.mouse.move(700, 400); await r.scroll(500, 1.1); await r.quieto(0.5);
  const [fx,fy] = await r.punto('I6359'); await r.toque(fx - 32, fy + 8, { clic:false });
  await r.transicion(async()=>{ await p.mouse.click(fx - 32, fy + 8); }, 'Factura seleccionada', { fundido: 0.25, extra: 1500 });
  await r.quieto(0.9);
  await p.mouse.move(700, 400); await r.scroll(600, 1.2); await r.quieto(0.4);
  for (const prenda of ['Vestido midi de lino · M', 'Blazer oversize negro · S']) {
    const [px,py] = await r.punto(prenda);
    const cb = await p.evaluate(y=>{ let best=null; const walk=root=>root.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) walk(el.shadowRoot); if(el.tagName==='INPUT'&&el.type==='checkbox'){ const b=el.getBoundingClientRect(); if(b.width>0&&Math.abs(b.y+b.height/2-y)<30) best=[b.x+b.width/2,b.y+b.height/2]; } }); walk(document); return best; }, py);
    const [cx,cy] = cb || [px - 100, py + 10];
    await r.toque(cx, cy); await p.waitForTimeout(900); await r.quieto(0.35);
  }
  await r.quieto(0.6);
  const b = await p.locator('text=Revisar y Timbrar').locator('visible=true').first().boundingBox();
  if (b.y + b.height > r.vh - 10) { await p.mouse.move(700, 400); await r.scroll(b.y + b.height - r.vh + 40, 0.8); }
  const [tx,ty] = await r.punto('Revisar y Timbrar'); await r.toque(tx, ty, { clic:false }); await r.quieto(1.3);
  await r.ocultar(); await r.quieto(0.3);
  await r.terminar('tab-notas-credito', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
