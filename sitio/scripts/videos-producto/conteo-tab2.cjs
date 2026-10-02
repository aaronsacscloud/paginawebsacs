// Conteo físico · pestaña «Análisis»: botón Análisis → indicadores, tendencia y faltante por categoría
const { abrir } = require('./rec.cjs'); const c = require('./conteo-comun.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await c.abrirConteos(r);
  const [ax,ay] = await r.punto('Análisis'); await p.mouse.click(ax, ay); await c.listo(r, 'VALOR FALTANTE'); await p.waitForTimeout(2000);
  await r.iniciar('conteo-analisis');
  await r.quieto(1.8);
  for (const t of ['VALOR FALTANTE DETECTADO', 'EXACTITUD DE INVENTARIO', 'PRODUCTOS REINCIDENTES']) { try { const [x,y] = await r.punto(t); await r.mover(x, y + 30, 0.5); await r.quieto(0.4); } catch(e){} }
  await r.ocultar(0.2);
  await p.mouse.move(700, 450); await r.scroll(420, 1.5); await r.quieto(1.2);
  await r.scroll(380, 1.4); await r.quieto(1.4);
  await r.terminar('conteo-analisis', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
