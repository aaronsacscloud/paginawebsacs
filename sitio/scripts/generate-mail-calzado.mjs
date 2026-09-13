// Las 8 imágenes de los correos ABM del giro «calzado» (expositores de SAPICA,
// León). Van a /images/mail/ a 600×300, el mismo tamaño que las de novias y
// mayoristas, porque el armador de HTML (lib/crm/abm-correo.ts) las pinta a
// 600 de ancho.
//   node scripts/generate-mail-calzado.mjs            (las que falten)
//   node scripts/generate-mail-calzado.mjs 3-foto     (fuerza una)
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import sharp from 'sharp';

const SITIO = path.resolve(new URL('.', import.meta.url).pathname, '..');
const OUT = path.join(SITIO, 'public/images/mail');
if (!process.env.OPENAI_API_KEY) {
  for (const f of [path.join(process.env.HOME, '.openai-images.key'), '/opt/sacs/sacs_api/.env', path.join(SITIO, '.env')]) {
    try {
      const t = await fs.readFile(f, 'utf8');
      const m = f.endsWith('.key') ? [null, t.trim()] : t.match(/^OPENAI_API_KEY=["']?([^"'\n]+)/m);
      if (m?.[1]) { process.env.OPENAI_API_KEY = m[1]; break; }
    } catch { /* no está */ }
  }
}

// Mismo estilo documental de las de novias y mayoristas; aquí el mundo es la
// fábrica y marca de calzado de León: la bodega de producto terminado con cajas
// de zapatos apiladas por número, el showroom con el muestrario de la temporada,
// la tienda de fábrica. Cualquier pantalla enseña una interfaz de Sacs, nunca
// vacía.
const ESTILO = `Photorealistic documentary photograph, real Mexican people with natural skin texture, soft bright natural light mixed with warm tungsten, slight film grain, candid gesture caught mid-action, editorial trade photography. A footwear FACTORY BRAND in León, Guanajuato, Mexico: the finished-goods warehouse with tall metal shelves of stacked shoe boxes sorted by size, a showroom with the season's sample shoes on wooden shelves (boots, leather loafers, women's heels, sneakers), cardboard master cartons, a factory outlet counter. Any screen shows a clean purple-accented retail software interface called Sacs (a size-by-color grid of a shoe model, a price list with three tiers, an orders list) rendered soft and NOT legible; no other text, no logos, no readable words anywhere. Hands anatomically correct with five separated fingers. Keep the subject in the vertical center: the image will be cropped to a 2:1 banner.`;

const FOTOS = {
  '1-presentacion': `The owner of a footwear brand (Mexican man, 48, shirt with rolled sleeves) in his showroom, handing a leather boot to a shoe-store buyer (woman, 40) who is checking a tablet glowing with Sacs; wooden shelves of the season's sample shoes behind them, a stack of shoe boxes on the table.`,
  '2-corrida': `Warehouse aisle of a shoe factory: tall shelves of identical shoe boxes with size labels, several gaps where the middle sizes are missing, a worker (man, 35) holding one box and checking a tablet glowing with a Sacs size-by-color grid; natural side light from a high window.`,
  '3-foto': `A young employee (woman, 25) in the showroom photographing a women's leather ankle boot on a white pedestal with her phone; the phone screen glows purple with a product card forming in Sacs; the same boot in every color lined up beside her on the shelf.`,
  '4-pedidos': `Shipping area of a shoe factory: a worker (man, 30) packing a dozen shoe boxes into a large cardboard master carton for a shoe store, a printed packing slip on top (not legible), a tablet propped on a shelf glowing with a Sacs orders list; cartons labeled with tape around him.`,
  '5-precios': `Close-up at the factory outlet counter: a vendor's hands (woman, 32) holding a tablet glowing with a Sacs price list of three tiers, next to an open shoe box with a pair of leather loafers and a price tag; a customer's hand pointing at the shoe; shallow depth of field.`,
  '6-credito': `At the showroom desk, the owner (man, 50) showing a shoe-store client (woman, 45) an account statement on a tablet glowing purple; she is holding colorful Mexican peso banknotes (blue 500 and red 100 tones), her order of shoe boxes stacked beside her; both relaxed and friendly.`,
  '7-caso': `In the finished-goods warehouse between tall shelves of shoe boxes, the owner (woman, 46) and a consultant (man, 34) looking together at a laptop on a stack of master cartons, the laptop glowing with Sacs bar charts; she points at the screen with a thoughtful expression.`,
  '8-cierre': `A shoe factory showroom at dusk seen from the street door, the metal shutter halfway down, warm light inside over shelves of sample boots and loafers and boxes ready for the next day, the owner (man, 42) inside tidying the desk; quiet, end-of-day, the door still open.`,
};

const openai = new OpenAI();
await fs.mkdir(OUT, { recursive: true });
const pedidas = process.argv.slice(2);

async function una(nombre) {
  const salida = path.join(OUT, `calzado-${nombre}.jpg`);
  if (!pedidas.length) { try { await fs.access(salida); console.log(`✓ ya está ${nombre}`); return; } catch { /* falta */ } }
  console.log(`→ ${nombre}…`);
  try {
    const r = await openai.images.generate({ model: 'gpt-image-2', prompt: `${FOTOS[nombre]}\n\n${ESTILO}`, size: '1536x1024', quality: 'high' });
    const b64 = r.data?.[0]?.b64_json; if (!b64) throw new Error('sin b64');
    await sharp(Buffer.from(b64, 'base64')).resize(600, 300, { fit: 'cover', position: 'centre' }).jpeg({ quality: 80, mozjpeg: true }).toFile(salida);
    console.log(`  ✓ calzado-${nombre}.jpg · ${((await fs.stat(salida)).size / 1024).toFixed(0)} KB`);
  } catch (e) { console.error(`  ✗ ${nombre}:`, e?.message || e); }
}
const lista = pedidas.length ? pedidas : Object.keys(FOTOS);
for (let i = 0; i < lista.length; i += 4) await Promise.all(lista.slice(i, i + 4).map(una));
console.log('listo');
