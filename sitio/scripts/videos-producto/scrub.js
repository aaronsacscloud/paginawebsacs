// Enmascara datos sensibles EN PANTALLA (no toca datos). Corre cada 120 ms sobre DOM + shadow roots.
(function(){
  if (window.__scrub) return; window.__scrub = true;
  const NOMBRES = ['MARIANA LÓPEZ RÍOS','SOFÍA HERNÁNDEZ CRUZ','DANIELA TORRES VEGA','VALERIA RAMÍREZ SOTO','FERNANDA CASTILLO PAZ','REGINA MORALES LUNA','ANDREA GUZMÁN REYES','CAMILA ORTIZ NAVA','LUCÍA MENDOZA ROJAS','PAULINA AGUILAR MEZA','XIMENA VARGAS LEÓN','RENATA SALAZAR DÍAZ','BOUTIQUE ALMA S.A. DE C.V.','TIENDAS LUNA MODA S.A. DE C.V.','NATALIA FLORES IBARRA','ISABELA CRUZ MÁRQUEZ'];
  const FIJOS = Object.assign({}, window.__SCRUB_FIJOS || {}); // pares real→ficticio: fijos.local.json (fuera de git)
  const mapa = new Map(Object.entries(FIJOS)); const FAKES = new Set(Object.values(FIJOS));
  const LIBRES = new Set(['LOMA850312AB1','PUBLICO EN GENERAL','PÚBLICO EN GENERAL','XAXX010101000','XEXX010101000']);
  let n = 0;
  const h = s => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ', N = '0123456789';
  function rfcFalso(r){ const k = h(r); const len = r.length; let s = '';
    const pre = len === 12 ? 3 : 4; for (let i=0;i<pre;i++) s += L[(k>>>(i*3))%L.length];
    s += String(70 + k%30).padStart(2,'0') + String(1 + (k>>>5)%12).padStart(2,'0') + String(1+(k>>>9)%28).padStart(2,'0');
    s += L[(k>>>4)%L.length] + L[(k>>>11)%L.length] + N[(k>>>7)%10]; FAKES.add(s); return s; }
  function nombreFalso(t){ if (!mapa.has(t)) { const f = NOMBRES[(n++) % NOMBRES.length]; mapa.set(t, f); FAKES.add(f); } return mapa.get(t); }
  const RFC = /\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/gi;
  const CP = /(C\.?\s?P\.?\s*\d{5})/i;
  const iniciales = s => s.split(/\s+/).filter(w=>w.length>2).slice(0,2).map(w=>w[0]).join('');
  function fixText(node){
    let t = node.textContent; const orig = t; const tr = t.trim(); if (!tr) return;
    if (FAKES.has(tr)) return; if (mapa.has(tr)) { t = t.replace(tr, mapa.get(tr)); }
    else if (CP.test(tr) && tr.length > 18) { t = 'Av. Insurgentes Sur 1458, Col. Actipan, Benito Juárez, CDMX, C.P. 03230'; }
    else {
      t = t.replace(RFC, m => (LIBRES.has(m.toUpperCase()) || FAKES.has(m)) ? m : (mapa.get(m) || (mapa.set(m, rfcFalso(m.toUpperCase())), mapa.get(m))));
    }
    if (t !== orig) node.textContent = t;
  }
  function esNombre(el){ const c = (el.className && el.className.baseVal === undefined ? el.className : '') + ''; return /cliente-nombre|receptor-nombre|nombre-cliente|client-name/.test(c); }
  function walk(root){
    const els = root.querySelectorAll('*');
    for (const el of els){
      if (el.shadowRoot) walk(el.shadowRoot);
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { const v = el.value; if (v && document.activeElement !== el && !(el.getRootNode && el.getRootNode().activeElement === el) && mapa.has(v.trim()) && FIJOS[v.trim()]) { el.value = mapa.get(v.trim()); continue; } if (v) { const nv = v.replace(RFC, m => (LIBRES.has(m.toUpperCase())||FAKES.has(m))?m:(mapa.get(m)||(mapa.set(m,rfcFalso(m.toUpperCase())),mapa.get(m)))); if (nv!==v) el.value = nv; } continue; }
      if (esNombre(el)) { const tr = el.textContent.trim(); const tn=[...el.childNodes].find(c=>c.nodeType===3&&c.textContent.trim()); if (tn && tr && !LIBRES.has(tr.toUpperCase()) && !NOMBRES.includes(tr)) { const f=nombreFalso(tr); if (tn.textContent.trim()!==f) tn.textContent = f; }
        const av = el.closest && el.closest('[class*=cell-wrapper]'); const a = av && av.querySelector('[class*=avatar]'); const atn = a && [...a.childNodes].find(c=>c.nodeType===3&&c.textContent.trim()); if (atn) { const nm=el.textContent.trim(); const want = LIBRES.has(nm.toUpperCase()) ? atn.textContent.trim() : iniciales(nm); if (atn.textContent.trim() !== want) atn.textContent = want; } continue; }
      for (const ch of el.childNodes) if (ch.nodeType === 3) fixText(ch);
    }
  }
  window.__scrubMapa = mapa;
  window.__scrubAhora = () => { try { walk(document); } catch(e){} };
  setInterval(window.__scrubAhora, 120);
})();
