// Reconocimiento rápido de pantallas (sin grabar): node recon.cjs ruta1 ruta2 …  o  MENU="Inventarios>Productos,Inventarios>Traslado de mercancía"
const { abrir } = require('./rec.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', process.env.ESPERA || 'Ingresos');
  const clickTxt = async (t, xmax=320) => p.evaluate(([t,xmax])=>{ let hit=null; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(hit) return; if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); if(own===t){ const b=el.getBoundingClientRect(); if(b.width>0&&b.x<xmax) hit=el; } }); w(document); if(!hit) return false; hit.scrollIntoView({block:'center'}); hit.click(); return true; },[t,xmax]);
  const listo = async () => { for (let i=0;i<90;i++){ const c = await r.hayTexto('Cargando'); if(!c && i>4) break; await p.waitForTimeout(1000);} await p.waitForTimeout(2500); };
  for (const item of (process.env.MENU||'').split(',').filter(Boolean)) {
    const [g, it] = item.split('>');
    if (!(await clickTxt(it))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); await clickTxt(g); await p.waitForTimeout(1200); await clickTxt(it); }
    await listo(); const f = __dirname+'/recon-'+it.replace(/\W+/g,'_')+'.png'; await p.screenshot({ path: f }); console.log(it, '→', p.url().split('/').slice(-3).join('/'), f);
  }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
