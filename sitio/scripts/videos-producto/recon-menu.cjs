// Lista los items de cada grupo del menú lateral (expandido) y su ruta al hacer clic
const { abrir } = require('./rec.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); }
  const grupos = (process.env.GRUPOS||'Inventarios,Administración,Estudio').split(',');
  const clickTxt = async (t) => p.evaluate((t)=>{ let hit=null; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(hit) return; if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').replace(/\s+/g,' ').trim(); if(own===t){ const b=el.getBoundingClientRect(); if(b.width>0&&b.x<320) hit=el; } }); w(document); if(!hit) return false; hit.scrollIntoView({block:'center'}); hit.click(); return true; }, t);
  for (const g of grupos) {
    await clickTxt(g); await p.waitForTimeout(1500);
    const items = await p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').replace(/\s+/g,' ').trim(); const b=el.getBoundingClientRect(); if(own && b.width>0 && b.x>30 && b.x<120 && own.length<40) out.push(own); }); w(document); return [...new Set(out)]; });
    console.log('##', g, '→', items.join(' | '));
  }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
