// Utilidades para las capturas de Fidelización (Polanco Boutique · andyaraujoconsultorias)
const prep = require('./prep.cjs');
const promo = async (r) => { for (const t of ['Ahora no', 'No me interesa']) { if (await r.hayTexto(t)) { try { await clic(r, t); } catch (e) {} await r.p.waitForTimeout(1200); return; } } };
const ir = async (r, item, esp) => { await r.go('dashboard/list/index', 'Ingresos'); await r.p.waitForTimeout(2500); await promo(r); await prep.abrirMenu(r, 'Fidelización', item, esp); await r.p.waitForTimeout(3000); await prep.menuColapsado(r); await prep.ocultarFlotantes(r); await r.p.waitForTimeout(1200); };
// clic DOM en el texto exacto (opcional: zona x/y)
const clic = async (r, t, { espera, xmin = 0, xmax = 1e9, ymin = 0, ymax = 1e9 } = {}) => {
  const ok = await r.p.evaluate(([t, a, b, c, d]) => { let hit = null; const w = (root) => root.querySelectorAll('*').forEach((el) => { if (hit) return; if (el.shadowRoot) w(el.shadowRoot); const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim(); if (own === t) { const bb = el.getBoundingClientRect(); if (bb.width > 0 && bb.x >= a && bb.x <= b && bb.y >= c && bb.y <= d) hit = el; } }); w(document); if (!hit) return false; hit.scrollIntoView({ block: 'center' }); hit.click(); return true; }, [t, xmin, xmax, ymin, ymax]);
  if (!ok) throw new Error('no encontré ' + t);
  if (espera) await r.esperaTexto(espera, 150000);
  await r.p.waitForTimeout(3000); await prep.ocultarFlotantes(r);
};
// oculta la «tarjeta» o renglón que contiene el texto: sube hasta un contenedor de ancho entre min y max
const ocultarCaja = async (r, t, { min = 150, max = 2000, alto = 900 } = {}) => r.p.evaluate(([t, min, max, alto]) => { let n = 0; const w = (root) => root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) w(el.shadowRoot); const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').replace(/\s+/g, ' ').trim(); if (own === t) { let e = el, sel = null; for (let i = 0; i < 14 && e; i++) { const b = e.getBoundingClientRect(); if (b.width >= min && b.width <= max && b.height <= alto) sel = e; if (b.width > max || b.height > alto) break; e = e.parentElement || (e.getRootNode() && e.getRootNode().host); } if (sel) { sel.style.setProperty('display', 'none', 'important'); n++; } } }); w(document); return n; }, [t, min, max, alto]);
const escribir = async (r, placeholder, texto) => { const ok = await r.p.evaluate(([ph, tx]) => { let hit = null; const w = (root) => root.querySelectorAll('input').forEach((i) => { if (!hit && (i.placeholder || '').startsWith(ph) && i.getBoundingClientRect().width > 0) hit = i; }); const ww = (root) => { w(root); root.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) ww(e.shadowRoot); }); }; ww(document); if (!hit) return false; hit.focus(); return true; }, [placeholder, texto]); if (!ok) throw new Error('sin input ' + placeholder); await r.p.keyboard.type(texto, { delay: 40 }); await r.p.waitForTimeout(3500); };
module.exports = { ir, clic, ocultarCaja, escribir, prep, promo };
// reemplaza texto en pantalla (copys de otro giro, p. ej. «joyero» → «taller»)
module.exports.reemplazar = async (r, pares) => r.p.evaluate((pares) => { const w = (root) => { const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); while (tw.nextNode()) { const n = tw.currentNode; let t = n.nodeValue, o = t; for (const [a, b] of pares) t = t.split(a).join(b); if (t !== o) n.nodeValue = t; } root.querySelectorAll('input,textarea').forEach((i) => { let v = i.value, o = v; for (const [a, b] of pares) v = v.split(a).join(b); if (v !== o) i.value = v; }); root.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) w(e.shadowRoot); }); }; w(document.body); }, pares);
// deja visible solo el contenedor del texto `t` (oculta los hermanos de cada ancestro) y lo sube al inicio
module.exports.aislar = async (r, t, minW = 500, minH = 0) => r.p.evaluate(([t, minW, minH]) => {
  let hit = null; const w = (root) => root.querySelectorAll('*').forEach((el) => { if (hit) return; if (el.shadowRoot) w(el.shadowRoot); const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').replace(/\s+/g, ' ').trim(); if (own.startsWith(t) && el.getBoundingClientRect().width > 0) hit = el; }); w(document);
  if (!hit) return false;
  let e = hit; while (e && (e.getBoundingClientRect().width < minW || e.getBoundingClientRect().height < minH)) e = e.parentElement || (e.getRootNode() && e.getRootNode().host);
  let c = e; while (c && c !== document.body) { const par = c.parentElement || (c.getRootNode() && c.getRootNode().host); if (!par) break; const hijos = c.parentElement ? [...c.parentElement.children] : [...c.getRootNode().children]; hijos.forEach((h) => { if (h !== c && !['STYLE', 'SCRIPT', 'TEMPLATE'].includes(h.tagName)) h.style.setProperty('display', 'none', 'important'); }); c = par; }
  e.scrollIntoView({ block: 'start' }); document.querySelectorAll('*').forEach((x) => { if (x.scrollTop) x.scrollTop = 0; }); return true;
}, [t, minW, minH]);
// clic por coordenadas en el texto (para encabezados de acordeón)
module.exports.clicXY = async (r, t, o) => { const [x, y] = await r.punto(t, o); await r.p.mouse.click(x, y); await r.p.waitForTimeout(2500); };
// nombres de clientes reales a ocultar en las listas: viven en fijos.local.json (fuera de git)
module.exports.reales = () => { try { return require('./fijos.local.json').__ocultarClientes || []; } catch (e) { return []; } };
