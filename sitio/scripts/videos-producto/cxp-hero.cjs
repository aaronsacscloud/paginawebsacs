// Cuentas por pagar · hero: lista (vencido a la vista) → vista agrupada por proveedor
const { abrir } = require('./rec.cjs'); const g = require('./gcp-comun.cjs');
(async()=>{
  const r = await abrir(1344, 720); const { p } = r;
  await g.abrir(r, 'Cuentas por pagar', 'Nueva Cuenta');
  await r.iniciar('cxp-hero'); await r.quieto(1.1);
  try { const [x,y] = await r.punto('Vencido', { ymax: 120 }); await r.mover(x+40, y, 0.6); await r.quieto(0.6); } catch(e){}
  const [vx,vy] = await r.punto('Vencidos'); await r.toque(vx, vy); await p.waitForTimeout(2500); await r.quieto(1.0);
  const [ax,ay] = await r.punto('Agrupada'); await r.toque(ax, ay); await p.waitForTimeout(3000); await r.quieto(1.4);
  await r.ocultar(); await r.quieto(0.4);
  await r.terminar('cxp-hero', { recorteIzq: 64, salida: [1600, 900] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
