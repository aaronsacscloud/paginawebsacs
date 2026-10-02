// Nivelación · pestaña «Veredictos»: tarjetas del tablero (liquidación, lote dormido, quiebre de básicos…) con sus acciones (toques sin clic)
const { abrir } = require('./rec.cjs'); const c = require('./niv-comun.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await c.abrirTablero(r);
  const yc = (await r.punto('Cada tarjeta es un veredicto', { xmin: 100 }).catch(()=>[0,600]))[1];
  await p.mouse.move(700,450); await p.mouse.wheel(0, Math.max(0, yc - 40)); await p.waitForTimeout(2000);
  await r.iniciar('nivelacion-veredictos');
  await r.quieto(1.0);
  for (const t of ['Armar la liquidación', 'Armar la lista de rebaja', 'Ver qué resurtir']) { try { const [x,y] = await r.punto(t); if (y < 700) { await r.toque(x, y, { clic:false }); await r.quieto(0.6); } } catch(e){} }
  await r.ocultar(0.2); await p.mouse.move(700,450); await r.scroll(300, 1.2); await r.quieto(0.4);
  for (const t of ['Responder caso por caso', 'Revisar el pedido', 'Ver los cortes de pedido']) { try { const [x,y] = await r.punto(t); if (y < 700) { await r.toque(x, y, { clic:false }); await r.quieto(0.6); } } catch(e){} }
  await r.ocultar(); await r.quieto(0.4);
  await r.terminar('nivelacion-veredictos', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
