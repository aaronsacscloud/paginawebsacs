// Inventario omnicanal · pestaña «Alertas antes del quiebre»: tablero de Nivelación (solo lectura, sin abrir detalles)
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await r.go('nivelacion-inventario/tablero/index', 'Tu analista');
  await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await p.waitForTimeout(4000);
  await r.iniciar('inventario-alertas');
  await r.quieto(1.4);
  const [ax,ay] = await r.punto('Se te acaban', { xmin: 200 }).catch(()=>[600,220]); await r.toque(ax, ay, { clic:false }); await r.quieto(0.9);
  await r.ocultar(0.2);
  await p.mouse.move(700, 450); await r.scroll(560, 1.6); await r.quieto(1.3);
  await r.scroll(420, 1.3); await r.quieto(1.5);
  await r.terminar('inventario-alertas', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
