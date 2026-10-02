// Reportes · hero: hub de reportes → reporte de ventas agrupado por categoría (últimos 7 días)
const { abrir } = require('./rec.cjs'); const c = require('./rep-comun.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1344, 720); const { p } = r;
  await c.ventas(r, 'nombrecategoria'); await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await p.waitForTimeout(2000);
  await r.iniciar('reportes-hero'); await r.quieto(1.2);
  try { const [x,y] = await r.punto('Agrupar por', { ymax: 300 }); await r.mover(x+40, y+34, 0.6); await r.quieto(0.5); } catch(e){}
  try { const [x,y] = await r.punto('Período', { ymax: 300 }); await r.mover(x+60, y+34, 0.6); await r.quieto(0.5); } catch(e){}
  const [gx,gy] = await r.punto('Generar reporte'); await r.toque(gx, gy); await p.waitForTimeout(6000); await r.quieto(0.6);
  await r.ocultar(0.2); await p.mouse.move(700,450); await r.scroll(260, 1.4); await r.quieto(1.6);
  await r.terminar('reportes-hero', { recorteIzq: 64, salida: [1600, 900] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
