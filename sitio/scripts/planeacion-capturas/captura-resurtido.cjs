// Captura las pantallas del RESURTIDO del módulo Demand Planning (local, solo lectura) para «Así se ve en Sacs»:
// «Tus nivelaciones» (sin la de MAJA, con los totales de las tres de Polanco) y «Talla × tienda» del primer modelo de
// la «Nivelación Buen Fin · toda la red». Uso: QA_USER=… QA_PASS=… node captura-resurtido.cjs escritorio|celular [salida]
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

async function sinMaja(p) {
  await p.evaluate(() => {
    // la fila de la nivelación de MAJA: se sube desde su título hasta el renglón de la lista y se quita
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; const hits = [];
    while ((n = w.nextNode())) if (/red MAJA/.test(n.nodeValue)) hits.push(n.parentElement);
    hits.forEach((el) => {
      let fila = el;
      while (fila.parentElement && !/Reparto de jeans|Vestidos y blusas/.test(fila.parentElement.innerText || '')) fila = fila.parentElement;
      fila.remove();
    });
    // los totales, solo con las 3 nivelaciones de Polanco por aprobar (199 + 1,074 + 427 piezas; $111,894 + $850,950 + $246,610)
    const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while ((n = w2.nextNode())) {
      if (/4 nivelaciones esperan tu revisión/.test(n.nodeValue)) n.nodeValue = '3 nivelaciones esperan tu revisión: 1,700 piezas y $1,209,454 a costo.';
    }
    document.querySelectorAll('button, a, [role="tab"]').forEach((b) => {
      const t = (b.innerText || '').replace(/\s+/g, ' ').trim();
      const cambia = (de, a) => { const w3 = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let m; while ((m = w3.nextNode())) if (m.nodeValue.trim() === de) { m.nodeValue = m.nodeValue.replace(de, a); break; } };
      if (/^Todas 5$/.test(t)) cambia('5', '4');
      if (/^Por aprobar 4$/.test(t)) cambia('4', '3');
    });
    // «1 piezas · 1 piezas» del borrador de compra
    const w4 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while ((n = w4.nextNode())) if (/1 piezas · 1 piezas/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace('1 piezas · 1 piezas', '1 pieza');
  });
}
(async () => {
  const { b, p } = await entrar(VP, DPR);
  if (await ir(p, 'nivelaciones/x', 'Nivelación Buen Fin')) { await sinMaja(p); await foto(p, 'nivelaciones', MODO === 'celular' ? 3400 : 1500); }
  const tarjeta = p.locator('text=Nivelación Buen Fin').first().locator('xpath=ancestor::*[.//*[contains(normalize-space(.), "Revisar")]][1]');
  await tarjeta.getByText('Revisar').first().click();
  await espera(p, async () => (await texto(p)).includes('Aprobar'), 150000); await sleep(4000);
  await p.getByText('Talla × tienda').first().click(); await sleep(6000);
  await sinMaja(p);
  await foto(p, 'talla-tienda', MODO === 'celular' ? 3600 : 1300);
  await b.close();
})();
