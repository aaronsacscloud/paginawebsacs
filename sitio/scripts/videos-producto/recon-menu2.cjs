// Lista los items nuevos que aparecen al abrir cada grupo del menú lateral
const { abrir } = require('./rec.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); }
  const grupos = (process.env.GRUPOS||'Fidelización').split(',');
  const clickTxt = async (t) => p.evaluate((t)=>{ let hit=null; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(hit) return; if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').replace(/\s+/g,' ').trim(); if(own===t){ const b=el.getBoundingClientRect(); if(b.width>0&&b.x<320) hit=el; } }); w(document); if(!hit) return false; hit.scrollIntoView({block:'center'}); hit.click(); return true; }, t);
  const lista = () => p.evaluate(()=>{ const out=[]; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').replace(/\s+/g,' ').trim(); const b=el.getBoundingClientRect(); if(own && b.width>0 && b.x>20 && b.x<140 && own.length<40) out.push(own); }); w(document); return [...new Set(out)]; });
  const base = await lista();
  for (const g of grupos) {
    await clickTxt(g); await p.waitForTimeout(1500);
    const items = (await lista()).filter(x=>!base.includes(x));
    console.log('##', g, '→', items.join(' | '));
    await clickTxt(g); await p.waitForTimeout(800);
  }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
