// Nivelación · hero: tablero del analista → cifras → tarjetas con veredicto (solo lectura, sin abrir detalles)
const { abrir } = require('./rec.cjs'); const c = require('./niv-comun.cjs');
(async()=>{
  const r = await abrir(1344, 720); const { p } = r;
  await c.abrirTablero(r);
  await r.iniciar('nivelacion-hero');
  await r.quieto(1.6);
  await p.mouse.move(700, 450); await r.scroll(420, 1.6); await r.quieto(1.0);
  await r.scroll(330, 1.4); await r.quieto(1.6);
  await r.terminar('nivelacion-hero', { recorteIzq: 64, salida: [1600, 900] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
