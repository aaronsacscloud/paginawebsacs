// Captura las pantallas reales del módulo Demand Planning (local, solo lectura) para la sección «Así se ve en Sacs» de
// /planeacion-de-demanda (src/components/planeacion/PdEnSacs.astro), con la red Polanco Boutique (demo ficticia).
// MAJA es un prospecto: su red se oculta y la captura avisa si queda algo suyo en pantalla. Las imágenes del sitio
// (public/images/planeacion/sacs/*.webp) se recortan de estas capturas: ver los recortes en PdEnSacs.astro.
// Uso: QA_USER=… QA_PASS=… node captura.cjs escritorio|celular [carpeta de salida]
const { entrar, ir, sleep, texto, espera } = require('./comun.cjs');
const S = process.argv[3] || require('path').join(__dirname, 'salida');
require('fs').mkdirSync(S, { recursive: true });
const MODO = process.argv[2] || 'escritorio';
const [VP, DPR] = MODO === 'celular' ? [{ width: 390, height: 844 }, 2] : [{ width: 1440, height: 900 }, 1];
const MARCAS = ['Desigual', 'Zara', 'Mango', "Levi's", 'Levis', 'Nike', 'Adidas', 'MAJA', 'H&M', 'Bershka', 'Pull&Bear', 'Guess', 'Tommy', 'Calvin Klein', 'Lacoste', 'Massimo Dutti', 'Oysho', 'Stradivarius', 'Shein', 'Puma', 'Under Armour', 'Columbia', 'Skechers', 'Vans', 'Converse', 'Reebok', 'Lululemon', 'Old Navy', 'American Eagle', 'Abercrombie', 'Hollister', 'Forever 21', 'Liverpool', 'Palacio de Hierro', 'Suburbia', 'Coppel', 'C&A', 'Cuidado con el Perro', 'Price Shoes', 'Flexi', 'Pirma', 'Charly', 'Andy Araujo', 'Araujo'];

async function enmascara(p) {
  // MAJA es un prospecto: su red no sale en la web ni renombrada (dueño, 2-oct-2026). Se oculta su botón del selector.
  await p.evaluate(() => document.querySelectorAll('[data-red="MAJA"]').forEach((el) => { el.style.display = 'none'; }));
  const antes = await texto(p);
  if (/MAJA/i.test(antes)) console.log('⚠ queda «MAJA» visible antes de enmascarar');
  await p.evaluate(() => {
    const CAMBIOS = [[/\bMAJA\b/g, 'Ruta Sport'], [/DESIGUAL/g, 'ATELIER COSTA'], [/Desigual/g, 'Atelier Costa'], [/Andy Araujo/g, 'Andrea Ruiz']];
    // «Del BajÍO», «TÉCnicos», «PacÍFico»: dentro de una palabra con minúsculas, la mayúscula acentuada y las que siguen
    const arreglaMayus = (t) => t.replace(/[A-Za-zÁÉÍÓÚÑáéíóúñ]+/g, (w) => (/[a-záéíóúñ]/.test(w) ? w.replace(/(?<=.)([ÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]*)/g, (m) => m.toLowerCase()) : w));
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodos = []; while (w.nextNode()) nodos.push(w.currentNode);
    nodos.forEach((n) => { let t = n.nodeValue, o = t; CAMBIOS.forEach(([a, b]) => { t = t.replace(a, b); }); t = arreglaMayus(t); t = t.replace(/\bDel\b/g, 'del'); if (t !== o) n.nodeValue = t; });
    document.querySelectorAll('input').forEach((i) => { if (/MAJA/.test(i.value)) i.value = i.value.replace(/MAJA/g, 'Ruta Sport'); });
  });
}
async function alto(p) {
  return p.evaluate(() => {
    let max = document.documentElement.scrollHeight;
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollHeight > el.clientHeight + 20 && el.clientHeight > 200) {
        const st = getComputedStyle(el);
        if (/(auto|scroll)/.test(st.overflowY)) max = Math.max(max, el.scrollHeight + el.getBoundingClientRect().top);
      }
    }
    return Math.ceil(max);
  });
}
async function foto(p, id, maxAlto) {
  await enmascara(p);
  const h = Math.min(Math.max((await alto(p)) + 24, VP.height), maxAlto || (MODO === 'celular' ? 4600 : 3800));
  await p.setViewportSize({ width: VP.width, height: h }); await sleep(2500);
  await enmascara(p);
  await p.screenshot({ path: `${S}/${id}-${MODO}.png` });
  const t = await texto(p);
  const hallados = MARCAS.filter((m) => t.toLowerCase().includes(m.toLowerCase()));
  console.log('ok', id, MODO, h, hallados.length ? '⚠ marcas: ' + hallados.join(', ') : 'sin marcas');
  await p.setViewportSize(VP); await sleep(800);
}
(async () => {
  const { b, p } = await entrar(VP, DPR);
  for (const [id, ruta, dice] of [
    ['resumen', 'reglas/resumen', 'Tu configuración'],
    ['reglas', 'reglas/reglas', 'Automático'],
    ['temporadas', 'temporadas/x', 'Cada temporada'],
    ['tablero', 'tablero/x', 'Tablero de moda'],
  ]) {
    const ok = await ir(p, ruta, dice);
    if (!ok) { console.log('no cargó', id); continue; }
    await foto(p, id);
  }
  // la Mesa de «Nivelación Buen Fin · toda la red» (Polanco Boutique)
  if (await ir(p, 'nivelaciones/x', 'Nivelación Buen Fin')) {
    const fila = p.locator('text=Nivelación Buen Fin').first();
    const tarjeta = fila.locator('xpath=ancestor::*[.//*[contains(normalize-space(.), "Revisar")]][1]');
    const boton = tarjeta.getByText('Revisar').first();
    await boton.click();
    const ok = await espera(p, async () => { const t = await texto(p); return t.includes('Aprobar') && !t.includes('Cargando módulo'); }, 150000);
    await sleep(4000);
    if (ok) await foto(p, 'mesa', MODO === 'celular' ? 3600 : 2600); else console.log('no cargó la mesa');
  }
  await b.close();
})();
