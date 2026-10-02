// Conteo físico · pestaña «Faltantes que se repiten»: análisis → productos reincidentes → «Crear conteo parcial» (sin clic)
const { abrir } = require('./rec.cjs'); const c = require('./conteo-comun.cjs');
(async()=>{
  const r = await abrir(1436, 720); const { p } = r;
  await c.abrirConteos(r);
  const [ax,ay] = await r.punto('Análisis'); await p.mouse.click(ax, ay); await c.listo(r, 'VALOR FALTANTE');
  await p.evaluate(()=>{ let hit=null; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(hit) return; if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').replace(/\s+/g,' ').trim(); if(/requieren supervisi/i.test(own)) hit=el; }); w(document); if (hit) hit.scrollIntoView({block:'start'}); });
  await p.mouse.wheel(0, -40); await p.waitForTimeout(1500);
  await r.iniciar('conteo-reincidentes');
  await r.quieto(1.3);
  const filas = await p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); if(own==='vigilar'){ const b=el.getBoundingClientRect(); if(b.width>0&&b.y>0&&b.y<700) out.push([b.x+b.width/2,b.y+b.height/2]); } }); w(document); return out; });
  for (const [x,y] of filas.slice(0,3)) { await r.mover(x, y, 0.45); await r.quieto(0.35); }
  const [bx,by] = await r.punto('Crear conteo parcial con estos productos').catch(()=>[0,0]);
  if (bx) { if (by > 680) { await r.ocultar(0.2); await p.mouse.move(700,450); await r.scroll(by - 520, 0.9); } const [b2x,b2y] = await r.punto('Crear conteo parcial con estos productos'); await r.toque(b2x, b2y, { clic:false }); await r.quieto(1.2); }
  await r.ocultar(); await r.quieto(0.3);
  await r.terminar('conteo-reincidentes', { recorteIzq: 64, salida: [1372, 720] });
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
