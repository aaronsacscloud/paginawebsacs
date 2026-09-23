// Genera los tres PDF "por caso" que acompañan a sacs-informacion.pdf:
//
//   precios.html → public/info/sacs-precios.pdf         (planes y precios)
//   cambio.html  → public/info/sacs-cambiate.pdf        (¿ya tienes sistema?)
//   demo.html    → public/info/sacs-demo-arranque.pdf   (la demo y el arranque)
//
//   node scripts/info-sacs/generar-casos.mjs                 → los tres PDF
//   node scripts/info-sacs/generar-casos.mjs precios         → solo uno (precios | cambio | demo)
//   node scripts/info-sacs/generar-casos.mjs --png DIR       → además, una PNG por página en DIR (QA)
//
// Mismo método que generar.mjs: cada HTML se abre tal cual en el navegador
// (rutas ../../public/...); aquí cada foto se reduce y se pasa a JPEG (sharp)
// y cada fuente se incrusta, para que el PDF quede ligero y autosuficiente.
// Una foto puede pedir más resolución con ?w=1600 al final de su ruta.

import { readFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';

const aqui = dirname(fileURLToPath(import.meta.url));
const sitio = resolve(aqui, '../..');
const ANCHO_DEFAULT = 1000;
const CALIDAD = 72;

const CASOS = {
  precios: { html: 'precios.html', pdf: 'public/info/sacs-precios.pdf' },
  cambio: { html: 'cambio.html', pdf: 'public/info/sacs-cambiate.pdf' },
  demo: { html: 'demo.html', pdf: 'public/info/sacs-demo-arranque.pdf' },
};

const args = process.argv.slice(2);
const iPng = args.indexOf('--png');
const dirPng = iPng >= 0 ? resolve(args[iPng + 1]) : null;
const pedidos = args.filter((a, i) => !a.startsWith('--') && !(iPng >= 0 && i === iPng + 1));
const elegidos = pedidos.length ? pedidos : Object.keys(CASOS);
for (const n of elegidos) if (!CASOS[n]) throw new Error(`Caso desconocido: ${n} (usa ${Object.keys(CASOS).join(' | ')})`);

const cache = new Map();
async function aDataUri(ref) {
  if (cache.has(ref)) return cache.get(ref);
  const [ruta, query = ''] = ref.split('?');
  const archivo = resolve(aqui, ruta);
  let uri;
  if (/\.woff2$/i.test(ruta)) {
    uri = `data:font/woff2;base64,${(await readFile(archivo)).toString('base64')}`;
  } else if (/\.(png|svg)$/i.test(ruta) && /wordmark|icon/.test(ruta)) {
    const buf = await readFile(archivo);
    uri = `data:image/${ruta.endsWith('.svg') ? 'svg+xml' : 'png'};base64,${buf.toString('base64')}`;
  } else {
    const w = Number(new URLSearchParams(query).get('w')) || ANCHO_DEFAULT;
    const buf = await sharp(archivo)
      .resize({ width: w, withoutEnlargement: true })
      .jpeg({ quality: CALIDAD, mozjpeg: true })
      .toBuffer();
    uri = `data:image/jpeg;base64,${buf.toString('base64')}`;
  }
  cache.set(ref, uri);
  return uri;
}

const browser = await chromium.launch();
try {
  for (const nombre of elegidos) {
    const { html: fuente, pdf } = CASOS[nombre];
    const salida = resolve(sitio, pdf);
    let html = await readFile(resolve(aqui, fuente), 'utf8');
    const refs = [...new Set(html.match(/\.\.\/\.\.\/public\/(?:images|fonts)\/[^"')\s]+/g) || [])];
    for (const ref of refs) html = html.split(ref).join(await aDataUri(ref));

    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    await mkdir(dirname(salida), { recursive: true });
    await page.pdf({ path: salida, format: 'A4', printBackground: true, preferCSSPageSize: true });

    const paginas = await page.$$('.page');
    if (dirPng) {
      await mkdir(dirPng, { recursive: true });
      for (let i = 0; i < paginas.length; i++) {
        await paginas[i].screenshot({ path: resolve(dirPng, `${nombre}-${i + 1}.png`) });
      }
    }
    await page.close();

    const { size } = await stat(salida);
    console.log(`${salida}  ${(size / 1024 / 1024).toFixed(2)} MB  ${paginas.length} págs  (${refs.length} recursos)`);
  }
} finally {
  await browser.close();
}
