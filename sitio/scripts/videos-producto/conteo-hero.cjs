// Conteo físico · hero: lista de conteos → abrir el de septiembre → diferencias por prenda con foto
const { abrir } = require('./rec.cjs'); const c = require('./conteo-comun.cjs');
(async()=>{
  const r = await abrir(1344, 720); const { p } = r;
  await c.abrirConteos(r);
  await r.iniciar('conteo-hero');
  await r.quieto(1.1);
  const [x,y] = await r.punto('CON - 23'); await r.toque(x, y, { clic:false });
  await r.transicion(async()=>{ await p.mouse.click(x, y); await c.listo(r, 'Resumen de Conteo'); }, null, { extra: 1500 });
  await r.quieto(1.3);
  await p.mouse.move(700, 450); await r.scroll(300, 1.4); await r.quieto(1.5);
  await r.terminar('conteo-hero', { recorteIzq: 64, salida: [1600, 900] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
