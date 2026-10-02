// Nivelación · pestaña «Reglas de moda»: Nivelación de moda → Gestor de reglas (temporadas, configuración, en números)
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos'); await prep.abrirMenu(r, 'Inventarios', 'Nivelación de moda', 'Gestor de reglas'); await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await p.waitForTimeout(3000);
  await r.iniciar('nivelacion-reglas');
  await r.quieto(1.3);
  for (const t of ['Buen Fin 2026', 'Navidad 2026 · Guía de regalo', 'Otoño-Invierno 2026']) { try { const [x,y] = await r.punto(t); await r.mover(x, y, 0.45); await r.quieto(0.35); } catch(e){} }
  try { const [x,y] = await r.punto('92 %'); await r.mover(x, y, 0.5); await r.quieto(0.6); } catch(e){}
  await r.ocultar(0.2); await p.mouse.move(800,450); await r.scroll(360, 1.3); await r.quieto(1.4);
  await r.terminar('nivelacion-reglas', { recorteIzq: 0, salida: [1436, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
