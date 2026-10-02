// Captura FORECASTING (Demand Planning · 2) del sistema local para «Así se ve en Sacs» — SOLO ESCRITORIO: la vista de
// teléfono de app.sacscloud.com está descontinuada (regla del dueño, 2-oct-2026), así que aquí no hay modo celular.
// Solo lectura: nunca toca «Guardar borrador» ni «Aprobar plan». Red fija en Polanco Boutique y sin nada de MAJA.
// Uso: QA_USER=… QA_PASS=… node captura-forecasting.cjs [reconocer|capturar] [salida]
const { entrar, ir, sleep, texto, espera } = require('./comun.cjs');
const path = require('path'), fs = require('fs');
const MODO = process.argv[2] || 'reconocer';
const S = process.argv[3] || path.join(__dirname, 'salida');
fs.mkdirSync(S, { recursive: true });
const VP = { width: 1440, height: 900 };
const MARCAS = ['Desigual', 'Zara', 'Mango', "Levi's", 'Nike', 'Adidas', 'MAJA', 'H&M', 'Bershka', 'Guess', 'Tommy', 'Calvin Klein', 'Lacoste', 'Shein', 'Puma', 'Under Armour', 'Liverpool', 'Palacio de Hierro', 'Suburbia', 'Coppel', 'Flexi', 'Andy Araujo', 'Araujo'];

async function enmascara(p) {
  // MAJA es un prospecto: ni su red ni su nombre salen en la web (dueño, 2-oct-2026). Se ocultan sus botones y chips.
  await p.evaluate(() => {
    document.querySelectorAll('[data-red="MAJA"]').forEach((el) => { el.style.display = 'none'; });
    document.querySelectorAll('button, .chip, [role="tab"]').forEach((el) => { if (/\bMAJA\b/.test(el.innerText || '')) el.style.display = 'none'; });
  });
  return p.evaluate(() => {
    const CAMBIOS = [[/DESIGUAL/g, 'ATELIER COSTA'], [/Desigual/g, 'Atelier Costa'], [/Andy Araujo/g, 'Andrea Ruiz']];
    const arreglaMayus = (t) => t.replace(/[A-Za-zÁÉÍÓÚÑáéíóúñ]+/g, (w) => (/[a-záéíóúñ]/.test(w) ? w.replace(/(?<=.)([ÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]*)/g, (m) => m.toLowerCase()) : w));
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodos = []; while (w.nextNode()) nodos.push(w.currentNode);
    nodos.forEach((n) => { let t = n.nodeValue, o = t; CAMBIOS.forEach(([a, b]) => { t = t.replace(a, b); }); t = arreglaMayus(t); if (t !== o) n.nodeValue = t; });
    return /\bMAJA\b/.test(document.body.innerText);
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

(async () => {
  // «capturar» va a 2x: la ventana de escritorio se reduce a 1440 y los recortes del teléfono salen nítidos
  const { b, p } = await entrar(VP, MODO === 'capturar' ? 2 : 1);
  const ok = await ir(p, 'forecasting/index', 'Forecasting', 180000);
  // el detalle de la temporada se calcula al entrar: se espera a que salgan la compra y el reparto
  await espera(p, async () => { const t = await texto(p); return /Compra/.test(t) && /Reparto/.test(t) && !/Calculando|Recalculando|Cargando/.test(t); }, 240000);
  await sleep(4000);
  const quedaMaja = await enmascara(p);
  const h = Math.min(Math.max((await alto(p)) + 24, VP.height), 9000);
  await p.setViewportSize({ width: VP.width, height: h }); await sleep(3000);
  await enmascara(p);
  {
    // títulos y bloques con su posición, para escoger las zonas de cada paso
    const mapa = await p.evaluate(() => [...document.querySelectorAll('h1, h2, h3, h4, .chip, .stat, .pasos-f, svg')]
      .filter((el) => el.getBoundingClientRect().width > 40)
      .map((el) => { const r = el.getBoundingClientRect(); return `${Math.round(r.top + scrollY)}\t${Math.round(r.left)}-${Math.round(r.right)}×${Math.round(r.height)}\t${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}\t${(el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 90)}`; }));
    fs.writeFileSync(`${S}/forecasting-mapa.txt`, mapa.join('\n'));
  }
  await p.screenshot({ path: `${S}/forecasting-escritorio.png` });
  const t = await texto(p);
  const hallados = MARCAS.filter((m) => t.toLowerCase().includes(m.toLowerCase()));
  console.log('ruta:', ok ? 'ok' : 'NO CARGÓ', '· alto:', h, '· MAJA visible:', quedaMaja ? '⚠ SÍ' : 'no', '·', hallados.length ? '⚠ marcas: ' + hallados.join(', ') : 'sin marcas');
  await b.close();
})();
