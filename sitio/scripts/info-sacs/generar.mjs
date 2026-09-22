// Genera public/info/sacs-informacion.pdf a partir de info-sacs.html.
//
//   node scripts/info-sacs/generar.mjs            → solo el PDF
//   node scripts/info-sacs/generar.mjs --png DIR  → además, una PNG por página en DIR (para QA)
//
// El HTML se puede abrir tal cual en el navegador (usa rutas ../../public/...).
// Aquí cada foto se reduce y se pasa a JPEG (sharp) y cada fuente se incrusta,
// para que el PDF quede ligero y no dependa de archivos externos.
// Una foto puede pedir más resolución con ?w=1600 al final de su ruta.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';

const aqui = dirname(fileURLToPath(import.meta.url));
const sitio = resolve(aqui, '../..');
const salida = resolve(sitio, 'public/info/sacs-informacion.pdf');
const ANCHO_DEFAULT = 1000;
const CALIDAD = 72;

const args = process.argv.slice(2);
const dirPng = args.includes('--png') ? resolve(args[args.indexOf('--png') + 1]) : null;

let html = await readFile(resolve(aqui, 'info-sacs.html'), 'utf8');

const cache = new Map();
async function aDataUri(ref) {
  if (cache.has(ref)) return cache.get(ref);
  const [ruta, query = ''] = ref.split('?');
  const archivo = resolve(aqui, ruta);
  let uri;
  if (/\.(woff2)$/i.test(ruta)) {
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

const refs = [...new Set(html.match(/\.\.\/\.\.\/public\/(?:images|fonts)\/[^"')\s]+/g) || [])];
for (const ref of refs) {
  const uri = await aDataUri(ref);
  html = html.split(ref).join(uri);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

await mkdir(dirname(salida), { recursive: true });
await page.pdf({ path: salida, format: 'A4', printBackground: true, preferCSSPageSize: true });

if (dirPng) {
  await mkdir(dirPng, { recursive: true });
  await page.setViewportSize({ width: 794, height: 1123 });
  const paginas = await page.$$('.page');
  for (let i = 0; i < paginas.length; i++) {
    await paginas[i].screenshot({ path: resolve(dirPng, `pagina-${i + 1}.png`) });
  }
}
await browser.close();

const { size } = await import('node:fs').then((fs) => fs.promises.stat(salida));
console.log(`${salida}  ${(size / 1024 / 1024).toFixed(2)} MB  (${refs.length} recursos incrustados)`);
