const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await r.go('facturacion-electronica/list/index', 'Timbradas');
  await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await p.waitForTimeout(800);
  await r.iniciar('tab-emision-cfdi');
  await r.quieto(0.9);
  const [nx,ny] = await r.punto('No timbradas'); await r.toque(nx,ny,{clic:false});
  await r.transicion(async()=>{ await p.mouse.click(nx,ny); await p.waitForTimeout(2500); }, 'NO TIMBRADO', { extra: 1500 });
  await prep.ocultarFlotantes(r); await r.quieto(0.8);
  const [tx,ty] = await r.punto('Timbrar', { xmin: 1000, ymin: 300 }); await r.toque(tx, ty, { clic:false }); await r.quieto(1.1);
  const [t2x,t2y] = await r.punto('Timbrar', { xmin: 1000, ymin: ty + 30 }); await r.toque(t2x, t2y, { clic:false }); await r.quieto(0.9);
  const [gx,gy] = await r.punto('Globales'); await r.toque(gx,gy,{clic:false});
  await r.transicion(async()=>{ await p.mouse.click(gx,gy); await p.waitForTimeout(2500); }, 'Global', { extra: 1500 });
  await prep.ocultarFlotantes(r); await r.quieto(1.4);
  await r.ocultar(); await r.quieto(0.3);
  await r.terminar('tab-emision-cfdi', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
