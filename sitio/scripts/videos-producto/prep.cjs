// utilidades de preparación de escena
module.exports = {
  async menuColapsado(r){ const { p } = r;
    const ancho = await p.evaluate(()=>{ let w=0; const walk=root=>root.querySelectorAll('*').forEach(el=>{ if(el.shadowRoot) walk(el.shadowRoot); const t=(el.textContent||'').trim(); if(el.children.length===0 && t==='Cerrar sesión'){ const b=el.getBoundingClientRect(); if(b.width>0) w=Math.max(w,b.x); } }); walk(document); return w; });
    if (ancho > 40) { try { const [x,y] = await r.punto('first_page', { xmax: 260 }); await p.mouse.click(x,y); await p.waitForTimeout(1500); } catch(e){} }
  },
  async ocultarFlotantes(r){ const { p } = r;
    await p.evaluate(()=>{ const vw=innerWidth, vh=innerHeight; const pts=[[vw-30,vh-30],[vw-45,vh-45],[vw-60,vh-60]];
      for (const [x,y] of pts){ let el=document.elementFromPoint(x,y); while(el && el.shadowRoot && el.shadowRoot.elementFromPoint(x,y) && el.shadowRoot.elementFromPoint(x,y)!==el) el=el.shadowRoot.elementFromPoint(x,y);
        let e=el; while(e && e!==document.body){ const cs=getComputedStyle(e); if(cs.position==='fixed'){ e.style.setProperty('display','none','important'); break; } e=e.parentElement || (e.getRootNode && e.getRootNode().host); } } });
  }
};
