// Conteo físico · pestaña «Diferencias»: resumen → «No coinciden» → dif. unidades y costo → Excel
const { abrir } = require('./rec.cjs'); const c = require('./conteo-comun.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await c.abrirConteos(r);
  const [x,y] = await r.punto('CON - 23'); await p.mouse.click(x, y); await c.listo(r, 'Resumen de Conteo');
  await r.iniciar('conteo-diferencias');
  await r.quieto(1.0);
  const [nx,ny] = await r.punto('No coinciden'); await r.toque(nx, ny); await p.waitForTimeout(1500); await r.quieto(0.8);
  const [dx,dy] = await r.punto('Dif. Unidades:').catch(()=>[0,0]); if (dx) { await r.mover(dx+60, dy, 0.6); await r.quieto(0.7); }
  const [ex,ey] = await r.punto('Excel', { ymax: 120 }); await r.toque(ex, ey, { clic:false }); await r.quieto(0.7);
  await r.ocultar(0.2); await p.mouse.move(700, 450); await r.scroll(320, 1.3); await r.quieto(1.2);
  await r.terminar('conteo-diferencias', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
