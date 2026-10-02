// Inventario omnicanal · hero: catálogo de moda con fotos, existencia y variantes por prenda
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1344, 720); const { p } = r;
  await r.go('articulos/list/index', 'Catálogo de productos');
  await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await p.waitForTimeout(2500);
  const yt = (await r.punto('Todos los productos'))[1]; await p.mouse.move(700, 450); await p.mouse.wheel(0, Math.max(0, yt - 120)); await p.waitForTimeout(1500);
  await r.iniciar('inventario-hero');
  await r.quieto(1.2);
  const [ex,ey] = await r.punto('79 en existencia').catch(()=>[0,0]); if (ex) { await r.toque(ex, ey, { clic:false }); await r.quieto(0.6); await r.ocultar(0.2); }
  await p.mouse.move(700, 450); await r.scroll(380, 1.6); await r.quieto(1.0);
  await r.scroll(380, 1.6); await r.quieto(1.2);
  await r.terminar('inventario-hero', { recorteIzq: 64, salida: [1600,900] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
