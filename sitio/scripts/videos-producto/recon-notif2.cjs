const { abrir } = require('./rec.cjs');
(async()=>{
  const r = await abrir(1440, 900); const { p } = r;
  await r.go('dashboard/list/index', 'Ingresos');
  if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); }
  let [x,y] = await r.punto('Configuración'); await p.mouse.click(x,y); await r.esperaTexto('Configuración y personalización');
  await p.waitForTimeout(4000);
  const ok = await p.evaluate(()=>{ let hit=null; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(hit) return; if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); if(own==='Notificaciones'){ const b=el.getBoundingClientRect(); if(b.width>0&&b.x<300&&b.y>150&&b.y<500) hit=el; } }); w(document); if(!hit) return false; hit.click(); return true; });
  console.log('clic', ok); await p.waitForTimeout(12000);
  await p.screenshot({path:'recon-notif.png'}); console.log(p.url());
  await p.mouse.move(900,600); for (let i=0;i<3;i++){ await p.mouse.wheel(0,800); await p.waitForTimeout(1500); await p.screenshot({path:`recon-notif${i}.png`}); }
  await r.cerrar();
})().catch(e=>{ console.error('FALLO', e.message); process.exit(1); });
