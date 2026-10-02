// Nivelación · pestaña «Nivelaciones»: lista de corridas con origen → destino y estado (sin abrir detalle)
const { abrir } = require('./rec.cjs'); const c = require('./niv-comun.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await c.abrirTablero(r);
  await r.iniciar('nivelacion-lista');
  await r.quieto(0.8);
  const [nx,ny] = await r.punto('Nivelaciones', { ymax: 80 }); await r.toque(nx, ny, { clic:false });
  await r.transicion(async()=>{ await p.mouse.click(nx, ny); }, 'Nueva nivelación', { extra: 3500 });
  await r.quieto(1.0);
  const filas = await p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); if(own==='Pendiente'||own==='Completado'){ const b=el.getBoundingClientRect(); if(b.width>0&&b.y>300&&b.y<700) out.push([b.x+b.width/2,b.y+b.height/2]); } }); w(document); return out; });
  for (const [x,y] of filas.slice(0,4)) { await r.mover(x, y, 0.4); await r.quieto(0.3); }
  for (const t of ['Completadas', 'Borradores']) { try { const [x,y] = await r.punto(t, { ymax: 420 }); await r.toque(x, y); await p.waitForTimeout(1500); await r.quieto(0.8); } catch(e){} }
  try { const [x,y] = await r.punto('Todas', { ymax: 420 }); await r.toque(x, y); await p.waitForTimeout(1500); } catch(e){}
  await r.ocultar(); await r.quieto(0.6);
  await r.terminar('nivelacion-lista', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
