// Gastos · hero: lista de gastos → Dashboard de análisis (gasto vs ventas, a dónde se va el dinero)
const { abrir } = require('./rec.cjs'); const g = require('./gcp-comun.cjs');
(async()=>{
  const r = await abrir(1344, 720); const { p } = r;
  await g.abrir(r, 'Gastos', 'Nuevo gasto');
  await r.iniciar('gastos-hero'); await r.quieto(1.0);
  const [mx,my] = await r.punto('Más acciones'); await r.toque(mx, my); await p.waitForTimeout(1200); await r.quieto(0.5);
  const [dx,dy] = await r.punto('Dashboard de análisis'); await r.toque(dx, dy, { clic:false });
  await r.transicion(async()=>{ await p.mouse.click(dx, dy); await r.esperaTexto('A dónde se va el dinero'); }, null, { extra: 2000 });
  await r.quieto(1.2); await p.mouse.move(700,450); await r.scroll(380, 1.5); await r.quieto(1.5);
  await r.terminar('gastos-hero', { recorteIzq: 64, salida: [1600, 900] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
