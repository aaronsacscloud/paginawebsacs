// utilidades de preparación de escena
module.exports = {
  async menuColapsado(r){ const { p } = r;
    const ancho = await p.evaluate(()=>{ let w=0; const walk=root=>root.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) walk(el.shadowRoot); const t=(el.textContent||'').trim(); if(el.children.length===0 && t==='Cerrar sesión'){ const b=el.getBoundingClientRect(); if(b.width>0) w=Math.max(w,b.x); } }); walk(document); return w; });
    if (ancho > 40) { try { const [x,y] = await r.punto('first_page', { xmax: 260 }); await p.mouse.click(x,y); await p.waitForTimeout(1500); } catch(e){} }
  },
  async ocultarFlotantes(r){ const { p } = r;
    await p.evaluate(()=>{ const vw=innerWidth, vh=innerHeight; const pts=[[vw-30,vh-30],[vw-45,vh-45],[vw-60,vh-60]];
      for (const [x,y] of pts){ let el=document.elementFromPoint(x,y); while(el && el.shadowRoot && el.shadowRoot.elementFromPoint(x,y) && el.shadowRoot.elementFromPoint(x,y)!==el) el=el.shadowRoot.elementFromPoint(x,y);
        let e=el; while(e && e!==document.body){ const cs=getComputedStyle(e); if(cs.position==='fixed'){ const bb=e.getBoundingClientRect(); if(bb.width<520 && bb.height<360) e.style.setProperty('display','none','important'); break; } e=e.parentElement || (e.getRootNode && e.getRootNode().host); } } });
  }
};
// Abre un módulo desde el menú lateral (los deep links de varios módulos se quedan en «Cargando módulo…»)
module.exports.abrirMenu = async function (r, grupo, item, esperar) {
  const { p } = r;
  if (!(await r.hayTexto('Cerrar sesión'))) { await p.mouse.click(32, 875); await p.waitForTimeout(1500); }
  const clic = t => p.evaluate((t)=>{ let hit=null; const w=r=>r.querySelectorAll('*').forEach(el=>{ if(hit) return; if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').replace(/\s+/g,' ').trim(); if(own===t){ const b=el.getBoundingClientRect(); if(b.width>0&&b.x<320) hit=el; } }); w(document); if(!hit) return false; hit.scrollIntoView({block:'center'}); hit.click(); return true; }, t);
  for (let intento = 0; intento < 3; intento++) {
    if (await clic(item)) break;
    if (await clic(grupo)) { await p.waitForTimeout(1500); if (await clic(item)) break; }
    // menú colapsado: expandirlo con el botón del riel (abajo a la izquierda)
    await p.mouse.click(32, (await p.evaluate(()=>innerHeight)) - 25); await p.waitForTimeout(1800);
    if (intento === 2) throw new Error('menú: no encontré ' + item);
  }
  if (esperar) await r.esperaTexto(esperar, 150000);
  await p.waitForTimeout(2500);
};
// Oculta el aviso (contenedor más cercano con fondo) que contiene un texto: avisos técnicos que distraen en video
module.exports.ocultarAviso = async function (r, texto) {
  await r.p.evaluate((t)=>{ const w=root=>root.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join(''); if(own.includes(t)){ let e=el; for(let i=0;i<6&&e;i++){ const cs=getComputedStyle(e); if(cs.backgroundColor!=='rgba(0, 0, 0, 0)' && cs.backgroundColor!=='transparent' && e.getBoundingClientRect().width>500 && e.getBoundingClientRect().height<220){ e.style.setProperty('display','none','important'); return; } e=e.parentElement; } } }); w(document); }, texto);
};

// Oculta el chip/botón cuyo texto es exactamente `t` (p. ej. una pestaña de otro giro)
module.exports.ocultarTexto = async function (r, t) {
  await r.p.evaluate((t)=>{ const w=root=>root.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) w(el.shadowRoot); const own=[...el.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim(); if(own===t){ let e=el; for(let i=0;i<3&&e.parentElement&&e.parentElement.getBoundingClientRect().width<260;i++) e=e.parentElement; e.style.setProperty('display','none','important'); } }); w(document); }, t);
};
