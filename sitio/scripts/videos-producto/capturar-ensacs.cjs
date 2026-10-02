// Capturas para la sección «Así se ve en Sacs» de /producto/<slug> (componente ProductEnSacs.astro).
// Uso: CUENTA=… node capturar-ensacs.cjs <config.cjs>
// La config exporta { slug, pantallas: [{ id, abrir: async (r, h) => {}, maxAlto }], pasos: [{ p, ancla, t, d, sube? }] }.
// Sale: public/images/producto/<slug>/<id>.webp (1440 de ancho, alto completo) + <slug>-ensacs.json con los rectángulos.
const { abrir } = require('./rec.cjs'); const prep = require('./prep.cjs');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
(async () => {
  const cfg = require(path.resolve(process.argv[2]));
  const OUT = path.resolve(__dirname, '../../public/images/producto', cfg.slug); fs.mkdirSync(OUT, { recursive: true });
  const r = await abrir(1440, 900); const { p } = r;
  const sleep = (ms) => p.waitForTimeout(ms);
  const alto = () => p.evaluate(() => { let max = document.documentElement.scrollHeight; for (const el of document.querySelectorAll('*')) { if (el.scrollHeight > el.clientHeight + 20 && el.clientHeight > 200) { const st = getComputedStyle(el); if (/(auto|scroll)/.test(st.overflowY)) max = Math.max(max, el.scrollHeight + el.getBoundingClientRect().top); } } return Math.ceil(max); });
  const res = { pantallas: [], pasos: [] };
  for (const pa of cfg.pantallas) {
    if (pa.altoFijo) await p.setViewportSize({ width: 1440, height: pa.altoFijo });
    await pa.abrir(r, { prep, sleep });
    if (pa.dice) await r.esperaTexto(pa.dice, 120000);
    await prep.menuColapsado(r); await prep.ocultarFlotantes(r); for (const a of (cfg.avisos || [])) await prep.ocultarAviso(r, a); for (const t of (cfg.ocultar || [])) await prep.ocultarTexto(r, t); await sleep(1500);
    const h = pa.altoFijo || Math.min(Math.max((await alto()) + 24, 900), pa.maxAlto || 3800);
    if (!pa.altoFijo) { await p.setViewportSize({ width: 1440, height: h }); await sleep(3500); }
    if (pa.dice) await r.esperaTexto(pa.dice, 120000).catch(() => console.log('⚠ no reapareció', pa.dice)); await sleep(1500);
    await prep.ocultarFlotantes(r); for (const a of (cfg.avisos || [])) await prep.ocultarAviso(r, a); for (const t of (cfg.ocultar || [])) await prep.ocultarTexto(r, t); await sleep(800);
    const png = path.join(OUT, pa.id + '.png');
    const shot = await p.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1440, height: h, scale: 1 } }).catch(() => p.screenshot({ type: 'png' }));
    fs.writeFileSync(png, shot);
    // rectángulos de los pasos de esta pantalla: el contenedor «tarjeta» más cercano al ancla
    for (const st of cfg.pasos.filter((s) => s.p === pa.id)) {
      const rect = await p.evaluate(([t, sube, minW]) => {
        let hit = null; const w = (root) => root.querySelectorAll('*').forEach((el) => { if (hit) return; if (el.shadowRoot) w(el.shadowRoot); const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').replace(/\s+/g, ' ').trim(); if (own && own.toLowerCase().startsWith(t.toLowerCase()) && el.getBoundingClientRect().width > 0) hit = el; }); w(document);
        if (!hit) return null;
        let e = hit; for (let i = 0; i < (sube || 12) && e; i++) { const b = e.getBoundingClientRect(); if (b.width >= (minW || 500) && b.height >= 60) break; e = e.parentElement || (e.getRootNode() && e.getRootNode().host); }
        const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.right), Math.round(b.bottom + scrollY)];
      }, [st.ancla, st.sube, st.minW]);
      if (!rect) console.log('⚠ sin ancla', st.ancla);
      res.pasos.push({ p: st.p, r: st.r || rect || [80, 80, 1360, 600], t: st.t, d: st.d });
    }
    execSync(`python3 -c "from PIL import Image; im=Image.open('${png}').convert('RGB'); im.save('${png.replace('.png', '.webp')}','WEBP',quality=80,method=6); print(im.size)"`, { stdio: 'inherit' });
    fs.unlinkSync(png);
    res.pantallas.push({ id: pa.id, img: `/images/producto/${cfg.slug}/${pa.id}.webp`, h, t: pa.t, alt: pa.alt });
    console.log('ok', pa.id, h);
    await p.setViewportSize({ width: 1440, height: 900 }); await sleep(800);
  }
  // los pasos en el orden de la config
  res.pasos.sort((a, b) => cfg.pasos.findIndex((s) => s.t === a.t) - cfg.pasos.findIndex((s) => s.t === b.t));
  fs.writeFileSync(path.join(__dirname, cfg.slug + '-ensacs.json'), JSON.stringify({ modulo: cfg.modulo, nota: cfg.nota, ...res }, null, 1));
  console.log('LISTO', cfg.slug, res.pasos.length, 'pasos');
  await r.cerrar();
})().catch((e) => { console.error('FALLO', e.message); process.exit(1); });
